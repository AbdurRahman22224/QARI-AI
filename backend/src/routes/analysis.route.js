const express = require('express');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const { ASR_SERVICE_URL } = require('../config/env');

const router = express.Router();

// Multer for audio file uploads (store in memory)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max

router.post('/analyze', upload.single('audio'), async (req, res) => {
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

    // Forward precomputed data from frontend
    if (req.body.normalized_expected) formData.append('normalized_expected', req.body.normalized_expected);
    if (req.body.word_list) formData.append('word_list', req.body.word_list);
    if (req.body.tajweed_map) formData.append('tajweed_map', req.body.tajweed_map);
    if (req.body.reference_duration) formData.append('reference_duration', req.body.reference_duration);

    const response = await axios.post(`${ASR_SERVICE_URL}/analyze`, formData, {
      headers: formData.getHeaders(),
      timeout: 120000, // 120s timeout for Whisper processing
    });

    console.log(`[ASR] Result: score=${response.data.score}/100 (${response.data.grade}) accuracy=${response.data.accuracy}%`);
    if (!response.data.raw_text) console.warn("[ASR] ⚠️ Warning: raw_text is MISSING or EMPTY in ASR response!");
    else console.log(`[ASR] Raw Text Received: "${response.data.raw_text}"`);

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

// Proxy to ASR Service (Word Trainer 3.0 Pre-Analysis)
router.post('/analyze-reference', async (req, res) => {
  try {
    const response = await axios.post(`${ASR_SERVICE_URL}/api/analyze-reference`, req.body);
    res.json(response.data);
  } catch (error) {
    console.error('❌ Reference analysis proxy error:', error.message);
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'ASR Service connection failed' });
  }
});

// Proxy to ASR Service (Word Trainer Hybrid Analysis)
router.post('/analyze-word-hybrid', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No user audio provided" });

  try {
    const formData = new FormData();
    formData.append('audio', req.file.buffer, {
      filename: 'practice.wav',
      contentType: req.file.mimetype || 'audio/wav',
    });
    
    // Pass along all form fields
    if (req.body.reference_audio_url) formData.append('reference_audio_url', req.body.reference_audio_url);
    if (req.body.word_text) formData.append('word_text', req.body.word_text);
    if (req.body.tajweed_map) formData.append('tajweed_map', req.body.tajweed_map);

    const response = await axios.post(`${ASR_SERVICE_URL}/analyze-word-hybrid`, formData, {
      headers: formData.getHeaders(),
      timeout: 60000,
    });

    res.json(response.data);
  } catch (error) {
    console.error("[Word Hybrid] Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Hybrid analysis failed", details: error.response?.data || error.message });
  }
});

module.exports = router;
