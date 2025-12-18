const express = require('express');
const https = require('https');
const axios = require('axios');

const app = express();
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'rightmove-proxy' });
});

// Proxy endpoint
app.post('/proxy', async (req, res) => {
  try {
    const { payload, target_url } = req.body;
    
    if (!payload || !target_url) {
      return res.status(400).json({ error: 'Missing payload or target_url' });
    }

    console.log('Proxying request to:', target_url);
    
    // Decode the base64 P12 file
    const p12Buffer = Buffer.from(process.env.RIGHTMOVE_P12_BASE64, 'base64');
    
    const agent = new https.Agent({
      pfx: p12Buffer,
      passphrase: process.env.RIGHTMOVE_P12_PASSPHRASE || '',
    });

    const response = await axios.post(target_url, payload, {
      httpsAgent: agent,
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });

    console.log('Rightmove response status:', response.status);
    res.json(response.data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    res.status(error.response?.status || 500).json({
      error: error.message,
      details: error.response?.data || null,
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Rightmove proxy listening on port ${PORT}`);
});
