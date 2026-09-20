import { useParams } from "wouter";
import { useSearchProducts } from "@workspace/api-client-react";
import { ProductCard, ProductCardSkeleton } from "@/components/product-card";
import { ErrorState } from "@/components/readiness-state";

export function Category({ category, title }: { category: string, title?: string }) {
  const { data, isLoading, error } = useSearchProducts({
    collection: category,
    limit: 24
  }, {
    query: {
      queryKey: ['searchProducts', { collection: category }]
    }
  });

  const displayTitle = title || category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ');

  if (error) return <ErrorState error="Failed to load category products" />;

  return (
    <div className="container mx-auto px-4 py-12 md:py-16">
      <div className="mb-10 text-center md:text-left">
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">{displayTitle}</h1>
        {data && (
          <p className="text-muted-foreground">{data.total} products available</p>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
          {Array.from({ length: 12 }).map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      ) : data?.products.length === 0 ? (
        <div className="py-24 text-center bg-secondary rounded-xl">
          <p className="text-lg text-muted-foreground mb-4">No products found in this category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
          {data?.products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AgeCategory() {
  const { range } = useParams<{ range: string }>();
  // Map friendly ranges to search
  const displayRange = range ? range.replace('-', ' ') : 'Kids';

  const { data, isLoading, error } = useSearchProducts({
    age: range,
    limit: 24
  }, { query: { queryKey: ['searchProducts', { age: range }] } });

  if (error) return <ErrorState error="Failed to load age products" />;

  return (
    <div className="container mx-auto px-4 py-12 md:py-16">
      <div className="mb-10 text-center md:text-left">
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4 capitalize">Shop by Age: {displayRange}</h1>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
          {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      ) : data?.products.length === 0 ? (
        <div className="py-24 text-center bg-secondary rounded-xl">
          <p className="text-lg text-muted-foreground mb-4">No products found for this age range.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
          {data?.products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

export function OccasionCategory() {
  const { occasion } = useParams<{ occasion: string }>();

  const { data, isLoading, error } = useSearchProducts({
    occasion: occasion,
    limit: 24
  }, { query: { queryKey: ['searchProducts', { occasion: occasion }] } });

  if (error) return <ErrorState error="Failed to load occasion products" />;

  return (
    <div className="container mx-auto px-4 py-12 md:py-16">
      <div className="mb-10 text-center md:text-left">
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4 capitalize">Shop by Occasion: {occasion}</h1>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
          {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      ) : data?.products.length === 0 ? (
        <div className="py-24 text-center bg-secondary rounded-xl">
          <p className="text-lg text-muted-foreground mb-4">No products found for this occasion.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
          {data?.products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
