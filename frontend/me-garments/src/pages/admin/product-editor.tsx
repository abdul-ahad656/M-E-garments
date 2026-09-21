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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { isLowStock, LOW_STOCK_THRESHOLD } from "@/lib/inventory-alerts";
import { AdminLayout } from "./layout";

type VariantDraft = {
  id?: string;
  optionValue: string;
  price: string;
  compareAtPrice: string;
  sku: string;
  quantity: string;
};

/** Storefront category pages match these product tags. */
type GenderOption = "" | "boys" | "girls" | "both";
type AgeOption = "" | "toddler" | "kids" | "both";
type SeasonOption = "" | "summer" | "winter" | "spring" | "autumn" | "year-round";

const GENDER_TAGS = new Set(["boys", "girls"]);
const AGE_TAGS = new Set(["toddler", "kids"]);
const OCCASION_TAGS = new Set(["party", "partywear"]);
const MERCH_TAGS = new Set(["best_seller", "sale"]);
const SEASON_TAGS = new Set(["summer", "winter", "spring", "autumn", "year-round"]);

const PRODUCT_TYPE_OPTIONS = [
  "Tops",
  "Bottoms",
  "Dresses",
  "Sets",
  "Shirts",
  "Pants",
  "Kurtas",
  "Frocks",
  "Outerwear",
  "Ethnic",
  "Sleepwear",
  "Accessories",
] as const;

const OTHER_TAG_OPTIONS = [
  "new",
  "limited",
  "featured",
  "exclusive",
  "organic",
  "cotton",
  "linen",
] as const;

const SIZE_OPTIONS = [
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

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

function isManagedTag(tag: string): boolean {
  const normalized = normalizeTag(tag);
  return (
    GENDER_TAGS.has(normalized) ||
    AGE_TAGS.has(normalized) ||
    OCCASION_TAGS.has(normalized) ||
    MERCH_TAGS.has(normalized) ||
    SEASON_TAGS.has(normalized)
  );
}

function parseMoney(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function formatMoney(value: number): string {
  return value.toFixed(2);
}

/** Prefer compare-at when already on sale; otherwise the current selling price. */
function originalPriceOf(variant: VariantDraft): number {
  const compare = parseMoney(variant.compareAtPrice);
  const price = parseMoney(variant.price);
  if (compare > price && compare > 0) return compare;
  return price;
}

function applySalePercentToVariants(
  drafts: VariantDraft[],
  percent: number,
): VariantDraft[] {
  const clamped = Math.min(100, Math.max(0, percent));
  return drafts.map((variant) => {
    const original = originalPriceOf(variant);
    const discounted = original * (1 - clamped / 100);
    return {
      ...variant,
      compareAtPrice: formatMoney(original),
      price: formatMoney(discounted),
    };
  });
}

function clearSaleFromVariants(drafts: VariantDraft[]): VariantDraft[] {
  return drafts.map((variant) => ({
    ...variant,
    price: formatMoney(originalPriceOf(variant)),
    compareAtPrice: "",
  }));
}

function deriveSalePercent(drafts: VariantDraft[]): string {
  for (const variant of drafts) {
    const compare = parseMoney(variant.compareAtPrice);
    const price = parseMoney(variant.price);
    if (compare > price && compare > 0) {
      return String(Math.round((1 - price / compare) * 100));
    }
  }
  return "";
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

function seasonFromTags(tags: string[]): SeasonOption {
  const normalized = tags.map(normalizeTag);
  if (normalized.includes("year-round")) return "year-round";
  if (normalized.includes("summer")) return "summer";
  if (normalized.includes("winter")) return "winter";
  if (normalized.includes("spring")) return "spring";
  if (normalized.includes("autumn")) return "autumn";
  return "";
}

function isPartywearFromTags(tags: string[]): boolean {
  return tags.some((tag) => OCCASION_TAGS.has(normalizeTag(tag)));
}

function hasMerchTag(tags: string[], merchTag: "best_seller" | "sale"): boolean {
  return tags.some((tag) => normalizeTag(tag) === merchTag);
}

function applyCategoryTags(
  freeformTags: string[],
  gender: GenderOption,
  age: AgeOption,
  season: SeasonOption,
  partywear: boolean,
  bestSeller: boolean,
  onSale: boolean,
): string[] {
  const tags = freeformTags.filter((tag) => !isManagedTag(tag));

  if (gender === "boys") tags.push("boys");
  if (gender === "girls") tags.push("girls");
  if (gender === "both") tags.push("boys", "girls");

  if (age === "toddler") tags.push("toddler");
  if (age === "kids") tags.push("kids");
  if (age === "both") tags.push("toddler", "kids");

  if (season === "summer") tags.push("summer");
  if (season === "winter") tags.push("winter");
  if (season === "spring") tags.push("spring");
  if (season === "autumn") tags.push("autumn");
  if (season === "year-round") tags.push("year-round");

  if (partywear) tags.push("party");
  if (bestSeller) tags.push("best_seller");
  if (onSale) tags.push("sale");

  return tags;
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
  const [season, setSeason] = useState<SeasonOption>("");
  const [partywear, setPartywear] = useState(false);
  const [bestSeller, setBestSeller] = useState(false);
  const [onSale, setOnSale] = useState(false);
  const [salePercent, setSalePercent] = useState("");
  const [otherTags, setOtherTags] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [productImageNames, setProductImageNames] = useState("");
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
    setSeason("");
    setPartywear(false);
    setBestSeller(false);
    setOnSale(false);
    setSalePercent("");
    setOtherTags([]);
    setImageUrls([]);
    setProductImageNames("");
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
    setSeason(seasonFromTags(existing.data.tags));
    setPartywear(isPartywearFromTags(existing.data.tags));
    setBestSeller(hasMerchTag(existing.data.tags, "best_seller"));
    const mappedVariants = existing.data.variants.map((variant) => ({
      id: variant.id,
      optionValue: variant.selectedOptions[0]?.value ?? variant.title,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice ?? "",
      sku: variant.sku ?? "",
      quantity: String(variant.inventoryQuantity ?? 0),
    }));
    const derivedPercent = deriveSalePercent(mappedVariants);
    const saleTagged = hasMerchTag(existing.data.tags, "sale");
    setOnSale(saleTagged || Boolean(derivedPercent));
    setSalePercent(derivedPercent);
    setOtherTags(
      existing.data.tags
        .filter((tag) => !isManagedTag(tag))
        .map((tag) => normalizeTag(tag)),
    );
    setImageUrls(existing.data.images.map((image) => image.url));
    setVariants(mappedVariants);
  }, [existing.data]);

  const saving =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const uploading = uploadMedia.isPending;
  const generating = generateMedia.isPending;
  const canSave = Boolean(title.trim()) && Boolean(gender) && Boolean(age);

  const handleImageFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const files = Array.from(fileList);
    setProductImageNames(files.map((file) => file.name).join(", "));
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
      otherTags,
      gender,
      age,
      season,
      partywear,
      bestSeller,
      onSale,
    );

    if (onSale) {
      const percent = Number.parseFloat(salePercent);
      if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
        toast({
          title: "Sale percentage required",
          description: "Enter a sale percentage between 1 and 100.",
          variant: "destructive",
        });
        return;
      }
    }

    const saleAppliedVariants = onSale
      ? applySalePercentToVariants(variants, Number.parseFloat(salePercent))
      : variants;

    const lowStockVariants = saleAppliedVariants.filter((variant) =>
      isLowStock(parseQuantity(variant.quantity)),
    );

    const notifyLowStockIfNeeded = () => {
      if (lowStockVariants.length === 0) return;
      toast({
        title: `Low stock alert (≤${LOW_STOCK_THRESHOLD})`,
        description: `${lowStockVariants.length} size variant${
          lowStockVariants.length === 1 ? "" : "s"
        } at or below ${LOW_STOCK_THRESHOLD} units.`,
        variant: "destructive",
      });
    };

    if (isNew) {
      createMutation.mutate(
        {
          data: {
            title,
            descriptionHtml,
            status,
            productType,
            tags: parsedTags,
            optionName: "Size",
            imageUrls,
            variants: saleAppliedVariants.map((variant) => ({
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
            notifyLowStockIfNeeded();
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
          variants: saleAppliedVariants
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
          notifyLowStockIfNeeded();
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
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                className={selectClassName}
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
              <select
                id="type"
                className={selectClassName}
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
              >
                <option value="" disabled>
                  Select product type…
                </option>
                {PRODUCT_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
                {productType &&
                  !PRODUCT_TYPE_OPTIONS.includes(
                    productType as (typeof PRODUCT_TYPE_OPTIONS)[number],
                  ) && <option value={productType}>{productType}</option>}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Collection (Boy / Girl)</Label>
              <select
                id="gender"
                className={selectClassName}
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
                className={selectClassName}
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
            <div className="space-y-2">
              <Label htmlFor="season">Season</Label>
              <select
                id="season"
                className={selectClassName}
                value={season}
                onChange={(e) => setSeason(e.target.value as SeasonOption)}
              >
                <option value="">Select season…</option>
                <option value="summer">Summer</option>
                <option value="winter">Winter</option>
                <option value="spring">Spring</option>
                <option value="autumn">Autumn</option>
                <option value="year-round">Year-round</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Helps shoppers find products by season in search.
              </p>
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
            <div className="space-y-4 rounded-lg border p-4 md:col-span-2">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="best-seller">Best Seller</Label>
                  <p className="text-xs text-muted-foreground">
                    Shows on the Best Sellers page and as a product badge.
                  </p>
                </div>
                <Switch
                  id="best-seller"
                  checked={bestSeller}
                  onCheckedChange={setBestSeller}
                />
              </div>
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="on-sale">Sale</Label>
                    <p className="text-xs text-muted-foreground">
                      Apply a percentage off the product price. Shoppers see the original and sale
                      prices.
                    </p>
                  </div>
                  <Switch
                    id="on-sale"
                    checked={onSale}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setOnSale(true);
                        if (!salePercent) setSalePercent("10");
                        const percent = Number.parseFloat(salePercent || "10");
                        if (Number.isFinite(percent) && percent > 0) {
                          setVariants((prev) => applySalePercentToVariants(prev, percent));
                        }
                      } else {
                        setOnSale(false);
                        setSalePercent("");
                        setVariants((prev) => clearSaleFromVariants(prev));
                      }
                    }}
                  />
                </div>
                {onSale && (
                  <div className="grid gap-3 sm:grid-cols-[10rem_1fr] sm:items-end">
                    <div className="space-y-2">
                      <Label htmlFor="sale-percent">Discount %</Label>
                      <Input
                        id="sale-percent"
                        type="number"
                        min={1}
                        max={100}
                        step={1}
                        value={salePercent}
                        onChange={(e) => {
                          const nextPercent = e.target.value;
                          setSalePercent(nextPercent);
                          const percent = Number.parseFloat(nextPercent);
                          if (Number.isFinite(percent) && percent > 0 && percent <= 100) {
                            setVariants((prev) => applySalePercentToVariants(prev, percent));
                          }
                        }}
                        placeholder="e.g. 20"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground pb-2">
                      Enter how much percent off. Variant prices update automatically — original
                      price is crossed out on the storefront, sale price is shown as the new price.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="other-tags">Other tags</Label>
              <select
                id="other-tags"
                className={selectClassName}
                value=""
                onChange={(e) => {
                  const next = normalizeTag(e.target.value);
                  if (!next) return;
                  setOtherTags((prev) =>
                    prev.includes(next) ? prev : [...prev, next],
                  );
                }}
              >
                <option value="">Add a tag…</option>
                {OTHER_TAG_OPTIONS.filter((tag) => !otherTags.includes(tag)).map(
                  (tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ),
                )}
                {otherTags
                  .filter(
                    (tag) =>
                      !OTHER_TAG_OPTIONS.includes(
                        tag as (typeof OTHER_TAG_OPTIONS)[number],
                      ),
                  )
                  .map((tag) => (
                    <option key={tag} value={tag} disabled>
                      {tag} (selected)
                    </option>
                  ))}
              </select>
              {otherTags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {otherTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full border bg-secondary px-2.5 py-1 text-xs font-medium"
                      onClick={() =>
                        setOtherTags((prev) => prev.filter((t) => t !== tag))
                      }
                    >
                      {tag}
                      <X className="h-3 w-3" />
                      <span className="sr-only">Remove {tag}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-3 md:col-span-2">
              <div className="space-y-2">
                <Label htmlFor="image-files">Product images</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="outline" asChild>
                    <label htmlFor="image-files" className="cursor-pointer">
                      Choose files
                    </label>
                  </Button>
                  <input
                    id="image-files"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    className="sr-only"
                    disabled={uploading || saving}
                    onChange={(e) => {
                      handleImageFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <span className="text-sm text-muted-foreground">
                    {productImageNames || "No file chosen"}
                  </span>
                </div>
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
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="outline" asChild>
                    <label htmlFor="generate-garment" className="cursor-pointer">
                      Choose file
                    </label>
                  </Button>
                  <input
                    id="generate-garment"
                    type="file"
                    accept="image/jpeg,image/png"
                    className="sr-only"
                    disabled={generating}
                    onChange={(e) => {
                      setGenerateFile(e.target.files?.[0] ?? null);
                      e.target.value = "";
                    }}
                  />
                  <span className="text-sm text-muted-foreground">
                    {generateFile?.name || "No file chosen"}
                  </span>
                </div>
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
                : "Update prices, product IDs, and stock quantity for existing variants."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {variants.map((variant, index) => (
              <div
                key={variant.id ?? index}
                className={`grid gap-3 rounded-lg border p-4 ${
                  onSale ? "md:grid-cols-5" : "md:grid-cols-4"
                }`}
              >
                <div className="space-y-2">
                  <Label htmlFor={`size-${index}`}>Size</Label>
                  {isNew ? (
                    <select
                      id={`size-${index}`}
                      className={selectClassName}
                      value={variant.optionValue}
                      onChange={(e) => {
                        const next = [...variants];
                        next[index] = {
                          ...variant,
                          optionValue: e.target.value,
                        };
                        setVariants(next);
                      }}
                    >
                      <option value="" disabled>
                        Select size…
                      </option>
                      {SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                      {variant.optionValue &&
                        !SIZE_OPTIONS.includes(
                          variant.optionValue as (typeof SIZE_OPTIONS)[number],
                        ) && (
                          <option value={variant.optionValue}>
                            {variant.optionValue}
                          </option>
                        )}
                    </select>
                  ) : (
                    <Input id={`size-${index}`} value={variant.optionValue} disabled />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{onSale ? "Original price" : "Price"}</Label>
                  <Input
                    value={onSale ? variant.compareAtPrice || variant.price : variant.price}
                    onChange={(e) => {
                      const next = [...variants];
                      if (onSale) {
                        const original = parseMoney(e.target.value);
                        const percent = Number.parseFloat(salePercent);
                        const clamped =
                          Number.isFinite(percent) && percent > 0 && percent <= 100
                            ? percent
                            : 0;
                        next[index] = {
                          ...variant,
                          compareAtPrice: formatMoney(original),
                          price: formatMoney(original * (1 - clamped / 100)),
                        };
                      } else {
                        next[index] = { ...variant, price: e.target.value };
                      }
                      setVariants(next);
                    }}
                  />
                </div>
                {onSale && (
                  <div className="space-y-2">
                    <Label>Sale price</Label>
                    <Input value={variant.price} readOnly disabled />
                    <p className="text-xs text-muted-foreground">
                      {salePercent
                        ? `${salePercent}% off — storefront shows original crossed out and this sale price.`
                        : "Enter a discount % above to calculate the sale price."}
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor={`product-id-${index}`}>Product ID</Label>
                  <Input
                    id={`product-id-${index}`}
                    value={variant.sku}
                    onChange={(e) => {
                      const next = [...variants];
                      next[index] = { ...variant, sku: e.target.value };
                      setVariants(next);
                    }}
                    placeholder="Optional product ID"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional ID for warehouse / inventory tracking.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`qty-${index}`}>Quantity</Label>
                  <Input
                    id={`qty-${index}`}
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
            ))}
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
