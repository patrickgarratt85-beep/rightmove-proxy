const express = require('express');
const https = require('https');

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3000;

// Rightmove RTDF endpoints
const RIGHTMOVE_TEST_URL = 'https://adfapi.adftest.rightmove.com/v1/property/sendpropertydetails';
const RIGHTMOVE_LIVE_URL = 'https://adfapi.rightmove.co.uk/v1/property/sendpropertydetails';

app.post('/proxy', async (req, res) => {
  console.log('Received request, test_mode:', req.body.test_mode);
  
  try {
    const { payload, test_mode } = req.body;
    
    if (!payload) {
      return res.status(400).json({ error: 'Missing payload' });
    }

    const cert = process.env.RIGHTMOVE_CERT_PEM;
    const key = process.env.RIGHTMOVE_KEY_PEM;
    const ca = process.env.RIGHTMOVE_CA_CERT_PEM;

    if (!cert || !key) {
      console.error('Missing certificate or key');
      return res.status(500).json({ error: 'Missing certificate configuration' });
    }

    const agent = new https.Agent({
      cert: cert,
      key: key,
      ca: ca,
      rejectUnauthorized: false
    });

    const targetUrl = test_mode ? RIGHTMOVE_TEST_URL : RIGHTMOVE_LIVE_URL;
    console.log('Forwarding to:', targetUrl);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      agent: agent
    });

    const responseText = await response.text();
    console.log('Rightmove response status:', response.status);
    console.log('Rightmove response:', responseText);

    res.status(response.status).send(responseText);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Proxy request failed', 
      message: error.message,
      code: error.code 
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Rightmove proxy running on port ${PORT}`);
});
