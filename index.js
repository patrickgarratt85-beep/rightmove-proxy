const express = require('express');
const axios = require('axios');
const https = require('https');
const forge = require('node-forge');

const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/proxy', async (req, res) => {
  try {
    const { payload, target_url } = req.body;
    
    console.log('Target URL:', target_url);
    
    const p12Base64 = process.env.RIGHTMOVE_P12_BASE64;
    const passphrase = process.env.RIGHTMOVE_P12_PASSPHRASE;
    
    const p12Buffer = Buffer.from(p12Base64, 'base64');
    const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, passphrase);
    
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const cert = forge.pki.certificateToPem(certBags[forge.pki.oids.certBag][0].cert);
    
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const key = forge.pki.privateKeyToPem(keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0].key);
    
    const agent = new https.Agent({ cert, key });
    
    const response = await axios.post(target_url, payload, {
      httpsAgent: agent,
      headers: { 'Content-Type': 'application/json' }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error:', error.message);
    res.status(error.response?.status || 500).json({
      error: error.message,
      details: error.response?.data
    });
  }
});

app.listen(process.env.PORT || 3000);
