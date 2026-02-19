import { NextResponse } from 'next/server';
import { createClient } from 'redis';

export async function GET() {
    const client = createClient({ url: process.env.KV_REDIS_URL });
    await client.connect();
    const data = await client.get('catalog:snapshot:v1');
    await client.quit();

    return NextResponse.json(JSON.parse(data || '{}'));
}
