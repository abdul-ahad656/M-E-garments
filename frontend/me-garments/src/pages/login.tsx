import { useEffect, useRef, useState, type ReactNode } from "react";
import { SignIn, SignUp, useSignUp } from "@clerk/react";
import { useSearch } from "wouter";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { trackEvent } from "@/lib/analytics";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

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
  shiftUp = 0,
}: {
  src: string;
  alt: string;
  captions: string[];
  shiftUp?: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative hidden min-h-[calc(100dvh-4rem)] flex-col items-center justify-center gap-4 overflow-hidden bg-white px-6 lg:flex">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,hsl(var(--primary)/0.06),transparent_55%)]"
      />
      <SwitchingThoughtBubble lines={captions} />
      <motion.img
        src={src}
        alt={alt}
        className="relative z-0 max-h-[52%] max-w-[48%] object-contain object-center"
        style={shiftUp ? { marginTop: -shiftUp } : undefined}
        animate={reduceMotion ? undefined : { y: [0, 8, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

function FormPanel({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-start justify-center bg-white px-6 pb-10 pt-40 sm:px-10 lg:px-16 lg:pt-45">
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
  mascotShiftUp = 0,
}: {
  children: ReactNode;
  mascotSrc: string;
  mascotAlt: string;
  mascotCaptions: string[];
  mascotSide?: "left" | "right";
  mascotShiftUp?: number;
}) {
  const mascot = (
    <MascotPanel
      src={mascotSrc}
      alt={mascotAlt}
      captions={mascotCaptions}
      shiftUp={mascotShiftUp}
    />
  );
  const form = <FormPanel>{children}</FormPanel>;

  return (
    <div className="grid flex-1 bg-white lg:grid-cols-2">
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
      mascotShiftUp={36}
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
      mascotShiftUp={36}
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
