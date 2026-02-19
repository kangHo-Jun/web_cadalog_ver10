'use client';

import React, { useRef } from 'react';
import { Search, ShoppingCart } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';

interface StickySearchHeaderProps {
    search: string;
    onSearchChange: (value: string) => void;
    onCartClick?: () => void;
}

export default function StickySearchHeader({
    search,
    onSearchChange,
    onCartClick,
}: StickySearchHeaderProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const totalItems = useCartStore((s) => s.totalItems());

    return (
        <header
            id="search-header"
            className="sticky top-0 z-50 flex items-center gap-3 px-4 py-3"
            style={{ background: '#123628' }}
        >
            {/* Brand */}
            <span className="text-white font-bold text-lg tracking-tight whitespace-nowrap">
                Daesan
            </span>

            {/* Search input */}
            <div className="flex-1 flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 border border-white/20">
                <Search className="w-4 h-4 text-white/60 flex-shrink-0" />
                <input
                    id="search-input"
                    ref={inputRef}
                    type="text"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="상품 검색... (Ctrl+K)"
                    className="flex-1 text-sm text-white bg-transparent border-none outline-none placeholder:text-white/50"
                />
                {search && (
                    <button
                        onClick={() => onSearchChange('')}
                        className="text-xs text-white/60 hover:text-white"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* 장바구니 — 클릭 시 드로어 오픈 */}
            <button
                id="cart-button"
                onClick={onCartClick}
                className="relative flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold whitespace-nowrap transition-all hover:bg-white/10"
            >
                <ShoppingCart className="w-4 h-4" />
                장바구니
                {totalItems > 0 && (
                    <span
                        className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1 text-white"
                        style={{ background: '#48BB78' }}
                    >
                        {totalItems}
                    </span>
                )}
            </button>
        </header>
    );
}
