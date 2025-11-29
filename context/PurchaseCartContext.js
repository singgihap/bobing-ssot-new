// context/PurchaseCartContext.js (FILE BARU)
"use client";
import { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const PurchaseCartContext = createContext();

export const usePurchaseCart = () => useContext(PurchaseCartContext);

export const PurchaseCartProvider = ({ children }) => {
    const [cart, setCart] = useState([]);

    // 1. Load dari LocalStorage saat awal buka
    useEffect(() => {
        const saved = localStorage.getItem('lumina_po_draft_cart');
        if (saved) setCart(JSON.parse(saved));
    }, []);

    // 2. Simpan ke LocalStorage setiap ada perubahan
    useEffect(() => {
        localStorage.setItem('lumina_po_draft_cart', JSON.stringify(cart));
    }, [cart]);

    const addToCart = (variant, product) => {
        // Cek duplikasi
        const exists = cart.find(item => item.variant_id === variant.id);
        if (exists) {
            toast("Item sudah ada di daftar PO", { icon: '📝' });
            return;
        }

        const newItem = {
            variant_id: variant.id,
            sku: variant.sku,
            name: product?.name || 'Unknown Product',
            spec: `${variant.color || ''}/${variant.size || ''}`,
            unit_cost: variant.cost || 0, // Ambil cost terakhir
            qty: 0, // Default 0, biar diisi user nanti
        };

        setCart(prev => [...prev, newItem]);
        toast.success(`Ditambahkan ke Draft PO: ${variant.sku}`);
    };

    const removeFromCart = (variantId) => {
        setCart(prev => prev.filter(i => i.variant_id !== variantId));
    };

    const clearCart = () => {
        setCart([]);
        localStorage.removeItem('lumina_po_draft_cart');
    };

    return (
        <PurchaseCartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart }}>
            {children}
        </PurchaseCartContext.Provider>
    );
};