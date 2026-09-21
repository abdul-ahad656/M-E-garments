import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Router, useLocation, useRouter } from "wouter";
import { Navbar } from "./navbar";
import { Footer } from "./footer";

type Phase = "idle" | "covering" | "revealing";

const COVER_DURATION = 0.8;
const REVEAL_DURATION = 1.2;
/** GSAP power4.inOut approximation */
const CURTAIN_EASE: [number, number, number, number] = [0.77, 0, 0.175, 1];

function isAdminPath(path: string) {
  return path === "/admin" || path.startsWith("/admin/");
}

function isAuthPath(path: string) {
  return (
    path === "/login" ||
    path.startsWith("/login/") ||
    path === "/sign-in" ||
    path.startsWith("/sign-in/") ||
    path === "/sign-up" ||
    path.startsWith("/sign-up/")
  );
}

function shouldSkipCurtain(from: string, to: string) {
  return isAdminPath(from) || isAdminPath(to);
}

function ShellChrome({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const authRoute = isAuthPath(location);

  return (
    <>
      <Navbar />
      <main className="flex flex-1 flex-col">{children}</main>
      {!authRoute && <Footer />}
    </>
  );
}

export function PageTransition({ children }: { children: ReactNode }) {
  const parentRouter = useRouter();
  const [location, navigate] = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const [displayedLocation, setDisplayedLocation] = useState(location);
  const [phase, setPhase] = useState<Phase>(() =>
    prefersReducedMotion ? "idle" : "revealing",
  );
  const pendingLocation = useRef<string | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const syncInstant = useCallback((next: string) => {
    pendingLocation.current = null;
    setDisplayedLocation(next);
    window.scrollTo(0, 0);
    setPhase("idle");
  }, []);

  useEffect(() => {
    if (location === displayedLocation) return;

    if (prefersReducedMotion || shouldSkipCurtain(displayedLocation, location)) {
      syncInstant(location);
      return;
    }

    if (phaseRef.current !== "idle") {
      pendingLocation.current = location;
      return;
    }

    pendingLocation.current = null;
    setPhase("covering");
  }, [location, displayedLocation, prefersReducedMotion, syncInstant]);

  const handleCurtainComplete = useCallback(() => {
    if (phaseRef.current === "covering") {
      const next = pendingLocation.current ?? location;
      pendingLocation.current = null;
      setDisplayedLocation(next);
      window.scrollTo(0, 0);
      setPhase("revealing");
      return;
    }

    if (phaseRef.current === "revealing") {
      const queued = pendingLocation.current;
      if (queued && queued !== displayedLocation) {
        pendingLocation.current = null;
        if (
          prefersReducedMotion ||
          shouldSkipCurtain(displayedLocation, queued)
        ) {
          syncInstant(queued);
          return;
        }
        setPhase("covering");
        return;
      }
      setPhase("idle");
    }
  }, [location, displayedLocation, prefersReducedMotion, syncInstant]);

  // Nested router freezes the painted path; navigate still updates the outer URL.
  // Keep base empty so navigate isn't double-prefixed; restore hrefs via parent base.
  const frozenHook = useCallback(
    () => [displayedLocation, navigate] as [string, typeof navigate],
    [displayedLocation, navigate],
  );

  const formatHref = useCallback(
    (path: string) =>
      parentRouter.hrefs(`${parentRouter.base}${path}`, parentRouter),
    [parentRouter],
  );

  const animateY = phase === "covering" ? "0%" : "-100%";
  const duration =
    phase === "covering"
      ? COVER_DURATION
      : phase === "revealing"
        ? REVEAL_DURATION
        : 0;

  return (
    <>
      <motion.div
        aria-hidden
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-primary text-primary-foreground"
        initial={prefersReducedMotion ? { y: "-100%" } : { y: "0%" }}
        animate={{ y: prefersReducedMotion ? "-100%" : animateY }}
        transition={{ duration, ease: CURTAIN_EASE }}
        onAnimationComplete={handleCurtainComplete}
        style={{
          pointerEvents: phase === "idle" ? "none" : "auto",
        }}
      >
        <span className="select-none text-[clamp(2.5rem,8vw,4rem)] font-bold tracking-[0.2em]">
          M&E
        </span>
      </motion.div>

      <Router hook={frozenHook} hrefs={formatHref}>
        <ShellChrome>
          <motion.div
            key={displayedLocation}
            className="flex flex-1 flex-col"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.8,
              delay: prefersReducedMotion || phase === "idle" ? 0 : 0.35,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {children}
          </motion.div>
        </ShellChrome>
      </Router>
    </>
  );
}
