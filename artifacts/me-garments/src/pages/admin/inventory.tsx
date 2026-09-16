import { useState } from "react";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListAdminInventoryQueryKey,
  useAdjustAdminInventory,
  useListAdminInventory,
} from "@workspace/api-client-react";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "./layout";

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
  return "Shopify rejected the inventory adjustment";
}

export default function AdminInventoryPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [appliedQuery, setAppliedQuery] = useState<string | undefined>();
  const [cursor, setCursor] = useState<string | undefined>();
  const [deltas, setDeltas] = useState<Record<string, string>>({});
  const inventory = useListAdminInventory(
    { query: appliedQuery, cursor },
    {
      query: {
        queryKey: [
          ...getListAdminInventoryQueryKey({ query: appliedQuery, cursor }),
          user?.id ?? "signed-out",
        ],
        enabled: Boolean(user?.id),
        staleTime: 10_000,
      },
    },
  );
  const adjust = useAdjustAdminInventory();

  const applyDelta = (inventoryItemId: string) => {
    const delta = Number(deltas[inventoryItemId] ?? "0");
    if (!Number.isFinite(delta) || delta === 0) {
      toast({ title: "Enter a non-zero delta", variant: "destructive" });
      return;
    }
    adjust.mutate(
      { data: { inventoryItemId, delta } },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({
            queryKey: getListAdminInventoryQueryKey(),
          });
          setDeltas((current) => ({ ...current, [inventoryItemId]: "" }));
          toast({ title: "Inventory updated" });
        },
        onError: (error) => {
          toast({
            title: "Could not adjust inventory",
            description: apiErrorMessage(error),
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Inventory</h2>
          <p className="text-sm text-muted-foreground">
            Adjust available quantity at the primary Shopify location
            {inventory.data ? ` (${inventory.data.locationName})` : ""}.
          </p>
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
            placeholder="Search product or SKU"
          />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        {inventory.error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Inventory unavailable</AlertTitle>
            <AlertDescription>
              Shopify Admin could not return inventory levels.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Variants</CardTitle>
            <CardDescription>Available quantity and delta adjustments</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {inventory.isPending && (
              <p className="py-6 text-sm text-muted-foreground">Loading inventory…</p>
            )}
            {inventory.data?.items.length === 0 && (
              <p className="py-6 text-sm text-muted-foreground">No inventory rows matched.</p>
            )}
            {inventory.data?.items.map((item) => (
              <div
                key={item.inventoryItemId}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {item.productTitle} · {item.variantTitle}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {item.sku || "No SKU"} · available {item.available}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    className="w-28"
                    type="number"
                    placeholder="Delta"
                    value={deltas[item.inventoryItemId] ?? ""}
                    onChange={(event) =>
                      setDeltas((current) => ({
                        ...current,
                        [item.inventoryItemId]: event.target.value,
                      }))
                    }
                  />
                  <Button
                    size="sm"
                    disabled={adjust.isPending}
                    onClick={() => applyDelta(item.inventoryItemId)}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {inventory.data?.pageInfo.hasNextPage && (
          <Button
            variant="outline"
            onClick={() => setCursor(inventory.data?.pageInfo.endCursor ?? undefined)}
          >
            Load more
          </Button>
        )}
      </div>
    </AdminLayout>
  );
}
