'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { QUOTE_CATEGORIES } from '@/config/quote-categories';

interface FixedSidebarProps {
    selectedCategoryNo: number | null;
    onCategoryChange: (no: number) => void;
}

export default function FixedSidebar({
    selectedCategoryNo,
    onCategoryChange,
}: FixedSidebarProps) {
    return (
        <aside
            className="flex-shrink-0 w-40 h-full overflow-y-auto z-40 border-r border-gray-200"
            style={{ background: '#f3f3f3' }}
        >
            <nav className="p-2 space-y-0.5">
                {/* 전체 */}
                <button
                    id="cat-all"
                    onClick={() => onCategoryChange(0)}
                    className={cn(
                        'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all',
                        selectedCategoryNo === null || selectedCategoryNo === 0
                            ? 'text-white'
                            : 'text-gray-700 hover:bg-gray-200'
                    )}
                    style={
                        selectedCategoryNo === null || selectedCategoryNo === 0
                            ? { background: '#48BB78' }
                            : {}
                    }
                >
                    ⌂ 전체
                </button>

                <hr className="my-2 border-gray-200" />

                {QUOTE_CATEGORIES.filter(
                    (c) => !c.parent_category_no
                ).map((cat) => {
                    const isActive = selectedCategoryNo === cat.category_no;
                    return (
                        <button
                            key={cat.category_no}
                            id={`cat-${cat.category_no}`}
                            onClick={() => onCategoryChange(cat.category_no)}
                            className={cn(
                                'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all leading-snug',
                                isActive
                                    ? 'text-white'
                                    : 'text-gray-700 hover:bg-gray-200'
                            )}
                            style={isActive ? { background: '#48BB78' } : {}}
                        >
                            {cat.display_name}
                        </button>
                    );
                })}
            </nav>
        </aside>
    );
}
