const { createClient } = require('redis');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// 오늘 발급된 토큰 만료일: 2026-03-05T08:26:51
const REFRESH_TOKEN_EXPIRES_AT = new Date('2026-03-05T08:26:51.000Z').getTime();

async function updateExpiry() {
    const client = createClient({ url: process.env.KV_REDIS_URL });
    await client.connect();

    const data = await client.get('cafe24_tokens');
    if (!data) {
        console.error('❌ No tokens in Redis');
        await client.quit();
        return;
    }

    const tokens = JSON.parse(data);
    tokens.refresh_token_expires_at = REFRESH_TOKEN_EXPIRES_AT;

    await client.set('cafe24_tokens', JSON.stringify(tokens));
    console.log('✅ refresh_token_expires_at saved to Redis');
    console.log('Expires At (KST):', new Date(REFRESH_TOKEN_EXPIRES_AT).toLocaleString('ko-KR'));

    await client.quit();
}

updateExpiry();
