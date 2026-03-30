const axios = require('axios');
const { QF_CLIENT_ID, QF_CLIENT_SECRET, config } = require('../config/env');

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

module.exports = {
  getAccessToken
};
