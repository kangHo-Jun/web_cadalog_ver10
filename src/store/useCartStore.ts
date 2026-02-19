'use client';

import { create } from 'zustand';

export interface CartProduct {
    product_no: number;
    product_name: string;
    price: string;
    product_code: string;
    detail_image?: string;
}

export interface CartItem {
    product: CartProduct;
    quantity: number;
}

interface CartStore {
    items: CartItem[];
    lastAddedProductNo: number | null;
    addToCart: (product: CartProduct, quantity?: number) => void;
    undoLastAdd: () => void;
    removeFromCart: (productNo: number) => void;
    updateCartQuantity: (productNo: number, delta: number) => void;
    clearCart: () => void;
    totalItems: () => number;
    totalAmount: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
    items: [],
    lastAddedProductNo: null,

    addToCart: (product: CartProduct, quantity = 1) => {
        set((state) => {
            const existingIndex = state.items.findIndex(
                (item) => item.product.product_no === product.product_no
            );

            let newItems;
            if (existingIndex !== -1) {
                newItems = [...state.items];
                newItems[existingIndex] = {
                    ...newItems[existingIndex],
                    quantity: newItems[existingIndex].quantity + quantity,
                };
            } else {
                newItems = [...state.items, { product, quantity }];
            }

            return {
                items: newItems,
                lastAddedProductNo: product.product_no,
            };
        });
    },

    undoLastAdd: () => {
        set((state) => {
            if (state.lastAddedProductNo === null) return state;

            const productNo = state.lastAddedProductNo;
            const existingIndex = state.items.findIndex(
                (item) => item.product.product_no === productNo
            );

            if (existingIndex === -1) return { ...state, lastAddedProductNo: null };

            const currentQuantity = state.items[existingIndex].quantity;
            let newItems;

            if (currentQuantity <= 1) {
                newItems = state.items.filter((item) => item.product.product_no !== productNo);
            } else {
                newItems = [...state.items];
                newItems[existingIndex] = {
                    ...newItems[existingIndex],
                    quantity: currentQuantity - 1,
                };
            }

            return {
                items: newItems,
                lastAddedProductNo: null,
            };
        });
    },

    removeFromCart: (productNo: number) => {
        set((state) => ({
            items: state.items.filter((item) => item.product.product_no !== productNo),
        }));
    },

    updateCartQuantity: (productNo: number, delta: number) => {
        set((state) => ({
            items: state.items.map((item) =>
                item.product.product_no === productNo
                    ? { ...item, quantity: Math.max(1, item.quantity + delta) }
                    : item
            ),
        }));
    },

    clearCart: () => set({ items: [] }),

    totalItems: () => get().items.reduce((sum, item) => sum + item.quantity, 0),

    totalAmount: () =>
        get().items.reduce(
            (sum, item) => sum + Number(item.product.price) * item.quantity,
            0
        ),
}));
