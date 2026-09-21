import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "wouter";
import { Search, X, Loader2 } from "lucide-react";
import { useSearchProducts } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hasSearchCriteria, parseSearchQuery } from "@/lib/search-query";

export function NavSearch() {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const queryRef = useRef(query);
  queryRef.current = query;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const params = parseSearchQuery(debounced, 8);
  const canSearch = hasSearchCriteria(params);

  const { data, isFetching, isError } = useSearchProducts(
    {
      query: params.query,
      collection: params.collection,
      age: params.age,
      occasion: params.occasion,
      limit: params.limit,
    },
    {
      query: {
        enabled: expanded && canSearch,
        queryKey: [
          "navSearchProducts",
          params.query,
          params.collection,
          params.age,
          params.occasion,
        ],
      },
    },
  );

  const close = useCallback(() => {
    setExpanded(false);
    setQuery("");
    setDebounced("");
  }, []);

  useEffect(() => {
    if (!expanded) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        if (!queryRef.current.trim()) close();
        else setExpanded(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded, close]);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  const products = data?.products ?? [];
  const showPanel = expanded && query.trim().length > 0;

  return (
    <div ref={rootRef} className="relative flex items-center">
      <div
        className={cn(
          "flex items-center overflow-hidden transition-[width,opacity] duration-300 ease-out",
          expanded
            ? "w-[min(70vw,16rem)] opacity-100 sm:w-56 md:w-64"
            : "w-0 opacity-0",
        )}
      >
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Age, gender, summer…"
            aria-label="Search products"
            aria-controls={listId}
            aria-expanded={showPanel}
            className="h-9 rounded-full border-black/10 bg-secondary/60 pl-8 pr-8 text-sm"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setQuery("");
                setDebounced("");
                inputRef.current?.focus();
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={expanded ? "Close search" : "Open search"}
        aria-expanded={expanded}
        className="shrink-0"
        onClick={() => {
          if (expanded && !query.trim()) close();
          else setExpanded((v) => !v);
        }}
      >
        {expanded ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
      </Button>

      {showPanel ? (
        <div
          id={listId}
          role="listbox"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-[60] w-[min(92vw,22rem)] overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg"
        >
          {!canSearch ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              Try “boys summer”, “toddler party”, or “girls winter”.
            </p>
          ) : isFetching && products.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </div>
          ) : isError ? (
            <p className="px-4 py-3 text-sm text-destructive">
              Search failed. Please try again.
            </p>
          ) : products.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              No matches for “{params.raw}”.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {products.map((product) => (
                <li key={product.id} role="option">
                  <Link
                    href={`/product/${product.handle}`}
                    onClick={close}
                    className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-secondary"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-secondary">
                      {product.image?.url ? (
                        <img
                          src={product.image.url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {product.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {product.price.currencyCode} {product.price.amount}
                        {product.badges?.length
                          ? ` · ${product.badges.slice(0, 2).join(", ")}`
                          : ""}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
