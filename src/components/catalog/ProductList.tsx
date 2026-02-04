import React from 'react';
import { Loader2, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Product {
    product_no: number;
    product_name: string;
    price: string;
    detail_image: string;
    product_code: string;
}

interface ProductListProps {
    products: Product[];
    loading: boolean;
    error: any;
    quantities: Record<number, number>;
    cartItemIds: number[];
    onUpdateQuantity: (id: number, delta: number, absolute?: number) => void;
    onAddToCart: (product: Product) => void;
}

const ProductList: React.FC<ProductListProps> = ({
    products,
    loading,
    error,
    quantities,
    cartItemIds,
    onUpdateQuantity,
    onAddToCart
}) => {
    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-gray-200 p-20 text-center shadow-sm">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                <p className="mt-2 text-gray-500">실시간 데이터를 불러오는 중...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-2xl border border-gray-200 p-20 text-center shadow-sm text-red-500">
                데이터를 불러오는 데 실패했습니다. 다시 시도해 주세요.
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-6 py-4 font-semibold text-sm text-gray-700">상품정보</th>
                            <th className="px-6 py-4 font-semibold text-sm text-gray-700">상품코드</th>
                            <th className="px-6 py-4 font-semibold text-sm text-gray-700">가격</th>
                            <th className="px-6 py-4 font-semibold text-sm text-gray-700">수량 선택</th>
                            <th className="px-6 py-4 font-semibold text-sm text-gray-700 text-right">견적 담기</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {products.length > 0 ? (
                            products.map((product) => {
                                const isInCart = cartItemIds.includes(product.product_no);
                                return (
                                    <tr key={product.product_no} className={cn("hover:bg-blue-50/50 transition-colors group", isInCart && "bg-green-50")}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-200">
                                                    {product.detail_image ? (
                                                        <img src={product.detail_image} alt={product.product_name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">이미지</div>
                                                    )}
                                                </div>
                                                <span className="font-semibold text-sm text-gray-900 group-hover:text-blue-600 transition-colors">
                                                    <span dangerouslySetInnerHTML={{ __html: product.product_name }} />
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 font-mono">{product.product_code}</td>
                                        <td className="px-6 py-4 font-bold text-gray-900 whitespace-nowrap">
                                            {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(Number(product.price))}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 bg-gray-100 w-fit rounded-lg p-1 border border-gray-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white transition-all">
                                                <button onClick={() => onUpdateQuantity(product.product_no, -1)} className="p-1.5 hover:bg-white rounded transition-colors text-gray-600">
                                                    <Minus className="w-3 h-3" />
                                                </button>
                                                <input
                                                    type="number"
                                                    value={quantities[product.product_no] === 0 ? '' : (quantities[product.product_no] || 1)}
                                                    onChange={(e) => {
                                                        const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                                        if (!isNaN(val)) {
                                                            onUpdateQuantity(product.product_no, 0, val);
                                                        }
                                                    }}
                                                    onFocus={(e) => e.target.select()}
                                                    onBlur={(e) => {
                                                        const val = parseInt(e.target.value);
                                                        if (isNaN(val) || val < 1) {
                                                            onUpdateQuantity(product.product_no, 0, 1);
                                                        }
                                                    }}
                                                    className="w-12 text-center text-sm font-bold text-gray-900 bg-transparent border-none focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    placeholder="1"
                                                />
                                                <button onClick={() => onUpdateQuantity(product.product_no, 1)} className="p-1.5 hover:bg-white rounded transition-colors text-gray-600">
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button onClick={() => onAddToCart(product)} className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm active:scale-95", isInCart ? "bg-green-600 hover:bg-green-700 text-white" : "bg-orange-500 hover:bg-orange-600 text-white")}>
                                                <Plus className="w-4 h-4" />
                                                {isInCart ? '추가 담기' : '견적 담기'}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={5} className="px-6 py-20 text-center text-gray-500">검색 결과가 없습니다.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ProductList;
