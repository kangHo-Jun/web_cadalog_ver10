'use client';

import React, { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { RefreshCw } from 'lucide-react';

// Sub-components
import CatalogHeader from './catalog/CatalogHeader';
import CategorySection from './CategorySection';
import ProductList from './catalog/ProductList';
import CartSummaryBar from './catalog/CartSummaryBar';
import QuoteRequestModal from './catalog/QuoteRequestModal';
import Pagination from './catalog/Pagination';

import { mapSubCategories, SubCategory } from '../utils/category-mapper';
import { QUOTE_CATEGORIES } from '@/config/quote-categories';

interface Product {
    product_no: number;
    product_name: string;
    price: string;
    display?: string;
    selling?: string;
    detail_image: string;
    product_code: string;
    created_date?: string;
    category_name?: string;
    display_category_name?: string;
}

interface Category {
    category_no: number;
    category_name: string;
    category_depth: number;
    parent_category_no: number;
    display_name?: string;
}

interface CartItem {
    product: Product;
    quantity: number;
}

interface QuoteFormData {
    name: string;
    email: string;
    phone: string;
    message: string;
}

const ITEMS_PER_PAGE = 20;
const DEFAULT_ROOT_CATEGORY_NO = 327;

type Phase2EventName =
    | 'ROOT_CATEGORY_SELECTED'
    | 'ROOT_CATEGORY_CHANGED'
    | 'SUBCATEGORY_RESET'
    | 'SUBCATEGORY_LIST_RENDERED'
    | 'SUBCATEGORY_SELECTED'
    | 'PRODUCT_FILTER_APPLIED'
    | 'RENDER_COMMIT';

interface Phase2LogPayload {
    timestamp: number;
    event_name: Phase2EventName;
    prev_state: Record<string, unknown>;
    next_state: Record<string, unknown>;
    category_no: number | null;
}

const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const error = new Error(errorData.error || 'API 요청 중 오류가 발생했습니다.');
        (error as any).status = res.status;
        (error as any).info = errorData;
        throw error;
    }
    return res.json();
};

interface QuoteCatalogProps {
    mode?: 'quote' | 'price';
}

export default function QuoteCatalog({ mode = 'quote' }: QuoteCatalogProps) {
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [selectedSubCategory, setSelectedSubCategory] = useState<number | null>(null);
    const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
    const [quantities, setQuantities] = useState<Record<number, number>>({});
    const [currentPage, setCurrentPage] = useState(1);

    const [cart, setCart] = useState<CartItem[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<QuoteFormData>({
        name: '',
        email: '',
        phone: '',
        message: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const prevSubCategoriesRef = React.useRef<SubCategory[]>([]);
    const hasInitializedFromUrlRef = React.useRef(false);
    const pendingUrlSubCategoryRef = React.useRef<number | null>(null);
    const prevRenderSnapshotRef = React.useRef<{
        selectedCategory: number | null;
        selectedSubCategory: number | null;
        subCategoryNos: number[];
    }>({
        selectedCategory: null,
        selectedSubCategory: null,
        subCategoryNos: [],
    });
    const prevProductFilterRef = React.useRef<{
        mode: 'quote' | 'price';
        keyword: string;
        activeCategoryNo: number | null;
    }>({
        mode,
        keyword: '',
        activeCategoryNo: null,
    });

    const emitPhase2Log = (
        eventName: Phase2EventName,
        prevState: Record<string, unknown>,
        nextState: Record<string, unknown>,
        categoryNo: number | null = null
    ) => {
        const payload: Phase2LogPayload = {
            timestamp: Date.now(),
            event_name: eventName,
            prev_state: prevState,
            next_state: nextState,
            category_no: categoryNo,
        };
        console.log(JSON.stringify(payload));
    };

    const parseCategoryNo = (raw: string | null): number | null => {
        if (!raw || !/^\d+$/.test(raw)) return null;
        const parsed = Number(raw);
        if (!Number.isInteger(parsed)) return null;
        return parsed;
    };

    const isRootCategoryNo = (categoryNo: number): boolean =>
        QUOTE_CATEGORIES.some(
            cat =>
                cat.category_no === categoryNo &&
                (cat.parent_category_no === null || cat.parent_category_no === undefined)
        );

    const isValidSubCategoryForRoot = (subCategoryNo: number, rootCategoryNo: number): boolean =>
        QUOTE_CATEGORIES.some(
            cat =>
                cat.category_no === subCategoryNo &&
                cat.parent_category_no === rootCategoryNo
        );

    const syncCategoryQuery = (
        rootCategoryNo: number,
        subCategoryNo: number | null,
        source: 'ui' | 'url' | 'system',
        changeType: 'root' | 'sub'
    ) => {
        if (source === 'system' || typeof window === 'undefined') return;

        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('root', String(rootCategoryNo));

        if (changeType === 'root') {
            currentUrl.searchParams.delete('sub');
        } else if (subCategoryNo !== null) {
            currentUrl.searchParams.set('sub', String(subCategoryNo));
        } else {
            currentUrl.searchParams.delete('sub');
        }

        const nextUrl = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
        const currentLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (nextUrl !== currentLocation) {
            window.history.replaceState(null, '', nextUrl);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    // Category Filtering Logic
    const handleCategoryChange = (catNo: number, source: 'ui' | 'url' | 'system' = 'ui') => {
        if (!Number.isFinite(catNo)) return;

        const nextSubCategories = mapSubCategories(QUOTE_CATEGORIES, catNo);
        const alreadyStableOnRoot =
            selectedCategory === catNo &&
            selectedSubCategory === null &&
            subCategories.length === nextSubCategories.length &&
            subCategories.every((sub, idx) => sub.category_no === nextSubCategories[idx]?.category_no);

        // Stability guard: 연속 클릭 시 동일 상태 재적용을 차단
        if (alreadyStableOnRoot) return;

        if (selectedCategory !== null && selectedCategory !== catNo) {
            emitPhase2Log(
                'ROOT_CATEGORY_CHANGED',
                { selectedCategory: selectedCategory },
                { selectedCategory: catNo },
                catNo
            );
        }

        emitPhase2Log(
            'ROOT_CATEGORY_SELECTED',
            { selectedCategory: selectedCategory },
            { selectedCategory: catNo },
            catNo
        );

        if (selectedSubCategory !== null) {
            emitPhase2Log(
                'SUBCATEGORY_RESET',
                { selectedSubCategory: selectedSubCategory },
                { selectedSubCategory: null },
                selectedSubCategory
            );
        }

        setSelectedCategory(catNo);
        setSelectedSubCategory(null); // T3: 다른 대분류 이동 즉시 이전 중분류 칩 0개 (초기화)
        setSubCategories(nextSubCategories);
        syncCategoryQuery(catNo, null, source, 'root');
    };

    const handleSubCategoryChange = (subCatNo: number, source: 'ui' | 'url' | 'system' = 'ui') => {
        if (!Number.isFinite(subCatNo) || selectedCategory === null) return;

        const isValidForCurrentRoot = subCategories.some(
            sub =>
                sub.category_no === subCatNo &&
                sub.parent_category_no === selectedCategory
        );

        // Stability guard: Root 전환 중 stale click 차단
        if (!isValidForCurrentRoot) return;

        // Stability guard: 중복 선택 이벤트 차단
        if (selectedSubCategory === subCatNo) return;

        emitPhase2Log(
            'SUBCATEGORY_SELECTED',
            { selectedSubCategory: selectedSubCategory },
            { selectedSubCategory: subCatNo },
            subCatNo
        );
        setSelectedSubCategory(subCatNo); // T2: 중분류 클릭 시 해당 category_no 반영
        syncCategoryQuery(selectedCategory, subCatNo, source, 'sub');
    };

    // Fetch quote categories only
    const { data: catData } = useSWR('/api/categories?type=quote', fetcher, {
        revalidateOnFocus: false,
        dedupingInterval: 60000,
    });

    useEffect(() => {
        if (!catData?.categories || selectedCategory !== null || hasInitializedFromUrlRef.current) return;

        hasInitializedFromUrlRef.current = true;

        if (typeof window === 'undefined') {
            handleCategoryChange(DEFAULT_ROOT_CATEGORY_NO, 'system');
            return;
        }

        const searchParams = new URLSearchParams(window.location.search);
        const rootFromUrl = parseCategoryNo(searchParams.get('root'));
        const subFromUrl = parseCategoryNo(searchParams.get('sub'));

        if (rootFromUrl !== null && isRootCategoryNo(rootFromUrl)) {
            handleCategoryChange(rootFromUrl, 'url');

            if (
                subFromUrl !== null &&
                isValidSubCategoryForRoot(subFromUrl, rootFromUrl)
            ) {
                pendingUrlSubCategoryRef.current = subFromUrl;
            }
            return;
        }

        handleCategoryChange(DEFAULT_ROOT_CATEGORY_NO, 'system'); // 기존 기본 동작 유지
    }, [catData]);

    useEffect(() => {
        const pendingSub = pendingUrlSubCategoryRef.current;
        if (pendingSub === null || selectedCategory === null) return;

        const isValid = subCategories.some(
            sub =>
                sub.category_no === pendingSub &&
                sub.parent_category_no === selectedCategory
        );

        pendingUrlSubCategoryRef.current = null;
        if (isValid) {
            handleSubCategoryChange(pendingSub, 'url');
        }
    }, [selectedCategory, subCategories]);

    const activeCategoryNo = selectedSubCategory || selectedCategory;

    useEffect(() => {
        const prevNos = prevSubCategoriesRef.current.map(sub => sub.category_no);
        const nextNos = subCategories.map(sub => sub.category_no);
        const prevKey = prevNos.join(',');
        const nextKey = nextNos.join(',');

        if (prevKey !== nextKey) {
            emitPhase2Log(
                'SUBCATEGORY_LIST_RENDERED',
                { subCategoryNos: prevNos, count: prevNos.length },
                { subCategoryNos: nextNos, count: nextNos.length },
                selectedCategory
            );
            prevSubCategoriesRef.current = subCategories;
        }
    }, [subCategories, selectedCategory]);

    useEffect(() => {
        const prev = prevProductFilterRef.current;
        const next = {
            mode,
            keyword: debouncedSearch,
            activeCategoryNo: activeCategoryNo || null,
        };
        const changed =
            prev.mode !== next.mode ||
            prev.keyword !== next.keyword ||
            prev.activeCategoryNo !== next.activeCategoryNo;

        if (changed) {
            emitPhase2Log(
                'PRODUCT_FILTER_APPLIED',
                {
                    mode: prev.mode,
                    keyword: prev.keyword,
                    activeCategoryNo: prev.activeCategoryNo,
                },
                {
                    mode: next.mode,
                    keyword: next.keyword,
                    activeCategoryNo: next.activeCategoryNo,
                },
                next.activeCategoryNo
            );
            prevProductFilterRef.current = next;
        }
    }, [mode, debouncedSearch, activeCategoryNo]);

    useEffect(() => {
        const prev = prevRenderSnapshotRef.current;
        const next = {
            selectedCategory,
            selectedSubCategory,
            subCategoryNos: subCategories.map(sub => sub.category_no),
        };
        const changed =
            prev.selectedCategory !== next.selectedCategory ||
            prev.selectedSubCategory !== next.selectedSubCategory ||
            prev.subCategoryNos.join(',') !== next.subCategoryNos.join(',');

        if (changed) {
            emitPhase2Log(
                'RENDER_COMMIT',
                {
                    selectedCategory: prev.selectedCategory,
                    selectedSubCategory: prev.selectedSubCategory,
                    subCategoryNos: prev.subCategoryNos,
                    subCategoryCount: prev.subCategoryNos.length,
                },
                {
                    selectedCategory: next.selectedCategory,
                    selectedSubCategory: next.selectedSubCategory,
                    subCategoryNos: next.subCategoryNos,
                    subCategoryCount: next.subCategoryNos.length,
                },
                next.selectedSubCategory || next.selectedCategory
            );
            prevRenderSnapshotRef.current = next;
        }
    }, [selectedCategory, selectedSubCategory, subCategories]);

    // Fetch quote products only
    const productKey = `/api/products?type=${mode}&keyword=${debouncedSearch}&category=${activeCategoryNo || ''}`;
    const { data: prodData, error: prodError, isLoading: prodLoading, isValidating } = useSWR(
        productKey,
        fetcher,
        {
            revalidateOnFocus: true,
            dedupingInterval: 2000,
            revalidateOnReconnect: true,
        }
    );

    const allProducts = prodData?.products || [];
    const selectedRoot = QUOTE_CATEGORIES.find(
        cat =>
            cat.category_no === selectedCategory &&
            (cat.parent_category_no === null || cat.parent_category_no === undefined)
    );
    const selectedSub = QUOTE_CATEGORIES.find(
        cat => cat.category_no === selectedSubCategory
    );
    const statusSummary = [
        `대분류: ${selectedRoot?.display_name ?? '-'}`,
        `중분류: ${selectedSub?.display_name ?? '-'}`,
        `검색: ${search.trim() || '-'}`,
    ].join(' / ');

    // Pagination logic
    const totalPages = Math.ceil(allProducts.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const products = allProducts.slice(startIndex, endIndex);

    useEffect(() => {
        if (products.length > 0) {
            const initialQuantities: Record<number, number> = {};
            products.forEach((p: Product) => {
                initialQuantities[p.product_no] = 1;
            });
            setQuantities((prev: Record<number, number>) => {
                const updated = { ...initialQuantities };
                Object.keys(prev).forEach((key: string) => {
                    const numKey = Number(key);
                    if (products.find((p: Product) => p.product_no === numKey)) {
                        updated[numKey] = prev[numKey];
                    }
                });
                return updated;
            });
        }
    }, [products]);

    const updateQuantity = (id: number, delta: number, absolute?: number) => {
        setQuantities(prev => ({
            ...prev,
            [id]: absolute !== undefined ? absolute : Math.max(0, (prev[id] || 0) + delta)
        }));
    };

    const addToCart = (product: Product) => {
        const qty = quantities[product.product_no] || 1;
        setCart(prev => {
            const existing = prev.find(item => item.product.product_no === product.product_no);
            if (existing) {
                return prev.map(item =>
                    item.product.product_no === product.product_no
                        ? { ...item, quantity: item.quantity + qty }
                        : item
                );
            }
            return [...prev, { product, quantity: qty }];
        });
        setQuantities(prev => ({ ...prev, [product.product_no]: 1 }));
    };

    const removeFromCart = (productNo: number) => {
        setCart(prev => prev.filter(item => item.product.product_no !== productNo));
    };

    const updateCartQuantity = (productNo: number, delta: number) => {
        setCart(prev =>
            prev.map(item =>
                item.product.product_no === productNo
                    ? { ...item, quantity: Math.max(1, item.quantity + delta) }
                    : item
            )
        );
    };

    const totalAmount = cart.reduce(
        (sum, item) => sum + Number(item.product.price) * item.quantity,
        0
    );

    const handleSubmitQuote = async () => {
        if (!formData.name || !formData.email || !formData.phone) {
            alert('필수 정보를 입력해주세요.');
            return;
        }
        setIsSubmitting(true);
        const quoteData = {
            customer: formData,
            items: cart.map(item => ({
                product_no: item.product.product_no,
                product_name: item.product.product_name.replace(/<[^>]*>/g, ''),
                product_code: item.product.product_code,
                price: item.product.price,
                quantity: item.quantity,
                subtotal: Number(item.product.price) * item.quantity
            })),
            totalAmount,
            requestDate: new Date().toISOString()
        };
        console.log('견적 요청 데이터:', quoteData);
        await new Promise(resolve => setTimeout(resolve, 1000));
        alert(`견적 요청이 접수되었습니다!\n\n담당자가 ${formData.email}로 견적서를 보내드립니다.\n\n선택 품목: ${cart.length}개\n총 금액: ${totalAmount.toLocaleString('ko-KR')}원`);
        setCart([]);
        setFormData({ name: '', email: '', phone: '', message: '' });
        setIsModalOpen(false);
        setIsSubmitting(false);
    };

    return (
        <div className="w-full max-w-6xl mx-auto p-6 space-y-8 animate-in bg-white min-h-screen">
            <div className="text-center mb-10">
                <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-3">
                    {mode === 'quote' ? '견적 문의' : '실시간 가격표'}
                </h1>
                {isValidating && (
                    <div className="flex items-center justify-center gap-2 text-xs text-blue-500 mt-4 animate-pulse">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>실시간 최신 정보 동기화 중...</span>
                    </div>
                )}
            </div>

            <CatalogHeader
                search={search}
                onSearchChange={setSearch}
                isValidating={isValidating}
            />
            <div className="text-center text-sm text-muted-foreground">
                {statusSummary}
            </div>

            {/* Google Style Category Filtering UI (Phase 1) */}
            <CategorySection
                categories={QUOTE_CATEGORIES}
                selectedCategoryId={selectedCategory}
                selectedSubCategoryId={selectedSubCategory}
                onCategoryChange={(id) => handleCategoryChange(id, 'ui')}
                onSubCategoryChange={(id) => handleSubCategoryChange(id, 'ui')}
                subCategories={subCategories}
            />

            <ProductList
                products={products}
                loading={prodLoading}
                error={prodError}
                quantities={quantities}
                cartItemIds={cart.map(item => item.product.product_no)}
                onUpdateQuantity={updateQuantity}
                onAddToCart={addToCart}
                showActions={mode === 'quote'}
            />
            {(prodLoading || isValidating) && (
                <div className="text-center text-xs text-muted-foreground">
                    실시간 데이터를 불러오는 중...
                </div>
            )}

            {/* Pagination */}
            {!prodLoading && !prodError && allProducts.length > 0 && (
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            )}

            {/* Results info */}
            {!prodLoading && !prodError && allProducts.length > 0 && (
                <div className="text-center text-sm text-muted-foreground">
                    전체 {allProducts.length}개 중 {startIndex + 1}-{Math.min(endIndex, allProducts.length)}번째 상품 표시
                </div>
            )}

            <CartSummaryBar
                itemCount={cart.length}
                totalQuantity={cart.reduce((sum, item) => sum + item.quantity, 0)}
                totalAmount={totalAmount}
                onClear={() => setCart([])}
                onRequestQuote={() => setIsModalOpen(true)}
            />

            <QuoteRequestModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                cart={cart}
                totalAmount={totalAmount}
                formData={formData}
                setFormData={setFormData}
                onUpdateCartQuantity={updateCartQuantity}
                onRemoveFromCart={removeFromCart}
                onSubmit={handleSubmitQuote}
                isSubmitting={isSubmitting}
            />

            {cart.length > 0 && <div className="h-24" />}
        </div>
    );
}
