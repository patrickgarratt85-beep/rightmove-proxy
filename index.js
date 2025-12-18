const express = require('express');
const axios = require('axios');
const https = require('https');
const forge = require('node-forge');

const app = express();
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/proxy', async (req, res) => {
  try {
    const { payload, target_url } = req.body;
    
    console.log('Received proxy request');
    console.log('Target URL:', target_url);
    
    // Get P12 credentials
    const p12Base64 = process.env.RIGHTMOVE_P12_BASE64;
    const passphrase = process.env.RIGHTMOVE_P12_PASSPHRASE;
    
    if (!p12Base64) {
      console.error('Missing RIGHTMOVE_P12_BASE64');
      return res.status(500).json({ error: 'Missing RIGHTMOVE_P12_BASE64' });
    }
    
    if (!passphrase) {
      console.error('Missing RIGHTMOVE_P12_PASSPHRASE');
      return res.status(500).json({ error: 'Missing RIGHTMOVE_P12_PASSPHRASE' });
    }
    
    // Decode P12 and extract cert/key using node-forge
    const p12Buffer = Buffer.from(p12Base64, 'base64');
    const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, passphrase);
    
    // Extract certificate
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags[forge.pki.oids.certBag];
    if (!certBag || certBag.length === 0) {
      throw new Error('No certificate found in P12');
    }
    const cert = forge.pki.certificateToPem(certBag[0].cert);
    
    // Extract private key
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
    if (!keyBag || keyBag.length === 0) {
      throw new Error('No private key found in P12');
    }
    const key = forge.pki.privateKeyToPem(keyBag[0].key);
    
    console.log('Successfully extracted cert and key from P12');
    
    // Create HTTPS agent with client certificate
    const agent = new https.Agent({
      cert: cert,
      key: key,
      rejectUnauthorized: true
    });
    
    // Make request to Rightmove
    console.log('Sending request to Rightmove...');
    const response = await axios.post(target_url, payload, {
      httpsAgent: agent,
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });
    
    console.log('Rightmove response status:', response.status);
    res.json(response.data);
    
  } catch (error) {
    console.error('Proxy error:', error.message);
    
    if (error.response) {
      console.error('Rightmove error response:', error.response.status, error.response.data);
      return res.status(error.response.status).json({
        error: error.message,
        details: error.response.data
      });
    }
    
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Rightmove proxy listening on port ${PORT}`);
});
