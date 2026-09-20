import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAdminProductQueryKey,
  getListAdminProductsQueryKey,
  useCreateAdminProduct,
  useDeleteAdminProduct,
  useGetAdminProduct,
  useGenerateAdminMedia,
  useUpdateAdminProduct,
  useUploadAdminMedia,
  type AdminProductCreateInputStatus,
} from "@workspace/api-client-react";
import { AlertTriangle, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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
  quantity: string;
  useCustomSize?: boolean;
};

/** Storefront category pages match these product tags. */
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
  return "Request rejected";
}

function generationAgeLabel(age: AgeOption): string {
  if (age === "toddler") return "2 to 4 years old";
  if (age === "kids") return "5 to 8 years old";
  if (age === "both") return "2 to 8 years old";
  return "";
}

function generationGenderLabel(gender: GenderOption): string {
  if (gender === "boys") return "a realistic boy";
  if (gender === "girls") return "a realistic girl";
  if (gender === "both") return "a realistic child";
  return "";
}

function mergeImageUrls(existing: string[], nextUrls: string[]): string[] {
  const merged = [...existing];
  for (const url of nextUrls) {
    if (!merged.includes(url)) merged.push(url);
  }
  return merged;
}

function parseQuantity(value: string): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const EMPTY_VARIANT: VariantDraft = {
  optionValue: "Small",
  price: "0.00",
  compareAtPrice: "",
  sku: "",
  quantity: "0",
};

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
  const deleteMutation = useDeleteAdminProduct();
  const uploadMedia = useUploadAdminMedia();
  const generateMedia = useGenerateAdminMedia();

  const [title, setTitle] = useState("");
  const [descriptionHtml, setDescriptionHtml] = useState("");
  const [status, setStatus] = useState<AdminProductCreateInputStatus>("DRAFT");
  const [productType, setProductType] = useState("");
  const [gender, setGender] = useState<GenderOption>("");
  const [age, setAge] = useState<AgeOption>("");
  const [partywear, setPartywear] = useState(false);
  const [tags, setTags] = useState("");
  const [optionName, setOptionName] = useState("Size");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [generatePrompt, setGeneratePrompt] = useState("");
  const [generateFile, setGenerateFile] = useState<File | null>(null);
  const [variants, setVariants] = useState<VariantDraft[]>([{ ...EMPTY_VARIANT }]);

  const resetCreateForm = () => {
    setTitle("");
    setDescriptionHtml("");
    setStatus("DRAFT");
    setProductType("");
    setGender("");
    setAge("");
    setPartywear(false);
    setTags("");
    setOptionName("Size");
    setImageUrls([]);
    setGeneratePrompt("");
    setGenerateFile(null);
    setVariants([{ ...EMPTY_VARIANT }]);
  };

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
    setImageUrls(existing.data.images.map((image) => image.url));
    setVariants(
      existing.data.variants.map((variant) => ({
        id: variant.id,
        optionValue: variant.selectedOptions[0]?.value ?? variant.title,
        price: variant.price,
        compareAtPrice: variant.compareAtPrice ?? "",
        sku: variant.sku ?? "",
        quantity: String(variant.inventoryQuantity ?? 0),
      })),
    );
  }, [existing.data]);

  const saving =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const uploading = uploadMedia.isPending;
  const generating = generateMedia.isPending;
  const canSave = Boolean(title.trim()) && Boolean(gender) && Boolean(age);

  const handleImageFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const files = Array.from(fileList);
    uploadMedia.mutate(
      { data: { files } },
      {
        onSuccess: (result) => {
          setImageUrls((prev) => mergeImageUrls(prev, result.urls));
          toast({
            title: files.length === 1 ? "Image uploaded" : "Images uploaded",
            description: "Save the product to attach these images.",
          });
        },
        onError: (error) => {
          toast({
            title: "Could not upload images",
            description: apiErrorMessage(error),
            variant: "destructive",
          });
        },
      },
    );
  };

  const removeImageUrl = (urlToRemove: string) => {
    setImageUrls((prev) => prev.filter((url) => url !== urlToRemove));
  };

  const handleGenerateImage = () => {
    if (!generateFile) {
      toast({
        title: "Garment image required",
        description: "Choose a JPEG or PNG garment photo to generate from.",
        variant: "destructive",
      });
      return;
    }
    if (!gender || !age) {
      toast({
        title: "Collection and age required",
        description: "Choose Boy/Girl and Toddler/Kids so the generated model matches the product.",
        variant: "destructive",
      });
      return;
    }

    generateMedia.mutate(
      {
        data: {
          garment: generateFile,
          age: generationAgeLabel(age),
          gender: generationGenderLabel(gender),
          customPrompt: generatePrompt.trim() || undefined,
        },
      },
      {
        onSuccess: (result) => {
          setImageUrls((prev) => mergeImageUrls(prev, result.urls));
          setGenerateFile(null);
          toast({
            title: "On-model image generated",
            description: "Save the product to attach this image.",
          });
        },
        onError: (error) => {
          toast({
            title: "Could not generate image",
            description: apiErrorMessage(error),
            variant: "destructive",
          });
        },
      },
    );
  };

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
            imageUrls,
            variants: variants.map((variant) => ({
              optionValues: [variant.optionValue],
              price: variant.price,
              compareAtPrice: variant.compareAtPrice || null,
              sku: variant.sku || null,
              inventoryQuantity: parseQuantity(variant.quantity),
            })),
          },
        },
        {
          onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey() });
            toast({
              title: "Product created",
              description: "You can add another product now.",
            });
            resetCreateForm();
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
          imageUrls,
          variants: variants
            .filter((variant) => variant.id)
            .map((variant) => ({
              id: variant.id!,
              price: variant.price,
              compareAtPrice: variant.compareAtPrice || null,
              sku: variant.sku || null,
              inventoryQuantity: parseQuantity(variant.quantity),
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
          toast({ title: "Product saved" });
        },
        onError: (error) => {
          toast({
            title: "Could not save product",
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
            Products and images are stored in Supabase. Upload images to R2, then save to
            attach those URLs on the product.
          </p>
        </div>

        {existing.error && !isNew && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Product unavailable</AlertTitle>
            <AlertDescription>This product could not be loaded.</AlertDescription>
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
            <div className="space-y-3 md:col-span-2">
              <div className="space-y-2">
                <Label htmlFor="image-files">Product images</Label>
                <Input
                  id="image-files"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  disabled={uploading || saving}
                  onChange={(e) => {
                    handleImageFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Select up to 20 JPEG, PNG, WebP, or GIF files (10MB each). Files upload to
                  Cloudflare R2 immediately; saving the product stores those URLs in Supabase.
                </p>
                {uploading && (
                  <p className="text-xs text-muted-foreground">Uploading images…</p>
                )}
              </div>
              <div className="space-y-2 rounded-md border border-dashed p-3">
                <Label htmlFor="generate-garment">Generate on-model photo (optional)</Label>
                <Input
                  id="generate-garment"
                  type="file"
                  accept="image/jpeg,image/png"
                  disabled={generating}
                  onChange={(e) => {
                    setGenerateFile(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
                <Textarea
                  id="generate-prompt"
                  value={generatePrompt}
                  onChange={(e) => setGeneratePrompt(e.target.value)}
                  disabled={generating}
                  placeholder="Optional extra instructions (pose, studio, lighting). The original garment will be preserved."
                  className="min-h-20"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGenerateImage}
                    disabled={generating || !generateFile}
                  >
                    {generating ? (
                      <>
                        <Spinner className="mr-2" />
                        Generating…
                      </>
                    ) : (
                      "Generate on-model photo"
                    )}
                  </Button>
                  {generateFile && !generating && (
                    <p className="text-xs text-muted-foreground">
                      Ready: {generateFile.name}
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Uses the collection and age selected above. Generation is optional — you can
                  still upload product photos if it fails or is unavailable.
                </p>
                {generating && (
                  <Alert>
                    <Spinner className="h-4 w-4" />
                    <AlertTitle>Generating image</AlertTitle>
                    <AlertDescription>
                      Creating an on-model photo. This can take up to a minute. You can still
                      upload images normally while you wait.
                    </AlertDescription>
                  </Alert>
                )}
                {generateMedia.isError && !generating && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Generation failed</AlertTitle>
                    <AlertDescription>
                      {apiErrorMessage(generateMedia.error)} You can upload a product photo
                      instead.
                    </AlertDescription>
                  </Alert>
                )}
                {generateMedia.isSuccess && !generating && (
                  <p className="text-xs text-muted-foreground">
                    Generated image added below. Save the product to keep it.
                  </p>
                )}
              </div>
              {imageUrls.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {imageUrls.map((url) => (
                    <div
                      key={url}
                      className="relative h-24 w-24 overflow-hidden rounded-md border bg-secondary"
                    >
                      <img
                        src={url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-foreground shadow"
                        aria-label="Remove image"
                        onClick={() => removeImageUrl(url)}
                        disabled={uploading || saving}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Variants</CardTitle>
            <CardDescription>
              {isNew
                ? "Choose size options, set prices, and enter stock quantity."
                : "Update prices, SKUs, and stock quantity for existing variants."}
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
                  className="grid gap-3 rounded-lg border p-4 md:grid-cols-5"
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
                      placeholder="Optional original price"
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional higher price shown crossed out (sale / was price).
                    </p>
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
                      placeholder="Optional stock code"
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional stock-keeping code for warehouse / inventory tracking.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={variant.quantity}
                      onChange={(e) => {
                        const next = [...variants];
                        next[index] = { ...variant, quantity: e.target.value };
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
                    { ...EMPTY_VARIANT, optionValue: "Medium" },
                  ])
                }
              >
                Add size variant
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button onClick={save} disabled={saving || uploading || !canSave}>
            {saving && !deleteMutation.isPending
              ? "Saving…"
              : uploading
                ? "Uploading…"
                : isNew
                  ? "Create product"
                  : "Save changes"}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/products">Back to list</Link>
          </Button>
          {!isNew && (
            <Button
              variant="destructive"
              disabled={saving || uploading}
              onClick={() => {
                if (
                  !window.confirm(
                    "Delete this product permanently? Variants and images will be removed. Carts that contain it will drop those lines.",
                  )
                ) {
                  return;
                }
                deleteMutation.mutate(
                  { id: productPathId },
                  {
                    onSuccess: async () => {
                      await queryClient.invalidateQueries({
                        queryKey: getListAdminProductsQueryKey(),
                      });
                      toast({ title: "Product deleted" });
                      setLocation("/admin/products");
                    },
                    onError: (error) => {
                      toast({
                        title: "Could not delete product",
                        description: apiErrorMessage(error),
                        variant: "destructive",
                      });
                    },
                  },
                );
              }}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete product"}
            </Button>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
