'use client';

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Search, ChevronRight } from 'lucide-react';
import FixedSidebar from '@/components/phase1/FixedSidebar';
import { GroupedProduct, ChildItem } from '@/lib/product-utils';
import { formatSupplyPrice, toSupplyPrice } from '@/lib/price-utils';

interface EnhancedPrice {
    price: number;
    prevPrice: number | null;
    changeAmount: number | null;
    changeDirection: 'up' | 'down' | 'same' | 'none';
    changeRate: number | null;
}

const fetcher = (url: string) =>
    fetch(url).then((res) => {
        if (!res.ok) throw new Error('fetch failed');
        return res.json();
    });

function useDebounce(value: string, ms = 200) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return debounced;
}

/* ── 가격 변동 표시 ── */
const PriceTrend = memo(({ info }: { info: EnhancedPrice | undefined }) => {
    if (!info || info.changeDirection === 'none' || info.changeAmount === null) {
        return null;
    }
    if (info.changeDirection === 'same') {
        return <span className="text-[10px] text-gray-400">—</span>;
    }

    const isUp = info.changeDirection === 'up';
    const supplyChange = toSupplyPrice(Math.abs(info.changeAmount));

    return (
        <div className={`flex items-center gap-1 text-[11px] font-bold ${isUp ? 'text-[#e53e3e]' : 'text-[#3182ce]'}`}>
            <span>{isUp ? '▲' : '▼'}</span>
            <span>{supplyChange.toLocaleString('ko-KR')}</span>
            <span className="opacity-80 ml-0.5">
                ({isUp ? '+' : '-'}{info.changeRate?.toFixed(1)}%)
            </span>
        </div>
    );
});
PriceTrend.displayName = 'PriceTrend';

/* ── 가격 전용 자녀 행 (장바구니 없음) ── */
const PriceChildRow = memo(({ child, priceInfo }: { child: ChildItem; priceInfo: EnhancedPrice | undefined }) => {
    const formattedPrice =
        child.price && child.price > 0 ? formatSupplyPrice(child.price) : '가격문의';

    return (
        <div className="grid grid-cols-[1fr_160px] items-center gap-3 px-4 py-3 border-t border-gray-100 hover:bg-gray-50/60 transition-colors">
            <span className="text-[13px] font-medium text-gray-800 truncate">
                {child.name}
            </span>
            <div className="flex flex-col items-end">
                <span
                    className={
                        child.price && child.price > 0
                            ? 'text-[13px] font-bold text-blue-600'
                            : 'text-[13px] text-gray-400'
                    }
                >
                    {formattedPrice}
                </span>
                <PriceTrend info={priceInfo} />
                <span className="text-[9px] text-gray-400 font-medium leading-none mt-0.5">
                    (VAT 별도)
                </span>
            </div>
        </div>
    );
});
PriceChildRow.displayName = 'PriceChildRow';

/* ── 가격 전용 상품 카드 (장바구니 없음) ── */
const PriceProductCard = memo(
    ({
        group,
        isExpanded,
        onToggle,
        priceData,
    }: {
        group: GroupedProduct;
        isExpanded: boolean;
        onToggle: () => void;
        priceData: Record<string, EnhancedPrice> | null;
    }) => {
        const isSingleProduct =
            group.children.length === 1 && group.children[0].isSingle;

        const singlePriceInfo = isSingleProduct
            ? priceData?.[group.children[0].variantCode || '']
            : undefined;

        return (
            <div
                className={`bg-white border transition-all duration-200 rounded-xl overflow-hidden mb-3 mx-1 shadow-sm ${
                    isExpanded
                        ? 'border-[#2563EB] ring-1 ring-[#2563EB]'
                        : 'border-gray-200'
                }`}
            >
                {/* 부모 헤더 */}
                <div
                    onClick={isSingleProduct ? undefined : onToggle}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                        isSingleProduct
                            ? 'cursor-default'
                            : 'cursor-pointer hover:bg-gray-50/50'
                    }`}
                >
                    <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-100">
                        {group.detail_image ? (
                            <img
                                src={group.detail_image}
                                alt={group.parentName}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-[9px] text-gray-300">
                                No Image
                            </div>
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        <h3 className="text-[15px] font-bold text-gray-900 truncate">
                            {group.parentName}
                        </h3>
                        <p className="text-[11px] text-gray-500 font-medium">
                            {isSingleProduct
                                ? '단일 상품'
                                : `${group.children.length}개 옵션`}
                        </p>
                    </div>

                    {/* 단일 상품: 가격 + 변동 표시 */}
                    {isSingleProduct && (
                        <div className="flex flex-col items-end">
                            <span
                                className={
                                    group.children[0].price && group.children[0].price > 0
                                        ? 'text-[13px] font-bold text-blue-600'
                                        : 'text-[13px] text-gray-400'
                                }
                            >
                                {group.children[0].price && group.children[0].price > 0
                                    ? formatSupplyPrice(group.children[0].price)
                                    : '가격문의'}
                            </span>
                            <PriceTrend info={singlePriceInfo} />
                            <span className="text-[9px] text-gray-400">(VAT 별도)</span>
                        </div>
                    )}

                    {/* 옵션 상품: 아코디언 아이콘 */}
                    {!isSingleProduct && (
                        <ChevronRight
                            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                                isExpanded ? 'rotate-90 text-[#2563EB]' : ''
                            }`}
                        />
                    )}
                </div>

                {/* 자녀 옵션 목록 */}
                {!isSingleProduct && isExpanded && (
                    <div className="bg-white">
                        {group.children.map((child, idx) => (
                            <PriceChildRow
                                key={child.variantCode || idx}
                                child={child}
                                priceInfo={priceData?.[child.variantCode || '']}
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    }
);
PriceProductCard.displayName = 'PriceProductCard';

/* ── 메인 뷰 ── */
export default function PriceCatalogView() {
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const debouncedSearch = useDebounce(search, 200);

    /* 데이터: Redis 스냅샷 (상품 목록) */
    const { data, error, isLoading } = useSWR('/api/debug-snapshot', fetcher, {
        revalidateOnFocus: false,
        dedupingInterval: 60000,
    });

    /* 가격 변동 데이터 */
    const { data: priceData } = useSWR<Record<string, EnhancedPrice>>('/api/prices', fetcher, {
        revalidateOnFocus: false,
        dedupingInterval: 60000,
    });

    const groups = useMemo((): GroupedProduct[] => {
        if (!data) return [];
        const allGroups: GroupedProduct[] = Object.values(data.lastSnapshot ?? data);
        return allGroups.filter((group) => {
            if (selectedCategory && !group.categoryNo?.includes(selectedCategory))
                return false;
            if (debouncedSearch) {
                const term = debouncedSearch.toLowerCase();
                const matchParent = group.parentName.toLowerCase().includes(term);
                const matchChild = group.children?.some(c => c.name.toLowerCase().includes(term));
                if (!matchParent && !matchChild) return false;
            }
            return true;
        });
    }, [data, selectedCategory, debouncedSearch]);

    const handleCategoryChange = (no: number) => {
        setSelectedCategory(no === 0 ? null : no);
    };

    const toggleGroup = useCallback((id: string) => {
        setExpandedId((prev) => (prev === id ? null : id));
    }, []);

    return (
        <div className="flex flex-col">
            {/* ── 헤더: 탭 네비게이션 + 검색 ── */}
            <header className="sticky top-0 z-50 flex flex-col" style={{ background: '#1e3a5f' }}>
                {/* 탭 네비게이션 */}
                <nav className="flex items-center border-b border-white/10">
                    <Link
                        href="/"
                        className="px-5 py-2.5 text-sm font-medium text-white/60 hover:text-white/80 transition-colors"
                    >
                        웹카탈로그
                    </Link>
                    <span className="px-5 py-2.5 text-sm font-bold text-white border-b-2 border-white">
                        실시간 가격정보
                    </span>
                </nav>

                {/* 검색 바 */}
                <div className="flex items-center gap-3 px-4 py-3">
                    <a href="https://daesan.ai" target="_self">
                        <span className="text-white font-bold text-lg tracking-tight whitespace-nowrap">
                            DAESAN
                        </span>
                    </a>

                    <div className="flex-1 flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 border border-white/20">
                        <Search className="w-4 h-4 text-white/60 flex-shrink-0" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="상품 검색..."
                            className="flex-1 text-sm text-white bg-transparent border-none outline-none placeholder:text-white/50"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="text-xs text-white/60 hover:text-white"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* ── 본문: 사이드바 + 상품 목록 ── */}
            <div className="flex flex-1 overflow-hidden flex-row">
                <FixedSidebar
                    selectedCategoryNo={selectedCategory}
                    onCategoryChange={handleCategoryChange}
                />

                <main className="flex-1 overflow-hidden flex flex-col relative p-4">
                    <p className="text-xs text-gray-500 mb-3 flex-shrink-0">
                        {isLoading
                            ? '불러오는 중...'
                            : `총 ${groups.length}개 상품 그룹`}
                    </p>

                    <div className="flex-1 overflow-y-auto pb-8">
                        {isLoading ? (
                            <div className="flex justify-center items-center py-20">
                                <div className="w-8 h-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                            </div>
                        ) : error ? (
                            <div className="py-20 text-center text-red-400 text-sm">
                                데이터를 불러오는 데 실패했습니다.
                            </div>
                        ) : groups.length === 0 ? (
                            <div className="py-20 text-center text-gray-400 text-sm">
                                검색 결과가 없습니다.
                            </div>
                        ) : (
                            <div className="pb-10 space-y-1">
                                {groups.map((group) => (
                                    <PriceProductCard
                                        key={group.id}
                                        group={group}
                                        isExpanded={expandedId === group.id}
                                        onToggle={() => toggleGroup(group.id)}
                                        priceData={priceData ?? null}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
