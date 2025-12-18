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
    
    console.log('Parsing P12...');
    
    // Parse P12
    const p12Der = forge.util.decode64(p12Base64);
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, p12Password);
    
    // Get ALL certificates
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const allCerts = certBags[forge.pki.oids.certBag] || [];
    console.log(`Found ${allCerts.length} certificates in P12`);
    
    // Get private key
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
    
    if (!keyBag) {
      throw new Error('No private key found in P12');
    }
    
    const key = forge.pki.privateKeyToPem(keyBag.key);
    console.log('Private key extracted');
    
    // Find the client cert (the one that matches the private key)
    const publicKeyPem = forge.pki.publicKeyToPem(forge.pki.rsa.setPublicKey(keyBag.key.n, keyBag.key.e));
    
    let clientCert = null;
    const caCerts = [];
    
    for (const bag of allCerts) {
      const certPublicKeyPem = forge.pki.publicKeyToPem(bag.cert.publicKey);
      if (certPublicKeyPem === publicKeyPem) {
        clientCert = bag.cert;
        console.log('Client cert identified: ' + bag.cert.subject.getField('CN')?.value);
      } else {
        caCerts.push(bag.cert);
        console.log('CA cert found: ' + bag.cert.subject.getField('CN')?.value);
      }
    }
    
    if (!clientCert) {
      throw new Error('Could not identify client certificate');
    }
    
    // Build cert chain: client cert first, then CAs
    const certChain = [forge.pki.certificateToPem(clientCert)];
    for (const ca of caCerts) {
      certChain.push(forge.pki.certificateToPem(ca));
    }
    
    console.log(`Cert chain: 1 client + ${caCerts.length} CA certs`);
    console.log(`Target: ${target_url}`);
    
    const agent = new https.Agent({
      cert: certChain.join('\n'),
      key: key,
      rejectUnauthorized: true
    });
    
    const response = await axios.post(target_url, payload, {
      httpsAgent: agent,
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('Success:', response.status);
    res.json(response.data);
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data));
    }
    res.status(error.response?.status || 500).json({
      error: error.message,
      details: error.response?.data
    });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Rightmove proxy running on port ' + (process.env.PORT || 3000));
});
