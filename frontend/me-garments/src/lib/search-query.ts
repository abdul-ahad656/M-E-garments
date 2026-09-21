import type { SearchProductsParams } from "@workspace/api-client-react";

/** Canonical tokens the catalog already uses as tags / facets. */
const COLLECTION_ALIASES: Record<string, string> = {
  boy: "boys",
  boys: "boys",
  girl: "girls",
  girls: "girls",
  sale: "sale",
  "best-seller": "best_seller",
  "best-sellers": "best_seller",
  bestseller: "best_seller",
  bestsellers: "best_seller",
  new: "new",
};

const AGE_ALIASES: Record<string, string> = {
  toddler: "toddler",
  toddlers: "toddler",
  baby: "toddler",
  babies: "toddler",
  infant: "toddler",
  infants: "toddler",
  "0-2": "toddler",
  "1-3": "toddler",
  "2-3": "toddler",
  kids: "kids",
  kid: "kids",
  children: "kids",
  child: "kids",
  "4-8": "kids",
  "4-10": "kids",
  "5-12": "kids",
  "6-12": "kids",
};

const OCCASION_ALIASES: Record<string, string> = {
  party: "party",
  partywear: "party",
  wedding: "party",
  festive: "party",
};

const SEASON_ALIASES: Record<string, string> = {
  summer: "summer",
  winter: "winter",
  spring: "spring",
  autumn: "autumn",
  fall: "autumn",
  "year-round": "year-round",
  yearround: "year-round",
};

/** Garment type words kept in free-text so they match title, type, and tags. */
const TYPE_WORDS = new Set([
  "casual",
  "formal",
  "cotton",
  "linen",
  "shirt",
  "shirts",
  "dress",
  "dresses",
  "set",
  "sets",
  "pant",
  "pants",
  "trouser",
  "trousers",
  "kurta",
  "kurtas",
  "frock",
  "frocks",
  "top",
  "tops",
  "bottom",
  "bottoms",
]);

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "for",
  "and",
  "or",
  "of",
  "in",
  "on",
  "to",
  "with",
  "wear",
  "wears",
  "clothes",
  "clothing",
  "outfit",
  "outfits",
  "collection",
  "me",
  "my",
  "please",
  "find",
  "show",
  "looking",
]);

export type ParsedSearchQuery = SearchProductsParams & {
  /** Original trimmed input */
  raw: string;
};

/**
 * Turn a natural phrase like "boys toddler summer shirts" into API search params.
 * Gender → collection, age phrases → age, party → occasion; season/type stay in query.
 */
export function parseSearchQuery(
  input: string,
  limit = 24,
): ParsedSearchQuery {
  const raw = input.trim();
  if (!raw) return { raw, limit };

  const tokens = raw
    .toLowerCase()
    .replace(/[^\w\s-/]/g, " ")
    .split(/[\s/]+/)
    .filter(Boolean);

  let collection: string | undefined;
  let age: string | undefined;
  let occasion: string | undefined;
  const remaining: string[] = [];

  for (const token of tokens) {
    if (STOP_WORDS.has(token)) continue;

    const coll = COLLECTION_ALIASES[token];
    if (coll && !collection) {
      collection = coll;
      continue;
    }

    const ageVal = AGE_ALIASES[token];
    if (ageVal && !age) {
      age = ageVal;
      continue;
    }

    const occ = OCCASION_ALIASES[token];
    if (occ && !occasion) {
      occasion = occ;
      continue;
    }

    const seasonVal = SEASON_ALIASES[token];
    if (seasonVal) {
      remaining.push(seasonVal);
      continue;
    }

    if (TYPE_WORDS.has(token) || token.length > 1) {
      remaining.push(token);
    }
  }

  // Multi-word age: "years old" leftovers aren't useful alone
  const query = remaining
    .filter((t) => t !== "year" && t !== "years" && t !== "old")
    .join(" ")
    .trim();

  return {
    raw,
    limit,
    ...(query ? { query } : {}),
    ...(collection ? { collection } : {}),
    ...(age ? { age } : {}),
    ...(occasion ? { occasion } : {}),
  };
}

export function hasSearchCriteria(params: ParsedSearchQuery): boolean {
  return Boolean(
    params.query || params.collection || params.age || params.occasion,
  );
}
