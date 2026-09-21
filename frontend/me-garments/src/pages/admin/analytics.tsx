import { useUser } from "@clerk/react";
import {
  getGetAdminAnalyticsQueryKey,
  useGetAdminAnalytics,
} from "@workspace/api-client-react";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdminLayout, MetricCard } from "./layout";

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "PKR",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(0)}`;
  }
}

export default function AdminAnalyticsPage() {
  const { user } = useUser();
  const analytics = useGetAdminAnalytics({
    query: {
      queryKey: [...getGetAdminAnalyticsQueryKey(), user?.id ?? "signed-out"],
      enabled: Boolean(user?.id),
      staleTime: 30_000,
    },
  });

  const metrics = analytics.data?.storeMetrics;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Storefront activity and order metrics from your live catalog.
          </p>
        </div>

        {analytics.data && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard
                label="Recorded events"
                value={analytics.data.recordedEvents}
                detail={
                  analytics.data.lastRecordedAt
                    ? `Latest ${new Date(analytics.data.lastRecordedAt).toLocaleString()}`
                    : "No events have been recorded yet"
                }
              />
              <MetricCard
                label="Tracked event types"
                value={analytics.data.events.length}
                detail="Distinct storefront actions recorded"
              />
              <MetricCard
                label="Orders"
                value={metrics?.totalOrders ?? 0}
                detail={
                  metrics
                    ? `${metrics.paidOrders} paid · ${metrics.uniqueCustomers} customers`
                    : "From the orders table"
                }
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard
                label="Paid revenue"
                value={
                  metrics
                    ? formatMoney(metrics.paidRevenue, metrics.currency)
                    : "—"
                }
                detail="Sum of paid order totals"
              />
              <MetricCard
                label="Paid orders"
                value={metrics?.paidOrders ?? 0}
                detail="Orders marked as paid"
              />
              <MetricCard
                label="Customers"
                value={metrics?.uniqueCustomers ?? 0}
                detail="Unique shoppers with an order"
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recorded activity</CardTitle>
                <CardDescription>
                  Event counts from storefront actions (views, cart, favorites,
                  checkout).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {analytics.data.events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No recorded events yet. Browse the store, add favorites, or
                    start checkout to populate this list.
                  </p>
                ) : (
                  analytics.data.events.map((event) => (
                    <div
                      key={event.eventName}
                      className="flex justify-between border-b pb-3 last:border-0"
                    >
                      <span className="capitalize">
                        {event.eventName.replace(/_/g, " ")}
                      </span>
                      <strong>{event.count}</strong>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}
        {analytics.error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Analytics unavailable</AlertTitle>
            <AlertDescription>
              Analytics could not be loaded. Please refresh and try again.
            </AlertDescription>
          </Alert>
        )}
        {analytics.isPending && (
          <p className="text-sm text-muted-foreground">Loading analytics…</p>
        )}
      </div>
    </AdminLayout>
  );
}
