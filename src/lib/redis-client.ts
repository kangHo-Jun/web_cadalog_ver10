import { createClient, type RedisClientType } from 'redis';

let client: RedisClientType | null = null;
let connectPromise: Promise<RedisClientType> | null = null;

async function getRedisClient(): Promise<RedisClientType> {
    if (client) return client;
    if (connectPromise) return connectPromise;

    const url = process.env.KV_REDIS_URL;
    if (!url) {
        throw new Error('Redis configuration missing (KV_REDIS_URL)');
    }

    const nextClient = createClient({ url });
    nextClient.on('error', (err) => {
        console.error('❌ Redis Client Error:', err);
    });

    connectPromise = nextClient.connect().then(() => {
        client = nextClient;
        return nextClient;
    });

    return connectPromise;
}

export async function redisGet<T = unknown>(key: string): Promise<T | null> {
    const c = await getRedisClient();
    const raw = await c.get(key);
    if (raw == null) return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return raw as unknown as T;
    }
}

export async function redisSet(
    key: string,
    value: unknown,
    options?: { EX?: number }
): Promise<void> {
    const c = await getRedisClient();
    const payload = typeof value === 'string' ? value : JSON.stringify(value);
    if (options?.EX) {
        await c.set(key, payload, { EX: options.EX });
        return;
    }
    await c.set(key, payload);
}
