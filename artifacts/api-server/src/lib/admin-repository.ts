import { supabaseRequest } from "./supabase";

type PolicyRow = {
  slug: string;
  title: string;
  content_markdown: string;
  published: boolean;
  updated_at: string;
};

type PolicyStatus = "draft" | "review" | "published";

const WORKFLOW_SUFFIX = /--(draft|review|published)$/;

function policyIdentity(row: PolicyRow): { slug: string; status: PolicyStatus } {
  const match = row.slug.match(WORKFLOW_SUFFIX);
  return {
    slug: match ? row.slug.slice(0, -match[0].length) : row.slug,
    status: match
      ? match[1] as PolicyStatus
      : row.published
        ? "published"
        : "draft",
  };
}

const mapPolicy = (row: PolicyRow) => ({
  slug: policyIdentity(row).slug,
  title: row.title,
  contentMarkdown: row.content_markdown,
  status: policyIdentity(row).status,
  updatedAt: row.updated_at,
});

export async function listPolicies() {
  const rows = await supabaseRequest<PolicyRow[]>(
    "policy_documents?select=slug,title,content_markdown,published,updated_at&order=updated_at.desc",
  );
  const latestBySlug = new Map<string, ReturnType<typeof mapPolicy>>();
  for (const row of rows) {
    const policy = mapPolicy(row);
    if (!latestBySlug.has(policy.slug)) latestBySlug.set(policy.slug, policy);
  }
  return [...latestBySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

export async function savePolicy(input: {
  slug: string;
  title: string;
  contentMarkdown: string;
  status: "draft" | "review" | "published";
}) {
  const rows = await supabaseRequest<PolicyRow[]>(
    "policy_documents?on_conflict=slug",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        slug: `${input.slug}--${input.status}`,
        title: input.title,
        content_markdown: input.contentMarkdown,
        published: input.status === "published",
        updated_at: new Date().toISOString(),
      }),
    },
  );
  if (!rows[0]) throw new Error("Supabase did not return the saved policy");
  return mapPolicy(rows[0]);
}

export async function recordCatalogSync(checkedAt: string, metadata: object) {
  const rows = await supabaseRequest<Array<{
    key: string;
    last_synced_at: string | null;
    updated_at: string;
  }>>("catalog_sync_state?on_conflict=key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      key: "catalog-health",
      last_synced_at: checkedAt,
      metadata,
      updated_at: checkedAt,
    }),
  });
  return rows[0];
}

export async function recordStaffAccessChange(input: {
  actorUserId: string;
  targetUserId: string;
  previousRole: "admin" | "staff" | null;
  newRole: "admin" | "staff" | null;
  changedAt: string;
}) {
  await supabaseRequest("staff_access_audit", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      actor_clerk_user_id: input.actorUserId,
      target_clerk_user_id: input.targetUserId,
      previous_role: input.previousRole,
      new_role: input.newRole,
      changed_at: input.changedAt,
    }),
  });
}

export async function getAnalyticsSummary() {
  const rows: Array<{
    event_name: string;
    created_at: string;
  }> = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const page = await supabaseRequest<typeof rows>(
      `analytics_events?select=event_name,created_at&order=created_at.desc&limit=${pageSize}&offset=${offset}`,
    );
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.event_name, (counts.get(row.event_name) ?? 0) + 1);
  return {
    recordedEvents: rows.length,
    firstRecordedAt: rows.at(-1)?.created_at ?? null,
    lastRecordedAt: rows[0]?.created_at ?? null,
    events: [...counts.entries()]
      .map(([eventName, count]) => ({ eventName, count }))
      .sort((a, b) => b.count - a.count),
    unavailableMetrics: [
      "Revenue attribution",
      "Conversion rate",
      "Unique visitors",
    ],
  };
}