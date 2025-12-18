const express = require('express');
const https = require('https');
const axios = require('axios');

const app = express();
app.use(express.json());

// mTLS agent with Rightmove certificates
const agent = new https.Agent({
  cert: process.env.RIGHTMOVE_CERT_PEM,
  key: process.env.RIGHTMOVE_KEY_PEM,
  ca: process.env.RIGHTMOVE_CA_CERT_PEM,
});

app.post('/proxy', async (req, res) => {
  try {
    const { payload, target_url } = req.body;
    
    // Use target_url from request - defaults to test endpoint for safety
    const rightmoveUrl = target_url || 'https://adfapi.adftest.rightmove.com/v1/property/sendpropertydetails';
    
    console.log('Proxying to:', rightmoveUrl);
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
    const response = await axios.post(rightmoveUrl, payload, {
      httpsAgent: agent,
      headers: { 'Content-Type': 'application/json' },
    });
    
    console.log('Rightmove response:', response.status, JSON.stringify(response.data));
    res.json(response.data);
  } catch (error) {
    console.error('Proxy error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || error.message,
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Rightmove proxy listening on port ${PORT}`);
});
