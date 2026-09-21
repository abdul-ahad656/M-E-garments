import { ReactNode } from "react";
import { AssistantWidgetProvider } from "@/components/assistant-widget";
import { PageTransition } from "./page-transition";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AssistantWidgetProvider>
      <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
        <PageTransition>{children}</PageTransition>
      </div>
    </AssistantWidgetProvider>
  );
}
