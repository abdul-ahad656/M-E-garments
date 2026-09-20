import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getAdminProduct,
  getListAdminProductsQueryKey,
  useDeleteAdminProduct,
  useListAdminProducts,
  useUpdateAdminProduct,
  type AdminProductSummary,
} from "@workspace/api-client-react";
import { AlertTriangle, Pencil, Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "./layout";

function hasTag(tags: string[], tag: string): boolean {
  return tags.some((value) => value.trim().toLowerCase() === tag);
}

function setMerchTag(tags: string[], tag: string, enabled: boolean): string[] {
  const next = tags.filter((value) => value.trim().toLowerCase() !== tag);
  if (enabled) next.push(tag);
  return next;
}

function parseMoney(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function formatMoney(value: number): string {
  return value.toFixed(2);
}

function originalPrice(price: string, compareAtPrice: string | null): number {
  const compare = compareAtPrice ? parseMoney(compareAtPrice) : 0;
  const current = parseMoney(price);
  if (compare > current && compare > 0) return compare;
  return current;
}

function apiErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const data = "data" in error ? (error as { data: unknown }).data : undefined;
    if (typeof data === "object" && data !== null && "error" in data) {
      return String((data as { error: unknown }).error);
    }
    if ("message" in error) {
      return String((error as { message: unknown }).message);
    }
  }
  return "Request rejected";
}

function productPathId(id: string): string {
  return encodeURIComponent(id);
}

type SaleDialogState = {
  productIds: string[];
  titles: string[];
};

export default function AdminProductsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [appliedQuery, setAppliedQuery] = useState<string | undefined>();
  const [cursor, setCursor] = useState<string | undefined>();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saleDialog, setSaleDialog] = useState<SaleDialogState | null>(null);
  const [salePercent, setSalePercent] = useState("20");
  const [saleApplying, setSaleApplying] = useState(false);

  const listParams = { query: appliedQuery, cursor };
  const products = useListAdminProducts(listParams, {
    query: {
      queryKey: [
        ...getListAdminProductsQueryKey(listParams),
        user?.id ?? "signed-out",
      ],
      enabled: Boolean(user?.id),
      staleTime: 15_000,
    },
  });
  const updateMutation = useUpdateAdminProduct();
  const deleteMutation = useDeleteAdminProduct();

  const catalog = products.data?.products ?? [];
  const allSelected =
    catalog.length > 0 && catalog.every((product) => selectedIds.has(product.id));
  const selectedProducts = useMemo(
    () => catalog.filter((product) => selectedIds.has(product.id)),
    [catalog, selectedIds],
  );

  const refreshList = async () => {
    await queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey() });
  };

  const toggleSelected = (productId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(productId);
      else next.delete(productId);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(catalog.map((product) => product.id)));
  };

  const applyBestSeller = async (targets: AdminProductSummary[], enabled: boolean) => {
    for (const product of targets) {
      await updateMutation.mutateAsync({
        id: productPathId(product.id),
        data: { tags: setMerchTag(product.tags, "best_seller", enabled) },
      });
    }
  };

  const applySaleToProducts = async (targets: AdminProductSummary[], percent: number) => {
    for (const product of targets) {
      const detail = await getAdminProduct(productPathId(product.id));
      const variants = detail.variants.map((variant) => {
        const original = originalPrice(variant.price, variant.compareAtPrice);
        return {
          id: variant.id,
          price: formatMoney(original * (1 - percent / 100)),
          compareAtPrice: formatMoney(original),
          sku: variant.sku,
          inventoryQuantity: variant.inventoryQuantity,
        };
      });
      await updateMutation.mutateAsync({
        id: productPathId(product.id),
        data: {
          tags: setMerchTag(detail.tags, "sale", true),
          variants,
        },
      });
    }
  };

  const clearSaleFromProducts = async (targets: AdminProductSummary[]) => {
    for (const product of targets) {
      const detail = await getAdminProduct(productPathId(product.id));
      const variants = detail.variants.map((variant) => {
        const original = originalPrice(variant.price, variant.compareAtPrice);
        return {
          id: variant.id,
          price: formatMoney(original),
          compareAtPrice: null,
          sku: variant.sku,
          inventoryQuantity: variant.inventoryQuantity,
        };
      });
      await updateMutation.mutateAsync({
        id: productPathId(product.id),
        data: {
          tags: setMerchTag(detail.tags, "sale", false),
          variants,
        },
      });
    }
  };

  const openSaleDialog = (targets: AdminProductSummary[]) => {
    if (!targets.length) return;
    setSalePercent("20");
    setSaleDialog({
      productIds: targets.map((product) => product.id),
      titles: targets.map((product) => product.title),
    });
  };

  const confirmSaleDialog = async () => {
    if (!saleDialog) return;
    const percent = Number.parseFloat(salePercent);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      toast({
        title: "Invalid percentage",
        description: "Enter a discount between 1 and 100.",
        variant: "destructive",
      });
      return;
    }

    const targets = catalog.filter((product) =>
      saleDialog.productIds.includes(product.id),
    );
    // Fall back for products not on the current page (shouldn't happen for row toggles)
    const byId = new Map(catalog.map((product) => [product.id, product]));
    const resolved = saleDialog.productIds
      .map((id) => byId.get(id))
      .filter((product): product is AdminProductSummary => Boolean(product));

    setSaleApplying(true);
    try {
      await applySaleToProducts(resolved.length ? resolved : targets, percent);
      await refreshList();
      setSelectedIds(new Set());
      setSaleDialog(null);
      toast({
        title: `Sale applied — ${percent}% off`,
        description:
          saleDialog.productIds.length === 1
            ? saleDialog.titles[0]
            : `${saleDialog.productIds.length} products updated`,
      });
    } catch (error) {
      toast({
        title: "Could not apply sale",
        description: apiErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaleApplying(false);
    }
  };

  const toggleBestSeller = (product: AdminProductSummary, enabled: boolean) => {
    setBusyId(product.id);
    void (async () => {
      try {
        await applyBestSeller([product], enabled);
        await refreshList();
        toast({
          title: enabled ? "Marked best seller" : "Removed best seller",
          description: product.title,
        });
      } catch (error) {
        toast({
          title: "Update failed",
          description: apiErrorMessage(error),
          variant: "destructive",
        });
      } finally {
        setBusyId(null);
      }
    })();
  };

  const toggleSale = (product: AdminProductSummary, enabled: boolean) => {
    if (enabled) {
      openSaleDialog([product]);
      return;
    }
    setBusyId(product.id);
    void (async () => {
      try {
        await clearSaleFromProducts([product]);
        await refreshList();
        toast({
          title: "Sale removed",
          description: "Original prices restored.",
        });
      } catch (error) {
        toast({
          title: "Update failed",
          description: apiErrorMessage(error),
          variant: "destructive",
        });
      } finally {
        setBusyId(null);
      }
    })();
  };

  const bulkMarkBestSeller = (enabled: boolean) => {
    if (!selectedProducts.length) return;
    setBulkBusy(true);
    void (async () => {
      try {
        await applyBestSeller(selectedProducts, enabled);
        await refreshList();
        setSelectedIds(new Set());
        toast({
          title: enabled ? "Marked as best sellers" : "Removed best seller",
          description: `${selectedProducts.length} products updated`,
        });
      } catch (error) {
        toast({
          title: "Bulk update failed",
          description: apiErrorMessage(error),
          variant: "destructive",
        });
      } finally {
        setBulkBusy(false);
      }
    })();
  };

  const bulkClearSale = () => {
    if (!selectedProducts.length) return;
    setBulkBusy(true);
    void (async () => {
      try {
        await clearSaleFromProducts(selectedProducts);
        await refreshList();
        setSelectedIds(new Set());
        toast({
          title: "Sale removed",
          description: `${selectedProducts.length} products updated`,
        });
      } catch (error) {
        toast({
          title: "Bulk update failed",
          description: apiErrorMessage(error),
          variant: "destructive",
        });
      } finally {
        setBulkBusy(false);
      }
    })();
  };

  const deleteProduct = (product: AdminProductSummary) => {
    if (
      !window.confirm(
        `Delete “${product.title}” permanently? Variants and images will be removed.`,
      )
    ) {
      return;
    }
    setBusyId(product.id);
    void (async () => {
      try {
        await deleteMutation.mutateAsync({ id: productPathId(product.id) });
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(product.id);
          return next;
        });
        await refreshList();
        toast({ title: "Product deleted", description: product.title });
      } catch (error) {
        toast({
          title: "Could not delete product",
          description: apiErrorMessage(error),
          variant: "destructive",
        });
      } finally {
        setBusyId(null);
      }
    })();
  };

  const anyBusy = bulkBusy || saleApplying || busyId != null;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-serif text-2xl font-semibold">Products</h2>
            <p className="text-sm text-muted-foreground">
              Select products for bulk Best Seller / Sale, or use the row toggles. Open Edit for
              full details.
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
              The product list could not be loaded.
            </AlertDescription>
          </Alert>
        )}

        {selectedIds.size > 0 && (
          <div className="flex flex-col gap-3 rounded-lg border bg-secondary/40 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="text-sm font-medium">
              {selectedIds.size} selected
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={anyBusy}
                onClick={() => bulkMarkBestSeller(true)}
              >
                Mark Best Seller
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={anyBusy}
                onClick={() => bulkMarkBestSeller(false)}
              >
                Remove Best Seller
              </Button>
              <Button
                size="sm"
                disabled={anyBusy}
                onClick={() => openSaleDialog(selectedProducts)}
              >
                Put on Sale
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={anyBusy}
                onClick={bulkClearSale}
              >
                Remove Sale
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={anyBusy}
                onClick={() => setSelectedIds(new Set())}
              >
                Clear selection
              </Button>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Catalog</CardTitle>
            <CardDescription>Supabase catalog products</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {products.isPending && (
              <p className="py-6 text-sm text-muted-foreground">Loading products…</p>
            )}
            {catalog.length === 0 && !products.isPending && (
              <p className="py-6 text-sm text-muted-foreground">No products matched.</p>
            )}
            {catalog.length > 0 && (
              <div className="flex items-center gap-3 py-3">
                <Checkbox
                  id="select-all-products"
                  checked={allSelected}
                  disabled={anyBusy}
                  onCheckedChange={(value) => toggleSelectAll(value === true)}
                />
                <Label htmlFor="select-all-products" className="text-sm font-medium">
                  Select all on this page
                </Label>
              </div>
            )}
            {catalog.map((product) => {
              const busy = busyId === product.id || bulkBusy || saleApplying;
              const bestSeller = hasTag(product.tags, "best_seller");
              const onSale = hasTag(product.tags, "sale");
              const selected = selectedIds.has(product.id);

              return (
                <div
                  key={product.id}
                  className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <Checkbox
                      checked={selected}
                      disabled={anyBusy}
                      onCheckedChange={(value) =>
                        toggleSelected(product.id, value === true)
                      }
                      aria-label={`Select ${product.title}`}
                      className="mt-1"
                    />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{product.title}</div>
                      <div className="truncate text-sm text-muted-foreground">
                        {product.handle} · {product.productType || "No type"}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{product.status}</Badge>
                        <span className="text-sm text-muted-foreground">
                          qty {product.totalInventory}
                        </span>
                        {busyId === product.id && <Spinner className="h-4 w-4" />}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:pl-7 lg:pl-0">
                    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 sm:justify-start">
                      <Label
                        htmlFor={`best-seller-${product.id}`}
                        className="text-sm font-medium"
                      >
                        Best Seller
                      </Label>
                      <Switch
                        id={`best-seller-${product.id}`}
                        checked={bestSeller}
                        disabled={busy}
                        onCheckedChange={(checked) => toggleBestSeller(product, checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 sm:justify-start">
                      <Label
                        htmlFor={`sale-${product.id}`}
                        className="text-sm font-medium"
                      >
                        Sale
                      </Label>
                      <Switch
                        id={`sale-${product.id}`}
                        checked={onSale}
                        disabled={busy}
                        onCheckedChange={(checked) => toggleSale(product, checked)}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" asChild disabled={busy}>
                        <Link href={`/admin/products/${productPathId(product.id)}`}>
                          <Pencil className="mr-1.5 h-3.5 w-3.5" />
                          Edit
                        </Link>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={busy}
                        onClick={() => deleteProduct(product)}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
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

      <Dialog
        open={Boolean(saleDialog)}
        onOpenChange={(open) => {
          if (!open && !saleApplying) setSaleDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set sale discount</DialogTitle>
            <DialogDescription>
              {saleDialog && saleDialog.productIds.length === 1
                ? `Apply a percentage off to “${saleDialog.titles[0]}”. Shoppers will see the original and sale prices.`
                : `Apply the same percentage off to ${saleDialog?.productIds.length ?? 0} selected products.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="bulk-sale-percent">Discount %</Label>
            <Input
              id="bulk-sale-percent"
              type="number"
              min={1}
              max={100}
              step={1}
              value={salePercent}
              onChange={(event) => setSalePercent(event.target.value)}
              disabled={saleApplying}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Example: 20 means 20% off. Original price is kept and shown crossed out.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saleApplying}
              onClick={() => setSaleDialog(null)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={saleApplying} onClick={() => void confirmSaleDialog()}>
              {saleApplying ? (
                <>
                  <Spinner className="mr-2" />
                  Applying…
                </>
              ) : (
                "Apply sale"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
