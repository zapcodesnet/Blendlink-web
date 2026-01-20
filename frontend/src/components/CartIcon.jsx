import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart } from "lucide-react";

export default function CartIcon({ className = "" }) {
  const navigate = useNavigate();
  const [itemCount, setItemCount] = useState(0);

  useEffect(() => {
    // Load initial count
    updateCount();

    // Listen for cart updates
    const handleCartUpdate = () => updateCount();
    window.addEventListener('cart-updated', handleCartUpdate);
    window.addEventListener('storage', handleCartUpdate);

    return () => {
      window.removeEventListener('cart-updated', handleCartUpdate);
      window.removeEventListener('storage', handleCartUpdate);
    };
  }, []);

  const updateCount = () => {
    const cart = JSON.parse(localStorage.getItem('blendlink_cart') || '[]');
    const count = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    setItemCount(count);
  };

  return (
    <button
      onClick={() => navigate("/checkout")}
      className={`relative p-2 rounded-full hover:bg-muted transition-colors ${className}`}
      data-testid="cart-icon"
    >
      <ShoppingCart className="w-5 h-5" />
      {itemCount > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      )}
    </button>
  );
}
