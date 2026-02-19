'use client';

import React, { useState } from 'react';
import { useCartStore } from '@/store/useCartStore';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Trash2, Send } from 'lucide-react';

interface QuoteFormData {
    name: string;
    email: string;
    phone: string;
    message: string;
}

export default function QuoteSummaryPage() {
    const router = useRouter();
    const items = useCartStore((s) => s.items);
    const removeFromCart = useCartStore((s) => s.removeFromCart);
    const updateCartQuantity = useCartStore((s) => s.updateCartQuantity);
    const clearCart = useCartStore((s) => s.clearCart);
    const totalAmount = useCartStore((s) => s.totalAmount());

    const [formData, setFormData] = useState<QuoteFormData>({
        name: '',
        email: '',
        phone: '',
        message: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.email || !formData.phone) {
            alert('이름, 이메일, 연락처는 필수 입력 항목입니다.');
            return;
        }
        if (items.length === 0) {
            alert('장바구니가 비어 있습니다.');
            return;
        }

        setIsSubmitting(true);

        const quoteData = {
            customer: formData,
            items: items.map((item) => ({
                product_no: item.product.product_no,
                product_name: item.product.product_name.replace(/<[^>]*>/g, ''),
                product_code: item.product.product_code,
                price: Number(item.product.price),
                quantity: item.quantity,
                subtotal: Number(item.product.price) * item.quantity,
            })),
            totalAmount,
            requestDate: new Date().toISOString(),
        };

        console.log('[견적 요청]', quoteData);

        // TODO: 실제 API 연동 시 fetch('/api/quote', { method: 'POST', body: JSON.stringify(quoteData) })
        await new Promise((r) => setTimeout(r, 800));

        setIsSubmitting(false);
        setSubmitted(true);
        clearCart();
    };

    if (submitted) {
        return (
            <main className="min-h-screen flex items-center justify-center" style={{ background: '#f3f3f3' }}>
                <div className="bg-white rounded-2xl shadow-md p-12 text-center max-w-md mx-auto">
                    <div className="text-5xl mb-4">✅</div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">견적 요청 완료</h2>
                    <p className="text-gray-500 text-sm mb-6">
                        담당자가 <span className="font-semibold text-gray-800">{formData.email}</span>로
                        견적서를 보내드립니다.
                    </p>
                    <button
                        onClick={() => router.push('/quote')}
                        className="px-6 py-3 rounded-xl text-white font-semibold text-sm"
                        style={{ background: '#48BB78' }}
                    >
                        카탈로그로 돌아가기
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen pb-24" style={{ background: '#f3f3f3' }}>
            {/* Header */}
            <header
                className="sticky top-0 z-50 flex items-center gap-3 px-6 py-4"
                style={{ background: '#123628' }}
            >
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-white/80 hover:text-white transition-colors text-sm"
                >
                    <ArrowLeft className="w-4 h-4" />
                    돌아가기
                </button>
                <div className="flex-1" />
                <FileText className="w-5 h-5 text-white" />
                <span className="text-white font-bold text-base">견적서 요청</span>
            </header>

            <div className="max-w-3xl mx-auto px-4 pt-8 space-y-6">
                {/* Cart Items */}
                <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="font-bold text-gray-800 text-base">
                            선택 상품 <span className="text-gray-400 font-normal text-sm">({items.length}종)</span>
                        </h2>
                        {items.length > 0 && (
                            <button
                                onClick={() => clearCart()}
                                className="text-xs text-gray-400 hover:text-red-400 flex items-center gap-1 transition-colors"
                            >
                                <Trash2 className="w-3 h-3" />
                                전체 삭제
                            </button>
                        )}
                    </div>

                    {items.length === 0 ? (
                        <div className="py-16 text-center text-gray-400 text-sm">
                            <p className="mb-4">선택된 상품이 없습니다.</p>
                            <button
                                onClick={() => router.back()}
                                className="text-sm font-semibold underline"
                                style={{ color: '#48BB78' }}
                            >
                                카탈로그에서 상품 담기
                            </button>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {items.map((item) => (
                                <div
                                    key={item.product.product_no}
                                    className="grid grid-cols-[1fr_120px_80px_32px] items-center gap-3 px-6 py-4"
                                >
                                    {/* Name */}
                                    <span className="text-sm text-gray-800 font-medium truncate">
                                        {item.product.product_name.replace(/<[^>]*>/g, '')}
                                    </span>
                                    {/* Price */}
                                    <span className="text-sm font-bold text-gray-700 text-right">
                                        ₩{Number(item.product.price).toLocaleString()}원
                                    </span>
                                    {/* Qty stepper */}
                                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                                        <button
                                            onClick={() => updateCartQuantity(item.product.product_no, -1)}
                                            className="px-2 py-1.5 text-gray-500 hover:bg-gray-100 text-sm leading-none"
                                        >
                                            −
                                        </button>
                                        <span className="w-8 text-center text-xs font-bold border-x border-gray-100 py-1.5">
                                            {item.quantity}
                                        </span>
                                        <button
                                            onClick={() => updateCartQuantity(item.product.product_no, 1)}
                                            className="px-2 py-1.5 text-gray-500 hover:bg-gray-100 text-sm leading-none"
                                        >
                                            +
                                        </button>
                                    </div>
                                    {/* Remove */}
                                    <button
                                        onClick={() => removeFromCart(item.product.product_no)}
                                        className="text-gray-300 hover:text-red-400 transition-colors flex items-center justify-center"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Total */}
                    {items.length > 0 && (
                        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
                            <span className="text-sm text-gray-500">합계</span>
                            <span className="text-lg font-extrabold text-gray-800">
                                ₩{totalAmount.toLocaleString()}원
                            </span>
                        </div>
                    )}
                </section>

                {/* Contact Form */}
                <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h2 className="font-bold text-gray-800 text-base">연락처 입력</h2>
                        <p className="text-xs text-gray-400 mt-0.5">견적서를 받을 정보를 입력해 주세요.</p>
                    </div>
                    <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                    이름 <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                                    placeholder="홍길동"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#48BB78]/30 focus:border-[#48BB78] transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                    연락처 <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                                    placeholder="010-0000-0000"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#48BB78]/30 focus:border-[#48BB78] transition-all"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                이메일 <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                                placeholder="example@company.com"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#48BB78]/30 focus:border-[#48BB78] transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                추가 요청사항
                            </label>
                            <textarea
                                value={formData.message}
                                onChange={(e) => setFormData((p) => ({ ...p, message: e.target.value }))}
                                placeholder="납기일, 설치 지역 등 추가 정보를 입력해주세요."
                                rows={3}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#48BB78]/30 focus:border-[#48BB78] transition-all resize-none"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting || items.length === 0}
                            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                            style={{ background: '#48BB78' }}
                        >
                            <Send className="w-4 h-4" />
                            {isSubmitting ? '전송 중...' : '견적 요청 보내기'}
                        </button>
                    </form>
                </section>
            </div>
        </main>
    );
}
