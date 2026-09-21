import { useEffect, useRef, type ReactNode } from "react";
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useSignUp } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { useLocation, useSearch } from 'wouter';
import { useQueryClient } from "@tanstack/react-query";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { trackEvent } from "@/lib/analytics";

const clerkEnvKey = (
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined
)?.trim();

// Without an env key, publishableKeyFromHost invents an invalid host key and
// the app fails to boot (blank page in production).
const clerkPubKey = clerkEnvKey
  ? publishableKeyFromHost(window.location.hostname, clerkEnvKey)
  : "";

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

function AuthFormShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-background px-4 py-8">
      {children}
    </div>
  );
}

export function LoginPage() {
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const redirectUrl = sanitizeRedirectUrl(searchParams.get('redirect_url'));

  return (
    <AuthFormShell>
      <SignIn
        routing="path"
        path={`${basePath}/login`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={redirectUrl}
      />
    </AuthFormShell>
  );
}

export function SignInPage() {
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const redirectUrl = sanitizeRedirectUrl(searchParams.get('redirect_url'));

  return (
    <AuthFormShell>
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={redirectUrl}
      />
    </AuthFormShell>
  );
}

export function SignUpPage() {
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const redirectUrl = sanitizeRedirectUrl(searchParams.get('redirect_url'));

  return (
    <AuthFormShell>
      <SignUpSuccessTracker />
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/login`} fallbackRedirectUrl={redirectUrl} />
    </AuthFormShell>
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

/** Attach Clerk session JWT to API calls so mutating requests stay authenticated. */
function ClerkApiAuthBridge() {
  const { getToken } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(async () => {
      try {
        return (await getToken()) ?? null;
      } catch {
        return null;
      }
    });
    return () => setAuthTokenGetter(null);
  }, [getToken]);

  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();

  if (!clerkPubKey) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-3">
          <h1 className="text-xl font-semibold">Missing Clerk configuration</h1>
          <p className="text-sm text-muted-foreground">
            Set <code className="text-foreground">VITE_CLERK_PUBLISHABLE_KEY</code> in
            the Vercel project environment variables, then redeploy. Vite embeds this
            value at build time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/login`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Login",
            subtitle: "Welcome back. Log in to save favorites and track orders",
          },
        },
        signUp: {
          start: {
            title: "Sign in",
            subtitle: "Create your M&E Garments account",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ClerkQueryClientCacheInvalidator />
      <ClerkApiAuthBridge />
      {children}
    </ClerkProvider>
  );
}
