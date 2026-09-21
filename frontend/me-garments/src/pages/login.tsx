import { useEffect, useRef, type ReactNode } from "react";
import { SignIn, SignUp, useSignUp } from "@clerk/react";
import { Link, useSearch } from "wouter";
import { Search, ShoppingBag } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const NAV_LINKS: { href: string; label: string; accent?: boolean }[] = [
  { href: "/new-arrivals", label: "New" },
  { href: "/best-sellers", label: "Best Sellers" },
  { href: "/boys", label: "Boys" },
  { href: "/girls", label: "Girls" },
  { href: "/sale", label: "Sale", accent: true },
];

function sanitizeRedirectUrl(url: string | null): string {
  if (!url) return `${basePath}/account`;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  return `${basePath}/account`;
}

function AuthHeader() {
  return (
    <header className="w-full border-b border-black/5 bg-white">
      <div className="flex items-center justify-between px-6 py-4 lg:px-16">
        <Link href="/" className="flex shrink-0 items-center">
          <img
            src={`${basePath}/logo.svg`}
            alt="M&E"
            className="h-8 w-auto object-contain"
          />
        </Link>

        <nav className="hidden flex-1 items-center justify-center space-x-8 md:flex">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm font-medium transition-colors hover:text-primary ${
                item.accent ? "text-primary" : "text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <Link
            href="/search"
            className="p-2 text-foreground transition-colors hover:text-primary"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </Link>
          <Link
            href="/cart"
            className="p-2 text-foreground transition-colors hover:text-primary"
            aria-label="Cart"
          >
            <ShoppingBag className="h-5 w-5" />
          </Link>
          <Link
            href="/login"
            className="hidden rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:inline-flex"
          >
            Login
          </Link>
          <Link
            href="/sign-up"
            className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Sign up
          </Link>
        </div>
      </div>
    </header>
  );
}

function MascotPanel({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative hidden min-h-[calc(100dvh-4.5rem)] items-center justify-center overflow-hidden bg-white lg:flex">
      <img
        src={src}
        alt={alt}
        className="max-h-[62%] max-w-[48%] object-contain object-center"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-8 -translate-x-1/2 font-serif text-3xl font-bold tracking-tight text-primary/40"
      >
        M&E
      </span>
    </div>
  );
}

function FormPanel({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100dvh-4.5rem)] items-center justify-center bg-white px-6 py-10 sm:px-10 lg:px-16">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

function AuthSplitShell({
  children,
  mascotSrc,
  mascotAlt,
  mascotSide = "left",
}: {
  children: ReactNode;
  mascotSrc: string;
  mascotAlt: string;
  mascotSide?: "left" | "right";
}) {
  const mascot = <MascotPanel src={mascotSrc} alt={mascotAlt} />;
  const form = <FormPanel>{children}</FormPanel>;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white">
      <AuthHeader />
      <div className="grid flex-1 lg:grid-cols-2">
        {mascotSide === "left" ? (
          <>
            {mascot}
            {form}
          </>
        ) : (
          <>
            {form}
            {mascot}
          </>
        )}
      </div>
    </div>
  );
}

export function LoginPage() {
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const redirectUrl = sanitizeRedirectUrl(searchParams.get("redirect_url"));

  return (
    <AuthSplitShell
      mascotSrc={`${basePath}/avatars/boy-mascot.png`}
      mascotAlt="M&E boy mascot"
      mascotSide="left"
    >
      <SignIn
        routing="path"
        path={`${basePath}/login`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={redirectUrl}
      />
    </AuthSplitShell>
  );
}

export function SignInPage() {
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const redirectUrl = sanitizeRedirectUrl(searchParams.get("redirect_url"));

  return (
    <AuthSplitShell
      mascotSrc={`${basePath}/avatars/boy-mascot.png`}
      mascotAlt="M&E boy mascot"
      mascotSide="left"
    >
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={redirectUrl}
      />
    </AuthSplitShell>
  );
}

export function SignUpPage() {
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const redirectUrl = sanitizeRedirectUrl(searchParams.get("redirect_url"));

  return (
    <AuthSplitShell
      mascotSrc={`${basePath}/avatars/girl-mascot.png`}
      mascotAlt="M&E girl mascot"
      mascotSide="right"
    >
      <SignUpSuccessTracker />
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/login`}
        fallbackRedirectUrl={redirectUrl}
      />
    </AuthSplitShell>
  );
}

function SignUpSuccessTracker() {
  const { signUp } = useSignUp();
  const trackedRef = useRef(false);

  useEffect(() => {
    if (signUp?.status === "complete" && !trackedRef.current) {
      trackedRef.current = true;
      trackEvent("sign_up_completed", { source: "sign_up_page" });
    }
  }, [signUp?.status]);

  return null;
}
