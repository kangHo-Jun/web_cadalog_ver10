'use client';

import React, { useState, useEffect, useMemo, memo } from 'react';
import useSWR from 'swr';
import { Search, ChevronRight, AlertCircle } from 'lucide-react';
import { GroupedProduct, ChildItem } from '@/lib/product-utils';
import { formatPrice, toSupplyPrice } from '@/lib/price-utils';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface EnhancedPrice {
  price: number;
  prevPrice: number | null;
  changeAmount: number | null;
  changeDirection: 'up' | 'down' | 'same' | 'none';
  changeRate: number | null;
}

/* ── 가격 변동 표시 컴포넌트 ── */
const PriceTrend = ({ info }: { info: EnhancedPrice | undefined }) => {
  if (!info || info.changeDirection === 'none' || info.changeAmount === null) {
    return <span className="text-[10px] text-gray-400">—</span>;
  }

  const { changeDirection, changeAmount, changeRate } = info;
  const isUp = changeDirection === 'up';
  const isDown = changeDirection === 'down';
  const isSame = changeDirection === 'same';

  if (isSame) return <span className="text-[10px] text-gray-400">—</span>;

  // 공급가 기준으로 변동액 변환 (소수점 버림/반올림 처리)
  const supplyChange = toSupplyPrice(Math.abs(changeAmount));

  return (
    <div className={`flex items-center gap-1 text-[11px] font-bold ${isUp ? 'text-[#e53e3e]' : 'text-[#3182ce]'}`}>
      <span>{isUp ? '▲' : '▼'}</span>
      <span>{supplyChange.toLocaleString('ko-KR')}</span>
      <span className="opacity-80 ml-0.5">({isUp ? '+' : '-'}{changeRate?.toFixed(1)}%)</span>
    </div>
  );
};

/* ── 상품 리스트 행 ── */
const MobilePriceItem = memo(({ item, priceInfo }: { item: ChildItem; priceInfo: EnhancedPrice | undefined }) => {
  const supplyPrice = item.price ? toSupplyPrice(item.price) : 0;

  return (
    <div className="bg-white px-4 py-4 border-b border-gray-100 active:bg-gray-50 transition-colors">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-[14px] font-bold text-gray-900 leading-tight mb-1">
            {item.name}
          </h4>
          <p className="text-[11px] text-gray-400 font-medium">규격: {item.variantCode || '-'}</p>
        </div>
        <div className="flex flex-col items-end flex-shrink-0">
          <span className="text-[15px] font-extrabold text-gray-900">
            {supplyPrice > 0 ? formatPrice(supplyPrice) : '가격문의'}
          </span>
          <PriceTrend info={priceInfo} />
        </div>
      </div>
    </div>
  );
});
MobilePriceItem.displayName = 'MobilePriceItem';

export default function PriceCatalogMobileView() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  // Data fetching
  const { data: snapshotData, isLoading: isSnapshotLoading } = useSWR('/api/debug-snapshot', fetcher);
  const { data: priceData, isLoading: isPriceLoading } = useSWR('/api/prices', fetcher);
  const { data: catData } = useSWR('/api/categories?type=quote', fetcher);

  const categories = catData?.categories || [];
  const isLoading = isSnapshotLoading || isPriceLoading;

  // Filtering
  const filteredItems = useMemo(() => {
    if (!snapshotData?.lastSnapshot) return [];
    
    // 전체 상품 리스트 (평탄화)
    const allGroups: GroupedProduct[] = Object.values(snapshotData.lastSnapshot);
    const flattened: ChildItem[] = [];
    
    allGroups.forEach(group => {
      // 카테고리 필터
      if (selectedCategory && !group.categoryNo?.includes(selectedCategory)) return;
      
      group.children.forEach(child => {
        // 검색 필터 (부모 이름 + 옵션 이름)
        const fullName = `${group.parentName} ${child.name}`.toLowerCase();
        if (debouncedSearch && !fullName.includes(debouncedSearch.toLowerCase())) return;
        
        flattened.push({
          ...child,
          name: group.children.length === 1 && child.isSingle ? group.parentName : `${group.parentName} - ${child.name}`
        });
      });
    });

    return flattened;
  }, [snapshotData, selectedCategory, debouncedSearch]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── 상단 헤더 ── */}
      <header className="sticky top-0 z-50 flex flex-col shadow-md" style={{ background: '#1e3a5f' }}>
        <div className="h-14 flex items-center px-4">
          <h1 className="text-white font-bold text-lg">실시간 가격정보</h1>
        </div>

        {/* 검색 입력 */}
        <div className="px-4 pb-3">
          <div className="relative flex items-center bg-white/10 rounded-xl px-3 py-2.5 border border-white/20 focus-within:bg-white/20 transition-all">
            <Search className="w-4 h-4 text-white/60 mr-2" />
            <input
              type="text"
              placeholder="품목명 또는 규격 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-[14px] text-white placeholder:text-white/40"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-white/40 p-1">✕</button>
            )}
          </div>
        </div>

        {/* 카테고리 칩 (가로 스크롤) */}
        <div className="bg-white border-b border-gray-200 overflow-x-auto no-scrollbar scroll-smooth">
          <div className="flex px-4 py-3 gap-2 min-w-max">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-1.5 rounded-full text-[13px] font-bold transition-all ${
                selectedCategory === null ? 'bg-[#1e3a5f] text-white shadow-sm' : 'bg-gray-100 text-gray-500 border border-gray-200'
              }`}
            >
              전체
            </button>
            {categories.map((cat: any) => (
              <button
                key={cat.category_no}
                onClick={() => setSelectedCategory(cat.category_no)}
                className={`px-4 py-1.5 rounded-full text-[13px] font-bold transition-all ${
                  selectedCategory === cat.category_no ? 'bg-[#1e3a5f] text-white shadow-sm' : 'bg-gray-100 text-gray-500 border border-gray-200'
                }`}
              >
                {cat.category_name}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── 본문 리스트 ── */}
      <main className="flex-1 overflow-y-auto">
        {selectedCategory === null && !debouncedSearch ? (
          <div className="flex flex-col items-center justify-center py-24 px-10 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-[#1e3a5f]/40" />
            </div>
            <h3 className="text-gray-900 font-bold mb-1">가격 정보를 조회하세요</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              상단 카테고리를 선택하거나<br />검색어를 입력하면 실시간 단가를 확인할 수 있습니다.
            </p>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-[12px] text-gray-400">최신 가격 정보를 불러오는 중...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-[13px] text-gray-400 italic">검색 결과가 없습니다.</p>
          </div>
        ) : (
          <div className="pb-10">
            <div className="bg-gray-50 px-4 py-2.5">
              <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">
                총 {filteredItems.length}개 품목
              </span>
            </div>
            {filteredItems.map((item, idx) => (
              <MobilePriceItem
                key={`${item.variantCode}-${idx}`}
                item={item}
                priceInfo={priceData?.[item.variantCode || '']}
              />
            ))}
            
            {/* 하단 푸터 안내 */}
            <div className="p-8 pb-12 text-center bg-gray-50">
              <p className="text-[11px] text-gray-400 leading-relaxed flex items-center justify-center gap-1">
                <AlertCircle className="w-3 h-3" />
                모든 단가는 부가세(VAT) 별도입니다.
              </p>
              <p className="text-[11px] text-gray-300 mt-2">© DAESAN. All rights reserved.</p>
            </div>
          </div>
        )}
      </main>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
