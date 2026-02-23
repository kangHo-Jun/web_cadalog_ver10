'use client';

import React from 'react';
import { X, Trash2, ShoppingCart, FileText } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import { toSupplyPrice } from '@/lib/price-utils';
import { useRouter } from 'next/navigation';

interface CartDrawerProps {
    open: boolean;
    onClose: () => void;
}

export default function CartDrawer({ open, onClose }: CartDrawerProps) {
    const router = useRouter();
    const items = useCartStore((s) => s.items);
    const removeFromCart = useCartStore((s) => s.removeFromCart);
    const updateCartQuantity = useCartStore((s) => s.updateCartQuantity);
    const clearCart = useCartStore((s) => s.clearCart);
    const totalAmount = useCartStore((s) => s.totalAmount());
    const totalItems = useCartStore((s) => s.totalItems());

    const handleQuoteRequest = () => {
        onClose();
        router.push('/quote/summary');
    };

    return (
        <>
            {/* Backdrop */}
            {open && (
                <div
                    className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
                    onClick={onClose}
                />
            )}

            {/* Drawer panel */}
            <div
                className={`fixed top-0 right-0 h-full z-50 w-[360px] flex flex-col shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'
                    }`}
                style={{ background: '#fff' }}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-5 py-4 shrink-0"
                    style={{ background: '#123628' }}
                >
                    <div className="flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4 text-white" />
                        <span className="text-white font-bold text-sm">
                            장바구니
                            {totalItems > 0 && (
                                <span className="ml-2 text-white/70 font-normal">({totalItems}개)</span>
                            )}
                        </span>
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                    {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
                            <ShoppingCart className="w-10 h-10 text-gray-200" />
                            <p className="text-sm">담긴 상품이 없습니다.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {items.map((item) => {
                                const name = item.product.product_name.replace(/<[^>]*>/g, '');
                                const price = Number(item.product.price);
                                const supplyPrice = toSupplyPrice(price); // 부가세 전 공급가
                                return (
                                    <div key={item.product.product_no} className="px-5 py-4">
                                        {/* Name row */}
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="flex flex-col gap-0.5 flex-1 overflow-hidden">
                                                <p className="text-xs text-gray-400 leading-tight">
                                                    {item.product.parent_name?.replace(/<[^>]*>/g, '')}
                                                </p>
                                                <p className="text-sm font-bold text-gray-900 leading-tight">
                                                    {item.product.product_name.replace(/<[^>]*>/g, '')}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => removeFromCart(item.product.product_no)}
                                                className="text-gray-300 hover:text-red-400 transition-colors shrink-0 mt-0.5"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        {/* Price & qty row */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-gray-700">
                                                ₩{(supplyPrice * item.quantity).toLocaleString()}원
                                            </span>
                                            {/* Qty stepper */}
                                            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                                                <button
                                                    onClick={() => updateCartQuantity(item.product.product_no, -1)}
                                                    className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-100 text-sm leading-none"
                                                >
                                                    −
                                                </button>
                                                <span className="w-9 text-center text-xs font-bold border-x border-gray-100 py-1.5 bg-white">
                                                    {item.quantity}
                                                </span>
                                                <button
                                                    onClick={() => updateCartQuantity(item.product.product_no, 1)}
                                                    className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-100 text-sm leading-none"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {items.length > 0 && (
                    <div className="shrink-0 border-t border-gray-100 px-5 py-4 space-y-3 bg-white">
                        {/* Total */}
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">합계</span>
                            <span className="text-base font-extrabold text-gray-800">
                                ₩{totalAmount.toLocaleString()}원
                            </span>
                        </div>
                        {/* Actions */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => clearCart()}
                                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50 transition-colors"
                            >
                                전체 삭제
                            </button>
                            <button
                                onClick={handleQuoteRequest}
                                className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                                style={{ background: '#48BB78' }}
                            >
                                <FileText className="w-4 h-4" />
                                견적요청
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
