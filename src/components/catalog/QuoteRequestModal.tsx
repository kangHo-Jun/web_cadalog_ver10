import React from 'react';
import { X, Minus, Plus, Trash2, Loader2, Send } from 'lucide-react';

interface Product {
    product_no: number;
    product_name: string;
    price: string;
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

interface QuoteRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    cart: CartItem[];
    totalAmount: number;
    formData: QuoteFormData;
    setFormData: React.Dispatch<React.SetStateAction<QuoteFormData>>;
    onUpdateCartQuantity: (id: number, delta: number) => void;
    onRemoveFromCart: (id: number) => void;
    onSubmit: () => Promise<void>;
    isSubmitting: boolean;
}

const QuoteRequestModal: React.FC<QuoteRequestModalProps> = ({
    isOpen,
    onClose,
    cart,
    totalAmount,
    formData,
    setFormData,
    onUpdateCartQuantity,
    onRemoveFromCart,
    onSubmit,
    isSubmitting
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl flex justify-between items-center">
                    <h2 className="text-xl font-bold">견적서 요청</h2>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-6">
                    <div>
                        <h3 className="font-semibold text-gray-900 mb-3">선택한 상품</h3>
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2 text-left font-medium text-gray-600">상품명</th>
                                        <th className="px-4 py-2 text-right font-medium text-gray-600">단가</th>
                                        <th className="px-4 py-2 text-center font-medium text-gray-600">수량</th>
                                        <th className="px-4 py-2 text-right font-medium text-gray-600">금액</th>
                                        <th className="px-4 py-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {cart.map((item) => (
                                        <tr key={item.product.product_no} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-gray-900 font-medium">
                                                <span dangerouslySetInnerHTML={{ __html: item.product.product_name }} />
                                            </td>
                                            <td className="px-4 py-3 text-right text-gray-700">
                                                {Number(item.product.price).toLocaleString('ko-KR')}원
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button onClick={() => onUpdateCartQuantity(item.product.product_no, -1)} className="p-1 hover:bg-gray-200 rounded text-gray-600">
                                                        <Minus className="w-3 h-3" />
                                                    </button>
                                                    <span className="w-8 text-center font-bold text-gray-900">{item.quantity}</span>
                                                    <button onClick={() => onUpdateCartQuantity(item.product.product_no, 1)} className="p-1 hover:bg-gray-200 rounded text-gray-600">
                                                        <Plus className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-gray-900">
                                                {(Number(item.product.price) * item.quantity).toLocaleString('ko-KR')}원
                                            </td>
                                            <td className="px-4 py-3">
                                                <button onClick={() => onRemoveFromCart(item.product.product_no)} className="p-1 hover:bg-red-100 text-red-500 rounded">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-blue-50 font-bold">
                                    <tr>
                                        <td colSpan={3} className="px-4 py-3 text-right text-gray-700">합계</td>
                                        <td className="px-4 py-3 text-right text-blue-600 text-lg">{totalAmount.toLocaleString('ko-KR')}원</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 mb-3">고객 정보</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">이름 / 회사명 <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="홍길동 / ABC 주식회사"
                                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">이메일 <span className="text-red-500">*</span></label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                    placeholder="example@email.com"
                                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">연락처 <span className="text-red-500">*</span></label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                    placeholder="010-1234-5678"
                                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">추가 요청사항</label>
                                <textarea
                                    value={formData.message}
                                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                                    placeholder="납기일, 배송지 등 추가 요청사항을 입력해주세요."
                                    rows={3}
                                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-gray-50 px-6 py-4 rounded-b-2xl flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        취소
                    </button>
                    <button
                        onClick={onSubmit}
                        disabled={isSubmitting}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        견적 요청하기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QuoteRequestModal;
