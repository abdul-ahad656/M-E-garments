import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAdminProductQueryKey,
  getListAdminProductsQueryKey,
  useCreateAdminProduct,
  useGetAdminProduct,
  useUpdateAdminProduct,
  type AdminProductCreateInputStatus,
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

type VariantDraft = {
  id?: string;
  optionValue: string;
  price: string;
  compareAtPrice: string;
  sku: string;
  useCustomSize?: boolean;
};

/** Storefront category pages match these Shopify product tags. */
type GenderOption = "" | "boys" | "girls" | "both";
type AgeOption = "" | "toddler" | "kids" | "both";

const GENDER_TAGS = new Set(["boys", "girls"]);
const AGE_TAGS = new Set(["toddler", "kids"]);
const OCCASION_TAGS = new Set(["party", "partywear"]);

const SIZE_PRESETS = [
  "XS",
  "Small",
  "Medium",
  "Large",
  "XL",
  "2-3Y",
  "4-5Y",
  "6-7Y",
  "8Y",
] as const;

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

function isManagedTag(tag: string): boolean {
  const normalized = normalizeTag(tag);
  return (
    GENDER_TAGS.has(normalized) ||
    AGE_TAGS.has(normalized) ||
    OCCASION_TAGS.has(normalized)
  );
}

function genderFromTags(tags: string[]): GenderOption {
  const normalized = tags.map(normalizeTag);
  const hasBoys = normalized.includes("boys");
  const hasGirls = normalized.includes("girls");
  if (hasBoys && hasGirls) return "both";
  if (hasBoys) return "boys";
  if (hasGirls) return "girls";
  return "";
}

function ageFromTags(tags: string[]): AgeOption {
  const normalized = tags.map(normalizeTag);
  const hasToddler = normalized.includes("toddler");
  const hasKids = normalized.includes("kids");
  if (hasToddler && hasKids) return "both";
  if (hasToddler) return "toddler";
  if (hasKids) return "kids";
  return "";
}

function isPartywearFromTags(tags: string[]): boolean {
  return tags.some((tag) => OCCASION_TAGS.has(normalizeTag(tag)));
}

function applyCategoryTags(
  freeformTags: string[],
  gender: GenderOption,
  age: AgeOption,
  partywear: boolean,
): string[] {
  const tags = freeformTags.filter((tag) => !isManagedTag(tag));

  if (gender === "boys") tags.push("boys");
  if (gender === "girls") tags.push("girls");
  if (gender === "both") tags.push("boys", "girls");

  if (age === "toddler") tags.push("toddler");
  if (age === "kids") tags.push("kids");
  if (age === "both") tags.push("toddler", "kids");

  if (partywear) tags.push("party");

  return tags;
}

function sizeSelectValue(variant: VariantDraft): string {
  if (variant.useCustomSize) return "__custom__";
  if (!variant.optionValue) return "";
  return SIZE_PRESETS.includes(variant.optionValue as (typeof SIZE_PRESETS)[number])
    ? variant.optionValue
    : "__custom__";
}

function apiErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const data = "data" in error ? (error as { data: unknown }).data : undefined;
    if (typeof data === "object" && data !== null && "error" in data) {
      return String((data as { error: unknown }).error);
    }
    if ("message" in error) {
      return String((error as { message: unknown }).message);
    }
  }
  return "Shopify rejected the request";
}

export default function AdminProductEditorPage() {
  const params = useParams<{ id?: string }>();
  const isNew = !params.id || params.id === "new";
  const productId = isNew ? undefined : decodeURIComponent(params.id!);
  const productPathId = productId ? encodeURIComponent(productId) : "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const existing = useGetAdminProduct(productPathId, {
    query: {
      queryKey: getGetAdminProductQueryKey(productPathId),
      enabled: Boolean(productPathId),
      staleTime: 10_000,
    },
  });
  const createMutation = useCreateAdminProduct();
  const updateMutation = useUpdateAdminProduct();

  const [title, setTitle] = useState("");
  const [descriptionHtml, setDescriptionHtml] = useState("");
  const [status, setStatus] = useState<AdminProductCreateInputStatus>("DRAFT");
  const [productType, setProductType] = useState("");
  const [gender, setGender] = useState<GenderOption>("");
  const [age, setAge] = useState<AgeOption>("");
  const [partywear, setPartywear] = useState(false);
  const [tags, setTags] = useState("");
  const [optionName, setOptionName] = useState("Size");
  const [imageUrls, setImageUrls] = useState("");
  const [variants, setVariants] = useState<VariantDraft[]>([
    { optionValue: "Small", price: "0.00", compareAtPrice: "", sku: "" },
  ]);

  useEffect(() => {
    if (!existing.data) return;
    setTitle(existing.data.title);
    setDescriptionHtml(existing.data.descriptionHtml);
    setStatus(existing.data.status);
    setProductType(existing.data.productType);
    setGender(genderFromTags(existing.data.tags));
    setAge(ageFromTags(existing.data.tags));
    setPartywear(isPartywearFromTags(existing.data.tags));
    setTags(existing.data.tags.filter((tag) => !isManagedTag(tag)).join(", "));
    setOptionName(existing.data.options[0]?.name ?? "Size");
    setImageUrls(existing.data.images.map((image) => image.url).join("\n"));
    setVariants(
      existing.data.variants.map((variant) => ({
        id: variant.id,
        optionValue: variant.selectedOptions[0]?.value ?? variant.title,
        price: variant.price,
        compareAtPrice: variant.compareAtPrice ?? "",
        sku: variant.sku ?? "",
      })),
    );
  }, [existing.data]);

  const saving = createMutation.isPending || updateMutation.isPending;
  const canSave = Boolean(title.trim()) && Boolean(gender) && Boolean(age);

  const save = () => {
    if (!gender) {
      toast({
        title: "Collection required",
        description: "Choose Boy, Girl, or Both so the product appears in the storefront.",
        variant: "destructive",
      });
      return;
    }
    if (!age) {
      toast({
        title: "Age range required",
        description: "Choose Toddler, Kids, or Both.",
        variant: "destructive",
      });
      return;
    }

    const parsedTags = applyCategoryTags(
      tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      gender,
      age,
      partywear,
    );
    const parsedImages = imageUrls
      .split("\n")
      .map((url) => url.trim())
      .filter(Boolean);

    if (isNew) {
      createMutation.mutate(
        {
          data: {
            title,
            descriptionHtml,
            status,
            productType,
            tags: parsedTags,
            optionName,
            imageUrls: parsedImages,
            variants: variants.map((variant) => ({
              optionValues: [variant.optionValue],
              price: variant.price,
              compareAtPrice: variant.compareAtPrice || null,
              sku: variant.sku || null,
            })),
          },
        },
        {
          onSuccess: async (product) => {
            await queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey() });
            toast({ title: "Product created" });
            setLocation(`/admin/products/${encodeURIComponent(product.id)}`);
          },
          onError: (error) => {
            toast({
              title: "Could not create product",
              description: apiErrorMessage(error),
              variant: "destructive",
            });
          },
        },
      );
      return;
    }

    updateMutation.mutate(
      {
        id: productPathId,
        data: {
          title,
          descriptionHtml,
          status,
          productType,
          tags: parsedTags,
          imageUrls: parsedImages,
          variants: variants
            .filter((variant) => variant.id)
            .map((variant) => ({
              id: variant.id!,
              price: variant.price,
              compareAtPrice: variant.compareAtPrice || null,
              sku: variant.sku || null,
            })),
        },
      },
      {
        onSuccess: async () => {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey() }),
            queryClient.invalidateQueries({
              queryKey: getGetAdminProductQueryKey(productPathId),
            }),
          ]);
          toast({ title: "Product updated" });
        },
        onError: (error) => {
          toast({
            title: "Could not update product",
            description: apiErrorMessage(error),
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="font-serif text-2xl font-semibold">
            {isNew ? "New product" : "Edit product"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Writes go directly to Shopify Admin. Image URLs only (no file upload).
          </p>
        </div>

        {existing.error && !isNew && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Product unavailable</AlertTitle>
            <AlertDescription>Shopify Admin could not load this product.</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>Core product fields</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description HTML</Label>
              <Textarea
                id="description"
                className="min-h-28 font-mono"
                value={descriptionHtml}
                onChange={(e) => setDescriptionHtml(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as AdminProductCreateInputStatus)}
              >
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Product type</Label>
              <Input
                id="type"
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
                placeholder="e.g. Tops, Dresses"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Collection (Boy / Girl)</Label>
              <select
                id="gender"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={gender}
                onChange={(e) => setGender(e.target.value as GenderOption)}
                required
              >
                <option value="" disabled>
                  Select collection…
                </option>
                <option value="boys">Boy</option>
                <option value="girls">Girl</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="age">Age range</Label>
              <select
                id="age"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={age}
                onChange={(e) => setAge(e.target.value as AgeOption)}
                required
              >
                <option value="" disabled>
                  Select age range…
                </option>
                <option value="toddler">Toddler (1-3y)</option>
                <option value="kids">Kids (4-8y)</option>
                <option value="both">Both age ranges</option>
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="partywear" className="flex items-center gap-2 font-normal">
                <input
                  id="partywear"
                  type="checkbox"
                  className="h-4 w-4 rounded border border-input"
                  checked={partywear}
                  onChange={(e) => setPartywear(e.target.checked)}
                />
                <span className="text-sm font-medium">Partywear</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Shows under Partywear. Boy/Girl and age tags power the storefront category pages.
              </p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="tags">Other tags (comma separated)</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. new, sale, best_seller"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="images">Image URLs (one per line)</Label>
              <Textarea
                id="images"
                className="min-h-24 font-mono"
                value={imageUrls}
                onChange={(e) => setImageUrls(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Variants</CardTitle>
            <CardDescription>
              {isNew
                ? "Choose size options (Small, Medium, Large, …) and set prices."
                : "Update prices and SKUs for existing variants."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isNew && (
              <div className="space-y-2">
                <Label htmlFor="option-name">Option name</Label>
                <Input
                  id="option-name"
                  value={optionName}
                  onChange={(e) => setOptionName(e.target.value)}
                />
              </div>
            )}
            {variants.map((variant, index) => {
              const sizeValue = sizeSelectValue(variant);
              const isCustomSize = sizeValue === "__custom__";
              return (
                <div
                  key={variant.id ?? index}
                  className="grid gap-3 rounded-lg border p-4 md:grid-cols-4"
                >
                  <div className="space-y-2">
                    <Label>Size</Label>
                    {isNew ? (
                      <div className="space-y-2">
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={sizeValue}
                          onChange={(e) => {
                            const next = [...variants];
                            const selected = e.target.value;
                            if (selected === "__custom__") {
                              next[index] = {
                                ...variant,
                                useCustomSize: true,
                                optionValue: "",
                              };
                            } else {
                              next[index] = {
                                ...variant,
                                useCustomSize: false,
                                optionValue: selected,
                              };
                            }
                            setVariants(next);
                          }}
                        >
                          <option value="" disabled>
                            Select size…
                          </option>
                          {SIZE_PRESETS.map((size) => (
                            <option key={size} value={size}>
                              {size}
                            </option>
                          ))}
                          <option value="__custom__">Custom…</option>
                        </select>
                        {isCustomSize && (
                          <Input
                            value={variant.optionValue}
                            placeholder="Custom size"
                            onChange={(e) => {
                              const next = [...variants];
                              next[index] = {
                                ...variant,
                                useCustomSize: true,
                                optionValue: e.target.value,
                              };
                              setVariants(next);
                            }}
                          />
                        )}
                      </div>
                    ) : (
                      <Input value={variant.optionValue} disabled />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Price</Label>
                    <Input
                      value={variant.price}
                      onChange={(e) => {
                        const next = [...variants];
                        next[index] = { ...variant, price: e.target.value };
                        setVariants(next);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Compare at</Label>
                    <Input
                      value={variant.compareAtPrice}
                      onChange={(e) => {
                        const next = [...variants];
                        next[index] = { ...variant, compareAtPrice: e.target.value };
                        setVariants(next);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SKU</Label>
                    <Input
                      value={variant.sku}
                      onChange={(e) => {
                        const next = [...variants];
                        next[index] = { ...variant, sku: e.target.value };
                        setVariants(next);
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {isNew && (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setVariants([
                    ...variants,
                    { optionValue: "Medium", price: "0.00", compareAtPrice: "", sku: "" },
                  ])
                }
              >
                Add size variant
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={save} disabled={saving || !canSave}>
            {saving ? "Saving…" : isNew ? "Create product" : "Save changes"}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/products">Back to list</Link>
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
