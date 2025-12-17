const express = require('express');
const https = require('https');

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 8080;

// Configuration
const CERT_PEM = process.env.RIGHTMOVE_CERT_PEM;
const KEY_PEM = process.env.RIGHTMOVE_KEY_PEM;
const CA_CERT_PEM = process.env.RIGHTMOVE_CA_CERT_PEM;
const NETWORK_ID = process.env.RIGHTMOVE_NETWORK_ID;
const BRANCH_ID = process.env.RIGHTMOVE_BRANCH_ID;

// Log startup config (without sensitive data)
console.log('Rightmove proxy running on port', PORT);
console.log('Certificate configured:', !!CERT_PEM);
console.log('Key configured:', !!KEY_PEM);
console.log('CA Certificate configured:', !!CA_CERT_PEM);
console.log('Network ID:', NETWORK_ID);
console.log('Branch ID:', BRANCH_ID);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Main proxy endpoint
app.post('/proxy', async (req, res) => {
  try {
    const { payload, test_mode } = req.body;
    
    console.log('Received proxy request, test_mode:', test_mode);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    if (!CERT_PEM || !KEY_PEM) {
      console.error('Missing certificate or key configuration');
      return res.status(500).json({ 
        error: 'Proxy not configured correctly - missing certificates' 
      });
    }

    // Determine API endpoint based on test mode
    const baseUrl = test_mode 
      ? 'adfapi.adftest.rightmove.com'
      : 'adfapi.rightmove.com';
    
    const path = '/v1/property/sendpropertydetails';

    console.log(`Proxying to ${baseUrl}${path} (test_mode: ${test_mode})`);

    // Create HTTPS agent with mTLS certificates
    // Note: No passphrase needed as key is not encrypted
    const httpsAgent = new https.Agent({
      cert: CERT_PEM,
      key: KEY_PEM,
      ca: CA_CERT_PEM || undefined,
      rejectUnauthorized: true,
    });

    const postData = JSON.stringify(payload);

    const options = {
      hostname: baseUrl,
      port: 443,
      path: path,
      method: 'POST',
      agent: httpsAgent,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    // Make the request to Rightmove
    const rightmoveResponse = await new Promise((resolve, reject) => {
      const req = https.request(options, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode,
            headers: response.headers,
            body: data,
          });
        });
      });

      req.on('error', (error) => {
        console.error('Request error:', error);
        reject(error);
      });

      req.write(postData);
      req.end();
    });

    console.log('Rightmove response status:', rightmoveResponse.statusCode);
    console.log('Rightmove response body:', rightmoveResponse.body);

    // Parse response body
    let responseBody;
    try {
      responseBody = JSON.parse(rightmoveResponse.body);
    } catch {
      responseBody = { raw: rightmoveResponse.body };
    }

    res.status(rightmoveResponse.statusCode).json(responseBody);

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: 'Proxy request failed', 
      message: error.message,
      code: error.code 
    });
  }
});

// Remove property endpoint
app.post('/proxy/remove', async (req, res) => {
  try {
    const { payload, test_mode } = req.body;
    
    console.log('Received remove request, test_mode:', test_mode);

    if (!CERT_PEM || !KEY_PEM) {
      return res.status(500).json({ 
        error: 'Proxy not configured correctly - missing certificates' 
      });
    }

    const baseUrl = test_mode 
      ? 'adfapi.adftest.rightmove.com'
      : 'adfapi.rightmove.com';
    
    const path = '/v1/property/removeproperty';

    const httpsAgent = new https.Agent({
      cert: CERT_PEM,
      key: KEY_PEM,
      ca: CA_CERT_PEM || undefined,
      rejectUnauthorized: true,
    });

    const postData = JSON.stringify(payload);

    const options = {
      hostname: baseUrl,
      port: 443,
      path: path,
      method: 'POST',
      agent: httpsAgent,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const rightmoveResponse = await new Promise((resolve, reject) => {
      const req = https.request(options, (response) => {
        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode,
            body: data,
          });
        });
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    let responseBody;
    try {
      responseBody = JSON.parse(rightmoveResponse.body);
    } catch {
      responseBody = { raw: rightmoveResponse.body };
    }

    res.status(rightmoveResponse.statusCode).json(responseBody);

  } catch (error) {
    console.error('Remove proxy error:', error);
    res.status(500).json({ error: 'Proxy request failed', message: error.message });
  }
});

// Get branch properties endpoint
app.post('/proxy/list', async (req, res) => {
  try {
    const { payload, test_mode } = req.body;
    
    console.log('Received list request, test_mode:', test_mode);

    if (!CERT_PEM || !KEY_PEM) {
      return res.status(500).json({ 
        error: 'Proxy not configured correctly - missing certificates' 
      });
    }

    const baseUrl = test_mode 
      ? 'adfapi.adftest.rightmove.com'
      : 'adfapi.rightmove.com';
    
    const path = '/v1/property/getbranchpropertylist';

    const httpsAgent = new https.Agent({
      cert: CERT_PEM,
      key: KEY_PEM,
      ca: CA_CERT_PEM || undefined,
      rejectUnauthorized: true,
    });

    const postData = JSON.stringify(payload);

    const options = {
      hostname: baseUrl,
      port: 443,
      path: path,
      method: 'POST',
      agent: httpsAgent,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const rightmoveResponse = await new Promise((resolve, reject) => {
      const req = https.request(options, (response) => {
        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode,
            body: data,
          });
        });
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    let responseBody;
    try {
      responseBody = JSON.parse(rightmoveResponse.body);
    } catch {
      responseBody = { raw: rightmoveResponse.body };
    }

    res.status(rightmoveResponse.statusCode).json(responseBody);

  } catch (error) {
    console.error('List proxy error:', error);
    res.status(500).json({ error: 'Proxy request failed', message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
