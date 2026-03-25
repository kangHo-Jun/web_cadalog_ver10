import { NextResponse } from 'next/server';
import { createClient } from 'redis';
import { getPriceMap } from '@/lib/price-map';

export const dynamic = 'force-dynamic';

/**
 * 전일 가격 스냅샷 저장 크론
 * 매일 KST 00:00 (UTC 15:00) 실행 권장
 */
export async function GET(request: Request) {
    // Vercel Cron Secret 검증 (필요시)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const redisUrl = process.env.KV_REDIS_URL;
    if (!redisUrl) {
        return NextResponse.json({ error: 'KV_REDIS_URL missing' }, { status: 500 });
    }

    const client = createClient({ url: redisUrl });

    try {
        await client.connect();

        // 1. 현재 가격 데이터 가져오기 (Google Sheets 기반)
        const priceMap = await getPriceMap();

        // 2. KST 기준 오늘 날짜 키 생성 (예: price_snapshot:2026-03-26)
        const kstDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        const dateStr = kstDate.toISOString().split('T')[0];
        const snapshotKey = `price_snapshot:${dateStr}`;

        // 3. Redis 저장 (TTL 60일)
        await client.set(snapshotKey, JSON.stringify(priceMap), {
            EX: 60 * 24 * 60 * 60 // 60 days
        });

        console.log(`✅ Price snapshot saved: ${snapshotKey}`);

        return NextResponse.json({
            success: true,
            key: snapshotKey,
            count: Object.keys(priceMap).length
        });
    } catch (error: any) {
        console.error('❌ Snapshot failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        await client.quit();
    }
}
