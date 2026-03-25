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

        // 2. 테스트 기간 분기 (~2026.03.31)
        const now = new Date();
        const KST = new Date(now.getTime() + 9 * 60 * 60 * 1000);
        const isTestPeriod = KST < new Date('2026-04-01T00:00:00+09:00');
        
        let enhancedPrices: Record<string, any> = {};

        if (isTestPeriod) {
            // [테스트 전용 로직]
            // 기본: Sheet 가격 전체를 "none"으로 출력
            enhancedPrices = Object.entries(currentPrices).reduce((acc, [code, price]) => {
                acc[code] = {
                    price,
                    prevPrice: null,
                    changeAmount: null,
                    changeDirection: 'none',
                    changeRate: null,
                };
                return acc;
            }, {} as any);

            // 카테고리 223(철물/부자재) 항목에 테스트 변동 데이터 주입
            // 스냅샷의 variantCode를 키로 직접 출력 (프론트엔드 매칭용)
            let snapshot: Record<string, any> = {};
            if (client) {
                await client.connect();
                const snapshotStr = await client.get('catalog:snapshot:v1');
                snapshot = snapshotStr ? JSON.parse(snapshotStr) : {};
            }

            let hardwareIdx = 0;
            Object.values(snapshot).forEach((group: any) => {
                const categoryNos = Array.isArray(group.categoryNo) ? group.categoryNo : [];
                const isHardware = categoryNos.some((cat: any) => String(cat) === '223');
                if (!isHardware) return;

                group.children?.forEach((child: any) => {
                    const vCode = child.variantCode || child.variant_code;
                    const childPrice = Number(child.price || 0);

                    if (!vCode || childPrice <= 0) {
                        hardwareIdx++;
                        return;
                    }

                    const mode = hardwareIdx % 3;
                    let prevPrice = childPrice;
                    let changeAmount = 0;
                    let changeDirection = 'same';

                    if (mode === 0) {
                        changeAmount = Math.floor(childPrice * 0.02);
                        changeDirection = 'up';
                        prevPrice = childPrice - changeAmount;
                    } else if (mode === 1) {
                        changeAmount = Math.floor(childPrice * 0.015);
                        changeDirection = 'down';
                        prevPrice = childPrice + changeAmount;
                    }

                    enhancedPrices[vCode] = {
                        price: childPrice,
                        prevPrice,
                        changeAmount,
                        changeDirection,
                        changeRate: prevPrice > 0 ? ((childPrice - prevPrice) / prevPrice) * 100 : 0,
                    };

                    hardwareIdx++;
                });
            });

        } else {
            // [운영 로직] 전일 스냅샷 비교
            let yesterdayPrices: Record<string, number> | null = null;
            if (client) {
                await client.connect();
                // ... (생략된 기존 운영 로직) ...
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

            enhancedPrices = Object.entries(currentPrices).reduce((acc, [code, price]) => {
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
        }

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
        try { if (client) await client.quit(); } catch { /* client may not be connected */ }
    }
}
