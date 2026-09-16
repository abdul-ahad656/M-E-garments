import { type ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAdminAnalyticsQueryKey,
  getGetAdminCatalogHealthQueryKey,
  getGetAdminSessionQueryKey,
  getListAdminStaffQueryKey,
  getListAdminPoliciesQueryKey,
  useGetAdminSession,
} from "@workspace/api-client-react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  FileText,
  Package,
  ShieldCheck,
  ShoppingBag,
  Users,
  Warehouse,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canRenderAdminWorkspace } from "@/lib/admin-access";
import { cn } from "@/lib/utils";

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

const navItems: Array<{
  href: string;
  label: string;
  icon: typeof Activity;
  exact?: boolean;
}> = [
  { href: "/admin", label: "Overview", icon: Activity, exact: true },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/inventory", label: "Inventory", icon: Warehouse },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/content", label: "Content", icon: FileText },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
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
  const forbidden = errorStatus(adminSession.error) === 403;
  const canManageStaff = adminSession.data?.canManageStaff === true;

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setLocation(`/sign-in?redirect_url=${encodeURIComponent(location)}`);
    }
  }, [isLoaded, isSignedIn, location, setLocation]);

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
      <div className="mb-8">
        <Badge variant="outline" className="mb-3 gap-1">
          <ShieldCheck className="h-3.5 w-3.5" /> Staff workspace
        </Badge>
        <h1 className="font-serif text-4xl font-bold tracking-tight md:text-5xl">
          Store operations
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Manage Shopify catalog, inventory, and orders alongside governed store content.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {navItems.map((item) => {
            const active = item.exact
              ? location === item.href
              : location === item.href || location.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          {canManageStaff && (
            <Link
              href="/admin/staff"
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                location === "/admin/staff"
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Users className="h-4 w-4" />
              Staff
            </Link>
          )}
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </main>
  );
}

export function MetricCard({
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
      <div className="px-6 pb-6 text-sm text-muted-foreground">{detail}</div>
    </Card>
  );
}
