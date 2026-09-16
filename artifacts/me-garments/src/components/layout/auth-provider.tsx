import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, useClerk, useSignUp } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { useLocation, useSearch } from 'wouter';
import { useQueryClient } from "@tanstack/react-query";
import { trackEvent } from "@/lib/analytics";

const clerkEnvKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as
  | string
  | undefined;

// Without an env key, publishableKeyFromHost("localhost") invents clerk.localhost
// and Clerk JS fails with ERR_CONNECTION_REFUSED.
if (!clerkEnvKey) {
  throw new Error(
    "Missing VITE_CLERK_PUBLISHABLE_KEY in the repo root .env file",
  );
}

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  clerkEnvKey,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(350 96% 43%)",
    colorForeground: "hsl(0 0% 8%)",
    colorMutedForeground: "hsl(0 0% 40%)",
    colorDanger: "hsl(0 84% 60%)",
    colorBackground: "hsl(0 0% 100%)",
    colorInput: "hsl(0 0% 100%)",
    colorInputForeground: "hsl(0 0% 8%)",
    colorNeutral: "hsl(0 0% 90%)",
    fontFamily: "Outfit, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-card rounded-2xl w-[440px] max-w-full overflow-hidden border border-border shadow-lg",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none border-t border-border",
    headerTitle: "text-2xl font-serif font-bold text-foreground",
    headerSubtitle: "text-muted-foreground text-sm",
    socialButtonsBlockButtonText: "text-foreground font-medium",
    formFieldLabel: "text-foreground font-medium",
    footerActionLink: "text-primary hover:text-primary/80 font-bold",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground",
    identityPreviewEditButton: "text-primary hover:text-primary/80",
    formFieldSuccessText: "text-green-600",
    alertText: "text-destructive font-medium",
    logoBox: "mb-6 flex justify-center items-center h-12",
    logoImage: "h-8 w-auto object-contain",
    socialButtonsBlockButton: "border border-border hover:bg-secondary transition-colors",
    formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-sm transition-all",
    formFieldInput: "border border-border rounded-lg bg-background text-foreground h-10 px-3",
    footerAction: "py-4",
    dividerLine: "bg-border",
    alert: "bg-destructive/10 border-destructive/20 text-destructive",
    otpCodeFieldInput: "border border-border bg-background text-foreground",
    formFieldRow: "gap-4",
    main: "flex flex-col gap-4",
  },
};

function sanitizeRedirectUrl(url: string | null): string {
  if (!url) return `${basePath}/account`;
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  return `${basePath}/account`;
}

export function SignInPage() {
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const redirectUrl = sanitizeRedirectUrl(searchParams.get('redirect_url'));

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-background px-4 py-8">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} fallbackRedirectUrl={redirectUrl} />
    </div>
  );
}

export function SignUpPage() {
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const redirectUrl = sanitizeRedirectUrl(searchParams.get('redirect_url'));

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-background px-4 py-8">
      <SignUpSuccessTracker />
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} fallbackRedirectUrl={redirectUrl} />
    </div>
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

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome to M&E",
            subtitle: "Sign in to save favorites and track orders",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Join M&E Garments today",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ClerkQueryClientCacheInvalidator />
      {children}
    </ClerkProvider>
  );
}
