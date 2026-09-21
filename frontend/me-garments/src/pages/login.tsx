import { useEffect, useRef, useState, type ReactNode } from "react";
import { SignIn, SignUp, useSignUp } from "@clerk/react";
import { Link, useSearch } from "wouter";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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

const LOGIN_THOUGHTS = [
  "Welcome back!",
  "Missed you…",
  "Ready to explore?",
  "Your favorites await",
];

const SIGNUP_THOUGHTS = [
  "Glad you're here!",
  "Join the crew",
  "New looks start here",
  "Let's get started",
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

function SwitchingThoughtBubble({ lines }: { lines: string[] }) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduceMotion || lines.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % lines.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, [lines.length, reduceMotion]);

  const active = lines[index] ?? lines[0];

  return (
    <motion.div
      className="relative z-10 flex flex-col items-center"
      animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
      transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
    >
      <div className="relative -rotate-2">
        <div className="absolute -inset-1 rounded-[1.75rem] bg-primary/10 blur-sm" />
        <div className="relative min-w-[15rem] max-w-[20rem] overflow-hidden rounded-[1.5rem] border-2 border-primary bg-white px-6 py-4 shadow-[6px_6px_0_0_hsl(var(--primary))]">
          <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-primary/60">
            Thinking…
          </p>
          <div className="relative min-h-[3.5rem] overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={active}
                initial={
                  reduceMotion
                    ? false
                    : { y: 28, opacity: 0, filter: "blur(4px)" }
                }
                animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                exit={
                  reduceMotion
                    ? undefined
                    : { y: -28, opacity: 0, filter: "blur(4px)" }
                }
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="w-full font-serif text-xl font-bold leading-snug text-primary"
              >
                {active}
              </motion.p>
            </AnimatePresence>
          </div>
          <div className="mt-3 flex gap-1.5">
            {lines.map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all duration-500 ${
                  i === index ? "w-5 bg-primary" : "w-1.5 bg-primary/25"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-col items-center gap-1.5" aria-hidden>
        <motion.span
          className="h-3 w-3 rounded-full border-2 border-primary bg-white"
          animate={reduceMotion ? undefined : { scale: [1, 1.15, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: 0 }}
        />
        <motion.span
          className="h-2 w-2 rounded-full border-2 border-primary bg-white"
          animate={reduceMotion ? undefined : { scale: [1, 1.2, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: 0.2 }}
        />
        <motion.span
          className="h-1.5 w-1.5 rounded-full bg-primary"
          animate={reduceMotion ? undefined : { scale: [1, 1.3, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: 0.4 }}
        />
      </div>
    </motion.div>
  );
}

function MascotPanel({
  src,
  alt,
  captions,
}: {
  src: string;
  alt: string;
  captions: string[];
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative hidden min-h-[calc(100dvh-4.5rem)] flex-col items-center justify-center gap-4 overflow-hidden bg-white px-6 lg:flex">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,hsl(var(--primary)/0.06),transparent_55%)]"
      />
      <SwitchingThoughtBubble lines={captions} />
      <motion.img
        src={src}
        alt={alt}
        className="relative z-0 max-h-[52%] max-w-[48%] object-contain object-center"
        animate={reduceMotion ? undefined : { y: [0, 8, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
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
  mascotCaptions,
  mascotSide = "left",
}: {
  children: ReactNode;
  mascotSrc: string;
  mascotAlt: string;
  mascotCaptions: string[];
  mascotSide?: "left" | "right";
}) {
  const mascot = (
    <MascotPanel src={mascotSrc} alt={mascotAlt} captions={mascotCaptions} />
  );
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
      mascotCaptions={LOGIN_THOUGHTS}
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
      mascotCaptions={LOGIN_THOUGHTS}
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
      mascotCaptions={SIGNUP_THOUGHTS}
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
