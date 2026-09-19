import { supabaseRequest } from "./supabase";

type ProfileRow = {
  display_name: string | null;
  preferred_currency: string | null;
  created_at: string;
  updated_at: string;
};

type WishlistRow = {
  product_id: string;
  product_handle: string;
  created_at: string;
};

type ViewedRow = {
  product_id: string;
  product_handle: string;
  viewed_at: string;
};

const eq = (value: string) => `eq.${encodeURIComponent(value)}`;

export async function getOrCreateProfile(authUserId: string) {
  const query = `customer_profiles?auth_user_id=${eq(authUserId)}&select=display_name,preferred_currency,created_at,updated_at`;
  let rows = await supabaseRequest<ProfileRow[]>(query);
  if (!rows[0]) {
    rows = await supabaseRequest<ProfileRow[]>(
      "customer_profiles?on_conflict=auth_user_id",
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({ auth_user_id: authUserId }),
      },
    );
  }
  const row = rows[0];
  if (!row) throw new Error("Supabase did not return the customer profile");
  return {
    displayName: row.display_name,
    preferredCurrency: row.preferred_currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updateProfile(
  authUserId: string,
  input: { displayName?: string | null; preferredCurrency?: string | null },
) {
  const current = await getOrCreateProfile(authUserId);
  const [row] = await supabaseRequest<ProfileRow[]>(
    `customer_profiles?auth_user_id=${eq(authUserId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        display_name:
          "displayName" in input ? input.displayName : current.displayName,
        preferred_currency:
          "preferredCurrency" in input
            ? input.preferredCurrency
            : current.preferredCurrency,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  if (!row) throw new Error("Supabase did not return the updated customer profile");
  return {
    displayName: row.display_name,
    preferredCurrency: row.preferred_currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listWishlist(authUserId: string) {
  const rows = await supabaseRequest<WishlistRow[]>(
    `wishlist_items?auth_user_id=${eq(authUserId)}&product_id=not.is.null&select=product_id,product_handle,created_at&order=created_at.desc`,
  );
  return rows.map((row) => ({
    productId: row.product_id,
    productHandle: row.product_handle,
    createdAt: row.created_at,
  }));
}

export async function saveWishlist(
  authUserId: string,
  input: { productId: string; productHandle: string },
) {
  const [row] = await supabaseRequest<WishlistRow[]>(
    "wishlist_items?on_conflict=auth_user_id,product_id",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        auth_user_id: authUserId,
        product_id: input.productId,
        product_handle: input.productHandle,
      }),
    },
  );
  if (!row) throw new Error("Supabase did not return the saved wishlist item");
  return {
    productId: row.product_id,
    productHandle: row.product_handle,
    createdAt: row.created_at,
  };
}

export async function deleteWishlist(authUserId: string, productId: string) {
  await supabaseRequest<void>(
    `wishlist_items?auth_user_id=${eq(authUserId)}&product_id=${eq(productId)}`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } },
  );
}

export async function listRecentlyViewed(authUserId: string) {
  const rows = await supabaseRequest<ViewedRow[]>(
    `recently_viewed_items?auth_user_id=${eq(authUserId)}&product_id=not.is.null&select=product_id,product_handle,viewed_at&order=viewed_at.desc`,
  );
  return rows.map((row) => ({
    productId: row.product_id,
    productHandle: row.product_handle,
    viewedAt: row.viewed_at,
  }));
}

export async function saveRecentlyViewed(
  authUserId: string,
  input: { productId: string; productHandle: string },
) {
  const [row] = await supabaseRequest<ViewedRow[]>(
    "recently_viewed_items?on_conflict=auth_user_id,product_id",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        auth_user_id: authUserId,
        product_id: input.productId,
        product_handle: input.productHandle,
        viewed_at: new Date().toISOString(),
      }),
    },
  );
  if (!row) throw new Error("Supabase did not return the recently viewed item");
  return {
    productId: row.product_id,
    productHandle: row.product_handle,
    viewedAt: row.viewed_at,
  };
}
