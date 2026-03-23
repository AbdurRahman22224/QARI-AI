require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');

const app = express();
app.use(cors());
app.use(express.json());

// Multer for audio file uploads (store in memory)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max

// Config from ENV
const QF_CLIENT_ID = process.env.QF_CLIENT_ID;
const QF_CLIENT_SECRET = process.env.QF_CLIENT_SECRET;
const QF_ENV = process.env.QF_ENV || 'prelive';

const ENV_CONFIG = {
  prelive: {
    auth_base_url: 'https://prelive-oauth2.quran.foundation',
    api_base_url: 'https://apis-prelive.quran.foundation'
  },
  production: {
    auth_base_url: 'https://oauth2.quran.foundation',
    api_base_url: 'https://apis.quran.foundation'
  }
};

const config = ENV_CONFIG[QF_ENV];

if (!QF_CLIENT_ID || !QF_CLIENT_SECRET) {
  console.error("Missing Quran Foundation API credentials.");
  process.exit(1);
}

// Token Cache
let tokenCache = {
  token: null,
  expiresAt: 0
};

async function getAccessToken() {
  const bufferSeconds = 30;
  const now = Math.floor(Date.now() / 1000);

  if (tokenCache.token && now < tokenCache.expiresAt - bufferSeconds) {
    return tokenCache.token;
  }

  // Fetch new token
  try {
    const response = await axios.post(
      `${config.auth_base_url}/oauth2/token`,
      'grant_type=client_credentials&scope=content',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        auth: {
          username: QF_CLIENT_ID,
          password: QF_CLIENT_SECRET
        }
      }
    );

    tokenCache.token = response.data.access_token;
    tokenCache.expiresAt = now + response.data.expires_in;
    return tokenCache.token;
  } catch (error) {
    console.error("Error fetching access token:", error.response?.data || error.message);
    throw new Error("Failed to get access token");
  }
}

// Global proxy route for any QF API endpoint
app.use('/api/quran', async (req, res) => {
  try {
    const token = await getAccessToken();
    
    // req.url contains the path after /api/quran
    const targetUrl = `${config.api_base_url}${req.url}`;
    
    console.log(`[PROXY] ${req.method} ${targetUrl}`);

    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        'x-auth-token': token,
        'x-client-id': QF_CLIENT_ID,
      },
      data: req.method !== 'GET' ? req.body : undefined,
      params: req.method === 'GET' ? req.query : undefined
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error("Error calling QF API:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed' });
  }
});

// OAuth2 Login URL Generator
app.get('/api/auth/login-url', (req, res) => {
  const redirect_uri = req.query.redirect_uri || 'http://localhost:3000/callback';
  const state = Math.random().toString(36).substring(2, 15);
  const nonce = Math.random().toString(36).substring(2, 15);
  
  // Using the discovered endpoint /oauth2/auth
  const url = `${config.auth_base_url}/oauth2/auth?client_id=${QF_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&scope=openid&state=${state}&nonce=${nonce}`;
  
  console.log(`[OAUTH] Generated Login URL: ${url}`);
  res.json({ url });
});

// OAuth2 User Login Callback handler
app.post('/api/auth/callback', async (req, res) => {
  const { code, redirect_uri } = req.body;
  if (!code) return res.status(400).json({ error: "Authorization code required" });

  console.log(`[OAUTH] Exchanging code: ${code.substring(0, 5)}... for redirect_uri: ${redirect_uri}`);

  try {
    const response = await axios.post(
      `${config.auth_base_url}/oauth2/token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirect_uri
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        auth: {
          username: QF_CLIENT_ID,
          password: QF_CLIENT_SECRET
        }
      }
    );
    console.log(`[OAUTH] Token exchange successful!`);
    res.json(response.data);
  } catch (error) {
    console.error("[OAUTH] Callback error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to exchange authorization code", details: error.response?.data });
  }
});

// ── ASR Analysis Proxy ──
const ASR_SERVICE_URL = process.env.ASR_URL || 'http://localhost:5001';

app.post('/api/analyze', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No audio file provided" });

  const expectedText = req.body.expected_text;
  if (!expectedText) return res.status(400).json({ error: "No expected_text provided" });

  console.log(`[ASR] Analyzing audio (${(req.file.size / 1024).toFixed(1)} KB) against: "${expectedText.substring(0, 40)}..."`);

  try {
    const formData = new FormData();
    formData.append('audio', req.file.buffer, {
      filename: 'recording.webm',
      contentType: req.file.mimetype || 'audio/webm',
    });
    formData.append('expected_text', expectedText);

    const response = await axios.post(`${ASR_SERVICE_URL}/analyze`, formData, {
      headers: formData.getHeaders(),
      timeout: 120000, // 120s timeout for Whisper processing
    });

    console.log(`[ASR] Result: accuracy=${response.data.accuracy}% decision=${response.data.decision?.status}`);
    res.json(response.data);
  } catch (error) {
    console.error("[ASR] Error:", error.response?.data || error.message);
    if (error.code === 'ECONNREFUSED') {
      res.status(503).json({ error: "ASR service not running. Start it with: python asr/asr_service.py" });
    } else {
      res.status(500).json({ error: "Analysis failed", details: error.response?.data || error.message });
    }
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔗 Proxied API running at http://localhost:${PORT}/api/quran`);
  console.log(`🎤 ASR proxy at http://localhost:${PORT}/api/analyze`);
});
