import { Link, useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { Search, ShoppingBag, User, Menu, ShieldCheck } from "lucide-react";
import {
  getGetAdminSessionQueryKey,
  useGetAdminSession,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { canRenderAdminWorkspace } from "@/lib/admin-access";

export function Navbar() {
  const [location] = useLocation();
  const { isSignedIn, user } = useUser();
  const adminSession = useGetAdminSession({
    query: {
      queryKey: [...getGetAdminSessionQueryKey(), user?.id ?? "signed-out"],
      enabled: Boolean(isSignedIn && user?.id),
      staleTime: 60_000,
      retry: false,
    },
  });
  const showAdmin = canRenderAdminWorkspace({
    isSignedIn: Boolean(isSignedIn),
    isSuccess: adminSession.isSuccess,
    isError: adminSession.isError,
    authorized: adminSession.data?.authorized,
  });

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">

        {/* Mobile Menu */}
        <div className="flex items-center md:hidden">
          <Button variant="ghost" size="icon" aria-label="Menu">
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Brand */}
        <div className="flex flex-1 justify-center md:justify-start">
          <Link href="/" className="flex items-center gap-2 transition-transform hover:scale-105">
            <span className="font-serif text-2xl font-bold tracking-tight text-primary">
              M&E
            </span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex flex-1 justify-center space-x-8">
          <NavLink href="/new-arrivals" current={location}>New</NavLink>
          <NavLink href="/best-sellers" current={location}>Best Sellers</NavLink>
          <NavLink href="/boys" current={location}>Boys</NavLink>
          <NavLink href="/girls" current={location}>Girls</NavLink>
          <NavLink href="/sale" current={location} className="text-primary font-medium">Sale</NavLink>
        </nav>

        {/* Actions */}
        <div className="flex items-center justify-end flex-1 space-x-2 md:space-x-4">
          {showAdmin && (
            <Link
              href="/admin"
              className="hidden sm:flex inline-flex items-center justify-center whitespace-nowrap text-sm h-9 px-3 text-foreground hover:text-primary hover:bg-accent rounded-full font-medium transition-colors"
            >
              <ShieldCheck className="h-4 w-4 mr-2" />
              Admin
            </Link>
          )}
          <Link href="/search" className="text-foreground hover:text-primary transition-colors p-2">
            <Search className="h-5 w-5" />
            <span className="sr-only">Search</span>
          </Link>
          <Link href="/account" className="hidden sm:block text-foreground hover:text-primary transition-colors p-2">
            <User className="h-5 w-5" />
            <span className="sr-only">Account</span>
          </Link>
          <Link href="/cart" className="text-foreground hover:text-primary transition-colors p-2 relative">
            <ShoppingBag className="h-5 w-5" />
            <span className="sr-only">Cart</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children, current, className }: { href: string, children: React.ReactNode, current: string, className?: string }) {
  const isActive = current === href || current.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={`text-sm font-medium transition-colors hover:text-primary ${isActive ? 'text-primary' : 'text-muted-foreground'} ${className || ''}`}
    >
      {children}
    </Link>
  );
}
