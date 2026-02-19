'use client';

import React, { useMemo, useState, useEffect, useCallback, memo, useRef } from 'react';
import { Loader2, Plus, ChevronRight } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import { List, RowComponentProps } from 'react-window';
import toast from 'react-hot-toast';
import { log, trackMetric } from '@/lib/logger';

interface Product {
    product_no: number;
    product_name: string;
    price: string;
    detail_image: string;
    product_code: string;
}

interface ProductListPhase1Props {
    products: Product[];
    loading: boolean;
    error: any;
}

/**
 * ChildOption: 개별 규격 옵션 카드
 */
const ChildOption = memo(({
    product,
    handleCartAdd,
    cartItems,
    isFocused,
    onFocus
}: {
    product: Product;
    handleCartAdd: (p: Product, q: number, isKbd?: boolean) => void;
    cartItems: any[];
    isFocused: boolean;
    onFocus: () => void;
}) => {
    const [quantity, setQuantity] = useState(1);
    const ref = useRef<HTMLDivElement>(null);

    // Auto-scroll when focused via keyboard
    useEffect(() => {
        if (isFocused) {
            ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [isFocused]);

    const isInCart = cartItems.some((item) => item.product.product_no === product.product_no);
    const priceValue = Number(product.price);
    const formattedPrice = isNaN(priceValue) ? '0' : new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW',
    }).format(priceValue);

    // 추출된 치수 (이름에서 추출하거나 정규식 사용)
    const dimensions = product.product_name.match(/(\d+)\s*[xX]\s*(\d+)/)
        ? `${product.product_name.match(/(\d+)\s*[xX]\s*(\d+)/)?.[1]} x ${product.product_name.match(/(\d+)\s*[xX]\s*(\d+)/)?.[2]}mm`
        : product.product_name.split(' ').pop(); // Fallback

    const handleUpdateQty = (delta: number) => {
        setQuantity(prev => Math.max(1, prev + delta));
    };

    return (
        <div
            ref={ref}
            onClick={onFocus}
            className={`grid grid-cols-[1fr_110px_148px_100px] items-center gap-3 px-4 py-3 border-t border-gray-100 transition-colors ${isFocused ? 'bg-green-50 ring-2 ring-[#48BB78] ring-inset' : 'hover:bg-gray-50/60'
                }`}
        >
            {/* 치수 */}
            <span className="text-[13px] font-medium text-gray-800 truncate">
                {dimensions}
            </span>

            {/* 가격 */}
            <span className="text-[13px] font-bold text-gray-700 text-right">
                ₩{Number(product.price).toLocaleString()}원
            </span>

            {/* 수량 UI */}
            <div className="flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden">
                <button
                    onClick={(e) => { e.stopPropagation(); handleUpdateQty(-1); }}
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
                    className="w-12 text-center text-xs font-bold border-x border-gray-200 focus:outline-none py-2 bg-white"
                />
                <button
                    onClick={(e) => { e.stopPropagation(); handleUpdateQty(1); }}
                    className="px-3 py-2 hover:bg-gray-100 text-gray-500 text-sm leading-none"
                >
                    +
                </button>
            </div>

            {/* 담기 버튼 (항상 우측 고정) */}
            <button
                onClick={(e) => { e.stopPropagation(); handleCartAdd(product, quantity); }}
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
    groupKey,
    variants,
    handleCartAdd,
    cartItems,
    isExpanded,
    onToggle,
    focusedChildIndex
}: {
    groupKey: string;
    variants: Product[];
    handleCartAdd: (p: Product, q: number, isKbd?: boolean) => void;
    cartItems: any[];
    isExpanded: boolean;
    onToggle: () => void;
    focusedChildIndex: number | null; // null 이면 헤더 포커스, 숫자면 자식 포커스
}) => {
    const rep = variants[0];
    const cleanName = rep.product_name.replace(/<[^>]*>/g, '').split(' ')[0] || rep.product_name;
    const headerRef = useRef<HTMLDivElement>(null);

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
                onClick={onToggle}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${focusedChildIndex === null ? 'bg-red-50/30' : 'hover:bg-gray-50/50'
                    }`}
            >
                <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-100">
                    {rep.detail_image ? (
                        <img src={rep.detail_image} alt={cleanName} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-[9px] text-gray-300">No Image</div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-bold text-gray-900 truncate" dangerouslySetInnerHTML={{ __html: cleanName }} />
                    <p className="text-[11px] text-gray-500 font-medium">
                        {variants.length}개 옵션 있음
                    </p>
                </div>
                <ChevronRight
                    className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-[#FF6B6B]' : ''}`}
                />
            </div>

            {/* Child Options List */}
            {isExpanded && (
                <div className="bg-white">
                    {variants.map((product, idx) => (
                        <ChildOption
                            key={product.product_no}
                            product={product}
                            handleCartAdd={handleCartAdd}
                            cartItems={cartItems}
                            isFocused={focusedChildIndex === idx}
                            onFocus={() => { }} // focus logic is handled by parent list
                        />
                    ))}
                </div>
            )}
        </div>
    );
});

ProductCard.displayName = 'ProductCard';

export default function ProductListPhase1({
    products,
    loading,
    error,
}: ProductListPhase1Props) {
    const addToCart = useCartStore((s) => s.addToCart);
    const undoLastAdd = useCartStore((s) => s.undoLastAdd);
    const cartItems = useCartStore((s) => s.items);

    const [listHeight, setListHeight] = useState(600);
    const [focusedIndex, setFocusedIndex] = useState(0);
    const [expandedProduct, setExpandedProduct] = useState<string | null>(null); // 단일 Accordion
    const listRef = useRef<any>(null);

    useEffect(() => {
        const updateHeight = () => setListHeight(window.innerHeight - 150);
        updateHeight();
        window.addEventListener('resize', updateHeight);
        return () => window.removeEventListener('resize', updateHeight);
    }, []);

    const groups = useMemo(() => {
        const map = new Map<string, Product[]>();
        products.forEach((p) => {
            const key = p.product_code && p.product_code.length > 1
                ? p.product_code.slice(0, -1)
                : String(p.product_no);
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(p);
        });
        return Array.from(map.entries());
    }, [products]);

    // 평탄화된 리스트 (포커스 이동용)
    const flatList = useMemo(() => {
        const list: { type: 'parent' | 'child', groupIndex: number, childIndex?: number, key: string }[] = [];
        groups.forEach(([key, variants], gIdx) => {
            list.push({ type: 'parent', groupIndex: gIdx, key });
            if (expandedProduct === key) {
                variants.forEach((v, cIdx) => {
                    list.push({ type: 'child', groupIndex: gIdx, childIndex: cIdx, key: `${key}-${v.product_no}` });
                });
            }
        });
        return list;
    }, [groups, expandedProduct]);

    const handleCartAdd = useCallback((product: Product, quantity: number = 1, isKeyboard: boolean = false) => {
        const start = performance.now();
        addToCart(
            {
                product_no: product.product_no,
                product_name: product.product_name,
                price: product.price,
                product_code: product.product_code,
                detail_image: product.detail_image,
            },
            quantity
        );
        trackMetric('cart_add_duration', performance.now() - start, { isKeyboard });

        toast.success((t) => (
            <div className="flex items-center gap-3">
                <span className="text-[13px] font-medium text-gray-900">
                    {product.product_name.replace(/<[^>]*>/g, '')} {quantity}개 담기 완료
                </span>
                <button
                    onClick={() => {
                        log('info', 'Undo clicked', { product_no: product.product_no });
                        undoLastAdd();
                        toast.dismiss(t.id);
                        toast('취소되었습니다', { icon: '↩️', duration: 1500 });
                    }}
                    className="bg-gray-900 text-white px-3 py-1.5 rounded-md text-[11px] font-bold hover:bg-gray-800 transition-all"
                >
                    취소 (Undo)
                </button>
            </div>
        ), { duration: 3000, id: `add-${product.product_no}` });
    }, [addToCart, undoLastAdd]);

    const toggleGroup = useCallback((key: string) => {
        setExpandedProduct(prev => prev === key ? null : key);
        if (listRef.current) {
            setTimeout(() => listRef.current.resetAfterIndex(0), 0);
        }
    }, []);

    // Keyboard Event Handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const activeTag = document.activeElement?.tagName;
            if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setFocusedIndex(prev => {
                    const next = Math.min(prev + 1, flatList.length - 1);
                    // scrollIntoView will handle sub-scrolling in ChildOption
                    return next;
                });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setFocusedIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const focused = flatList[focusedIndex];
                if (!focused) return;

                if (focused.type === 'parent') {
                    toggleGroup(focused.key);
                } else {
                    const product = groups[focused.groupIndex][1][focused.childIndex!];
                    handleCartAdd(product, 1, true);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [flatList, focusedIndex, toggleGroup, groups, handleCartAdd]);

    const getItemSize = useCallback((index: number) => {
        const [key, variants] = groups[index];
        const base = 64 + 12;
        if (expandedProduct === key) {
            return base + (variants.length * 56); // 1행 레이아웃 approx 56px
        }
        return base;
    }, [groups, expandedProduct]);

    const Row = useCallback(({ index, style }: RowComponentProps) => {
        const [groupKey, variants] = groups[index];
        const isExpanded = expandedProduct === groupKey;

        const focusedItem = flatList[focusedIndex];
        const isHeaderFocused = focusedItem?.type === 'parent' && focusedItem.groupIndex === index;
        const focusedChildIndex = focusedItem?.type === 'child' && focusedItem.groupIndex === index ? focusedItem.childIndex! : null;

        return (
            <div style={style}>
                <ProductCard
                    groupKey={groupKey}
                    variants={variants}
                    handleCartAdd={handleCartAdd}
                    cartItems={cartItems}
                    isExpanded={isExpanded}
                    onToggle={() => toggleGroup(groupKey)}
                    focusedChildIndex={isHeaderFocused ? null : focusedChildIndex}
                />
            </div>
        );
    }, [handleCartAdd, cartItems, groups, expandedProduct, flatList, focusedIndex, toggleGroup]);

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

    const shouldVirtualize = groups.length > 50;

    return (
        <div className="pb-10">
            {shouldVirtualize ? (
                <List
                    listRef={listRef}
                    style={{ height: listHeight, width: '100%' }}
                    rowCount={groups.length}
                    rowHeight={getItemSize}
                    rowComponent={Row}
                    rowProps={{}}
                />
            ) : (
                <div className="space-y-1">
                    {groups.map(([groupKey, variants], index) => {
                        const isExpanded = expandedProduct === groupKey;
                        const focusedItem = flatList[focusedIndex];
                        const isHeaderFocused = focusedItem?.type === 'parent' && focusedItem.groupIndex === index;
                        const focusedChildIdx = focusedItem?.type === 'child' && focusedItem.groupIndex === index ? focusedItem.childIndex! : null;

                        return (
                            <ProductCard
                                key={groupKey}
                                groupKey={groupKey}
                                variants={variants}
                                handleCartAdd={handleCartAdd}
                                cartItems={cartItems}
                                isExpanded={isExpanded}
                                onToggle={() => toggleGroup(groupKey)}
                                focusedChildIndex={isHeaderFocused ? null : focusedChildIdx}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}
