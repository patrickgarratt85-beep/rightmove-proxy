const express = require('express');
const axios = require('axios');
const https = require('https');
const forge = require('node-forge');

const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/proxy', async (req, res) => {
  try {
    const { payload, target_url } = req.body;
    
    const p12Base64 = process.env.RIGHTMOVE_P12_BASE64;
    const p12Password = process.env.RIGHTMOVE_P12_PASSPHRASE;
    
    // Parse P12
    const p12Der = forge.util.decode64(p12Base64);
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, p12Password);
    
    // Get ALL certificates and concatenate them
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certs = certBags[forge.pki.oids.certBag] || [];
    const certChain = certs.map(bag => forge.pki.certificateToPem(bag.cert)).join('\n');
    
    // Get private key
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0];
    const key = forge.pki.privateKeyToPem(keyBag.key);
    
    console.log(`Certs found: ${certs.length}, Target: ${target_url}`);
    
    const agent = new https.Agent({
      cert: certChain,
      key: key,
      rejectUnauthorized: true
    });
    
    const response = await axios.post(target_url, payload, {
      httpsAgent: agent,
      headers: { 'Content-Type': 'application/json' }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(error.response?.status || 500).json({
      error: error.message,
      details: error.response?.data
    });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Proxy running');
});
