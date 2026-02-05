'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QuoteCategory } from '../config/quote-categories';
import { SubCategory } from '../utils/category-mapper';
import { cn } from '../lib/utils';

interface CategorySectionProps {
    categories: QuoteCategory[];
    selectedCategoryId: number | null;
    selectedSubCategoryId: number | null;
    onCategoryChange: (id: number) => void;
    onSubCategoryChange: (id: number) => void;
    subCategories: SubCategory[];
}

const CategorySection: React.FC<CategorySectionProps> = ({
    categories,
    selectedCategoryId,
    selectedSubCategoryId,
    onCategoryChange,
    onSubCategoryChange,
    subCategories,
}) => {
    const rootCategories = categories.filter(cat => cat.category_depth === 1);

    return (
        <div className="w-full space-y-6">
            {/* Main Navigation (Root Tabs) */}
            <div className="flex flex-wrap justify-center gap-2 border-b border-gray-100 pb-4">
                {rootCategories.map((category) => (
                    <button
                        key={category.category_no}
                        onClick={() => onCategoryChange(category.category_no)}
                        className={cn(
                            "px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-200",
                            selectedCategoryId === category.category_no
                                ? "bg-blue-600 text-white shadow-md"
                                : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
                        )}
                    >
                        {category.display_name}
                    </button>
                ))}
            </div>

            {/* Sub Filter Bar (Chips) */}
            <div className="min-h-[48px] flex justify-center items-center">
                <AnimatePresence mode="wait">
                    {subCategories.length > 0 ? (
                        <motion.div
                            key={selectedCategoryId}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex flex-wrap justify-center gap-3"
                        >
                            {subCategories.map((sub) => (
                                <button
                                    key={sub.category_no}
                                    onClick={() => onSubCategoryChange(sub.category_no)}
                                    className={cn(
                                        "px-4 py-1.5 rounded-xl text-sm transition-all border",
                                        selectedSubCategoryId === sub.category_no
                                            ? "bg-blue-50 border-blue-200 text-blue-700 font-semibold"
                                            : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                                    )}
                                >
                                    {sub.display_name}
                                </button>
                            ))}
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default CategorySection;
