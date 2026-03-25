import { NextResponse } from 'next/server';
import { getPriceMap } from '@/lib/price-map';
import { createClient } from 'redis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    const redisUrl = process.env.KV_REDIS_URL;
    const client = redisUrl ? createClient({ url: redisUrl }) : null;

    try {
        // 1. 현재 가격 맵 (Sheet)
        const currentPrices = await getPriceMap();

        // 2. 전일 스냅샷 조회 (KST 기준 어제)
        let yesterdayPrices: Record<string, number> | null = null;
        if (client) {
            await client.connect();
            const kstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
            const kstYesterday = new Date(kstNow);
            kstYesterday.setDate(kstNow.getDate() - 1);
            const dateStr = kstYesterday.toISOString().split('T')[0];
            const snapshotKey = `price_snapshot:${dateStr}`;

            const cached = await client.get(snapshotKey);
            if (cached) {
                yesterdayPrices = JSON.parse(cached);
            }
        }

        // 3. 메타데이터 통합
        const enhancedPrices = Object.entries(currentPrices).reduce((acc, [code, price]) => {
            const prevPrice = yesterdayPrices ? yesterdayPrices[code] : null;
            let changeAmount = null;
            let changeDirection = 'none';

            if (prevPrice !== null && prevPrice !== undefined) {
                changeAmount = price - prevPrice;
                if (changeAmount > 0) changeDirection = 'up';
                else if (changeAmount < 0) changeDirection = 'down';
                else changeDirection = 'same';
            }

            acc[code] = {
                price,
                prevPrice,
                changeAmount,
                changeDirection,
                changeRate: prevPrice ? ((price - prevPrice) / prevPrice) * 100 : null
            };
            return acc;
        }, {} as any);

        return NextResponse.json(enhancedPrices, {
            headers: {
                'Cache-Control': 'no-store, max-age=0, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            },
        });
    } catch (error: any) {
        console.error('Failed to fetch prices map:', error?.message || error);
        return NextResponse.json(
            { error: 'Failed to fetch prices', details: error?.message || 'Unknown error' },
            { status: 500 }
        );
    } finally {
        if (client) await client.quit();
    }
}
