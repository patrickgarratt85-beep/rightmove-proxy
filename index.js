const express = require('express');
const https = require('https');
const axios = require('axios');

const app = express();
app.use(express.json());

// Safely parse certificates with newline handling
function parseCert(envVar) {
  if (!envVar) return undefined;
  return envVar.replace(/\\n/g, '\n');
}

// Create agent lazily on first request to avoid startup crash
let agent = null;
function getAgent() {
  if (agent) return agent;
  
  const cert = parseCert(process.env.RIGHTMOVE_CERT_PEM);
  const key = parseCert(process.env.RIGHTMOVE_KEY_PEM);
  const ca = parseCert(process.env.RIGHTMOVE_CA_CERT_PEM);
  
  console.log('Creating mTLS agent...');
  console.log('CERT present:', !!cert, 'length:', cert?.length);
  console.log('KEY present:', !!key, 'length:', key?.length);
  console.log('CA present:', !!ca, 'length:', ca?.length);
  
  agent = new https.Agent({ cert, key, ca });
  return agent;
}

app.post('/proxy', async (req, res) => {
  try {
    const { payload, target_url } = req.body;
    const rightmoveUrl = target_url || 'https://adfapi.adftest.rightmove.com/v1/property/sendpropertydetails';
    
    console.log('Proxying to:', rightmoveUrl);
    
    const response = await axios.post(rightmoveUrl, payload, {
      httpsAgent: getAgent(),
      headers: { 'Content-Type': 'application/json' },
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on ${PORT}`));
