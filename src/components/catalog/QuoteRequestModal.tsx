import React, { useRef, useState } from 'react';
import { X, Minus, Plus, Trash2, Loader2, Send, Upload, Paperclip } from 'lucide-react';

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
    onSubmit: (files: File[]) => Promise<void>;
    isSubmitting: boolean;
}

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'pdf', 'xlsx', 'xls', 'docx']);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

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
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const [fileError, setFileError] = useState('');
    const [isDragOver, setIsDragOver] = useState(false);

    if (!isOpen) return null;

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

    const handleSubmit = async () => {
        await onSubmit(attachedFiles);
    };

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
                        <p className="text-xs text-gray-400 mt-0.5 mb-3">세금계산서 발행 요청 시 사업자등록증 첨부, 현금영수증 발급 요청 시 번호 기재해 주세요.</p>
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
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">파일 첨부</label>
                                <div
                                    onDragOver={(event) => {
                                        event.preventDefault();
                                        setIsDragOver(true);
                                    }}
                                    onDragLeave={() => setIsDragOver(false)}
                                    onDrop={handleDrop}
                                    className={`rounded-xl border-2 border-dashed p-5 transition-colors ${
                                        isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
                                    }`}
                                >
                                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                                        <div className="rounded-full bg-white p-3 shadow-sm">
                                            <Upload className="h-5 w-5 text-blue-600" />
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
                                    <p className="mt-2 text-sm text-red-600">{fileError}</p>
                                )}
                                {attachedFiles.length > 0 && (
                                    <ul className="mt-3 space-y-2">
                                        {attachedFiles.map((file) => (
                                            <li key={`${file.name}-${file.lastModified}-${file.size}`} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
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
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-gray-50 px-6 py-4 rounded-b-2xl flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        취소
                    </button>
                    <button
                        onClick={handleSubmit}
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
