import { Link } from "wouter";
import { useGetProduct, getGetProductQueryKey } from "@workspace/api-client-react";
import { ProductCardSkeleton } from "./product-card";
import { Badge } from "@/components/ui/badge";
import { FavoriteButton } from "@/components/favorite-button";
import { trackEvent } from "@/lib/analytics";

type ProductReferenceSource = "wishlist" | "recently_viewed";

export function ProductReferenceCard({
  reference,
  source,
}: {
  reference: { shopifyProductId: string, productHandle: string };
  source: ProductReferenceSource;
}) {
  const { data: product, isLoading, error } = useGetProduct(reference.productHandle, {
    query: {
      enabled: !!reference.productHandle,
      queryKey: getGetProductQueryKey(reference.productHandle),
      retry: false,
    }
  });

  if (isLoading) return <ProductCardSkeleton />;
  if (error || !product) {
    // Return a fallback card
    return (
      <div className="group block rounded-xl border opacity-50 relative">
        <div className="relative aspect-[4/5] overflow-hidden rounded-t-xl bg-secondary mb-4 flex items-center justify-center">
          <span className="text-muted-foreground text-sm">Product unavailable</span>
        </div>
        <div className="absolute top-3 right-3 z-10">
          <FavoriteButton
            productId={reference.shopifyProductId}
            productHandle={reference.productHandle}
            location={source}
          />
        </div>
        <div className="p-4 space-y-1">
          <h3 className="font-medium text-foreground line-clamp-1">{reference.productHandle.replace(/-/g, ' ')}</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="group block rounded-xl relative">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-secondary mb-4">
        {product.images[0] ? (
          <img
            src={product.images[0].url}
            alt={product.images[0].altText || product.title}
            className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
            No image
          </div>
        )}

        {!product.availableForSale && (
          <div className="absolute top-3 left-3 flex flex-col gap-2 items-start z-10 pointer-events-none">
            <Badge variant="destructive" className="shadow-sm">Sold Out</Badge>
          </div>
        )}

        <div className="absolute top-3 right-3 z-20">
          <FavoriteButton productId={product.id} productHandle={product.handle} location={source} />
        </div>

        <Link
          href={`/product/${product.handle}`}
          onClick={() => {
            if (source === "wishlist") {
              trackEvent("saved_product_revisited", { source: "account_wishlist" });
            }
          }}
          className="absolute inset-0 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
        >
          <span className="sr-only">View {product.title}</span>
        </Link>
      </div>

      <div className="space-y-1 relative z-20 pointer-events-none">
        <h3 className="font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
          {product.title}
        </h3>
        <div className="flex items-center gap-2">
          {product.variants[0]?.price && (
            <span className="font-semibold text-foreground">
              {product.variants[0].price.currencyCode} {product.variants[0].price.amount}
            </span>
          )}
          {product.variants[0]?.compareAtPrice && parseFloat(product.variants[0].compareAtPrice.amount) > parseFloat(product.variants[0].price.amount) && (
            <span className="text-sm text-muted-foreground line-through">
              {product.variants[0].compareAtPrice.currencyCode} {product.variants[0].compareAtPrice.amount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}