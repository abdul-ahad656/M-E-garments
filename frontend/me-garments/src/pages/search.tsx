import { useState, useEffect } from "react";
import { useSearchProducts } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon } from "lucide-react";
import { ProductCard, ProductCardSkeleton } from "@/components/product-card";
import { useLocation } from "wouter";
import { hasSearchCriteria, parseSearchQuery } from "@/lib/search-query";

export default function Search() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      if (query) {
        setLocation(`/search?q=${encodeURIComponent(query)}`, { replace: true });
      } else {
        setLocation("/search", { replace: true });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [query, setLocation]);

  const params = parseSearchQuery(debouncedQuery, 24);
  const canSearch = hasSearchCriteria(params);

  const { data, isLoading, error } = useSearchProducts(
    {
      query: params.query,
      collection: params.collection,
      age: params.age,
      occasion: params.occasion,
      limit: params.limit,
    },
    {
      query: {
        enabled: canSearch,
        queryKey: [
          "searchProducts",
          params.query,
          params.collection,
          params.age,
          params.occasion,
        ],
      },
    },
  );

  return (
    <div className="container mx-auto min-h-[60vh] px-4 py-12 md:py-16">
      <div className="mx-auto mb-12 max-w-2xl">
        <h1 className="mb-6 text-center font-serif text-3xl font-bold">
          What are you looking for?
        </h1>
        <div className="relative flex items-center">
          <SearchIcon className="absolute left-4 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Try boys summer, toddler party, girls winter…"
            className="rounded-full border-card-border bg-card py-6 pl-12 text-lg shadow-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {!canSearch ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">
            Search by age, gender, or type — e.g. “boys toddler summer shirts”
          </p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="py-12 text-center text-destructive">
          Failed to load search results.
        </div>
      ) : data?.products.length === 0 ? (
        <div className="rounded-xl bg-secondary py-12 text-center">
          <h2 className="mb-2 text-xl font-bold">No results found</h2>
          <p className="text-muted-foreground">
            We couldn&apos;t find anything matching &quot;{debouncedQuery}&quot;.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-muted-foreground">
            Found {data?.total} results for &quot;{debouncedQuery}&quot;
          </p>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
            {data?.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
