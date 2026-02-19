const { createClient } = require('redis');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function syncToRedis() {
    const client = createClient({
        url: process.env.KV_REDIS_URL,
    });

    client.on('error', (err) => console.error('❌ Redis Error:', err));

    try {
        await client.connect();
        console.log('✅ Connected to Redis');

        const tokens = {
            access_token: process.env.CAFE24_ACCESS_TOKEN,
            refresh_token: process.env.CAFE24_REFRESH_TOKEN,
            expires_at: Date.now() + 2 * 60 * 60 * 1000, // 2 hours from now
        };

        if (!tokens.access_token || !tokens.refresh_token) {
            throw new Error('Missing tokens in .env.local');
        }

        await client.set('cafe24_tokens', JSON.stringify(tokens));
        console.log('✅ Tokens synchronized to Redis!');
        console.log('Expires At:', new Date(tokens.expires_at).toLocaleString());
    } catch (err) {
        console.error('❌ Sync failed:', err.message);
    } finally {
        await client.quit();
    }
}

syncToRedis();
