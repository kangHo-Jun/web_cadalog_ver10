import { NextResponse } from 'next/server';
import { redisGet } from '@/lib/redis-client';

export async function GET() {
  const start = Date.now();
  try {
    const snapshot = await redisGet<Record<string, any>>('catalog:snapshot:v1') || {};

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
