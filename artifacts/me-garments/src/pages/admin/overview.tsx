import { useUser } from "@clerk/react";
import {
  getGetAdminAnalyticsQueryKey,
  getGetAdminCatalogHealthQueryKey,
  useGetAdminAnalytics,
  useGetAdminCatalogHealth,
} from "@workspace/api-client-react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdminLayout, MetricCard } from "./layout";

export default function AdminOverviewPage() {
  const { user } = useUser();
  const catalog = useGetAdminCatalogHealth({
    query: {
      queryKey: [...getGetAdminCatalogHealthQueryKey(), user?.id ?? "signed-out"],
      enabled: Boolean(user?.id),
      staleTime: 60_000,
    },
  });
  const analytics = useGetAdminAnalytics({
    query: {
      queryKey: [...getGetAdminAnalyticsQueryKey(), user?.id ?? "signed-out"],
      enabled: Boolean(user?.id),
      staleTime: 30_000,
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-8">
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-serif text-2xl font-semibold">Catalog health</h2>
              <p className="text-sm text-muted-foreground">
                Live pull from Shopify Storefront catalog.
              </p>
            </div>
            <Button variant="outline" onClick={() => catalog.refetch()} disabled={catalog.isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${catalog.isFetching ? "animate-spin" : ""}`} />
              Pull latest
            </Button>
          </div>
          {catalog.error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Catalog health unavailable</AlertTitle>
              <AlertDescription>
                The live Shopify catalog could not be checked. No cached result is being shown.
              </AlertDescription>
            </Alert>
          )}
          {catalog.data && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard
                  label="Products checked"
                  value={catalog.data.totalProducts}
                  detail={`Pulled ${new Date(catalog.data.checkedAt).toLocaleString()}`}
                />
                <MetricCard
                  label="Available for sale"
                  value={catalog.data.availableProducts}
                  detail="Based on current Shopify availability"
                />
                <MetricCard
                  label="Products needing attention"
                  value={catalog.data.issues.length}
                  detail="Verified catalog-quality checks"
                />
              </div>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle>Catalog checks</CardTitle>
                      <CardDescription>
                        Pull-based sync ·{" "}
                        {catalog.data.sync.lastSyncedAt
                          ? `last persisted ${new Date(catalog.data.sync.lastSyncedAt).toLocaleString()}`
                          : "sync state was not persisted"}
                      </CardDescription>
                    </div>
                    {catalog.data.issues.length === 0 && (
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {catalog.data.sync.persistenceStatus === "unavailable" && (
                    <Alert className="mb-4">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Sync-state storage unavailable</AlertTitle>
                      <AlertDescription>
                        The live Shopify pull completed, but Supabase could not record its sync state.
                      </AlertDescription>
                    </Alert>
                  )}
                  {catalog.data.issues.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No issues were found in the products included in this pull.
                    </p>
                  ) : (
                    <div className="divide-y">
                      {catalog.data.issues.map((issue) => (
                        <div key={issue.productId} className="py-4 first:pt-0 last:pb-0">
                          <div className="font-medium">{issue.title || issue.handle}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {issue.problems.map((problem) => (
                              <Badge key={problem} variant="secondary">
                                {problem}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="font-serif text-2xl font-semibold">Analytics snapshot</h2>
            <p className="text-sm text-muted-foreground">
              Counts from recorded analytics_events only.
            </p>
          </div>
          {analytics.data && (
            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard
                label="Recorded events"
                value={analytics.data.recordedEvents}
                detail={
                  analytics.data.lastRecordedAt
                    ? `Latest ${new Date(analytics.data.lastRecordedAt).toLocaleString()}`
                    : "No events have been recorded"
                }
              />
              <MetricCard
                label="Tracked event types"
                value={analytics.data.events.length}
                detail="Counts reflect stored event rows only"
              />
              <MetricCard
                label="Data source"
                value="Supabase"
                detail="No modeled or estimated values"
              />
            </div>
          )}
          {analytics.error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Analytics unavailable</AlertTitle>
              <AlertDescription>
                No analytics values are being inferred or substituted.
              </AlertDescription>
            </Alert>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
