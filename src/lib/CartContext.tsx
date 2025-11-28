// src/lib/CartContext.tsx
'use client';
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

const FIXED_SHIPPING_FEE = 800;

export interface SelectedOption {
  optionId: string;
  optionName: string;
  valueId: string;
  valueName: string;
  priceModifier?: number;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  images?: string[];
  requiresShipping?: boolean;
  selectedOptions?: SelectedOption[];
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  total: number;
  getItemCount: () => number;
  getSubtotal: () => number;
  getShippingFee: () => number;
  getTotal: () => number;
  needsShipping: () => boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [total, setTotal] = useState(0);

  const needsShipping = useCallback(() => items.some((i) => i.requiresShipping), [items]);

  const getSubtotal = useCallback(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  );

  const getShippingFeeInternal = useCallback((subtotal: number) => {
    if (!needsShipping()) return 0;
    if (subtotal >= 10000) return 0;
    return FIXED_SHIPPING_FEE;
  }, [needsShipping]);

  const getShippingFee = useCallback(
    () => getShippingFeeInternal(getSubtotal()),
    [getShippingFeeInternal, getSubtotal]
  );

  const getTotal = useCallback(() => getSubtotal() + getShippingFee(), [getSubtotal, getShippingFee]);

  // 初期読み込み
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('cart');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as CartItem[];
      setItems(parsed.map((it) => ({ ...it, selectedOptions: it.selectedOptions ?? [] })));
    } catch (e) {
      console.error('カートデータの解析に失敗しました:', e);
    }
  }, []);

  // 永続化
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('cart', JSON.stringify(items));
  }, [items]);

  // 合計再計算（eslint-disable コメント不要）
  useEffect(() => {
    const subtotal = getSubtotal();
    const shipping = getShippingFeeInternal(subtotal);
    setTotal(subtotal + shipping);
  }, [items, getSubtotal, getShippingFeeInternal]);

  const getUniqueItemKey = useCallback((item: CartItem): string => {
    const optionsKey = item.selectedOptions
      ? [...item.selectedOptions]
          .sort((a, b) => a.optionId.localeCompare(b.optionId))
          .map((opt) => `${opt.optionId}:${opt.valueId}`)
          .join('|')
      : '';
    return `${item.id}${optionsKey ? `_${optionsKey}` : ''}`;
  }, []);

  const areItemsEqual = useCallback((a: CartItem, b: CartItem): boolean => {
    if (a.id !== b.id) return false;
    const ao = a.selectedOptions ?? [];
    const bo = b.selectedOptions ?? [];
    if (ao.length !== bo.length) return false;
    const A = [...ao].sort((x, y) => x.optionId.localeCompare(y.optionId));
    const B = [...bo].sort((x, y) => x.optionId.localeCompare(y.optionId));
    return A.every((o, i) => {
      const p = B[i];
      return o.optionId === p.optionId && o.valueId === p.valueId && o.priceModifier === p.priceModifier;
    });
  }, []);

  const addItem = useCallback((newItem: CartItem) => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => areItemsEqual(it, newItem));
      if (idx !== -1) {
        return prev.map((it, i) => (i === idx ? { ...it, quantity: it.quantity + newItem.quantity } : it));
      }
      return [...prev, { ...newItem, selectedOptions: newItem.selectedOptions ?? [] }];
    });
  }, [areItemsEqual]);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => getUniqueItemKey(it) !== id));
  }, [getUniqueItemKey]);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) return removeItem(id);
    setItems((prev) => prev.map((it) => (getUniqueItemKey(it) === id ? { ...it, quantity } : it)));
  }, [getUniqueItemKey, removeItem]);

  const clearCart = useCallback(() => setItems([]), []);

  const getItemCount = useCallback(() => items.reduce((c, it) => c + it.quantity, 0), [items]);

  const ctxValue = useMemo<CartContextType>(() => ({
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    total,
    getItemCount,
    getSubtotal,
    getShippingFee,
    getTotal,
    needsShipping,
  }), [items, addItem, removeItem, updateQuantity, clearCart, total, getItemCount, getSubtotal, getShippingFee, getTotal, needsShipping]);

  return <CartContext.Provider value={ctxValue}>{children}</CartContext.Provider>;
};
