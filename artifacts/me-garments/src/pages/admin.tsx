import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  getListAdminPoliciesQueryKey,
  getGetAdminAnalyticsQueryKey,
  getGetAdminCatalogHealthQueryKey,
  getGetAdminSessionQueryKey,
  getListAdminStaffQueryKey,
  useGetAdminAnalytics,
  useGetAdminCatalogHealth,
  useGetAdminSession,
  useListAdminStaff,
  useListAdminPolicies,
  useSaveAdminPolicy,
  useUpdateAdminStaffAccess,
  type AdminStaffMember,
  type PolicyDocument,
  type PolicyDocumentInputStatus,
} from "@workspace/api-client-react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  FileText,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { canRenderAdminWorkspace } from "@/lib/admin-access";

const newDocuments = [
  { slug: "shipping-returns", title: "Shipping & Returns" },
  { slug: "privacy-policy", title: "Privacy Policy" },
  { slug: "size-guide", title: "Size Guide" },
];

function errorStatus(error: unknown): number | undefined {
  return typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status: unknown }).status)
    : undefined;
}

function AccessDenied() {
  return (
    <main className="container mx-auto flex min-h-[55vh] items-center justify-center px-4 py-12">
      <Card className="max-w-lg">
        <CardHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <ShieldCheck className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Staff access only</CardTitle>
          <CardDescription>
            Your account is signed in, but it does not have a staff or admin role.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-serif text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{detail}</CardContent>
    </Card>
  );
}

function PolicyEditor({ policies }: { policies: PolicyDocument[] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const options = useMemo(() => {
    const existing = new Set(policies.map((policy) => policy.slug));
    return [
      ...policies.map((policy) => ({ slug: policy.slug, title: policy.title })),
      ...newDocuments.filter((document) => !existing.has(document.slug)),
    ];
  }, [policies]);
  const [slug, setSlug] = useState(options[0]?.slug ?? "shipping-returns");
  const selected = policies.find((policy) => policy.slug === slug);
  const defaultTitle = options.find((document) => document.slug === slug)?.title ?? "";
  const [title, setTitle] = useState(selected?.title ?? defaultTitle);
  const [contentMarkdown, setContentMarkdown] = useState(selected?.contentMarkdown ?? "");
  const [status, setStatus] = useState<PolicyDocumentInputStatus>(selected?.status ?? "draft");
  const mutation = useSaveAdminPolicy();

  useEffect(() => {
    setTitle(selected?.title ?? defaultTitle);
    setContentMarkdown(selected?.contentMarkdown ?? "");
    setStatus(selected?.status ?? "draft");
  }, [defaultTitle, selected]);

  const save = () => {
    mutation.mutate(
      { slug, data: { title, contentMarkdown, status } },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: getListAdminPoliciesQueryKey() });
          toast({ title: status === "published" ? "Content published" : "Content saved" });
        },
        onError: () => {
          toast({ title: "Could not save content", variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-lg">Documents</CardTitle>
          <CardDescription>Policies and sizing guidance stored in Supabase.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {options.map((document) => (
            <Button
              key={document.slug}
              variant={slug === document.slug ? "secondary" : "ghost"}
              className="h-auto w-full justify-between py-3 text-left"
              onClick={() => setSlug(document.slug)}
            >
              <span className="truncate">{document.title}</span>
              {policies.find((policy) => policy.slug === document.slug) && (
                <span className="ml-2 text-[10px] uppercase text-muted-foreground">
                  {policies.find((policy) => policy.slug === document.slug)?.status}
                </span>
              )}
            </Button>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Content editor</CardTitle>
          <CardDescription>
            Draft changes, move them to review, then publish verified content.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="policy-title">Title</Label>
            <Input id="policy-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="policy-content">Markdown content</Label>
            <Textarea
              id="policy-content"
              className="min-h-72 font-mono"
              value={contentMarkdown}
              onChange={(event) => setContentMarkdown(event.target.value)}
              placeholder="Write verified policy or sizing content here."
            />
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <Label htmlFor="policy-status">Workflow status</Label>
              <select
                id="policy-status"
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={status}
                onChange={(event) => setStatus(event.target.value as PolicyDocumentInputStatus)}
              >
                <option value="draft">Draft</option>
                <option value="review">Ready for review</option>
                <option value="published">Published</option>
              </select>
            </div>
            <Button
              onClick={save}
              disabled={mutation.isPending || !title.trim()}
              className="sm:min-w-36"
            >
              {mutation.isPending ? "Saving…" : "Save document"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StaffAccessManager({
  members,
  currentUserId,
}: {
  members: AdminStaffMember[];
  currentUserId: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const mutation = useUpdateAdminStaffAccess();

  const changeRole = (member: AdminStaffMember, role: "admin" | "staff" | null) => {
    mutation.mutate(
      { userId: member.userId, data: { role } },
      {
        onSuccess: async () => {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: getListAdminStaffQueryKey() }),
            queryClient.invalidateQueries({ queryKey: getGetAdminSessionQueryKey() }),
          ]);
          toast({
            title: role ? "Staff access updated" : "Staff access revoked",
            description: `${member.email} will use the new access on their next dashboard check.`,
          });
        },
        onError: () => {
          toast({
            title: "Could not update staff access",
            description: "No access change was saved. Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff access</CardTitle>
        <CardDescription>
          Grant only the access a team member needs. Every successful change is recorded.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {members.map((member) => {
          const isProtected = member.userId === currentUserId || member.role === "owner";
          const isUpdating = mutation.isPending && mutation.variables?.userId === member.userId;
          return (
            <div
              key={member.userId}
              className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{member.displayName || member.email}</div>
                <div className="truncate text-sm text-muted-foreground">{member.email}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={member.role ? "secondary" : "outline"}>
                  {member.role ?? "Customer"}
                </Badge>
                {!isProtected && (
                  <select
                    aria-label={`Access for ${member.email}`}
                    className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={member.role ?? "customer"}
                    disabled={mutation.isPending}
                    onChange={(event) => {
                      const role = event.target.value;
                      changeRole(
                        member,
                        role === "admin" || role === "staff" ? role : null,
                      );
                    }}
                  >
                    <option value="customer">No dashboard access</option>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                )}
                {isUpdating && <span className="text-xs text-muted-foreground">Saving…</span>}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function Admin() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("catalog");
  const adminSession = useGetAdminSession({
    query: {
      queryKey: [...getGetAdminSessionQueryKey(), user?.id ?? "signed-out"],
      enabled: Boolean(isSignedIn && user?.id),
      staleTime: 0,
      retry: false,
      refetchInterval: 60_000,
    },
  });
  const authorized = canRenderAdminWorkspace({
    isSignedIn: Boolean(isSignedIn),
    isSuccess: adminSession.isSuccess,
    isError: adminSession.isError,
    authorized: adminSession.data?.authorized,
  });
  const catalog = useGetAdminCatalogHealth({
    query: {
      queryKey: [...getGetAdminCatalogHealthQueryKey(), user?.id ?? "signed-out"],
      enabled: authorized,
      staleTime: 60_000,
    },
  });
  const policies = useListAdminPolicies({
    query: {
      queryKey: [...getListAdminPoliciesQueryKey(), user?.id ?? "signed-out"],
      enabled: authorized,
      staleTime: 30_000,
    },
  });
  const analytics = useGetAdminAnalytics({
    query: {
      queryKey: [...getGetAdminAnalyticsQueryKey(), user?.id ?? "signed-out"],
      enabled: authorized,
      staleTime: 30_000,
    },
  });
  const staff = useListAdminStaff({
    query: {
      queryKey: [...getListAdminStaffQueryKey(), user?.id ?? "signed-out"],
      enabled: authorized && adminSession.data?.canManageStaff === true,
      staleTime: 0,
    },
  });
  const forbidden = errorStatus(adminSession.error) === 403;

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setLocation("/sign-in?redirect_url=/admin");
    }
  }, [isLoaded, isSignedIn, setLocation]);

  useEffect(() => {
    if (!adminSession.isError || !user?.id) return;
    queryClient.removeQueries({ queryKey: getGetAdminCatalogHealthQueryKey() });
    queryClient.removeQueries({ queryKey: getListAdminPoliciesQueryKey() });
    queryClient.removeQueries({ queryKey: getGetAdminAnalyticsQueryKey() });
    queryClient.removeQueries({ queryKey: getListAdminStaffQueryKey() });
  }, [adminSession.isError, queryClient, user?.id]);

  if (!isLoaded || !isSignedIn || adminSession.isPending) {
    return (
      <main className="container mx-auto px-4 py-16 text-center text-muted-foreground">
        Checking staff access…
      </main>
    );
  }
  if (forbidden) return <AccessDenied />;
  if (!authorized) {
    return (
      <main className="container mx-auto px-4 py-16">
        <Alert variant="destructive" className="mx-auto max-w-xl">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unable to verify staff access</AlertTitle>
          <AlertDescription>Please refresh and try again.</AlertDescription>
        </Alert>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-10 md:py-14">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge variant="outline" className="mb-3 gap-1">
            <ShieldCheck className="h-3.5 w-3.5" /> Staff workspace
          </Badge>
          <h1 className="font-serif text-4xl font-bold tracking-tight md:text-5xl">
            Store operations
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Live Shopify catalog checks, governed content, and event-backed insights.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 h-auto w-full justify-start overflow-x-auto p-1 sm:w-auto">
          <TabsTrigger value="catalog" className="gap-2">
            <Activity className="h-4 w-4" /> Catalog
          </TabsTrigger>
          <TabsTrigger value="content" className="gap-2">
            <FileText className="h-4 w-4" /> Content
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="h-4 w-4" /> Analytics
          </TabsTrigger>
          {adminSession.data?.canManageStaff && (
            <TabsTrigger value="staff" className="gap-2">
              <Users className="h-4 w-4" /> Staff
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="catalog" className="space-y-6">
          <div className="flex justify-end">
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
                              <Badge key={problem} variant="secondary">{problem}</Badge>
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
        </TabsContent>

        <TabsContent value="content">
          {policies.data && <PolicyEditor policies={policies.data} />}
          {policies.error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Content unavailable</AlertTitle>
              <AlertDescription>Supabase policy documents could not be loaded.</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
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
                    ) : analytics.data.events.map((event) => (
                      <div key={event.eventName} className="flex justify-between border-b pb-3 last:border-0">
                        <span>{event.eventName}</span>
                        <strong>{event.count}</strong>
                      </div>
                    ))}
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
                      <div key={metric} className="flex items-center justify-between border-b pb-3 last:border-0">
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
              <AlertDescription>No analytics values are being inferred or substituted.</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {adminSession.data?.canManageStaff && (
          <TabsContent value="staff">
            {staff.data && user?.id && (
              <StaffAccessManager members={staff.data} currentUserId={user.id} />
            )}
            {staff.error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Staff access unavailable</AlertTitle>
                <AlertDescription>
                  User access could not be loaded. No changes can be made right now.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
        )}
      </Tabs>
    </main>
  );
}