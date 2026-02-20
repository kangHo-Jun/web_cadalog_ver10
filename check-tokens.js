
const { createClient } = require('redis');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const TOKEN_KEY = 'cafe24_tokens';

async function checkTokens() {
    const client = createClient({
        url: process.env.KV_REDIS_URL,
    });

    client.on('error', (err) => console.error('Redis Error:', err));

    await client.connect();
    console.log('Connected to Redis');

    const data = await client.get(TOKEN_KEY);
    if (data) {
        const tokens = JSON.parse(data);
        console.log('--- Tokens in Redis ---');
        console.log('Access Token:', tokens.access_token ? 'Exists' : 'Missing');
        console.log('Refresh Token:', tokens.refresh_token ? 'Exists' : 'Missing');
        console.log('Expires At:', tokens.expires_at ? new Date(tokens.expires_at).toLocaleString() : 'N/A');
        console.log('RT Expires At:', tokens.refresh_token_expires_at ? new Date(tokens.refresh_token_expires_at).toLocaleString() : 'N/A');

        const now = Date.now();
        if (tokens.expires_at && tokens.expires_at < now) {
            console.log('⚠️ Access Token is EXPIRED');
        }
        if (tokens.refresh_token_expires_at && tokens.refresh_token_expires_at < now) {
            console.log('🚨 Refresh Token is EXPIRED');
        }
    } else {
        console.log('No tokens found in Redis key:', TOKEN_KEY);
    }

    console.log('\n--- Tokens in .env.local ---');
    console.log('Access Token:', process.env.CAFE24_ACCESS_TOKEN ? 'Exists' : 'Missing');
    console.log('Refresh Token:', process.env.CAFE24_REFRESH_TOKEN ? 'Exists' : 'Missing');

    await client.quit();
}

checkTokens().catch(console.error);
