import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis-client';

export async function GET() {
  const start = Date.now();
  try {
    const client = getRedisClient();
    // @upstash/redis parses JSON automatically
    const snapshot = await client.get<Record<string, any>>('catalog:snapshot:v1') || {};

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
