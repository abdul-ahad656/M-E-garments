import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListAdminPoliciesQueryKey,
  useListAdminPolicies,
  useSaveAdminPolicy,
  type PolicyDocument,
  type PolicyDocumentInputStatus,
} from "@workspace/api-client-react";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "./layout";

const newDocuments = [
  { slug: "shipping-returns", title: "Shipping & Returns" },
  { slug: "privacy-policy", title: "Privacy Policy" },
  { slug: "size-guide", title: "Size Guide" },
];

function PolicyEditor({ policies }: { policies: PolicyDocument[] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const options = useMemo(() => {
    const existing = new Set(policies.map((policy) => policy.slug));
    return [
      ...policies.map((policy) => ({ slug: policy.slug, title: policy.title })),
      ...newDocuments.filter((document) => !existing.has(document.slug)),
    ];
  }, [policies]);
  const [slug, setSlug] = useState(options[0]?.slug ?? "shipping-returns");
  const selected = policies.find((policy) => policy.slug === slug);
  const defaultTitle = options.find((document) => document.slug === slug)?.title ?? "";
  const [title, setTitle] = useState(selected?.title ?? defaultTitle);
  const [contentMarkdown, setContentMarkdown] = useState(selected?.contentMarkdown ?? "");
  const [status, setStatus] = useState<PolicyDocumentInputStatus>(selected?.status ?? "draft");
  const mutation = useSaveAdminPolicy();

  useEffect(() => {
    setTitle(selected?.title ?? defaultTitle);
    setContentMarkdown(selected?.contentMarkdown ?? "");
    setStatus(selected?.status ?? "draft");
  }, [defaultTitle, selected]);

  const save = () => {
    mutation.mutate(
      { slug, data: { title, contentMarkdown, status } },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: getListAdminPoliciesQueryKey() });
          toast({ title: status === "published" ? "Content published" : "Content saved" });
        },
        onError: () => {
          toast({ title: "Could not save content", variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-lg">Documents</CardTitle>
          <CardDescription>Policies and sizing guidance stored in Supabase.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {options.map((document) => (
            <Button
              key={document.slug}
              variant={slug === document.slug ? "secondary" : "ghost"}
              className="h-auto w-full justify-between py-3 text-left"
              onClick={() => setSlug(document.slug)}
            >
              <span className="truncate">{document.title}</span>
              {policies.find((policy) => policy.slug === document.slug) && (
                <span className="ml-2 text-[10px] uppercase text-muted-foreground">
                  {policies.find((policy) => policy.slug === document.slug)?.status}
                </span>
              )}
            </Button>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Content editor</CardTitle>
          <CardDescription>
            Draft changes, move them to review, then publish verified content.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="policy-title">Title</Label>
            <Input id="policy-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="policy-content">Markdown content</Label>
            <Textarea
              id="policy-content"
              className="min-h-72 font-mono"
              value={contentMarkdown}
              onChange={(event) => setContentMarkdown(event.target.value)}
              placeholder="Write verified policy or sizing content here."
            />
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <Label htmlFor="policy-status">Workflow status</Label>
              <select
                id="policy-status"
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={status}
                onChange={(event) => setStatus(event.target.value as PolicyDocumentInputStatus)}
              >
                <option value="draft">Draft</option>
                <option value="review">Ready for review</option>
                <option value="published">Published</option>
              </select>
            </div>
            <Button
              onClick={save}
              disabled={mutation.isPending || !title.trim()}
              className="sm:min-w-36"
            >
              {mutation.isPending ? "Saving…" : "Save document"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminContentPage() {
  const { user } = useUser();
  const policies = useListAdminPolicies({
    query: {
      queryKey: [...getListAdminPoliciesQueryKey(), user?.id ?? "signed-out"],
      enabled: Boolean(user?.id),
      staleTime: 30_000,
    },
  });

  return (
    <AdminLayout>
      {policies.data && <PolicyEditor policies={policies.data} />}
      {policies.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Content unavailable</AlertTitle>
          <AlertDescription>Supabase policy documents could not be loaded.</AlertDescription>
        </Alert>
      )}
    </AdminLayout>
  );
}
