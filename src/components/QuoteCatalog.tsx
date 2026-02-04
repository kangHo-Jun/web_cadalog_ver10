'use client';

import React, { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { RefreshCw } from 'lucide-react';

// Sub-components
import CatalogHeader from './catalog/CatalogHeader';
import CategoryTabs from './catalog/CategoryTabs';
import ProductList from './catalog/ProductList';
import CartSummaryBar from './catalog/CartSummaryBar';
import QuoteRequestModal from './catalog/QuoteRequestModal';
import Pagination from './catalog/Pagination';

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

export default function QuoteCatalog() {
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
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

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    // Reset to page 1 when search or category changes
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch, selectedCategory]);

    // Fetch quote categories only
    const { data: catData } = useSWR('/api/categories?type=quote', fetcher, {
        revalidateOnFocus: false,
        dedupingInterval: 60000,
    });

    const categories = useMemo(() => {
        if (catData?.categories) {
            return catData.categories.filter((c: Category) => c.category_depth === 1);
        }
        return [];
    }, [catData]);

    // Fetch quote products only
    const productKey = `/api/products?type=quote&keyword=${debouncedSearch}&category=${selectedCategory || ''}`;
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
                    견적 문의
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

            <CategoryTabs
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
            />

            <ProductList
                products={products}
                loading={prodLoading}
                error={prodError}
                quantities={quantities}
                cartItemIds={cart.map(item => item.product.product_no)}
                onUpdateQuantity={updateQuantity}
                onAddToCart={addToCart}
            />

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
