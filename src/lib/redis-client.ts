import { createClient } from 'redis';

export async function redisGet<T = unknown>(key: string): Promise<T | null> {
    const client = createClient({ url: process.env.KV_REDIS_URL });
    await client.connect();
    try {
        const raw = await client.get(key);
        if (raw == null) return null;
        try {
            return JSON.parse(raw) as T;
        } catch {
            return raw as unknown as T;
        }
    } finally {
        await client.quit();
    }
}

export async function redisSet(
    key: string,
    value: unknown,
    options?: { EX?: number }
): Promise<void> {
    const client = createClient({ url: process.env.KV_REDIS_URL });
    await client.connect();
    try {
        const payload = typeof value === 'string' ? value : JSON.stringify(value);
        if (options?.EX) {
            await client.set(key, payload, { EX: options.EX });
        } else {
            await client.set(key, payload);
        }
    } finally {
        await client.quit();
    }
}
