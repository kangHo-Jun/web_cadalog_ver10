'use client';

import React, { useRef, useState } from 'react';
import { useCartStore } from '@/store/useCartStore';
import { toSupplyPrice } from '@/lib/price-utils';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Trash2, Send, Upload, Paperclip } from 'lucide-react';

interface QuoteFormData {
    name: string;
    phone: string;
    message: string;
}

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'pdf', 'xlsx', 'xls', 'docx']);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function QuoteSummaryPage() {
    const router = useRouter();
    const items = useCartStore((s) => s.items);
    const removeFromCart = useCartStore((s) => s.removeFromCart);
    const updateCartQuantity = useCartStore((s) => s.updateCartQuantity);
    const clearCart = useCartStore((s) => s.clearCart);
    const totalAmount = useCartStore((s) => s.totalAmount());

    const [formData, setFormData] = useState<QuoteFormData>({
        name: '',
        phone: '',
        message: '',
    });
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const [fileError, setFileError] = useState('');
    const [isDragOver, setIsDragOver] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const addFiles = (incomingFiles: FileList | File[]) => {
        const nextFiles = Array.from(incomingFiles);
        if (nextFiles.length === 0) return;

        const validFiles: File[] = [];

        for (const file of nextFiles) {
            const extension = file.name.split('.').pop()?.toLowerCase() || '';
            if (!ALLOWED_EXTENSIONS.has(extension)) {
                setFileError('허용되지 않는 파일 형식이 포함되어 있습니다. jpg, jpeg, png, pdf, xlsx, xls, docx 파일만 첨부할 수 있습니다.');
                continue;
            }
            if (file.size > MAX_FILE_SIZE) {
                setFileError(`파일 크기는 개당 10MB 이하여야 합니다: ${file.name}`);
                continue;
            }
            validFiles.push(file);
        }

        if (validFiles.length > 0) {
            setFileError('');
            setAttachedFiles(prev => {
                const merged = [...prev];
                for (const file of validFiles) {
                    const exists = merged.some(
                        current =>
                            current.name === file.name &&
                            current.size === file.size &&
                            current.lastModified === file.lastModified
                    );
                    if (!exists) merged.push(file);
                }
                return merged;
            });
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) addFiles(event.target.files);
        event.target.value = '';
    };

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragOver(false);
        if (event.dataTransfer.files) addFiles(event.dataTransfer.files);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.phone) {
            alert('이름과 연락처는 필수 입력 항목입니다.');
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

        const payload = new FormData();
        payload.append('name', formData.name);
        payload.append('phone', formData.phone);
        payload.append('message', formData.message);
        payload.append('items', JSON.stringify(quoteData.items));
        payload.append('totalAmount', String(totalAmount));
        payload.append('requestDate', quoteData.requestDate);
        attachedFiles.forEach((file) => payload.append('files', file));

        const response = await fetch('/api/submit-quote', {
            method: 'POST',
            body: payload,
        });

        if (!response.ok) {
            alert('견적 요청 중 오류가 발생했습니다. 다시 시도해주세요.');
            setIsSubmitting(false);
            return;
        }

        alert(`견적 요청이 접수되었습니다!\n선택 품목: ${quoteData.items.length}개`);

        setIsSubmitting(false);
        setSubmitted(true);
        setAttachedFiles([]);
        setFileError('');
        clearCart();
    };

    if (submitted) {
        return (
            <main className="min-h-screen flex items-center justify-center" style={{ background: '#f3f3f3' }}>
                <div className="bg-white rounded-2xl shadow-md p-8 text-center max-w-md w-full mx-auto">
                    <div className="text-5xl mb-4">✅</div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">견적 요청 완료</h2>
                    <p className="text-gray-500 text-sm mb-8">
                        견적 요청이 정상적으로 접수되었습니다. <br />
                        담당자가 확인 후 연락처로 안내해 드립니다.
                    </p>

                    <button
                        onClick={() => router.push('/')}
                        className="w-full py-3.5 rounded-xl text-white font-semibold text-sm bg-[#48BB78] active:scale-[0.98] transition-all"
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
                        <div className="divide-y divide-gray-50 max-h-[460px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
                            {items.map((item) => (
                                <div
                                    key={item.product.product_no}
                                    className="grid grid-cols-[1fr_120px_80px_32px] items-center gap-3 px-6 py-4 hover:bg-gray-50/50 transition-colors"
                                >
                                    {/* Name - 2줄 구조로 변경 (CartDrawer와 통일) */}
                                    <div className="flex flex-col gap-0.5 overflow-hidden">
                                        <span className="text-[10px] text-gray-400 font-medium truncate">
                                            {item.product.parent_name?.replace(/<[^>]*>/g, '')}
                                        </span>
                                        <span className="text-sm text-gray-800 font-bold truncate">
                                            {item.product.product_name.replace(/<[^>]*>/g, '')}
                                        </span>
                                    </div>
                                    {/* Price - 부가세 전 공급가 표시 */}
                                    <span className="text-sm font-bold text-gray-700 text-right">
                                        ₩{toSupplyPrice(Number(item.product.price)).toLocaleString()}원
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
                            <span className="text-sm text-gray-500 font-medium">총 합계 <span className="text-[10px] opacity-70">(VAT 포함)</span></span>
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
                        <p className="text-xs text-gray-400 mt-0.5">세금계산서 발행 요청 시 사업자등록증 첨부, 현금영수증 발급 요청 시 번호 기재해 주세요.</p>
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
                                추가 요청사항
                            </label>
                            <textarea
                                value={formData.message}
                                onChange={(e) => setFormData((p) => ({ ...p, message: e.target.value }))}
                                placeholder="현금영수증 번호, 납기일, 설치 지역 등 추가 정보를 입력해주세요."
                                rows={3}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#48BB78]/30 focus:border-[#48BB78] transition-all resize-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-medium text-gray-600">
                                파일 첨부
                            </label>
                            <div
                                onDragOver={(event) => {
                                    event.preventDefault();
                                    setIsDragOver(true);
                                }}
                                onDragLeave={() => setIsDragOver(false)}
                                onDrop={handleDrop}
                                className={`rounded-xl border-2 border-dashed p-5 transition-colors ${
                                    isDragOver ? 'border-[#48BB78] bg-[#48BB78]/10' : 'border-gray-300 bg-gray-50'
                                }`}
                            >
                                <div className="flex flex-col items-center justify-center gap-3 text-center">
                                    <div className="rounded-full bg-white p-3 shadow-sm">
                                        <Upload className="h-5 w-5 text-[#48BB78]" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-gray-800">파일을 드래그해서 놓거나 버튼으로 선택하세요.</p>
                                        <p className="text-xs text-gray-500">허용 형식: jpg, jpeg, png, pdf, xlsx, xls, docx / 개당 최대 10MB</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                                    >
                                        <Paperclip className="h-4 w-4" />
                                        파일 추가
                                    </button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        accept=".jpg,.jpeg,.png,.pdf,.xlsx,.xls,.docx"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                </div>
                            </div>

                            {fileError && (
                                <p className="text-sm text-red-600">{fileError}</p>
                            )}

                            {attachedFiles.length > 0 && (
                                <ul className="space-y-2">
                                    {attachedFiles.map((file) => (
                                        <li
                                            key={`${file.name}-${file.lastModified}-${file.size}`}
                                            className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-gray-800">{file.name}</p>
                                                <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setAttachedFiles(prev => prev.filter(current => current !== file))}
                                                className="rounded-md p-2 text-red-500 transition-colors hover:bg-red-50"
                                                aria-label={`${file.name} 삭제`}
                                            >
                                                ×
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
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
