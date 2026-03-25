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
        
        let targetMatchesArray: string[] = [];
        let enhancedPrices: Record<string, any> = {};

        if (isTestPeriod && client) {
            // [테스트 전용 로직] 
            await client.connect();
            const snapshotStr = await client.get('catalog:snapshot:v1');
            const snapshot = snapshotStr ? JSON.parse(snapshotStr) : {};

            // 철물/부자재(223) 카테고리 품목 추출 (이름 및 코드 포함)
            const targetMatches = new Set<string>();
            Object.values(snapshot).forEach((group: any) => {
                const categoryNos = Array.isArray(group.categoryNo) ? group.categoryNo : [];
                const isHardware = categoryNos.some((cat: any) => String(cat) === '223');

                if (isHardware) {
                    if (group.parentName) targetMatches.add(String(group.parentName).trim());
                    group.children?.forEach((child: any) => {
                        if (child.name) targetMatches.add(String(child.name).trim());
                        const code = child.variantCode || child.variant_code;
                        if (code) targetMatches.add(String(code).trim());
                    });
                }
            });

            const targetMatchesArray = Array.from(targetMatches);

            // 데이터 주입
            enhancedPrices = Object.entries(currentPrices).reduce((acc, [code, price]) => {
                const trimmedKey = code.trim();
                // 1. 완전 일치 확인
                let isTarget = targetMatches.has(trimmedKey);
                
                // 2. 부분 일치 확인 (이름 형식이 다를 수 있음)
                if (!isTarget) {
                    isTarget = targetMatchesArray.some(match => 
                        trimmedKey.includes(match) || match.includes(trimmedKey)
                    );
                }
                
                if (isTarget) {
                    // 순환 인덱스 생성을 위해 해시값이나 다른 수단 사용 (여기서는 키의 문자열 합 활용)
                    const charSum = trimmedKey.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
                    const mode = charSum % 3;
                    let prevPrice = price;
                    let changeAmount = 0;
                    let changeDirection = 'same';

                    if (mode === 0) { // Up (2%)
                        changeAmount = Math.floor(price * 0.02);
                        changeDirection = 'up';
                        prevPrice = price - changeAmount;
                    } else if (mode === 1) { // Down (1.5%)
                        changeAmount = Math.floor(price * 0.015);
                        changeDirection = 'down';
                        prevPrice = price + changeAmount;
                    }

                    acc[code] = {
                        price,
                        prevPrice,
                        changeAmount,
                        changeDirection,
                        changeRate: prevPrice > 0 ? ((price - prevPrice) / prevPrice) * 100 : 0
                    };
                } else {
                    acc[code] = {
                        price,
                        prevPrice: null,
                        changeAmount: null,
                        changeDirection: 'none',
                        changeRate: null
                    };
                }
                return acc;
            }, {} as any);

        } else {
            // [운영 로직] 전일 스냅샷 비교
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

        return NextResponse.json({
            ...enhancedPrices,
            _is_test_period: isTestPeriod,
            _debug: isTestPeriod ? {
                targetMatchesCount: targetMatchesArray.length,
                sampleMatches: targetMatchesArray.slice(0, 10),
                sampleCurrent: Object.keys(currentPrices).slice(0, 10),
            } : undefined
        }, {
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
