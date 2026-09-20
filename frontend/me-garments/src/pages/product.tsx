import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { useGetProduct, useCreateCart, useAddCartLine, useSaveRecentlyViewedItem, getGetCartQueryKey, getGetProductQueryKey, type ProductImage } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getCartId, setCartId, clearCartId } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, PackageCheck, ShieldCheck, ChevronRight } from "lucide-react";
import { ErrorState, ReadinessState } from "@/components/readiness-state";
import { cn } from "@/lib/utils";
import { FavoriteButton } from "@/components/favorite-button";

export default function Product() {
  const { handle } = useParams<{ handle: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { isSignedIn } = useUser();

  const { data: product, isLoading, error } = useGetProduct(handle || "", {
    query: { enabled: !!handle, queryKey: getGetProductQueryKey(handle || ""), retry: false }
  });

  const saveRecentlyViewed = useSaveRecentlyViewedItem({ mutation: { retry: 2 } });
  const saveRecentlyViewedRef = useRef(saveRecentlyViewed.mutate);
  saveRecentlyViewedRef.current = saveRecentlyViewed.mutate;
  const viewedRecorded = useRef<string | null>(null);
  const inFlight = useRef<boolean>(false);

  useEffect(() => {
    const productId = product?.id;
    const productHandle = product?.handle;

    // Only attempt to record if we are signed in, have a product, haven't recorded it yet, and aren't currently recording
    if (isSignedIn && productId && productHandle && viewedRecorded.current !== productId && !inFlight.current) {
      inFlight.current = true;
      saveRecentlyViewedRef.current(
        { data: { productId: productId, productHandle } },
        {
          onSuccess: () => {
            viewedRecorded.current = productId;
            inFlight.current = false;
          },
          onError: () => {
            inFlight.current = false;
          }
        }
      );
    }
  }, [isSignedIn, product?.id, product?.handle]);

  const createCart = useCreateCart();
  const addCartLine = useAddCartLine();
  const [isAdding, setIsAdding] = useState(false);

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [mainImage, setMainImage] = useState<ProductImage | null>(null);

  // Auto-select first available variant
  useEffect(() => {
    if (product && Object.keys(selectedOptions).length === 0) {
      const availableVariant = product.variants.find(v => v.availableForSale) || product.variants[0];
      if (availableVariant) {
        const initialOptions: Record<string, string> = {};
        availableVariant.selectedOptions.forEach(opt => {
          initialOptions[opt.name] = opt.value;
        });
        setSelectedOptions(initialOptions);
      }
      setMainImage(product.images[0]);
    }
  }, [product, selectedOptions]);

  const matchedVariant = useMemo(() => {
    if (!product) return null;
    return product.variants.find(v =>
      v.selectedOptions.every(opt => selectedOptions[opt.name] === opt.value)
    );
  }, [product, selectedOptions]);

  useEffect(() => {
    if (matchedVariant?.image) {
      setMainImage(matchedVariant.image);
    }
  }, [matchedVariant]);

  const handleAddToCart = () => {
    if (!matchedVariant) return;
    setIsAdding(true);
    const currentCartId = getCartId();

    if (currentCartId) {
      addCartLine.mutate({
        data: { cartId: currentCartId, merchandiseId: matchedVariant.id, quantity: 1 }
      }, {
        onSuccess: (newCart) => {
          queryClient.setQueryData(
            getGetCartQueryKey({ cartId: currentCartId }),
            newCart,
          );
          setIsAdding(false);
          setLocation('/cart');
        },
        onError: () => {
          // If cart is stale/missing, clear it and retry by creating a new cart
          clearCartId();
          createCart.mutate({
            data: { merchandiseId: matchedVariant.id, quantity: 1 }
          }, {
            onSuccess: (cart) => {
              setCartId(cart.id);
              setIsAdding(false);
              setLocation('/cart');
            },
            onError: () => setIsAdding(false)
          });
        }
      });
    } else {
      createCart.mutate({
        data: { merchandiseId: matchedVariant.id, quantity: 1 }
      }, {
        onSuccess: (cart) => {
          setCartId(cart.id);
          setIsAdding(false);
          setLocation('/cart');
        },
        onError: () => setIsAdding(false)
      });
    }
  };

  if (error) {
    return (error as { status?: number }).status === 404
      ? <ReadinessState title="Product unavailable" description="This product was not found in the M&E catalog." actionText="Continue Shopping" actionHref="/" />
      : <ErrorState error="Product details are temporarily unavailable." />;
  }

  if (isLoading || !product) {
    return <ProductSkeleton />;
  }

  const isSale = matchedVariant?.compareAtPrice && parseFloat(matchedVariant.compareAtPrice.amount) > parseFloat(matchedVariant.price.amount);
  const price = matchedVariant?.price || product.variants[0]?.price;
  const compareAtPrice = matchedVariant?.compareAtPrice || product.variants[0]?.compareAtPrice;

  const hasOnlyDefaultVariant = product.options.length === 1 && product.options[0].values[0] === 'Default Title';

  return (
    <div className="container mx-auto px-4 py-8 md:py-16 max-w-7xl animate-in fade-in duration-500">
      <div className="text-sm breadcrumbs text-muted-foreground mb-8 flex items-center gap-2">
        <button onClick={() => setLocation('/')} className="hover:text-primary transition-colors">Home</button>
        <ChevronRight className="w-4 h-4" />
        <span className="text-foreground font-medium">{product.title}</span>
      </div>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-12 lg:gap-20 items-start">
        {/* Images */}
        <div className="flex flex-col-reverse md:flex-row gap-4 lg:sticky lg:top-24">
          {product.images.length > 1 && (
            <div className="flex md:flex-col gap-4 overflow-x-auto md:overflow-y-auto no-scrollbar pb-2 md:pb-0 md:w-24 shrink-0">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setMainImage(img)}
                  className={cn(
                    "relative aspect-[4/5] w-20 md:w-full rounded-xl overflow-hidden border-2 transition-all",
                    mainImage?.url === img.url ? "border-primary shadow-md" : "border-transparent hover:border-primary/30"
                  )}
                >
                  <img src={img.url} alt={img.altText || `Thumbnail ${i+1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="relative rounded-3xl overflow-hidden bg-secondary aspect-[4/5] flex-1">
            {mainImage ? (
              <img
                src={mainImage.url}
                alt={mainImage.altText || product.title}
                className="w-full h-full object-cover transition-opacity duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                No image available
              </div>
            )}

            <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
              {isSale && (
                <Badge className="bg-destructive text-white border-none px-3 py-1 text-sm uppercase tracking-wider font-bold">
                  Sale
                </Badge>
              )}
            </div>

            <div className="absolute top-4 right-4 z-10">
              <FavoriteButton
                productId={product.id}
                productHandle={product.handle}
                location="product_detail"
                className="w-12 h-12 flex items-center justify-center bg-white shadow-md text-foreground hover:bg-white"
                iconClassName="w-6 h-6"
              />
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-10 lg:pt-4">
          <div className="space-y-4">
            <p className="text-primary font-bold tracking-widest uppercase text-sm">{product.vendor}</p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-foreground leading-[1.1] text-balance">
              {product.title}
            </h1>
            <div className="flex items-center gap-4 pt-2">
              <span className="text-3xl font-bold text-foreground font-serif tracking-tight">
                {price.currencyCode} {price.amount}
              </span>
              {isSale && compareAtPrice && (
                <span className="text-xl text-muted-foreground line-through decoration-muted-foreground/50">
                  {compareAtPrice.currencyCode} {compareAtPrice.amount}
                </span>
              )}
            </div>
          </div>

          {!hasOnlyDefaultVariant && (
            <div className="space-y-8">
              {product.options.map(option => (
                <div key={option.id} className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-sm uppercase tracking-widest text-foreground/80">{option.name}</h3>
                    {option.name.toLowerCase() === 'size' && (
                      <span className="text-sm text-muted-foreground">Choose an available size</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {option.values.map(val => {
                      const isSelected = selectedOptions[option.name] === val;

                      // Check if any available variant has this option value
                      const isAvailable = product.variants.some(v =>
                        v.availableForSale && v.selectedOptions.some(o => o.name === option.name && o.value === val)
                      );

                      return (
                        <button
                          key={val}
                          onClick={() => setSelectedOptions(prev => ({ ...prev, [option.name]: val }))}
                          className={cn(
                            "h-12 px-6 rounded-xl border text-sm font-medium transition-all duration-200",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground shadow-sm scale-105"
                              : "border-border hover:border-primary/50 hover:bg-secondary/50",
                            (!isAvailable && !isSelected) && "opacity-50 hover:bg-transparent hover:border-border decoration-destructive line-through"
                          )}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 space-y-4">
            <Button
              size="lg"
              onClick={handleAddToCart}
              disabled={isAdding || !matchedVariant?.availableForSale}
              className={cn(
                "w-full h-16 text-lg rounded-2xl font-bold transition-all duration-300",
                matchedVariant?.availableForSale
                  ? "hover:scale-[1.02] shadow-lg hover:shadow-primary/25"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {isAdding ? (
                <span className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                  Adding to Cart...
                </span>
              ) : matchedVariant?.availableForSale ? (
                <span className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5" /> Add to Cart
                </span>
              ) : (
                "Out of Stock"
              )}
            </Button>

            <div className="grid grid-cols-2 gap-4 pt-6 border-t">
              <div className="flex items-center gap-3 text-sm text-foreground/70">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-primary">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <span className="font-medium">Live inventory<br/>from catalog</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-foreground/70">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-primary">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <span className="font-medium">Secure in-app<br/>checkout</span>
              </div>
            </div>
          </div>

          {product.descriptionHtml ? (
            <div className="prose prose-sm md:prose-base prose-headings:font-serif prose-p:text-foreground/80 prose-a:text-primary max-w-none pt-8 border-t"
                 dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />
          ) : (
            <div className="pt-8 border-t space-y-4">
              <h3 className="font-bold text-sm uppercase tracking-widest text-foreground/80">Description</h3>
              <p className="text-foreground/80 leading-relaxed text-lg">
                 {product.description || "Product details have not been added yet."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="container mx-auto px-4 py-12 md:py-16 max-w-7xl animate-pulse">
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-12 lg:gap-20">
        <Skeleton className="aspect-[4/5] w-full rounded-3xl" />
        <div className="space-y-8 py-8">
          <div className="space-y-4">
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-16 w-3/4" />
            <Skeleton className="h-8 w-1/3" />
          </div>
          <div className="space-y-4 pt-8">
            <Skeleton className="h-6 w-1/4" />
            <div className="flex gap-4">
              <Skeleton className="h-12 w-16 rounded-xl" />
              <Skeleton className="h-12 w-16 rounded-xl" />
              <Skeleton className="h-12 w-16 rounded-xl" />
            </div>
          </div>
          <Skeleton className="h-24 w-full mt-12" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
