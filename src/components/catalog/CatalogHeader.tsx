import React from 'react';
import { Search, RefreshCw } from 'lucide-react';

interface CatalogHeaderProps {
    search: string;
    onSearchChange: (value: string) => void;
    isValidating: boolean;
}

const CatalogHeader: React.FC<CatalogHeaderProps> = ({ search, onSearchChange, isValidating }) => {
    return (
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        제품 카탈로그
                    </h1>
                    <div className="flex items-center gap-2 text-gray-600 mt-1">
                        <p>제품을 선택하고 견적을 요청하세요</p>
                        {isValidating && (
                            <div className="flex items-center gap-1 text-xs text-blue-500 animate-pulse">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>동기화 중...</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <form onSubmit={(e) => e.preventDefault()} className="relative w-full md:w-96 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                    type="text"
                    placeholder="상품명으로 검색..."
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-gray-900 placeholder:text-gray-400"
                />
            </form>
        </div>
    );
};

export default CatalogHeader;
