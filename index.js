const https = require('https');
const http = require('http');

const PORT = process.env.PORT || 3000;

// Get certificates from environment variables
const CERT_PEM = process.env.RIGHTMOVE_CERT_PEM?.replace(/\\n/g, '\n');
const KEY_PEM = process.env.RIGHTMOVE_KEY_PEM?.replace(/\\n/g, '\n');
const NETWORK_ID = process.env.RIGHTMOVE_NETWORK_ID;
const BRANCH_ID = process.env.RIGHTMOVE_BRANCH_ID;

// Rightmove API endpoints
const TEST_HOST = 'adfapi.adftest.rightmove.com';
const PROD_HOST = 'adfapi.rightmove.co.uk';

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  // Check configuration
  if (!CERT_PEM || !KEY_PEM || !NETWORK_ID || !BRANCH_ID) {
    console.error('Missing configuration:', {
      hasCert: !!CERT_PEM,
      hasKey: !!KEY_PEM,
      hasNetwork: !!NETWORK_ID,
      hasBranch: !!BRANCH_ID
    });
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Server not configured properly' }));
    return;
  }

  // Parse request body
  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }

  let requestData;
  try {
    requestData = JSON.parse(body);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  const { endpoint, payload, test_mode = true } = requestData;
  const host = test_mode ? TEST_HOST : PROD_HOST;
  const path = `/v1/property/${endpoint || 'sendpropertydetails'}`;

  console.log(`Proxying to ${host}${path} (test_mode: ${test_mode})`);
  console.log('Payload:', JSON.stringify(payload, null, 2));

  // Make mTLS request to Rightmove
  const options = {
    hostname: host,
    port: 443,
    path: path,
    method: 'POST',
    cert: CERT_PEM,
    key: KEY_PEM,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const rightmoveReq = https.request(options, (rightmoveRes) => {
    let responseBody = '';
    
    rightmoveRes.on('data', (chunk) => {
      responseBody += chunk;
    });

    rightmoveRes.on('end', () => {
      console.log(`Rightmove response: ${rightmoveRes.statusCode}`);
      console.log('Response body:', responseBody);
      
      res.writeHead(rightmoveRes.statusCode, { 
        'Content-Type': 'application/json' 
      });
      res.end(JSON.stringify({
        status: rightmoveRes.statusCode,
        response: responseBody ? JSON.parse(responseBody) : null
      }));
    });
  });

  rightmoveReq.on('error', (error) => {
    console.error('Rightmove request error:', error.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Failed to connect to Rightmove',
      details: error.message 
    }));
  });

  rightmoveReq.write(JSON.stringify(payload));
  rightmoveReq.end();
});

server.listen(PORT, () => {
  console.log(`Rightmove proxy running on port ${PORT}`);
  console.log(`Certificate configured: ${!!CERT_PEM}`);
  console.log(`Key configured: ${!!KEY_PEM}`);
  console.log(`Network ID: ${NETWORK_ID}`);
  console.log(`Branch ID: ${BRANCH_ID}`);
});
