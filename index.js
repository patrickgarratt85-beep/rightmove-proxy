const express = require('express');
const https = require('https');

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3000;

const certPem = process.env.CERT_PEM || process.env.RIGHTMOVE_CERT_PEM;
const keyPem = process.env.KEY_PEM || process.env.RIGHTMOVE_KEY_PEM;
const caCertPem = process.env.CA_CERT_PEM || process.env.RIGHTMOVE_CA_CERT_PEM;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', hasCert: !!certPem, hasKey: !!keyPem });
});

app.post('/proxy', async (req, res) => {
  try {
    if (!certPem || !keyPem) {
      return res.status(500).json({ error: 'Missing certificate or key' });
    }

    const { payload, test_mode } = req.body;
    console.log('Received request, test_mode:', test_mode);
    
    const baseUrl = test_mode ? 'adfapi.adftest.rightmove.com' : 'adfapi.rightmove.com';

    // NO passphrase - key is unencrypted
    const httpsAgent = new https.Agent({
      cert: certPem,
      key: keyPem,
      ca: caCertPem || undefined,
    });

    const postData = JSON.stringify(payload);

    const options = {
      hostname: baseUrl,
      port: 443,
      path: '/v1/property/sendpropertydetails',
      method: 'POST',
      agent: httpsAgent,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const proxyReq = https.request(options, (proxyRes) => {
      let data = '';
      proxyRes.on('data', (chunk) => { data += chunk; });
      proxyRes.on('end', () => {
        console.log('Rightmove response:', proxyRes.statusCode, data);
        res.status(proxyRes.statusCode).json({ status: proxyRes.statusCode, response: data });
      });
    });

    proxyReq.on('error', (e) => {
      console.error('Proxy error:', e);
      res.status(500).json({ error: 'Proxy request failed', message: e.message, code: e.code });
    });

    proxyReq.write(postData);
    proxyReq.end();

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`Server on port ${PORT}`));
