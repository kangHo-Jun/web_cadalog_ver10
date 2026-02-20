'use client';

import React, { useMemo, useState, useEffect, useCallback, memo, useRef } from 'react';
import { Loader2, ChevronRight, Plus, Minus } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import toast from 'react-hot-toast';
import { GroupedProduct, ChildItem } from '@/lib/product-utils';

interface ProductListPhase1Props {
    groups: GroupedProduct[];
    loading: boolean;
    error: any;
}

/**
 * ChildOption: 개별 옵션 카드 (option_value 기반)
 */
const ChildOption = memo(({
    child,
    parentName,
    onAdd,
    isFocused,
}: {
    child: ChildItem;
    parentName: string;
    onAdd: (child: ChildItem, quantity: number) => void;
    isFocused: boolean;
}) => {
    const [quantity, setQuantity] = useState(1);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isFocused) {
            ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [isFocused]);

    const formattedPrice = new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW',
    }).format(child.price);

    return (
        <div
            ref={ref}
            className={`grid grid-cols-[1fr_110px_148px_100px] items-center gap-3 px-4 py-3 border-t border-gray-100 transition-colors ${isFocused ? 'bg-green-50 ring-2 ring-[#48BB78] ring-inset' : 'hover:bg-gray-50/60'
                }`}
        >
            {/* 옵션명 (예: 30T x 1000 x 1800) */}
            <span className="text-[13px] font-medium text-gray-800 truncate">
                {child.name}
            </span>

            {/* 가격 */}
            <span className="text-[13px] font-bold text-gray-700 text-right">
                {formattedPrice}
            </span>

            {/* 수량 UI */}
            <div className="flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden">
                <button
                    onClick={(e) => { e.stopPropagation(); setQuantity(prev => Math.max(1, prev - 1)); }}
                    className="px-3 py-2 hover:bg-gray-100 text-gray-500 text-sm leading-none"
                >
                    −
                </button>
                <input
                    type="number"
                    value={quantity}
                    min={1}
                    max={9999}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    onClick={(e) => { e.stopPropagation(); e.currentTarget.select(); }}
                    onFocus={(e) => e.currentTarget.select()}
                    className="w-12 text-center text-xs font-bold border-x border-gray-200 focus:outline-none py-2 bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                    onClick={(e) => { e.stopPropagation(); setQuantity(prev => Math.min(9999, prev + 1)); }}
                    className="px-3 py-2 hover:bg-gray-100 text-gray-500 text-sm leading-none"
                >
                    +
                </button>
            </div>

            {/* 담기 버튼 */}
            <button
                onClick={(e) => { e.stopPropagation(); onAdd(child, quantity); }}
                className="w-full py-2 rounded-lg text-white text-[12px] font-bold transition-all active:scale-[0.97]"
                style={{ background: '#48BB78' }}
            >
                담기
            </button>
        </div>
    );
});

ChildOption.displayName = 'ChildOption';

/**
 * ProductCard: 부모 그룹 카드
 */
const ProductCard = memo(({
    group,
    onAdd,
    isExpanded,
    onToggle,
    focusedChildIndex,
}: {
    group: GroupedProduct;
    onAdd: (child: ChildItem, quantity: number) => void;
    isExpanded: boolean;
    onToggle: () => void;
    focusedChildIndex: number | null;
}) => {
    const headerRef = useRef<HTMLDivElement>(null);
    const isSingleProduct = group.children.length === 1 && group.children[0].isSingle;

    useEffect(() => {
        if (focusedChildIndex === null && headerRef.current) {
            headerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [focusedChildIndex]);

    return (
        <div
            className={`bg-white border transition-all duration-200 rounded-xl overflow-hidden mb-3 mx-1 shadow-sm ${isExpanded ? 'border-[#FF6B6B] ring-1 ring-[#FF6B6B]' : 'border-gray-200'
                }`}
        >
            {/* Parent Header */}
            <div
                ref={headerRef}
                onClick={isSingleProduct ? undefined : onToggle}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${isSingleProduct
                        ? 'cursor-default'
                        : 'cursor-pointer hover:bg-gray-50/50'
                    } ${focusedChildIndex === null ? 'bg-red-50/30' : ''}`}
            >
                <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-100">
                    {group.detail_image ? (
                        <img src={group.detail_image} alt={group.parentName} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-[9px] text-gray-300">No Image</div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    {/* [수정] parentName 전체 출력 (절삭 없음) */}
                    <h3 className="text-[15px] font-bold text-gray-900 truncate">
                        {group.parentName}
                    </h3>
                    <p className="text-[11px] text-gray-500 font-medium">
                        {isSingleProduct ? '단일 상품' : `${group.children.length}개 옵션`}
                    </p>
                </div>
                {/* 단일 상품이면 아코디언 아이콘 숨김 */}
                {!isSingleProduct && (
                    <ChevronRight
                        className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-[#FF6B6B]' : ''}`}
                    />
                )}
                {/* 단일 상품은 헤더에 바로 담기 버튼 */}
                {isSingleProduct && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onAdd(group.children[0], 1); }}
                        className="px-4 py-2 rounded-lg text-white text-[12px] font-bold transition-all active:scale-[0.97]"
                        style={{ background: '#48BB78' }}
                    >
                        담기
                    </button>
                )}
            </div>

            {/* Child Options List (옵션 상품만 렌더링) */}
            {!isSingleProduct && isExpanded && (
                <div className="bg-white">
                    {group.children.map((child, idx) => (
                        <ChildOption
                            key={child.variantCode || idx}
                            child={child}
                            parentName={group.parentName}
                            onAdd={onAdd}
                            isFocused={focusedChildIndex === idx}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});

ProductCard.displayName = 'ProductCard';

export default function ProductListPhase1({
    groups,
    loading,
    error,
}: ProductListPhase1Props) {
    const addToCart = useCartStore((s) => s.addToCart);
    const undoLastAdd = useCartStore((s) => s.undoLastAdd);

    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [focusedIndex, setFocusedIndex] = useState(0);

    const handleAdd = useCallback((child: ChildItem, quantity: number) => {
        // CartStore에 맞게 변환
        addToCart(
            {
                product_no: child.variantCode ? parseInt(child.variantCode.replace(/\D/g, ''), 10) : 0,
                product_name: child.name,
                price: String(child.price),
                product_code: child.variantCode || '',
                detail_image: '',
            },
            quantity
        );

        toast.success((t) => (
            <div className="flex items-center gap-3">
                <span className="text-[13px] font-medium text-gray-900">
                    {child.name} {quantity}개 담기 완료
                </span>
                <button
                    onClick={() => {
                        undoLastAdd();
                        toast.dismiss(t.id);
                        toast('취소되었습니다', { icon: '↩️', duration: 1500 });
                    }}
                    className="bg-gray-900 text-white px-3 py-1.5 rounded-md text-[11px] font-bold hover:bg-gray-800 transition-all"
                >
                    취소 (Undo)
                </button>
            </div>
        ), { duration: 3000 });
    }, [addToCart, undoLastAdd]);

    const toggleGroup = useCallback((id: string) => {
        setExpandedId(prev => prev === id ? null : id);
    }, []);

    if (loading) return (
        <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-white/40" />
        </div>
    );

    if (error) return (
        <div className="py-20 text-center text-red-400 text-sm">데이터를 불러오는 데 실패했습니다.</div>
    );

    if (groups.length === 0) return (
        <div className="py-20 text-center text-white/40 text-sm">검색 결과가 없습니다.</div>
    );

    return (
        <div className="pb-10 space-y-1">
            {groups.map((group, index) => {
                const isExpanded = expandedId === group.id;
                return (
                    <ProductCard
                        key={group.id}
                        group={group}
                        onAdd={handleAdd}
                        isExpanded={isExpanded}
                        onToggle={() => toggleGroup(group.id)}
                        focusedChildIndex={null}
                    />
                );
            })}
        </div>
    );
}
