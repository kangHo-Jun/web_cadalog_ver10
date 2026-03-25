'use client';

import React, { useState, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ShoppingCart, 
    ChevronRight, 
    Plus, 
    Minus, 
    X, 
    CheckCircle2
} from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import { GroupedProduct, ChildItem } from '@/lib/product-utils';
import { QUOTE_CATEGORIES } from '@/config/quote-categories';
import { formatSupplyPrice } from '@/lib/price-utils';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// --- Components ---

/**
 * Mobile Header
 */
const MobileHeader = ({ cartCount, onCartClick }: { cartCount: number; onCartClick: () => void }) => (
    <header className="fixed top-0 left-0 right-0 h-14 bg-[#123628] flex items-center justify-between px-4 z-50 shadow-md">
        <h1 className="text-white text-lg font-bold tracking-tight">Daesan</h1>
        <button 
            onClick={onCartClick}
            className="relative p-2 text-white/90 active:scale-90 transition-transform"
        >
            <ShoppingCart className="w-6 h-6" />
            {cartCount > 0 && (
                <span className="absolute top-0 right-0 bg-[#48BB78] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {cartCount}
                </span>
            )}
        </button>
    </header>
);

/**
 * Counter Component
 */
const QuantityCounter = ({ quantity, setQuantity }: { quantity: number; setQuantity: (q: number) => void }) => (
    <div className="flex items-center bg-gray-100 rounded-lg overflow-hidden">
        <button 
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="p-2 text-gray-500 active:bg-gray-200"
        >
            <Minus className="w-4 h-4" />
        </button>
        <span className="w-10 text-center text-sm font-bold text-gray-800">{quantity}</span>
        <button 
            onClick={() => setQuantity(quantity + 1)}
            className="p-2 text-gray-500 active:bg-gray-200"
        >
            <Plus className="w-4 h-4" />
        </button>
    </div>
);

// --- Main View ---

export default function Phase1MobileView() {
    const router = useRouter();
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<GroupedProduct | null>(null);
    const [bsQuantities, setBsQuantities] = useState<Record<string, number>>({});

    // Cart Store
    const totalItems = useCartStore((s) => s.totalItems());
    const addToCart = useCartStore((s) => s.addToCart);

    // Data Fetching
    const { data, isLoading } = useSWR('/api/debug-snapshot', fetcher);

    // Grouping
    const allGroups = useMemo((): GroupedProduct[] => {
        if (!data) return [];
        return Object.values(data.lastSnapshot ?? data);
    }, [data]);

    // Handle Add to Cart
    const handleAddToCart = useCallback((parentName: string, child: ChildItem, quantity: number) => {
        const idSource = child.variantCode || child.name;
        const productNo = Math.abs(
            idSource.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0)
        );

        addToCart({
            product_no: productNo,
            parent_name: parentName,
            product_name: child.name,
            price: String(child.price),
            product_code: child.variantCode || '',
            detail_image: '',
        }, quantity);

        toast.success(`${child.name} ${quantity}개 담기 완료`, {
            icon: '🛒',
            position: 'bottom-center',
            style: { fontSize: '12px', fontWeight: 'bold' }
        });
    }, [addToCart]);

    // Filtered Groups
    const filteredGroups = useMemo(() => {
        if (!selectedCategory) return allGroups;
        return allGroups.filter(g => g.categoryNo?.includes(selectedCategory));
    }, [allGroups, selectedCategory]);

    if (isLoading) return (
        <div className="min-h-screen bg-white flex items-center justify-center">
            <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="w-8 h-8 border-4 border-[#123628] border-t-transparent rounded-full"
            />
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col pb-24 font-sans text-gray-900 overflow-x-hidden pt-14">
            <MobileHeader cartCount={totalItems} onCartClick={() => router.push('/quote/summary')} />
            
            <main className="flex-1 overflow-y-auto [-webkit-overflow-scrolling:touch]">
                <div className="flex flex-col h-full">
                    {/* Category Chips - Sticky below Header */}
                    <div className="sticky top-0 bg-white border-b border-gray-100 px-3 py-3 flex gap-2 overflow-x-auto no-scrollbar z-40 shadow-sm">
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                                selectedCategory === null ? 'bg-[#48BB78] text-white' : 'bg-gray-100 text-gray-500'
                            }`}
                        >
                            전체
                        </button>
                        {QUOTE_CATEGORIES.map(cat => (
                            <button
                                key={cat.category_no}
                                onClick={() => setSelectedCategory(cat.category_no)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                                    selectedCategory === cat.category_no ? 'bg-[#48BB78] text-white' : 'bg-gray-100 text-gray-500'
                                }`}
                            >
                                {cat.display_name}
                            </button>
                        ))}
                    </div>

                    {/* Product List */}
                    <div className="p-3 grid grid-cols-1 gap-2">
                        {filteredGroups.map(group => (
                            <button 
                                key={group.id}
                                onClick={() => setSelectedProduct(group)}
                                className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3 active:bg-gray-50 text-left"
                            >
                                <div className="w-12 h-12 bg-gray-50 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] text-gray-300">
                                    {group.detail_image ? <img src={group.detail_image} alt={group.parentName} className="w-full h-full object-cover rounded-lg" /> : 'IMG'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[14px] font-bold text-gray-800 truncate">{group.parentName}</div>
                                    <div className="text-[11px] text-gray-400 mt-0.5">{group.children.length}개 옵션</div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-300" />
                            </button>
                        ))}
                    </div>
                </div>
            </main>

            {/* Bottom Sheet Overlay */}
            <AnimatePresence>
                {selectedProduct && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedProduct(null)}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
                        />
                        {/* Sheet */}
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[24px] z-[70] max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
                        >
                            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                                <div className="flex-1 min-w-0 pr-4">
                                    <h3 className="text-base font-bold text-gray-900 truncate">{selectedProduct.parentName}</h3>
                                    <p className="text-xs text-gray-400">옵션을 선택해 주세요</p>
                                </div>
                                <button onClick={() => setSelectedProduct(null)} className="p-1 bg-gray-100 rounded-full text-gray-400">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {selectedProduct.children.map((child, idx) => {
                                    const qty = bsQuantities[`${selectedProduct.id}-${idx}`] || 1;
                                    return (
                                        <div key={idx} className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 flex flex-col gap-3">
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="flex-1 font-bold text-sm text-gray-800 leading-snug">{child.name}</div>
                                                <div className="text-right">
                                                    <div className={child.price && child.price > 0 ? "text-sm font-black text-blue-600" : "text-sm text-gray-400 font-medium"}>
                                                        {child.price && child.price > 0 ? formatSupplyPrice(child.price) : '가격문의'}
                                                    </div>
                                                    <div className="text-[9px] text-gray-400">(VAT 별도)</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between mt-1">
                                                <QuantityCounter 
                                                    quantity={qty} 
                                                    setQuantity={(newQty) => setBsQuantities(prev => ({ ...prev, [`${selectedProduct.id}-${idx}`]: newQty }))} 
                                                />
                                                <button 
                                                    onClick={() => {
                                                        handleAddToCart(selectedProduct.parentName, child, qty);
                                                    }}
                                                    className="px-6 py-2 bg-[#123628] text-white text-xs font-bold rounded-lg shadow-sm active:scale-95 transition-all"
                                                >
                                                    담기
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="p-4 bg-gray-50 border-t border-gray-100">
                                <button 
                                    onClick={() => setSelectedProduct(null)}
                                    className="w-full py-3.5 bg-gray-900 text-white font-bold rounded-xl active:scale-95 transition-transform"
                                >
                                    설정 완료
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Bottom Sticky Button */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-gray-100 z-50">
                <button
                    disabled={totalItems === 0}
                    onClick={() => router.push('/quote/summary')}
                    className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] ${
                        totalItems > 0 
                        ? 'bg-[#48BB78] text-white shadow-green-200' 
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                >
                    <CheckCircle2 className="w-5 h-5" />
                    {totalItems > 0 ? `${totalItems}건 견적 요청하기` : '항목을 추가해 주세요'}
                </button>
            </div>

            <style jsx global>{`
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
}
