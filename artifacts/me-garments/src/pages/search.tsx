import { useState, useEffect } from "react";
import { useSearchProducts } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search as SearchIcon } from "lucide-react";
import { ProductCard, ProductCardSkeleton } from "@/components/product-card";
import { useLocation } from "wouter";

export default function Search() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      if (query) {
        setLocation(`/search?q=${encodeURIComponent(query)}`, { replace: true });
      } else {
        setLocation('/search', { replace: true });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [query, setLocation]);

  const { data, isLoading, error } = useSearchProducts(
    { query: debouncedQuery, limit: 24 },
    {
      query: {
        enabled: debouncedQuery.length > 0,
        queryKey: ['searchProducts', { query: debouncedQuery }]
      }
    }
  );

  return (
    <div className="container mx-auto px-4 py-12 md:py-16 min-h-[60vh]">
      <div className="max-w-2xl mx-auto mb-12">
        <h1 className="text-3xl font-serif font-bold text-center mb-6">What are you looking for?</h1>
        <div className="relative flex items-center">
          <SearchIcon className="absolute left-4 text-muted-foreground w-5 h-5" />
          <Input
            type="search"
            placeholder="Search by color, style, or age..."
            className="pl-12 py-6 text-lg rounded-full shadow-sm bg-card border-card-border"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {!debouncedQuery ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Try searching for "red party dress" or "boys summer shirts"</p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      ) : error ? (
        <div className="text-center text-destructive py-12">Failed to load search results.</div>
      ) : data?.products.length === 0 ? (
        <div className="text-center py-12 bg-secondary rounded-xl">
          <h2 className="text-xl font-bold mb-2">No results found</h2>
          <p className="text-muted-foreground">We couldn't find anything matching "{debouncedQuery}".</p>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-muted-foreground">Found {data?.total} results for "{debouncedQuery}"</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {data?.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
