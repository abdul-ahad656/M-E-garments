type AnalyticsData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void;
    };
  }
}

const SESSION_KEY = "me_analytics_sid";

function getSessionId(): string | undefined {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

function analyticsUrl(): string {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (base) return `${base.replace(/\/+$/, "")}/api/storefront/analytics`;
  const viteBase = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${viteBase}/api/storefront/analytics`;
}

export function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === "undefined") return;

  try {
    window.umami?.track(name, data);
  } catch {
    // Optional Umami must never interrupt storefront actions.
  }

  try {
    const payload = {
      eventName: name,
      sessionId: getSessionId(),
      path: window.location.pathname,
      properties: data ?? {},
    };
    void fetch(analyticsUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Analytics must never interrupt storefront actions.
    });
  } catch {
    // Analytics must never interrupt storefront actions.
  }
}
