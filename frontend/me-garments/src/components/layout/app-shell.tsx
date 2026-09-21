import { ReactNode } from "react";
import { useLocation } from "wouter";
import { AssistantWidgetProvider } from "@/components/assistant-widget";
import { Navbar } from "./navbar";
import { Footer } from "./footer";
import { PageTransition } from "./page-transition";

function isAuthRoute(path: string): boolean {
  return (
    path === "/login" ||
    path.startsWith("/login/") ||
    path === "/sign-in" ||
    path.startsWith("/sign-in/") ||
    path === "/sign-up" ||
    path.startsWith("/sign-up/")
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const authRoute = isAuthRoute(location);

  return (
    <AssistantWidgetProvider>
      <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
        {!authRoute && <Navbar />}
        <main className="flex flex-1 flex-col">
          <PageTransition>{children}</PageTransition>
        </main>
        {!authRoute && <Footer />}
      </div>
    </AssistantWidgetProvider>
  );
}
