import { useState } from "react";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import {
  getListAdminProductsQueryKey,
  useListAdminProducts,
} from "@workspace/api-client-react";
import { AlertTriangle, Plus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdminLayout } from "./layout";

export default function AdminProductsPage() {
  const { user } = useUser();
  const [search, setSearch] = useState("");
  const [appliedQuery, setAppliedQuery] = useState<string | undefined>();
  const [cursor, setCursor] = useState<string | undefined>();
  const products = useListAdminProducts(
    { query: appliedQuery, cursor },
    {
      query: {
        queryKey: [
          ...getListAdminProductsQueryKey({ query: appliedQuery, cursor }),
          user?.id ?? "signed-out",
        ],
        enabled: Boolean(user?.id),
        staleTime: 15_000,
      },
    },
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-serif text-2xl font-semibold">Products</h2>
            <p className="text-sm text-muted-foreground">
              Create and edit Shopify products. Shopify remains the source of truth.
            </p>
          </div>
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus className="mr-2 h-4 w-4" />
              New product
            </Link>
          </Button>
        </div>

        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            setCursor(undefined);
            setAppliedQuery(search.trim() || undefined);
          }}
        >
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title or handle"
          />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        {products.error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Products unavailable</AlertTitle>
            <AlertDescription>
              Shopify Admin could not return the product list.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Catalog</CardTitle>
            <CardDescription>Live Shopify Admin product list</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {products.isPending && (
              <p className="py-6 text-sm text-muted-foreground">Loading products…</p>
            )}
            {products.data?.products.length === 0 && (
              <p className="py-6 text-sm text-muted-foreground">No products matched.</p>
            )}
            {products.data?.products.map((product) => (
              <Link
                key={product.id}
                href={`/admin/products/${encodeURIComponent(product.id)}`}
                className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0 hover:bg-accent/40"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{product.title}</div>
                  <div className="truncate text-sm text-muted-foreground">
                    {product.handle} · {product.productType || "No type"}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline">{product.status}</Badge>
                  <span className="text-sm text-muted-foreground">
                    qty {product.totalInventory}
                  </span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {products.data?.pageInfo.hasNextPage && (
          <Button
            variant="outline"
            onClick={() => setCursor(products.data?.pageInfo.endCursor ?? undefined)}
          >
            Load more
          </Button>
        )}
      </div>
    </AdminLayout>
  );
}
