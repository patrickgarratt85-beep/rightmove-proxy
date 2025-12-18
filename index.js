const express = require('express');
const https = require('https');

const app = express();
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'rightmove-proxy' });
});

// Proxy endpoint
app.post('/proxy', async (req, res) => {
  try {
    const { url, method, headers, body } = req.body;
    
    console.log(`Proxying ${method} request to: ${url}`);
    
    // Create HTTPS agent with client certificate (PFX/P12 format)
    const agent = new https.Agent({
      pfx: Buffer.from(process.env.RIGHTMOVE_P12_BASE64, 'base64'),
      passphrase: process.env.RIGHTMOVE_P12_PASSPHRASE,
      rejectUnauthorized: true
    });
    
    const parsedUrl = new URL(url);
    const requestBody = JSON.stringify(body);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method || 'POST',
      agent: agent,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };
    
    const proxyReq = https.request(options, (proxyRes) => {
      let data = '';
      proxyRes.on('data', chunk => data += chunk);
      proxyRes.on('end', () => {
        console.log(`Rightmove response status: ${proxyRes.statusCode}`);
        console.log(`Rightmove response body: ${data}`);
        res.status(proxyRes.statusCode).send(data);
      });
    });
    
    proxyReq.on('error', (error) => {
      console.error('Proxy request error:', error.message);
      res.status(500).json({ 
        status: 'error', 
        message: error.message,
        code: error.code 
      });
    });
    
    proxyReq.write(requestBody);
    proxyReq.end();
    
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Rightmove proxy listening on port ${PORT}`);
});
