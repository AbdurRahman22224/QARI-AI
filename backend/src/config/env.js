require('dotenv').config({ path: '../../.env' });

const QF_CLIENT_ID = process.env.QF_CLIENT_ID;
const QF_CLIENT_SECRET = process.env.QF_CLIENT_SECRET;
const QF_ENV = process.env.QF_ENV || 'prelive';
const ASR_SERVICE_URL = process.env.ASR_URL || 'http://localhost:5001';

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

module.exports = {
  QF_CLIENT_ID,
  QF_CLIENT_SECRET,
  config,
  ASR_SERVICE_URL
};
