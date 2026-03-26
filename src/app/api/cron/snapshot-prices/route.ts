import { NextResponse } from 'next/server';
import { createClient } from 'redis';

export const dynamic = 'force-dynamic';

/**
 * 전일 가격 스냅샷 저장 크론
 * 매일 KST 00:00 (UTC 15:00) 실행
 *
 * 카탈로그 스냅샷(catalog:snapshot:v1)에서 variantCode → price 맵을 추출하여
 * price_snapshot:YYYY-MM-DD 키로 Redis에 저장한다.
 * /api/prices 운영 로직이 이 스냅샷을 전일 가격으로 참조한다.
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

        // 1. 카탈로그 스냅샷에서 variantCode → price 맵 추출
        const snapshotStr = await client.get('catalog:snapshot:v1');
        const snapshot = snapshotStr ? JSON.parse(snapshotStr) : {};

        const variantPriceMap: Record<string, number> = {};
        Object.values(snapshot).forEach((group: any) => {
            group.children?.forEach((child: any) => {
                const vCode = child.variantCode || child.variant_code;
                const price = Number(child.price || 0);
                if (vCode && price > 0) {
                    variantPriceMap[vCode] = price;
                }
            });
        });

        // 2. KST 기준 오늘 날짜 키 생성 (예: price_snapshot:2026-03-26)
        const kstDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        const dateStr = kstDate.toISOString().split('T')[0];
        const snapshotKey = `price_snapshot:${dateStr}`;

        // 3. Redis 저장 (TTL 60일)
        await client.set(snapshotKey, JSON.stringify(variantPriceMap), {
            EX: 60 * 24 * 60 * 60 // 60 days
        });

        console.log(`Price snapshot saved: ${snapshotKey} (${Object.keys(variantPriceMap).length} variants)`);

        return NextResponse.json({
            success: true,
            key: snapshotKey,
            count: Object.keys(variantPriceMap).length,
        });
    } catch (error: any) {
        console.error('Snapshot failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        try { await client.quit(); } catch { /* client may not be connected */ }
    }
}
