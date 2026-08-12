import React from 'react';

interface Category {
    category_no: number;
    category_name: string;
    display_name?: string;
}

interface CategoryTabsProps {
    categories: Category[];
    selectedCategory: number | null;
    onSelectCategory: (id: number | null) => void;
}

const CategoryTabs: React.FC<CategoryTabsProps> = ({ categories, selectedCategory, onSelectCategory }) => {
    return (
        <div className="flex flex-wrap gap-2">
            <button
                onClick={() => onSelectCategory(null)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedCategory === null
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                    }`}
            >
                전체
            </button>
            {categories.map((cat) => (
                <button
                    key={cat.category_no}
                    onClick={() => onSelectCategory(cat.category_no)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedCategory === cat.category_no
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                        }`}
                >
                    {cat.display_name || cat.category_name}
                </button>
            ))}
        </div>
    );
};

export default CategoryTabs;
