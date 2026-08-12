import { NextResponse } from 'next/server';
import { createClient } from 'redis';

const LOG_KEY = 'prod_logs';

let redisClient: any = null;
async function getRedis() {
    if (!redisClient) {
        redisClient = createClient({ url: process.env.KV_REDIS_URL });
        await redisClient.connect();
    }
    return redisClient;
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const client = await getRedis();

        // Store logs in a list, keep last 1000
        await client.lPush(LOG_KEY, JSON.stringify(body));
        await client.lTrim(LOG_KEY, 0, 999);

        return NextResponse.json({ ok: true });
    } catch (error) {
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}

export async function GET() {
    try {
        const client = await getRedis();
        const logs = await client.lRange(LOG_KEY, 0, -1);
        return NextResponse.json({ logs: logs.map((l: string) => JSON.parse(l)) });
    } catch (error) {
        return NextResponse.json({ error: 'failed to fetch logs' }, { status: 500 });
    }
}
