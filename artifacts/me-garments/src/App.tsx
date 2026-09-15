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
import Admin from '@/pages/admin';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

import { AuthProvider, SignInPage, SignUpPage } from '@/components/layout/auth-provider';

function Router() {
  return (
    <AppShell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Home} />

          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />

          <Route path="/boys">
            <Category category="boys" title="Boys Collection" />
          </Route>
          <Route path="/girls">
            <Category category="girls" title="Girls Collection" />
          </Route>
          <Route path="/new-arrivals">
            <Category category="new-arrivals" title="New Arrivals" />
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
          <Route path="/admin" component={Admin} />

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
