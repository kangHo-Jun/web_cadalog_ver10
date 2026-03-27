import { Redis } from '@upstash/redis';

let client: Redis | null = null;

/**
 * Redis 싱글턴 클라이언트를 반환합니다.
 * @upstash/redis는 HTTP 기반이므로 별도의 connect/disconnect가 필요하지 않습니다.
 */
export function getRedisClient(): Redis {
    if (!client) {
        // REDIS_URL과 REDIS_TOKEN이 환경변수에 설정되어 있어야 합니다.
        // Vercel KV 사용 시 KV_REST_API_URL, KV_REST_API_TOKEN과 동일할 수 있습니다.
        const url = process.env.REDIS_URL || process.env.KV_REST_API_URL;
        const token = process.env.REDIS_TOKEN || process.env.KV_REST_API_TOKEN;

        if (!url || !token) {
            throw new Error('Redis configuration missing (REDIS_URL/TOKEN or KV_REST_API_URL/TOKEN)');
        }

        client = new Redis({
            url,
            token,
        });
    }
    return client;
}
