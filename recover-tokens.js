
const axios = require('axios');
const { createClient } = require('redis');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const MALL_ID = process.env.MALL_ID || 'daesan3833';
const CLIENT_ID = process.env.CAFE24_CLIENT_ID;
const CLIENT_SECRET = process.env.CAFE24_CLIENT_SECRET;
const REDIRECT_URI = 'https://web-cadalog-ver10.vercel.app/api/auth/callback';
const TOKEN_KEY = 'cafe24_tokens';

const code = process.argv[2];

if (!code) {
    console.error('❌ Usage: node recover-tokens.js [AUTHORIZATION_CODE]');
    process.exit(1);
}

async function recover() {
    console.log(`🚀 Starting token recovery for MALL: ${MALL_ID}...`);
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

    try {
        const response = await axios.post(
            `https://${MALL_ID}.cafe24api.com/api/v2/oauth/token`,
            new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
            }),
            {
                headers: {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );

        const data = response.data;
        const tokens = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: Date.now() + 2 * 60 * 60 * 1000,
            refresh_token_expires_at: data.refresh_token_expires_at
                ? new Date(data.refresh_token_expires_at).getTime()
                : Date.now() + 14 * 24 * 60 * 60 * 1000
        };

        console.log('✅ Tokens received from Cafe24');

        const client = createClient({ url: process.env.KV_REDIS_URL });
        await client.connect();
        await client.set(TOKEN_KEY, JSON.stringify(tokens));
        await client.quit();

        console.log('🎉 Successfully saved tokens to Redis!');
        console.log('--- New Token Info ---');
        console.log('Access Token Expiry:', new Date(tokens.expires_at).toLocaleString());
        console.log('Refresh Token Expiry:', new Date(tokens.refresh_token_expires_at).toLocaleString());

    } catch (error) {
        console.error('❌ Recovery Failed:', error.response?.data || error.message);
    }
}

recover();
