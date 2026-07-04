'use client';

import { useEffect } from 'react';

export default function ClearCartOnSuccess() {
  useEffect(() => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('olive_cart_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
      window.dispatchEvent(new Event('cart-updated'));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.error('Failed to clear cart on success:', e);
    }
  }, []);

  return null;
}
