const express = require('express');
const https = require('https');

const app = express();
app.use(express.json({ limit: '10mb' }));

const RIGHTMOVE_URL = 'https://adfapi.rightmove.co.uk/v1/property/sendpropertydetails';

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'rightmove-proxy' });
});

app.post('/proxy', (req, res) => {
  try {
    const { payload, test_mode } = req.body;
    
    console.log('Received payload:', JSON.stringify(payload).substring(0, 200));
    
    const agent = new https.Agent({
      pfx: Buffer.from(process.env.RIGHTMOVE_P12_BASE64, 'base64'),
      passphrase: process.env.RIGHTMOVE_P12_PASSPHRASE,
      rejectUnauthorized: true
    });
    
    const requestBody = JSON.stringify(payload);
    
    const options = {
      hostname: 'adfapi.rightmove.co.uk',
      port: 443,
      path: '/v1/property/sendpropertydetails',
      method: 'POST',
      agent: agent,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };
    
    const proxyReq = https.request(options, (proxyRes) => {
      let data = '';
      proxyRes.on('data', chunk => data += chunk);
      proxyRes.on('end', () => {
        console.log('Rightmove response:', proxyRes.statusCode, data);
        res.status(proxyRes.statusCode).send(data);
      });
    });
    
    proxyReq.on('error', (error) => {
      console.error('Request error:', error);
      res.status(500).json({ status: 'error', message: error.message });
    });
    
    proxyReq.write(requestBody);
    proxyReq.end();
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Rightmove proxy on port ${PORT}`));
