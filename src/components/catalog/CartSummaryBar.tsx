import React from 'react';
import { FileText } from 'lucide-react';

interface CartSummaryBarProps {
    itemCount: number;
    totalQuantity: number;
    totalAmount: number;
    onClear: () => void;
    onRequestQuote: () => void;
}

const CartSummaryBar: React.FC<CartSummaryBarProps> = ({
    itemCount,
    totalQuantity,
    totalAmount,
    onClear,
    onRequestQuote
}) => {
    if (itemCount === 0) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 shadow-lg z-50">
            <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                    <div>
                        <span className="text-orange-100 text-sm">선택 품목</span>
                        <p className="text-xl font-bold">{itemCount}개</p>
                    </div>
                    <div>
                        <span className="text-orange-100 text-sm">총 수량</span>
                        <p className="text-xl font-bold">{totalQuantity}개</p>
                    </div>
                    <div>
                        <span className="text-orange-100 text-sm">예상 금액</span>
                        <p className="text-xl font-bold">{totalAmount.toLocaleString('ko-KR')}원</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={onClear}
                        className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
                    >
                        초기화
                    </button>
                    <button
                        onClick={onRequestQuote}
                        className="px-6 py-2 bg-white text-orange-600 hover:bg-orange-50 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                    >
                        <FileText className="w-4 h-4" />
                        견적서 요청
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CartSummaryBar;
