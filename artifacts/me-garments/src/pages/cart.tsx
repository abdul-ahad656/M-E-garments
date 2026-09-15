import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useGetCart, useUpdateCartLine, useRemoveCartLine, getGetCartQueryKey } from "@workspace/api-client-react";
import { getCartId, clearCartId } from "@/lib/cart";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingBag, Minus, Plus, Trash2, ArrowRight, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { ErrorState } from "@/components/readiness-state";
import { trackEvent } from "@/lib/analytics";

export default function Cart() {
  const cartId = getCartId();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const cartParams = { cartId: cartId || "" };
  const { data: cart, isLoading, error } = useGetCart(cartParams, {
    query: { enabled: !!cartId, queryKey: getGetCartQueryKey(cartParams), retry: false }
  });

  const updateLine = useUpdateCartLine();
  const removeLine = useRemoveCartLine();

  useEffect(() => {
    // If cart is completely missing (404), clear the local ID
    if ((error as { status?: number } | null)?.status === 404) {
      clearCartId();
    }
  }, [error]);

  const handleUpdateQuantity = (lineId: string, currentQuantity: number, delta: number) => {
    if (!cart) return;
    const newQuantity = currentQuantity + delta;
    if (newQuantity < 1) return;

    updateLine.mutate({
      data: { cartId: cart.id, lineId, quantity: newQuantity }
    }, {
      onSuccess: (newCart) => {
        queryClient.setQueryData(getGetCartQueryKey({ cartId: cart.id }), newCart);
      }
    });
  };

  const handleRemove = (lineId: string) => {
    if (!cart) return;
    removeLine.mutate({
      data: { cartId: cart.id, lineId }
    }, {
      onSuccess: (newCart) => {
        queryClient.setQueryData(getGetCartQueryKey({ cartId: cart.id }), newCart);
      }
    });
  };

  const handleCheckout = () => {
    if (cart?.checkoutUrl) {
      trackEvent("checkout_started", {
        cart_size: cart.totalQuantity === 1 ? "single_item" : "multiple_items",
      });
      window.location.href = cart.checkoutUrl;
    }
  };

  if (error && (error as { status?: number }).status !== 404) {
    return <ErrorState error="Your Shopify cart is temporarily unavailable. Please try again." />;
  }

  if (isLoading || (cartId && !cart && !error)) {
    return <CartSkeleton />;
  }

  if (!cartId || !cart || cart.lines.length === 0) {
    return (
      <div className="container mx-auto px-4 py-24 md:py-32 max-w-4xl flex flex-col items-center justify-center text-center animate-in fade-in duration-500">
        <div className="w-32 h-32 bg-secondary rounded-full flex items-center justify-center mb-8 text-primary/40">
          <ShoppingBag className="w-16 h-16" />
        </div>
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-6">Your cart is empty</h1>
        <p className="text-lg text-foreground/70 mb-10 max-w-md">
          Looks like you haven't added any kidswear to your cart yet. Let's find something joyful!
        </p>
        <Link href="/" className="inline-flex">
          <Button size="lg" className="h-14 px-8 text-lg rounded-full font-bold shadow-lg hover:shadow-primary/25 hover:scale-105 transition-all">
            Continue Shopping
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 md:py-16 max-w-6xl animate-in fade-in duration-500">
      <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-12">Your Cart</h1>

      <div className="grid lg:grid-cols-[1fr_400px] gap-12 lg:gap-16 items-start">

        {/* Cart Items */}
        <div className="space-y-8">
          {cart.lines.map((line) => {
            const isUpdating = updateLine.isPending && updateLine.variables?.data?.lineId === line.id;
            const isRemoving = removeLine.isPending && removeLine.variables?.data?.lineId === line.id;

            return (
              <div
                key={line.id}
                className={cn(
                  "flex gap-6 py-6 border-b border-border/50 transition-opacity",
                  (isUpdating || isRemoving) && "opacity-50 pointer-events-none"
                )}
              >
                {/* Product Image */}
                <Link href={`/product/${line.merchandise.product.handle}`} className="shrink-0 group block cursor-pointer">
                  <div className="w-28 h-36 md:w-32 md:h-40 bg-secondary rounded-2xl overflow-hidden">
                    {line.merchandise.image ? (
                      <img
                        src={line.merchandise.image.url}
                        alt={line.merchandise.image.altText || line.merchandise.product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-8 h-8 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                </Link>

                {/* Product Info */}
                <div className="flex flex-col flex-1 py-1">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <Link href={`/product/${line.merchandise.product.handle}`} className="cursor-pointer">
                        <h3 className="font-serif text-lg md:text-xl font-bold text-foreground hover:text-primary transition-colors line-clamp-2">
                          {line.merchandise.product.title}
                        </h3>
                      </Link>
                      <div className="mt-2 space-y-1">
                        {line.merchandise.selectedOptions.map(opt => (
                          <p key={opt.name} className="text-sm text-foreground/70">
                            <span className="font-medium mr-2">{opt.name}:</span> {opt.value}
                          </p>
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-lg text-foreground font-serif tracking-tight">
                        {line.merchandise.price.currencyCode} {line.merchandise.price.amount}
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center justify-between pt-4">
                    <div className="flex items-center bg-secondary rounded-full p-1 border border-border/50">
                      <button
                        onClick={() => handleUpdateQuantity(line.id, line.quantity, -1)}
                        disabled={line.quantity <= 1}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-background disabled:opacity-30 transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-10 text-center font-medium text-sm text-foreground">{line.quantity}</span>
                      <button
                        onClick={() => handleUpdateQuantity(line.id, line.quantity, 1)}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-background transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      onClick={() => handleRemove(line.id)}
                      className="text-sm text-muted-foreground hover:text-destructive flex items-center gap-1.5 transition-colors font-medium p-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order Summary */}
        <div className="bg-secondary/50 rounded-3xl p-8 sticky top-24 border border-border/50">
          <h2 className="font-serif text-2xl font-bold mb-8 text-foreground">Order Summary</h2>

          <div className="space-y-4 mb-8 text-foreground/80">
            <div className="flex justify-between items-center">
              <span>Subtotal ({cart.totalQuantity} items)</span>
              <span className="font-medium text-foreground">{cart.cost.subtotalAmount.currencyCode} {cart.cost.subtotalAmount.amount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Shipping</span>
              <span className="text-primary font-medium tracking-wide text-sm">Calculated at checkout</span>
            </div>
          </div>

          <div className="pt-6 border-t border-border/50 mb-8 flex justify-between items-end">
            <span className="font-bold text-lg text-foreground">Total</span>
            <div className="text-right">
              <span className="text-3xl font-serif font-bold block text-foreground">{cart.cost.totalAmount.currencyCode} {cart.cost.totalAmount.amount}</span>
              <span className="text-xs text-muted-foreground">Taxes shown at checkout</span>
            </div>
          </div>

          <Button
            size="lg"
            onClick={handleCheckout}
            className="w-full h-16 text-lg rounded-2xl font-bold shadow-lg hover:shadow-primary/25 hover:scale-[1.02] transition-all duration-300 group"
          >
            Checkout Securely
            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>

          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="w-4 h-4" />
            <span>Shopify-hosted checkout</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="container mx-auto px-4 py-12 md:py-16 max-w-6xl animate-pulse">
      <Skeleton className="h-12 w-64 mb-12" />
      <div className="grid lg:grid-cols-[1fr_400px] gap-12 lg:gap-16">
        <div className="space-y-8">
          {[1, 2].map(i => (
            <div key={i} className="flex gap-6 py-6 border-b border-border/50">
              <Skeleton className="w-28 h-36 md:w-32 md:h-40 rounded-2xl shrink-0" />
              <div className="flex-1 space-y-4 py-2">
                <div className="flex justify-between">
                  <Skeleton className="h-6 w-1/2" />
                  <Skeleton className="h-6 w-20" />
                </div>
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-1/4" />
                <div className="mt-8 flex justify-between">
                  <Skeleton className="h-10 w-24 rounded-full" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="h-[400px] rounded-3xl" />
      </div>
    </div>
  );
}
