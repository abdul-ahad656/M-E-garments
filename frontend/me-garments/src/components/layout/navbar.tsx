import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { Search, ShoppingBag, User, Menu, ShieldCheck } from "lucide-react";
import {
  getGetAdminSessionQueryKey,
  useGetAdminSession,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { canRenderAdminWorkspace } from "@/lib/admin-access";

const NAV_LINKS: { href: string; label: string; accent?: boolean }[] = [
  { href: "/new-arrivals", label: "New" },
  { href: "/best-sellers", label: "Best Sellers" },
  { href: "/boys", label: "Boys" },
  { href: "/girls", label: "Girls" },
  { href: "/sale", label: "Sale", accent: true },
];

export function Navbar() {
  const [location] = useLocation();
  const { isSignedIn, user } = useUser();
  const [open, setOpen] = useState(false);
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
    <header className="sticky top-0 z-50 w-full border-b border-black/5 bg-white">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex flex-1 items-center md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <SheetHeader>
                <SheetTitle className="font-serif text-primary">M&E</SheetTitle>
              </SheetHeader>
              <nav className="mt-8 flex flex-col gap-4">
                {NAV_LINKS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`text-base font-medium ${
                      item.accent ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
                {showAdmin && (
                  <Link href="/admin" onClick={() => setOpen(false)} className="text-base font-medium">
                    Admin
                  </Link>
                )}
                {isSignedIn ? (
                  <Link href="/account" onClick={() => setOpen(false)} className="text-base font-medium">
                    Account
                  </Link>
                ) : (
                  <>
                    <Link href="/sign-up" onClick={() => setOpen(false)} className="text-base font-medium">
                      Sign in
                    </Link>
                    <Link href="/login" onClick={() => setOpen(false)} className="text-base font-medium">
                      Login
                    </Link>
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>

        <div className="flex flex-1 justify-center md:justify-start">
          <Link href="/" className="flex items-center gap-2 transition-transform hover:scale-105">
            <span className="font-serif text-2xl font-bold tracking-tight text-primary">
              M&E
            </span>
          </Link>
        </div>

        <nav className="hidden flex-1 justify-center space-x-8 md:flex">
          {NAV_LINKS.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              current={location}
              className={item.accent ? "text-primary font-medium" : undefined}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex flex-1 items-center justify-end space-x-2 md:space-x-4">
          {showAdmin && (
            <Link
              href="/admin"
              className="hidden h-9 items-center justify-center whitespace-nowrap rounded-full px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-primary sm:inline-flex"
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Admin
            </Link>
          )}
          <Link href="/search" className="p-2 text-foreground transition-colors hover:text-primary">
            <Search className="h-5 w-5" />
            <span className="sr-only">Search</span>
          </Link>
          {isSignedIn ? (
            <Link
              href="/account"
              className="p-2 text-foreground transition-colors hover:text-primary"
            >
              <User className="h-5 w-5" />
              <span className="sr-only">Account</span>
            </Link>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/sign-up"
                className="inline-flex h-8 w-[5.5rem] items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:h-9 sm:w-[6.25rem] sm:text-sm"
              >
                Sign in
              </Link>
              <Link
                href="/login"
                className="inline-flex h-8 w-[5.5rem] items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:h-9 sm:w-[6.25rem] sm:text-sm"
              >
                Login
              </Link>
            </div>
          )}
          <Link href="/cart" className="relative p-2 text-foreground transition-colors hover:text-primary">
            <ShoppingBag className="h-5 w-5" />
            <span className="sr-only">Cart</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  children,
  current,
  className,
}: {
  href: string;
  children: React.ReactNode;
  current: string;
  className?: string;
}) {
  const isActive = current === href || current.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={`text-sm font-medium transition-colors hover:text-primary ${isActive ? "text-primary" : "text-muted-foreground"} ${className || ""}`}
    >
      {children}
    </Link>
  );
}
