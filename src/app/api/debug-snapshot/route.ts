import { NextResponse } from 'next/server';
import { createClient } from 'redis';

export async function GET() {
  const start = Date.now();
  try {
    const client = createClient({ url: process.env.KV_REDIS_URL });
    await client.connect();
    const data = await client.get('catalog:snapshot:v1');
    await client.quit();
    const snapshot = data ? JSON.parse(data) : {};
    return NextResponse.json({
      status: 'OK',
      responseTime: Date.now() - start + 'ms',
      snapshotSize: Object.keys(snapshot).length,
      lastSnapshot: snapshot
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'ERROR',
      error: error.message
    }, { status: 500 });
  }
}
