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
        if (!process.env.KV_REDIS_URL) {
            console.error('⚠️ KV_REDIS_URL is missing; Redis tokens will not be used');
        }
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
            const normalized: Tokens = {
                ...tokens,
                access_token: tokens?.access_token?.trim() || '',
                refresh_token: tokens?.refresh_token?.trim() || '',
            };
            if (normalized.access_token && normalized.refresh_token) {
                console.log('✅ Tokens retrieved from Redis', {
                    access_token_len: normalized.access_token.length,
                    refresh_token_len: normalized.refresh_token.length,
                });
                return normalized;
            }
            console.warn('⚠️ Redis tokens missing required fields; falling back to env');
        }
    } catch (error) {
        console.error('⚠️ Redis get error:', error);
    }

    // Fallback to env vars
    console.log('ℹ️ Using tokens from environment variables', {
        has_access_token: Boolean(process.env.CAFE24_ACCESS_TOKEN),
        has_refresh_token: Boolean(process.env.CAFE24_REFRESH_TOKEN),
        access_token_len: process.env.CAFE24_ACCESS_TOKEN?.length || 0,
        refresh_token_len: process.env.CAFE24_REFRESH_TOKEN?.length || 0,
    });
    return {
        access_token: process.env.CAFE24_ACCESS_TOKEN?.trim() || '',
        refresh_token: process.env.CAFE24_REFRESH_TOKEN?.trim() || '',
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
