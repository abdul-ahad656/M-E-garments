type SupabaseError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

export class SupabaseRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: SupabaseError,
  ) {
    super(message);
  }
}

export async function supabaseRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const baseUrl = process.env.SUPABASE_URL?.trim()?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!baseUrl || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables",
    );
  }

  const headers = Object.fromEntries(new Headers(init.headers).entries());
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      ...headers,
    },
  });

  if (!response.ok) {
    const details = (await response.json().catch(() => ({}))) as SupabaseError;
    throw new SupabaseRequestError(
      details.message ?? `Supabase request failed with ${response.status}`,
      response.status,
      details,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
