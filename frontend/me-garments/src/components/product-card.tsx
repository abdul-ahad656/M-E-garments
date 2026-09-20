import { Link } from "wouter";
import { type Product } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";
import { FavoriteButton } from "@/components/favorite-button";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <div className="group block rounded-xl relative">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-secondary mb-4">
        {product.image ? (
          <img
            src={product.image.url}
            alt={product.image.altText || product.title}
            className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
            No image
          </div>
        )}

        <div className="absolute top-3 left-3 flex flex-col gap-2 items-start z-10 pointer-events-none">
          {product.badges.map((badge) => (
            <Badge key={badge} className={badge.toLowerCase() === 'new' ? 'bg-primary text-white shadow-sm' : 'bg-white text-foreground shadow-sm hover:bg-white'}>
              {badge.toLowerCase() === 'ai recommended' && <Sparkles className="w-3 h-3 mr-1 text-primary" />}
              {badge}
            </Badge>
          ))}
          {!product.availableForSale && (
            <Badge variant="destructive" className="shadow-sm">Sold Out</Badge>
          )}
        </div>

        <div className="absolute top-3 right-3 z-20">
          <FavoriteButton productId={product.id} productHandle={product.handle} />
        </div>

        <Link href={`/product/${product.handle}`} className="absolute inset-0 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
          <span className="sr-only">View {product.title}</span>
        </Link>
      </div>

      <div className="space-y-1 relative z-20 pointer-events-none">
        <h3 className="font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
          {product.title}
        </h3>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">
            {product.price.currencyCode} {product.price.amount}
          </span>
          {product.compareAtPrice && parseFloat(product.compareAtPrice.amount) > parseFloat(product.price.amount) && (
            <span className="text-sm text-muted-foreground line-through">
              {product.compareAtPrice.currencyCode} {product.compareAtPrice.amount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="aspect-[4/5] w-full rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/4" />
      </div>
    </div>
  );
}
