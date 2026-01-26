'use client';

import React, { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';

// Sub-components
import CatalogHeader from './catalog/CatalogHeader';
import CategoryTabs from './catalog/CategoryTabs';
import ProductList from './catalog/ProductList';
import CartSummaryBar from './catalog/CartSummaryBar';
import QuoteRequestModal from './catalog/QuoteRequestModal';

interface Product {
  product_no: number;
  product_name: string;
  price: string;
  display?: string;
  selling?: string;
  detail_image: string;
  product_code: string;
  created_date?: string;
}

interface Category {
  category_no: number;
  category_name: string;
  category_depth: number;
  parent_category_no: number;
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

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ProductTable() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<QuoteFormData>({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: catData } = useSWR('/api/categories', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  const categories = useMemo(() => {
    if (catData?.categories) {
      return catData.categories.filter((c: Category) => c.category_depth === 1);
    }
    return [];
  }, [catData]);

  const productKey = `/api/products?keyword=${debouncedSearch}&category=${selectedCategory || ''}`;
  const { data: prodData, error: prodError, isLoading: prodLoading, isValidating } = useSWR(
    productKey,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 2000,
      revalidateOnReconnect: true,
    }
  );

  const products = prodData?.products || [];

  useEffect(() => {
    if (products.length > 0) {
      const initialQuantities: Record<number, number> = {};
      products.forEach((p: Product) => {
        initialQuantities[p.product_no] = 1;
      });
      setQuantities((prev: Record<number, number>) => {
        const updated = { ...initialQuantities };
        Object.keys(prev).forEach((key: string) => {
          const numKey = Number(key);
          if (products.find((p: Product) => p.product_no === numKey)) {
            updated[numKey] = prev[numKey];
          }
        });
        return updated;
      });
    }
  }, [products]);

  const updateQuantity = (id: number, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [id]: Math.max(1, (prev[id] || 1) + delta)
    }));
  };

  const addToCart = (product: Product) => {
    const qty = quantities[product.product_no] || 1;
    setCart(prev => {
      const existing = prev.find(item => item.product.product_no === product.product_no);
      if (existing) {
        return prev.map(item =>
          item.product.product_no === product.product_no
            ? { ...item, quantity: item.quantity + qty }
            : item
        );
      }
      return [...prev, { product, quantity: qty }];
    });
    setQuantities(prev => ({ ...prev, [product.product_no]: 1 }));
  };

  const removeFromCart = (productNo: number) => {
    setCart(prev => prev.filter(item => item.product.product_no !== productNo));
  };

  const updateCartQuantity = (productNo: number, delta: number) => {
    setCart(prev =>
      prev.map(item =>
        item.product.product_no === productNo
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item
      )
    );
  };

  const totalAmount = cart.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0
  );

  const handleSubmitQuote = async () => {
    if (!formData.name || !formData.email || !formData.phone) {
      alert('필수 정보를 입력해주세요.');
      return;
    }
    setIsSubmitting(true);
    const quoteData = {
      customer: formData,
      items: cart.map(item => ({
        product_no: item.product.product_no,
        product_name: item.product.product_name.replace(/<[^>]*>/g, ''),
        product_code: item.product.product_code,
        price: item.product.price,
        quantity: item.quantity,
        subtotal: Number(item.product.price) * item.quantity
      })),
      totalAmount,
      requestDate: new Date().toISOString()
    };
    console.log('견적 요청 데이터:', quoteData);
    await new Promise(resolve => setTimeout(resolve, 1000));
    alert(`견적 요청이 접수되었습니다!\n\n담당자가 ${formData.email}로 견적서를 보내드립니다.\n\n선택 품목: ${cart.length}개\n총 금액: ${totalAmount.toLocaleString('ko-KR')}원`);
    setCart([]);
    setFormData({ name: '', email: '', phone: '', message: '' });
    setIsModalOpen(false);
    setIsSubmitting(false);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-8 animate-in bg-white min-h-screen">
      <CatalogHeader
        search={search}
        onSearchChange={setSearch}
        isValidating={isValidating}
      />

      <CategoryTabs
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      <ProductList
        products={products}
        loading={prodLoading}
        error={prodError}
        quantities={quantities}
        cartItemIds={cart.map(item => item.product.product_no)}
        onUpdateQuantity={updateQuantity}
        onAddToCart={addToCart}
      />

      <CartSummaryBar
        itemCount={cart.length}
        totalQuantity={cart.reduce((sum, item) => sum + item.quantity, 0)}
        totalAmount={totalAmount}
        onClear={() => setCart([])}
        onRequestQuote={() => setIsModalOpen(true)}
      />

      <QuoteRequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        cart={cart}
        totalAmount={totalAmount}
        formData={formData}
        setFormData={setFormData}
        onUpdateCartQuantity={updateCartQuantity}
        onRemoveFromCart={removeFromCart}
        onSubmit={handleSubmitQuote}
        isSubmitting={isSubmitting}
      />

      {cart.length > 0 && <div className="h-24" />}
    </div>
  );
}
