import { useState } from "react";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import {
  getListAdminOrdersQueryKey,
  useListAdminOrders,
  type ListAdminOrdersFinancialStatus,
  type ListAdminOrdersFulfillmentStatus,
} from "@workspace/api-client-react";
import { AlertTriangle } from "lucide-react";
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

export default function AdminOrdersPage() {
  const { user } = useUser();
  const [search, setSearch] = useState("");
  const [financialStatus, setFinancialStatus] =
    useState<ListAdminOrdersFinancialStatus>("any");
  const [fulfillmentStatus, setFulfillmentStatus] =
    useState<ListAdminOrdersFulfillmentStatus>("any");
  const [applied, setApplied] = useState({
    query: undefined as string | undefined,
    financialStatus: "any" as ListAdminOrdersFinancialStatus,
    fulfillmentStatus: "any" as ListAdminOrdersFulfillmentStatus,
  });
  const [cursor, setCursor] = useState<string | undefined>();
  const params = {
    query: applied.query,
    cursor,
    financialStatus: applied.financialStatus,
    fulfillmentStatus: applied.fulfillmentStatus,
  };
  const orders = useListAdminOrders(params, {
    query: {
      queryKey: [...getListAdminOrdersQueryKey(params), user?.id ?? "signed-out"],
      enabled: Boolean(user?.id),
      staleTime: 10_000,
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Orders</h2>
          <p className="text-sm text-muted-foreground">
            Staff order list from Shopify Admin. Fulfill, refund, or cancel from the detail page.
          </p>
        </div>

        <form
          className="grid gap-3 md:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            setCursor(undefined);
            setApplied({
              query: search.trim() || undefined,
              financialStatus,
              fulfillmentStatus,
            });
          }}
        >
          <Input
            className="md:col-span-2"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or email"
          />
          <select
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={financialStatus}
            onChange={(event) =>
              setFinancialStatus(event.target.value as ListAdminOrdersFinancialStatus)
            }
          >
            <option value="any">Any payment</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="refunded">Refunded</option>
            <option value="partially_refunded">Partially refunded</option>
            <option value="authorized">Authorized</option>
            <option value="voided">Voided</option>
          </select>
          <select
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={fulfillmentStatus}
            onChange={(event) =>
              setFulfillmentStatus(event.target.value as ListAdminOrdersFulfillmentStatus)
            }
          >
            <option value="any">Any fulfillment</option>
            <option value="unfulfilled">Unfulfilled</option>
            <option value="partial">Partial</option>
            <option value="shipped">Shipped</option>
            <option value="unshipped">Unshipped</option>
          </select>
          <Button type="submit" variant="secondary" className="md:col-span-4 sm:w-fit">
            Apply filters
          </Button>
        </form>

        {orders.error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Orders unavailable</AlertTitle>
            <AlertDescription>Shopify Admin could not return orders.</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Recent orders</CardTitle>
            <CardDescription>Live Shopify Admin data</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {orders.isPending && (
              <p className="py-6 text-sm text-muted-foreground">Loading orders…</p>
            )}
            {orders.data?.orders.length === 0 && (
              <p className="py-6 text-sm text-muted-foreground">No orders matched.</p>
            )}
            {orders.data?.orders.map((order) => (
              <Link
                key={order.id}
                href={`/admin/orders/${encodeURIComponent(order.id)}`}
                className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 hover:bg-accent/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="font-medium">{order.name}</div>
                  <div className="truncate text-sm text-muted-foreground">
                    {order.customerName || order.customerEmail || "Guest"} ·{" "}
                    {new Date(order.processedAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{order.displayFinancialStatus ?? "unknown"}</Badge>
                  <Badge variant="secondary">
                    {order.displayFulfillmentStatus ?? "unfulfilled"}
                  </Badge>
                  <span className="text-sm font-medium">
                    {order.totalPrice.amount} {order.totalPrice.currencyCode}
                  </span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {orders.data?.pageInfo.hasNextPage && (
          <Button
            variant="outline"
            onClick={() => setCursor(orders.data?.pageInfo.endCursor ?? undefined)}
          >
            Load more
          </Button>
        )}
      </div>
    </AdminLayout>
  );
}
