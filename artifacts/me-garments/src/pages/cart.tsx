import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useCheckoutCart,
  useGetCart,
  useRemoveCartLine,
  useUpdateCartLine,
  getGetCartQueryKey,
} from "@workspace/api-client-react";
import { getCartId, clearCartId } from "@/lib/cart";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingBag, Minus, Plus, Trash2, ArrowRight, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { ErrorState } from "@/components/readiness-state";
import { trackEvent } from "@/lib/analytics";
import { useToast } from "@/hooks/use-toast";

export default function Cart() {
  const cartId = getCartId();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { toast } = useToast();

  const cartParams = { cartId: cartId || "" };
  const { data: cart, isLoading, error } = useGetCart(cartParams, {
    query: { enabled: !!cartId, queryKey: getGetCartQueryKey(cartParams), retry: false },
  });

  const updateLine = useUpdateCartLine();
  const removeLine = useRemoveCartLine();
  const checkout = useCheckoutCart();

  const [name, setName] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Pakistan");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if ((error as { status?: number } | null)?.status === 404) {
      clearCartId();
    }
  }, [error]);

  useEffect(() => {
    if (!user) return;
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
    if (fullName && !name) setName(fullName);
  }, [user, name]);

  const handleUpdateQuantity = (lineId: string, currentQuantity: number, delta: number) => {
    if (!cart) return;
    const newQuantity = currentQuantity + delta;
    if (newQuantity < 1) return;

    updateLine.mutate(
      { data: { cartId: cart.id, lineId, quantity: newQuantity } },
      {
        onSuccess: (newCart) => {
          queryClient.setQueryData(getGetCartQueryKey({ cartId: cart.id }), newCart);
        },
      },
    );
  };

  const handleRemove = (lineId: string) => {
    if (!cart) return;
    removeLine.mutate(
      { data: { cartId: cart.id, lineId } },
      {
        onSuccess: (newCart) => {
          queryClient.setQueryData(getGetCartQueryKey({ cartId: cart.id }), newCart);
        },
      },
    );
  };

  const handleCheckout = () => {
    if (!cart) return;
    if (!isSignedIn) {
      toast({
        title: "Sign in required",
        description: "Sign in to place an order so it appears in your account.",
        variant: "destructive",
      });
      setLocation("/account");
      return;
    }
    if (!name.trim() || !line1.trim() || !city.trim() || !country.trim()) {
      toast({
        title: "Shipping details required",
        description: "Enter name, address, city, and country.",
        variant: "destructive",
      });
      return;
    }

    const email =
      user?.primaryEmailAddress?.emailAddress ||
      user?.emailAddresses[0]?.emailAddress ||
      "";
    if (!email) {
      toast({
        title: "Email required",
        description: "Your account needs a verified email to checkout.",
        variant: "destructive",
      });
      return;
    }

    trackEvent("checkout_started", {
      cart_size: cart.totalQuantity === 1 ? "single_item" : "multiple_items",
    });

    checkout.mutate(
      {
        data: {
          cartId: cart.id,
          email,
          shippingAddress: {
            name: name.trim(),
            line1: line1.trim(),
            city: city.trim(),
            country: country.trim(),
            phone: phone.trim() || null,
          },
        },
      },
      {
        onSuccess: (order) => {
          clearCartId();
          toast({
            title: "Order placed",
            description: `${order.name} is unpaid until staff confirms payment.`,
          });
          setLocation("/account");
        },
        onError: (err) => {
          const data =
            typeof err === "object" && err && "data" in err
              ? (err as { data: { error?: string } }).data
              : undefined;
          toast({
            title: "Checkout failed",
            description: data?.error || "Could not place the order.",
            variant: "destructive",
          });
        },
      },
    );
  };

  if (error && (error as { status?: number }).status !== 404) {
    return <ErrorState error="Your cart is temporarily unavailable. Please try again." />;
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
        <h1 className="font-serif text-4xl font-bold mb-4">Your bag is empty</h1>
        <p className="text-muted-foreground mb-8 max-w-md">
          Discover premium kidswear and add pieces you love.
        </p>
        <Button asChild size="lg" className="rounded-2xl">
          <Link href="/">Continue shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 md:py-16 max-w-6xl animate-in fade-in duration-500">
      <h1 className="font-serif text-4xl font-bold mb-10">Shopping bag</h1>
      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          {cart.lines.map((line) => {
            const image = line.merchandise.image;
            return (
              <div
                key={line.id}
                className="flex gap-6 py-6 border-b border-border/50"
              >
                <div className="h-28 w-24 overflow-hidden rounded-2xl bg-secondary shrink-0">
                  {image?.url ? (
                    <img src={image.url} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="font-medium">{line.merchandise.product.title}</p>
                      <p className="text-sm text-muted-foreground">{line.merchandise.title}</p>
                    </div>
                    <p className="font-medium">
                      {line.merchandise.price.currencyCode} {line.merchandise.price.amount}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-secondary rounded-full p-1 border border-border/50">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => handleUpdateQuantity(line.id, line.quantity, -1)}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className={cn("w-8 text-center text-sm font-medium")}>{line.quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => handleUpdateQuantity(line.id, line.quantity, 1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground"
                      onClick={() => handleRemove(line.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-secondary/50 rounded-3xl p-8 sticky top-24 border border-border/50 space-y-6">
          <h2 className="font-serif text-2xl font-bold">Checkout</h2>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="ship-name">Full name</Label>
              <Input id="ship-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ship-line1">Address</Label>
              <Input id="ship-line1" value={line1} onChange={(e) => setLine1(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ship-city">City</Label>
              <Input id="ship-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ship-country">Country</Label>
              <Input id="ship-country" value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ship-phone">Phone (optional)</Label>
              <Input id="ship-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          <div className="pt-4 border-t border-border/50 flex justify-between items-end">
            <span className="font-bold text-lg">Total</span>
            <span className="text-3xl font-serif font-bold">
              {cart.cost.totalAmount.currencyCode} {cart.cost.totalAmount.amount}
            </span>
          </div>

          <Button
            size="lg"
            onClick={handleCheckout}
            disabled={checkout.isPending}
            className="w-full h-14 text-lg rounded-2xl font-bold"
          >
            {checkout.isPending ? "Placing order…" : "Place order"}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="w-4 h-4" />
            <span>Orders are unpaid until staff confirms payment</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
