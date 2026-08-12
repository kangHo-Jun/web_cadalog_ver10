'use client';

import React, { useState } from 'react';
import AppleCategoryOverlay from '@/components/AppleCategoryOverlay';
import { QUOTE_CATEGORIES } from '@/config/quote-categories';
import { CategoryItem } from '@/types/category';

/**
 * AppleCategoryOverlay 기능을 독립적으로 검증하기 위한 테스트 페이지
 */
export default function CategoryTestPage() {
    const [isOpen, setIsOpen] = useState(false);

    // 테스트를 위한 가상 데이터 생성 (full_category_no 포함)
    const testCategories: CategoryItem[] = QUOTE_CATEGORIES.map((cat, index) => ({
        category_no: cat.category_no,
        parent_category_no: cat.parent_category_no || 0,
        category_name: cat.display_name || cat.category_name,
        category_depth: cat.parent_category_no ? 3 : 2,
        // 테스트용 12자리 코드 생성 (8자리 prefix 그룹화 테스트용)
        // 상위 카테고리는 '00010001', '00010002' 식으로 할당
        full_category_no: cat.parent_category_no
            ? `0001000${cat.parent_category_no % 5}${cat.category_no.toString().padStart(4, '0')}`
            : `0001000${cat.category_no % 5}0000`
    }));

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-white to-blue-50">
            <div className="max-w-2xl text-center space-y-8">
                <div className="space-y-4">
                    <h1 className="text-5xl font-extrabold tracking-tight text-gray-900">
                        Apple Category <span className="text-blue-600">UI Test</span>
                    </h1>
                    <p className="text-lg text-gray-600">
                        기획서 ver2 명세에 따른 **Glassmorphism**, **Safe Triangle**, **CSR 필터링** 기능을 테스트합니다.
                    </p>
                </div>

                <div className="flex flex-col items-center gap-4">
                    <button
                        onMouseEnter={() => setIsOpen(true)}
                        className="group relative px-10 py-5 bg-black text-white rounded-3xl font-bold text-xl shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300"
                    >
                        <span className="relative z-10 flex items-center gap-2">
                            메뉴 탐색하기 (Hover)
                            <span className="opacity-50 group-hover:translate-x-1 transition-transform">&rarr;</span>
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>

                    <p className="text-sm text-gray-400">마우스를 버튼 위로 올리거나 클릭하세요.</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-left mt-20">
                    <div className="p-4 bg-white/50 rounded-2xl border border-gray-100">
                        <h3 className="font-bold text-gray-800 mb-2">테스트 케이스</h3>
                        <ul className="text-sm text-gray-600 space-y-1">
                            <li>• 200ms 이내 빠른 렌더링 확인</li>
                            <li>• 배경 12px 블러 효과 확인</li>
                            <li>• 대각선 이동 시 패널 유지 확인</li>
                        </ul>
                    </div>
                    <div className="p-4 bg-white/50 rounded-2xl border border-gray-100">
                        <h3 className="font-bold text-gray-800 mb-2">기술 스택</h3>
                        <ul className="text-sm text-gray-600 space-y-1">
                            <li>• Next.js 15 App Router</li>
                            <li>• Framer Motion</li>
                            <li>• Tailwind CSS</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* 오버레이 컴포넌트 */}
            <AppleCategoryOverlay
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                categories={testCategories}
                onSelectCategory={(no) => {
                    alert(`선택된 카테고리 번호: ${no}`);
                    setIsOpen(false);
                }}
            />
        </div>
    );
}
