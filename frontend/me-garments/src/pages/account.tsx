import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { Show, useUser, useClerk } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCustomerProfile,
  useUpdateCustomerProfile,
  useListWishlistItems,
  useListRecentlyViewedItems,
  useListCustomerOrders,
  useGetCustomerOrder,
  getGetCustomerProfileQueryKey,
  getListWishlistItemsQueryKey,
  getListRecentlyViewedItemsQueryKey,
  getListCustomerOrdersQueryKey,
  getGetCustomerOrderQueryKey,
  type OrderReference
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Heart, Clock, Package, Settings, LogOut, Loader2, ArrowRight, ChevronDown, ExternalLink } from "lucide-react";
import { ProductCardSkeleton } from "@/components/product-card";
// We need a lightweight version of ProductCard that accepts SavedProductReference or ViewedProductReference
import { ProductReferenceCard } from "@/components/product-reference-card";

function formatMoney(amount: string, currencyCode: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  }).format(parseFloat(amount));
}

export default function Account() {
  return (
    <div className="container mx-auto px-4 py-8 md:py-16 max-w-7xl animate-in fade-in duration-500">
      <Show when="signed-in">
        <AccountDashboard />
      </Show>
      <Show when="signed-out">
        <SignInPrompt />
      </Show>
    </div>
  );
}

function SignInPrompt() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center max-w-md mx-auto space-y-8">
      <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center">
        <Heart className="w-10 h-10 text-primary" />
      </div>
      <div className="space-y-4">
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground">
          Sign in to your account
        </h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Create an account or sign in to save your favorite items, track your orders, and keep your shopping history across all devices.
        </p>
      </div>
      <div className="flex flex-col w-full gap-4 sm:flex-row justify-center">
        <Link
          href="/sign-in"
          className="w-full sm:w-auto inline-flex items-center justify-center whitespace-nowrap text-base h-14 rounded-xl px-8 font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-colors"
        >
          Sign In
        </Link>
        <Link
          href="/sign-up"
          className="w-full sm:w-auto inline-flex items-center justify-center whitespace-nowrap text-base h-14 rounded-xl px-8 font-bold border-2 border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          Create Account
        </Link>
      </div>
    </div>
  );
}

function AccountDashboard() {
  const { user, isSignedIn } = useUser();
  const { signOut } = useClerk();

  const { data: profile, isLoading: isProfileLoading, error: profileError } = useGetCustomerProfile({
    query: { enabled: !!isSignedIn, queryKey: getGetCustomerProfileQueryKey(), retry: false }
  });
  const { data: wishlist, isLoading: isWishlistLoading, error: wishlistError } = useListWishlistItems({
    query: { enabled: !!isSignedIn, queryKey: getListWishlistItemsQueryKey(), retry: false }
  });
  const { data: recent, isLoading: isRecentLoading, error: recentError } = useListRecentlyViewedItems({
    query: { enabled: !!isSignedIn, queryKey: getListRecentlyViewedItemsQueryKey(), retry: false }
  });

  // Orders may fail if the commerce API is temporarily unavailable.
  const { data: orders, isLoading: isOrdersLoading, error: ordersError } = useListCustomerOrders({
    query: { enabled: !!isSignedIn, queryKey: getListCustomerOrdersQueryKey(), retry: false }
  });

  const handleSignOut = () => {
    signOut({ redirectUrl: '/' });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground">
            Welcome back, {profile?.displayName || user?.firstName || 'Friend'}
          </h1>
          <p className="text-muted-foreground">
            {user?.primaryEmailAddress?.emailAddress}
          </p>
        </div>
        <Button variant="outline" onClick={handleSignOut} className="w-fit text-muted-foreground hover:text-foreground">
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>

      <Tabs defaultValue="wishlist" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto rounded-none border-b bg-transparent p-0 h-14 mb-8">
          <TabsTrigger value="wishlist" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none px-6 h-full text-base">
            <Heart className="w-4 h-4 mr-2" /> Wishlist
          </TabsTrigger>
          <TabsTrigger value="recent" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none px-6 h-full text-base">
            <Clock className="w-4 h-4 mr-2" /> Recently Viewed
          </TabsTrigger>
          <TabsTrigger value="orders" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none px-6 h-full text-base">
            <Package className="w-4 h-4 mr-2" /> Orders
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none px-6 h-full text-base">
            <Settings className="w-4 h-4 mr-2" /> Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="wishlist" className="space-y-6 outline-none">
          {isWishlistLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          ) : wishlistError ? (
            <Card className="bg-secondary border-none">
              <CardContent className="pt-6 flex flex-col items-center justify-center text-center p-8 space-y-4">
                <Heart className="w-12 h-12 text-muted-foreground opacity-50" />
                <div className="space-y-2 max-w-md">
                  <h3 className="font-bold text-lg text-foreground">Wishlist unavailable</h3>
                  <p className="text-muted-foreground">We couldn't load your wishlist at this time. Please try again later.</p>
                </div>
              </CardContent>
            </Card>
          ) : wishlist && wishlist.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {wishlist.map(item => (
                <ProductReferenceCard key={item.productId} reference={item} source="wishlist" />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Heart className="w-12 h-12" />}
              title="Your wishlist is empty"
              description="Save items you love by clicking the heart icon on any product."
            />
          )}
        </TabsContent>

        <TabsContent value="recent" className="space-y-6 outline-none">
          {isRecentLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          ) : recentError ? (
            <Card className="bg-secondary border-none">
              <CardContent className="pt-6 flex flex-col items-center justify-center text-center p-8 space-y-4">
                <Clock className="w-12 h-12 text-muted-foreground opacity-50" />
                <div className="space-y-2 max-w-md">
                  <h3 className="font-bold text-lg text-foreground">Recent views unavailable</h3>
                  <p className="text-muted-foreground">We couldn't load your recent history at this time. Please try again later.</p>
                </div>
              </CardContent>
            </Card>
          ) : recent && recent.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {recent.map(item => (
                <ProductReferenceCard
                  key={`${item.productId}-${item.viewedAt}`}
                  reference={item}
                  source="recently_viewed"
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Clock className="w-12 h-12" />}
              title="No recently viewed items"
              description="Products you browse will appear here so you can easily find them again."
            />
          )}
        </TabsContent>

        <TabsContent value="orders" className="space-y-6 outline-none">
          {isOrdersLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
            </div>
          ) : ordersError ? (
            <Card className="bg-secondary border-none">
              <CardContent className="pt-6 flex flex-col items-center justify-center text-center p-8 space-y-4">
                <Package className="w-12 h-12 text-muted-foreground opacity-50" />
                <div className="space-y-2 max-w-md">
                  <h3 className="font-bold text-lg text-foreground">Order history unavailable</h3>
                  <p className="text-muted-foreground">We couldn't load your orders right now. Please try again later.</p>
                </div>
              </CardContent>
            </Card>
          ) : orders && orders.length > 0 ? (
            <div className="space-y-4">
              {orders.map(order => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Package className="w-12 h-12" />}
              title="No orders yet"
              description="When you make a purchase, your order status will appear here."
            />
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-6 outline-none max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>Update your display name and preferences.</CardDescription>
            </CardHeader>
            <CardContent>
              {isProfileLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-32" />
                </div>
              ) : profileError ? (
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-4 text-muted-foreground">
                  <Settings className="w-12 h-12 opacity-50" />
                  <p>Profile settings are currently unavailable.</p>
                </div>
              ) : (
                <ProfileSettingsForm
                  initialDisplayName={profile?.displayName || ''}
                  initialCurrency={profile?.preferredCurrency || 'USD'}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="text-muted-foreground/30 mb-6">{icon}</div>
      <h3 className="text-2xl font-serif font-bold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-md mb-8">{description}</p>
      <Link
        href="/"
        className="inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 transition-colors"
      >
        Start Shopping <ArrowRight className="w-4 h-4 ml-2" />
      </Link>
    </div>
  );
}

function OrderCard({ order }: { order: OrderReference }) {
  const [isOpen, setIsOpen] = useState(false);
  const {
    data: detail,
    isLoading,
    error,
  } = useGetCustomerOrder(order.id, {
    query: {
      enabled: isOpen,
      queryKey: getGetCustomerOrderQueryKey(order.id),
      retry: false,
    },
  });

  return (
    <Card className="overflow-hidden">
      <div className="bg-secondary/50 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Order Number</p>
            <p className="font-bold">{order.name}</p>
          </div>
          <div className="h-10 w-px bg-border hidden sm:block"></div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Date</p>
            <p className="font-medium">{new Date(order.processedAt).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Total</p>
          <p className="font-bold text-lg">{formatMoney(order.totalPrice.amount, order.totalPrice.currencyCode)}</p>
        </div>
      </div>
      <CardContent className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Payment:</span>
            <Badge variant="outline" className={order.displayFinancialStatus?.toUpperCase() === 'PAID' ? 'bg-green-100 text-green-800 border-green-200' : ''}>
              {order.displayFinancialStatus || 'PENDING'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Fulfillment:</span>
            <Badge variant="outline" className={order.displayFulfillmentStatus?.toUpperCase() === 'FULFILLED' ? 'bg-blue-100 text-blue-800 border-blue-200' : ''}>
              {order.displayFulfillmentStatus || 'UNFULFILLED'}
            </Badge>
          </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setIsOpen((open) => !open)}
            aria-expanded={isOpen}
            aria-controls={`order-${order.id}-details`}
          >
            {isOpen ? "Hide details" : "View details"}
            <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </Button>
        </div>

        {isOpen && (
          <div id={`order-${order.id}-details`} className="mt-6 border-t pt-6">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
              </div>
            ) : error ? (
              <p className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
                We couldn't load this order's live details. Please try again later.
              </p>
            ) : detail ? (
              <div className="space-y-8">
                <section aria-labelledby={`order-${order.id}-items`}>
                  <h4 id={`order-${order.id}-items`} className="mb-3 font-bold">
                    Items
                  </h4>
                  <div className="divide-y rounded-lg border">
                    {detail.lineItems.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-4 p-4">
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.variantTitle ? `${item.variantTitle} · ` : ""}Qty {item.quantity}
                          </p>
                        </div>
                        <p className="font-medium">
                          {formatMoney(item.price.amount, item.price.currencyCode)}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                <section aria-labelledby={`order-${order.id}-delivery`}>
                  <h4 id={`order-${order.id}-delivery`} className="mb-3 font-bold">
                    Delivery
                  </h4>
                  {detail.fulfillments.length === 0 ? (
                    <p className="rounded-lg bg-secondary/60 p-4 text-sm text-muted-foreground">
                      This order has not been fulfilled yet. Tracking will appear here when available.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {detail.fulfillments.map((fulfillment) => (
                        <div key={fulfillment.id} className="rounded-lg border p-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <span className="text-sm text-muted-foreground">Fulfillment status</span>
                            <Badge variant="outline">
                              {fulfillment.status.replaceAll("_", " ").toUpperCase()}
                            </Badge>
                          </div>
                          {fulfillment.tracking.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {fulfillment.tracking.map((tracking) => (
                                <a
                                  key={`${tracking.url}-${tracking.number ?? ""}`}
                                  href={tracking.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                                >
                                  Track{tracking.company ? ` with ${tracking.company}` : " delivery"}
                                  {tracking.number ? ` · ${tracking.number}` : ""}
                                  <ExternalLink className="ml-2 h-3.5 w-3.5" />
                                </a>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No tracking link is available for this fulfillment yet.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProfileSettingsForm({ initialDisplayName, initialCurrency }: { initialDisplayName: string, initialCurrency: string }) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [currency, setCurrency] = useState(initialCurrency);
  const updateProfile = useUpdateCustomerProfile();
  const queryClient = useQueryClient();

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync({
        data: {
          displayName,
          preferredCurrency: currency
        }
      });
      toast({
        title: "Profile updated",
        description: "Your settings have been saved successfully.",
      });
      // Invalidate queries to refresh data across tabs
      queryClient.invalidateQueries({ queryKey: getGetCustomerProfileQueryKey() });
    } catch (e) {
      toast({
        title: "Error saving profile",
        description: "Please try again later.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="displayName">Display Name</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="How should we call you?"
          className="max-w-md"
        />
        <p className="text-xs text-muted-foreground">This is how we'll greet you in the app.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="currency">Preferred Currency</Label>
        <Input
          id="currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          maxLength={3}
          placeholder="USD"
          className="max-w-[100px]"
        />
        <p className="text-xs text-muted-foreground">3-letter currency code (e.g. USD, EUR, GBP).</p>
      </div>

      <Button
        onClick={handleSave}
        disabled={updateProfile.isPending || (displayName === initialDisplayName && currency === initialCurrency)}
        className="w-full sm:w-auto"
      >
        {updateProfile.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Save Changes
      </Button>
    </div>
  );
}
