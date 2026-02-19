const { createClient } = require('redis');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function checkRedis() {
    console.log('🔗 Connecting to Redis:', process.env.KV_REDIS_URL);
    const client = createClient({
        url: process.env.KV_REDIS_URL,
    });

    client.on('error', (err) => console.error('❌ Redis Error:', err));

    try {
        await client.connect();
        console.log('✅ Connected');
        const data = await client.get('cafe24_tokens');
        if (data) {
            const tokens = JSON.parse(data);
            console.log('✅ Found tokens in Redis:');
            console.log('Access Token (first 5 chars):', tokens.access_token.substring(0, 5));
            console.log('Refresh Token (first 5 chars):', tokens.refresh_token.substring(0, 5));
            console.log('Expires At:', new Date(tokens.expires_at).toLocaleString());
            console.log('Current Time:', new Date().toLocaleString());

            if (tokens.expires_at < Date.now()) {
                console.log('⚠️ Tokens in Redis are EXPIRED.');
            } else {
                console.log('✨ Tokens in Redis are STILL VALID!');
            }
        } else {
            console.log('❌ No tokens found in Redis under key "cafe24_tokens"');
        }
    } catch (err) {
        console.error('❌ Failed to check Redis:', err);
    } finally {
        await client.quit();
    }
}

checkRedis();
