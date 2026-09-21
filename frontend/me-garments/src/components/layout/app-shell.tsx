import { ReactNode } from "react";
import { AssistantWidgetProvider } from "@/components/assistant-widget";
import { Navbar } from "./navbar";
import { Footer } from "./footer";
import { PageTransition } from "./page-transition";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AssistantWidgetProvider>
      <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
        <Navbar />
        <main className="flex flex-1 flex-col">
          <PageTransition>{children}</PageTransition>
        </main>
        <Footer />
      </div>
    </AssistantWidgetProvider>
  );
}
