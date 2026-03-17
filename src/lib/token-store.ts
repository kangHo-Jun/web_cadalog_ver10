import { createClient } from 'redis';

const TOKEN_KEY = 'cafe24_tokens';

// ── Vercel 환경변수 업데이트 (목표 C) ─────────────────────────────
async function updateVercelEnv(key: string, value: string): Promise<void> {
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const PROJECT_ID = process.env.VERCEL_PROJECT_ID;

    if (!VERCEL_TOKEN || !PROJECT_ID) {
        console.warn('⚠️ VERCEL_TOKEN or VERCEL_PROJECT_ID missing — skipping env update');
        return;
    }

    // 기존 환경변수 ID 조회 후 PATCH, 없으면 POST
    const listRes = await fetch(
        `https://api.vercel.com/v9/projects/${PROJECT_ID}/env?decrypt=true`,
        { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } }
    );
    const listData = await listRes.json();
    const existing = listData.envs?.find((e: { key: string }) => e.key === key);

    if (existing) {
        await fetch(
            `https://api.vercel.com/v9/projects/${PROJECT_ID}/env/${existing.id}`,
            {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ value, target: ['production', 'preview', 'development'] }),
            }
        );
    } else {
        await fetch(
            `https://api.vercel.com/v9/projects/${PROJECT_ID}/env`,
            {
                method: 'POST',
                headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value, type: 'encrypted', target: ['production', 'preview', 'development'] }),
            }
        );
    }
    console.log(`✅ Vercel env updated: ${key}`);
}

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
    const envTokens: Tokens = {
        access_token: process.env.CAFE24_ACCESS_TOKEN?.trim() || '',
        refresh_token: process.env.CAFE24_REFRESH_TOKEN?.trim() || '',
    };
    console.log('ℹ️ Using tokens from environment variables', {
        has_access_token: Boolean(envTokens.access_token),
        has_refresh_token: Boolean(envTokens.refresh_token),
        access_token_len: envTokens.access_token.length,
        refresh_token_len: envTokens.refresh_token.length,
    });

    // Redis 유실 시 자동 복구 (목표 C)
    if (envTokens.access_token && envTokens.refresh_token) {
        await saveToRedisOnly(envTokens);
    }

    return envTokens;
}

export async function saveTokens(tokens: Tokens): Promise<void> {
    // 1. Redis 저장
    try {
        const client = await getRedisClient();
        await client.set(TOKEN_KEY, JSON.stringify(tokens));
        console.log('✅ Tokens saved to Redis');
    } catch (error) {
        console.error('❌ Redis save error:', error);
    }

    // 2. Vercel 환경변수 동시 업데이트 (목표 C — Redis 유실 대비 fallback 최신화)
    // 백그라운드 실행 (await 제거 - 타임아웃 방지)
    updateVercelEnv('CAFE24_ACCESS_TOKEN', tokens.access_token).catch(e =>
        console.error('Vercel env update failed:', e.message)
    );
    updateVercelEnv('CAFE24_REFRESH_TOKEN', tokens.refresh_token).catch(e =>
        console.error('Vercel env update failed:', e.message)
    );
}

// Redis에만 저장 (getTokens fallback 복구용)
async function saveToRedisOnly(tokens: Tokens): Promise<void> {
    try {
        const client = await getRedisClient();
        await client.set(TOKEN_KEY, JSON.stringify(tokens));
        console.log('✅ Redis 자동 복구 완료');
    } catch (error) {
        console.error('❌ Redis 복구 저장 실패:', error);
    }
}
