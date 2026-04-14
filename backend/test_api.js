const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

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

async function testApi() {
  console.log("🚀 Starting API Test...");
  console.log(`📡 Auth URL: ${config.auth_base_url}`);
  console.log(`📡 API URL: ${config.api_base_url}`);
  
  try {
    // 1. Get Access Token
    console.log("🔐 Fetching access token...");
    const authRes = await axios.post(
      `${config.auth_base_url}/oauth2/token`,
      'grant_type=client_credentials&scope=content',
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        auth: { username: QF_CLIENT_ID, password: QF_CLIENT_SECRET }
      }
    );

    const token = authRes.data.access_token;
    console.log("✅ Token obtained successfully.");

    // 2. Call protected verse endpoint
    const surah = 10;
    console.log(`📖 Fetching Surah ${surah} verses via by_chapter...`);
    
    // Test by_chapter
    const byChapterUrl = `${config.api_base_url}/content/api/v4/verses/by_chapter/${surah}?language=en&words=true&per_page=1&page=1`;
    
    const apiRes = await axios.get(byChapterUrl, {
      headers: {
        'x-auth-token': token,
        'x-client-id': QF_CLIENT_ID,
      }
    });

    console.log("\n✨ --- BY_KEY RESPONSE --- ✨");
    console.log(`Status: ${apiRes.status}`);
    console.log("Full Response Structure:", JSON.stringify(apiRes.data, (key, value) => {
      // Truncate long strings for readability
      if (typeof value === 'string' && value.length > 200) return value.slice(0, 100) + "...";
      return value;
    }, 2));
    
    // Test chapters
    console.log(`\n📚 Fetching Surah list...`);
    const chaptersUrl = `${config.api_base_url}/content/api/v4/chapters?language=en`;
    const chaptersRes = await axios.get(chaptersUrl, {
      headers: {
        'x-auth-token': token,
        'x-client-id': QF_CLIENT_ID,
      }
    });
    // Test recitations
    console.log(`\n🎧 Fetching Recitation for 1:1...`);
    const recitationId = 7; // Mishary Rashid
    const ayahKey = "1:1";
    const recitationUrl = `${config.api_base_url}/content/api/v4/recitations/${recitationId}/by_ayah/${ayahKey}`;
    
    const recRes = await axios.get(recitationUrl, {
      headers: {
        'x-auth-token': token,
        'x-client-id': QF_CLIENT_ID,
      }
    });
    console.log(`Status: ${recRes.status}`);
    console.log(`Audio File URL: ${recRes.data.audio_file?.audio_url || 'Not Found'}`);
    console.log("Full Response:", JSON.stringify(recRes.data, null, 2));

  } catch (error) {
    console.error("\n❌ API Test Failed:");
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data:`, error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

async function testPublicProduction() {
  console.log("\n🌐 Testing Public Production (No Auth) for Surah 10...");
  try {
    const url = 'https://apis.quran.foundation/content/api/v4/verses/by_chapter/10?language=en&per_page=1';
    const res = await axios.get(url);
    console.log(`Status: ${res.status}`);
    console.log(`Verse 1 Found: ${res.data.verses?.[0]?.verse_key || 'No'}`);
  } catch (error) {
    console.log(`Status: ${error.response?.status || 'Error'}`);
    console.log(`Error: ${error.response?.data?.message || error.message}`);
  }
}

testApi().then(testPublicProduction);
