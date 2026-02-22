'use client';

import React, { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import StickySearchHeader from './StickySearchHeader';
import FixedSidebar from './FixedSidebar';
import ProductListPhase1 from './ProductListPhase1';
import CartDrawer from './CartDrawer';
import { useCartStore } from '@/store/useCartStore';
import { log, trackMetric } from '@/lib/logger';
import { GroupedProduct } from '@/lib/product-utils';

const fetcher = (url: string) =>
    fetch(url).then((res) => {
        if (!res.ok) throw new Error('fetch failed');
        return res.json();
    });

// 200ms debounce hook
function useDebounce(value: string, ms = 200) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return debounced;
}

export default function Phase1CatalogView() {
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const debouncedSearch = useDebounce(search, 200);

    const totalItems = useCartStore((s) => s.totalItems());
    const totalAmount = useCartStore((s) => s.totalAmount());
    const clearCart = useCartStore((s) => s.clearCart);

    // [수정] 데이터 소스: /api/products → /api/debug-snapshot (Redis 스냅샷)
    const { data, error, isLoading } = useSWR('/api/debug-snapshot', fetcher, {
        revalidateOnFocus: false,
        dedupingInterval: 60000,
        onError: (err) => {
            log('error', 'Snapshot fetch failed', { error: err.message });
        }
    });

    // Performance Tracking
    useEffect(() => {
        if (debouncedSearch || selectedCategory) {
            const start = performance.now();
            return () => {
                const duration = performance.now() - start;
                if (data) trackMetric('search_fetch_duration', duration, { keyword: debouncedSearch, category: selectedCategory });
            };
        }
    }, [debouncedSearch, selectedCategory, data]);

    // [수정] Redis 스냅샷은 Record<string, GroupedProduct> → Object.values()로 배열 변환 후 필터
    const groups = useMemo((): GroupedProduct[] => {
        if (!data) return [];
        const allGroups: GroupedProduct[] = Object.values(data);
        return allGroups.filter((group) => {
            if (selectedCategory && !group.categoryNo?.includes(selectedCategory)) return false;
            if (debouncedSearch && !group.parentName.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
            return true;
        });
    }, [data, selectedCategory, debouncedSearch]);

    const handleCategoryChange = (no: number) => {
        const start = performance.now();
        setSelectedCategory(no === 0 ? null : no);
        trackMetric('category_switch_trigger', performance.now() - start);
    };

    return (
        <div className="h-screen overflow-hidden flex flex-col">
            {/* Sticky header */}
            <StickySearchHeader
                search={search}
                onSearchChange={setSearch}
                onCartClick={() => setDrawerOpen(true)}
            />

            {/* Cart Drawer */}
            <CartDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

            {/* Body: fixed sidebar + scrollable content */}
            <div className="flex flex-1 overflow-hidden flex-row">
                <FixedSidebar
                    selectedCategoryNo={selectedCategory}
                    onCategoryChange={handleCategoryChange}
                />

                {/* Main content — offset left by sidebar width */}
                <main className="flex-1 overflow-hidden flex flex-col p-4">
                    {/* Product count */}
                    <p className="text-xs text-gray-500 mb-3 flex-shrink-0">
                        {isLoading ? '불러오는 중...' : `총 ${groups.length}개 상품 그룹`}
                    </p>
                    {/* 리스트 — 내부 스크롤만 발생 */}
                    <div className="flex-1 overflow-y-auto pb-24">
                        <ProductListPhase1
                            groups={groups}
                            loading={isLoading}
                            error={error}
                        />
                    </div>
                </main>
            </div>

            {/* Cart bar (bottom) — 견적요청 연결 */}
            {totalItems > 0 && (
                <div
                    className="absolute bottom-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 border-t border-white/10 shadow-2xl"
                    style={{ background: '#123628' }}
                >
                    <span className="text-white text-sm">
                        🛒 {totalItems}개 선택 |{' '}
                        <span className="font-bold">
                            {new Intl.NumberFormat('ko-KR', {
                                style: 'currency',
                                currency: 'KRW',
                            }).format(totalAmount)}
                        </span>
                    </span>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => clearCart()}
                            className="text-xs text-white/50 hover:text-white"
                        >
                            초기화
                        </button>
                        <button
                            onClick={() => router.push('/quote/summary')}
                            className="px-4 py-2 rounded-lg text-white text-sm font-semibold transition-all active:scale-[0.97]"
                            style={{ background: '#48BB78' }}
                        >
                            견적요청
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
