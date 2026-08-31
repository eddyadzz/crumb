'use client';

import { useState } from 'react';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Package,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { products, formatMVR, getRecipe, recipeCostPerServing } from '@/lib/data';
import { cn } from '@/lib/utils';

interface CartItem {
  productId: string;
  quantity: number;
}

export default function SellPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  const addToCart = (productId: string) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === productId);
      if (existing) {
        return prev.map((c) =>
          c.productId === productId
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [...prev, { productId, quantity: 1 }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.productId === productId
            ? { ...c, quantity: Math.max(0, c.quantity + delta) }
            : c
        )
        .filter((c) => c.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((c) => c.productId !== productId));
  };

  const cartTotal = cart.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.productId);
    return sum + (product?.sellingPrice ?? 0) * item.quantity;
  }, 0);

  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  const completeSale = () => {
    setCart([]);
    setCartOpen(false);
    setSuccessOpen(true);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Sell"
        description="Tap products to add to cart"
        action={
          <Button
            className="relative gap-2"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Cart</span>
            {cartCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-destructive-foreground">
                {cartCount}
              </span>
            )}
          </Button>
        }
      />

      {/* Product grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => {
          const inCart = cart.find((c) => c.productId === product.id);
          const outOfStock = product.availableQuantity === 0;
          return (
            <button
              key={product.id}
              onClick={() => !outOfStock && addToCart(product.id)}
              disabled={outOfStock}
              className={cn(
                'group relative flex flex-col items-center gap-2 rounded-2xl border bg-card p-4 text-center transition-all no-tap-highlight',
                outOfStock
                  ? 'cursor-not-allowed opacity-50'
                  : 'hover:border-primary/30 hover:shadow-md active:scale-[0.97]'
              )}
            >
              {inCart && (
                <span className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                  {inCart.quantity}
                </span>
              )}
              <div
                className={cn(
                  'flex h-16 w-16 items-center justify-center rounded-2xl transition-colors',
                  outOfStock
                    ? 'bg-muted'
                    : 'bg-primary/10 group-hover:bg-primary/15'
                )}
              >
                <Package
                  className={cn(
                    'h-8 w-8',
                    outOfStock
                      ? 'text-muted-foreground'
                      : 'text-primary'
                  )}
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{product.name}</p>
                <p className="font-display text-lg font-bold text-primary">
                  {formatMVR(product.sellingPrice)}
                </p>
                <p
                  className={cn(
                    'text-xs',
                    outOfStock
                      ? 'text-destructive'
                      : product.availableQuantity <= 5
                        ? 'text-warning'
                        : 'text-muted-foreground'
                  )}
                >
                  {outOfStock
                    ? 'Out of stock'
                    : `${product.availableQuantity} available`}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Cart sheet */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent className="flex w-full flex-col p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border p-4">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Cart ({cartCount})
              </SheetTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCartOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          {cart.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <ShoppingCart className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Your cart is empty
              </p>
            </div>
          ) : (
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {cart.map((item) => {
                const product = products.find((p) => p.id === item.productId);
                if (!product) return null;
                return (
                  <div
                    key={item.productId}
                    className="flex items-center gap-3 rounded-xl border border-border p-3"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {product.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatMVR(product.sellingPrice)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQty(item.productId, -1)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-6 text-center font-display text-base font-bold">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQty(item.productId, 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeFromCart(item.productId)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {cart.length > 0 && (
            <SheetFooter className="border-t border-border p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-display text-2xl font-bold text-primary">
                  {formatMVR(cartTotal)}
                </span>
              </div>
              <Button
                className="w-full gap-2"
                size="lg"
                onClick={completeSale}
              >
                <CheckCircle2 className="h-5 w-5" />
                Complete Sale
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      {/* Success dialog */}
      <Sheet open={successOpen} onOpenChange={setSuccessOpen}>
        <SheetContent
          side="bottom"
          className="flex flex-col items-center justify-center gap-4 p-8"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10 animate-scale-in">
            <CheckCircle2 className="h-10 w-10 text-success" />
          </div>
          <div className="text-center">
            <p className="font-display text-2xl font-bold">Sale Complete!</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Product inventory has been updated
            </p>
          </div>
          <Button
            className="w-full"
            size="lg"
            onClick={() => setSuccessOpen(false)}
          >
            Done
          </Button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
