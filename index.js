const express = require('express');
const https = require('https');

const app = express();
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'rightmove-proxy' });
});

// Proxy endpoint
app.post('/proxy', async (req, res) => {
  try {
    const { url, method, headers, body } = req.body;
    
    console.log(`Proxying ${method} request to: ${url}`);
    
    // Create HTTPS agent with client certificate (PFX/P12 format)
    const agent = new https.Agent({
      pfx: Buffer.from(process.env.RIGHTMOVE_P12_BASE64, 'base64'),
      passphrase: process.env
