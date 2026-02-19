import { createClient } from 'redis';

const TOKEN_KEY = 'cafe24_tokens';

export interface Tokens {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
    refresh_token_expires_at?: number; // Unix ms — used for expiry alert cron
}

// Redis 클라이언트 생성 (싱글톤 패턴)
let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedisClient() {
    if (!redisClient) {
        redisClient = createClient({
            url: process.env.KV_REDIS_URL,
        });

        redisClient.on('error', (err) => {
            console.error('❌ Redis Client Error:', err);
        });

        await redisClient.connect();
        console.log('✅ Redis client connected');
    }
    return redisClient;
}

export async function getTokens(): Promise<Tokens> {
    try {
        const client = await getRedisClient();
        const data = await client.get(TOKEN_KEY);

        if (data) {
            const tokens = JSON.parse(data) as Tokens;
            console.log('✅ Tokens retrieved from Redis');
            return tokens;
        }
    } catch (error) {
        console.error('⚠️ Redis get error:', error);
    }

    // Fallback to env vars
    console.log('ℹ️ Using tokens from environment variables');
    return {
        access_token: process.env.CAFE24_ACCESS_TOKEN || '',
        refresh_token: process.env.CAFE24_REFRESH_TOKEN || '',
    };
}

export async function saveTokens(tokens: Tokens): Promise<void> {
    try {
        const client = await getRedisClient();
        await client.set(TOKEN_KEY, JSON.stringify(tokens));
        console.log('✅ Tokens saved to Redis');
    } catch (error) {
        console.error('❌ Redis save error:', error);
    }
}
