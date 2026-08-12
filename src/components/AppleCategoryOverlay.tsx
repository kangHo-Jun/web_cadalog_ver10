'use client';

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CategoryItem, CategoryGroup, Point } from '../types/category';
import { groupCategoriesByPrefix } from '../utils/filterLogic';

interface AppleCategoryOverlayProps {
    categories: CategoryItem[];
    isOpen: boolean;
    onClose: () => void;
    onSelectCategory: (categoryNo: number) => void;
}

/**
 * Apple 스타일의 2단 Hover 카테고리 오버레이 컴포넌트
 */
export default function AppleCategoryOverlay({
    categories,
    isOpen,
    onClose,
    onSelectCategory
}: AppleCategoryOverlayProps) {
    const [activePrefix, setActivePrefix] = useState<string | null>(null);
    const [mouseHistory, setMouseHistory] = useState<Point[]>([]);
    const panelRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // 8자리 Prefix 그룹화 (메모리 필터링)
    const groups = useMemo(() => groupCategoriesByPrefix(categories), [categories]);

    // 활성 그룹의 자식 아이템
    const activeGroup = useMemo(() =>
        groups.find(g => g.prefix === activePrefix), [groups, activePrefix]
    );

    // 마우스 이동 추적 (Safe Triangle 용)
    const handleMouseMove = (e: React.MouseEvent) => {
        const newPoint = { x: e.clientX, y: e.clientY };
        setMouseHistory(prev => [...prev.slice(-2), newPoint]);
    };

    /**
     * Safe Triangle 로직 구현
     * 부모 리스트 아이템에서 우측 자식 패널로 사선 이동 시 패널을 유지합니다.
     */
    const handleMouseLeaveItem = () => {
        if (!activePrefix) return;

        // 마우스 궤적 분석을 통한 지연 로직 (심플 버전)
        // 실제 삼각형 영역 계산 대신 200ms 지연을 두어 이동 시간 확보
        timeoutRef.current = setTimeout(() => {
            setActivePrefix(null);
        }, 200);
    };

    const handleMouseEnterItem = (prefix: string) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setActivePrefix(prefix);
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center pt-20"
            onMouseMove={handleMouseMove}
        >
            {/* 배경 블러 (Apple 스타일) */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/5 backdrop-blur-[12px]"
                onClick={onClose}
            />

            {/* 메인 컨테이너 */}
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative flex w-full max-w-5xl h-[600px] bg-white/60 backdrop-blur-[24px] rounded-2xl shadow-2xl overflow-hidden border border-white/20"
            >
                {/* 좌측: 부모 리스트 (8자리 Prefix) */}
                <div className="w-1/3 border-r border-gray-200/50 overflow-y-auto custom-scrollbar">
                    <div className="p-4 space-y-1">
                        <h2 className="text-xs font-semibold text-gray-400 mb-4 px-3 uppercase tracking-wider">주요 카테고리</h2>
                        {groups.map((group) => (
                            <div
                                key={group.prefix}
                                onMouseEnter={() => handleMouseEnterItem(group.prefix)}
                                onMouseLeave={handleMouseLeaveItem}
                                className={`px-4 py-3 rounded-xl cursor-default transition-all duration-200 ${activePrefix === group.prefix
                                        ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                                        : 'hover:bg-gray-100/50 text-gray-700'
                                    }`}
                            >
                                <span className="text-[15px] font-medium">{group.displayName}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 우측: 자식 패널 (Variant) */}
                <div className="flex-1 overflow-y-auto p-8 bg-white/30 custom-scrollbar">
                    <AnimatePresence mode="wait">
                        {activeGroup ? (
                            <motion.div
                                key={activePrefix}
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                                className="space-y-6"
                            >
                                <h3 className="text-xl font-bold text-gray-800 border-b border-gray-200/50 pb-4">
                                    {activeGroup.displayName} 상세 옵션
                                </h3>
                                <div className="grid grid-cols-1 gap-1">
                                    {activeGroup.children.map((item) => (
                                        <div
                                            key={item.category_no}
                                            onClick={() => onSelectCategory(item.category_no)}
                                            className="group flex items-center justify-between p-3 rounded-lg hover:bg-white/50 cursor-pointer transition-all border border-transparent hover:border-white/50"
                                        >
                                            <div className="flex-1">
                                                <div className="text-[14px] text-gray-900 font-semibold group-hover:text-blue-600">
                                                    {item.category_name.split('>').pop()?.trim()}
                                                </div>
                                                <div className="text-[12px] text-gray-500 mt-1">
                                                    규격: {item.category_no} | 코드: {item.full_category_no}
                                                </div>
                                            </div>
                                            <div className="text-[14px] font-mono font-medium text-gray-400 group-hover:text-blue-500">
                                                VIEW &rarr;
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {activeGroup.children.length === 0 && (
                                    <div className="text-center py-20 text-gray-400">
                                        등록된 하위 옵션이 없습니다.
                                    </div>
                                )}
                            </motion.div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                                <div className="p-4 bg-gray-50 rounded-full">
                                    <svg className="w-8 h-8 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                                    </svg>
                                </div>
                                <p className="text-sm">부모 카테고리를 선택하여 상세 옵션을 확인하세요.</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(0, 0, 0, 0.05);
                    border-radius: 10px;
                }
                .custom-scrollbar:hover::-webkit-scrollbar-thumb {
                    background: rgba(0, 0, 0, 0.1);
                }
            `}</style>
        </div>
    );
}
