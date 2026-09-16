import { useUser } from "@clerk/react";
import {
  getGetAdminAnalyticsQueryKey,
  useGetAdminAnalytics,
} from "@workspace/api-client-react";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdminLayout, MetricCard } from "./layout";

export default function AdminAnalyticsPage() {
  const { user } = useUser();
  const analytics = useGetAdminAnalytics({
    query: {
      queryKey: [...getGetAdminAnalyticsQueryKey(), user?.id ?? "signed-out"],
      enabled: Boolean(user?.id),
      staleTime: 30_000,
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        {analytics.data && (
          <>
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
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Recorded activity</CardTitle>
                  <CardDescription>Counts from analytics_events.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analytics.data.events.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No recorded events yet.</p>
                  ) : (
                    analytics.data.events.map((event) => (
                      <div
                        key={event.eventName}
                        className="flex justify-between border-b pb-3 last:border-0"
                      >
                        <span>{event.eventName}</span>
                        <strong>{event.count}</strong>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Unavailable metrics</CardTitle>
                  <CardDescription>
                    These are not reported because no verified source is connected.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analytics.data.unavailableMetrics.map((metric) => (
                    <div
                      key={metric}
                      className="flex items-center justify-between border-b pb-3 last:border-0"
                    >
                      <span>{metric}</span>
                      <Badge variant="outline">Unavailable</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </>
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
      </div>
    </AdminLayout>
  );
}
