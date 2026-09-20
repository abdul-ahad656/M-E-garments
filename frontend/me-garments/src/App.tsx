import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

import { AppShell } from '@/components/layout/app-shell';
import Home from '@/pages/home';
import { Category, AgeCategory, OccasionCategory } from '@/pages/category';
import Search from '@/pages/search';
import Assistant from '@/pages/assistant';
import Product from '@/pages/product';
import Cart from '@/pages/cart';
import Account from '@/pages/account';
import AdminOverviewPage from '@/pages/admin/overview';
import AdminProductsPage from '@/pages/admin/products';
import AdminProductEditorPage from '@/pages/admin/product-editor';
import AdminInventoryPage from '@/pages/admin/inventory';
import AdminOrdersPage from '@/pages/admin/orders';
import AdminOrderDetailPage from '@/pages/admin/order-detail';
import AdminContentPage from '@/pages/admin/content';
import AdminAnalyticsPage from '@/pages/admin/analytics';
import AdminStaffPage from '@/pages/admin/staff';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

import { AuthProvider, LoginPage, SignInPage, SignUpPage } from '@/components/layout/auth-provider';

function Router() {
  return (
    <AppShell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Home} />

          <Route path="/login/*?" component={LoginPage} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />

          <Route path="/boys">
            <Category category="boys" title="Boys Collection" />
          </Route>
          <Route path="/girls">
            <Category category="girls" title="Girls Collection" />
          </Route>
          <Route path="/new-arrivals">
            <Category category="new" title="New Arrivals" />
          </Route>
          <Route path="/best-sellers">
            <Category category="best_seller" title="Best Sellers" />
          </Route>
          <Route path="/sale">
            <Category category="sale" title="Sale" />
          </Route>

          <Route path="/age/:range" component={AgeCategory} />
          <Route path="/occasion/:occasion" component={OccasionCategory} />

          <Route path="/search" component={Search} />
          <Route path="/assistant" component={Assistant} />
          <Route path="/product/:handle" component={Product} />

          <Route path="/cart" component={Cart} />
          <Route path="/account" component={Account} />

          <Route path="/admin/products/new" component={AdminProductEditorPage} />
          <Route path="/admin/products/:id" component={AdminProductEditorPage} />
          <Route path="/admin/products" component={AdminProductsPage} />
          <Route path="/admin/inventory" component={AdminInventoryPage} />
          <Route path="/admin/orders/:id" component={AdminOrderDetailPage} />
          <Route path="/admin/orders" component={AdminOrdersPage} />
          <Route path="/admin/content" component={AdminContentPage} />
          <Route path="/admin/analytics" component={AdminAnalyticsPage} />
          <Route path="/admin/staff" component={AdminStaffPage} />
          <Route path="/admin" component={AdminOverviewPage} />

          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </AppShell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
