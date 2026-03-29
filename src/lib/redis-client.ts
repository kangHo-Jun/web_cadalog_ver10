import { Redis } from '@upstash/redis';

let client: Redis | null = null;

/**
 * Redis 싱글턴 클라이언트를 반환합니다.
 * @upstash/redis는 HTTP 기반이므로 별도의 connect/disconnect가 필요하지 않습니다.
 */
export function getRedisClient(): Redis {
    if (!client) {
        // Vercel Redis URL (KV_REDIS_URL)만 사용
        const url = process.env.KV_REDIS_URL;
        const token = process.env.KV_REST_API_TOKEN || process.env.REDIS_TOKEN;

        if (!url || !token) {
            throw new Error('Redis configuration missing (KV_REDIS_URL + KV_REST_API_TOKEN)');
        }

        client = new Redis({
            url,
            token,
        });
    }
    return client;
}
