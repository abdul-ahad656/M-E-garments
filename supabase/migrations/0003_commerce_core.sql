-- M&E Garments commerce core (Supabase is system of record).
-- Image file bytes live in Cloudflare R2; public URLs are stored on product_images.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique,
  title text not null,
  description_html text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'active', 'archived')),
  product_type text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_status_updated_idx
  on public.products (status, updated_at desc);

create table if not exists public.product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  position int not null default 0,
  unique (product_id, name)
);

create index if not exists product_options_product_idx
  on public.product_options (product_id, position);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  title text not null,
  sku text,
  price numeric(12, 2) not null check (price >= 0),
  compare_at_price numeric(12, 2) check (compare_at_price is null or compare_at_price >= 0),
  option_values jsonb not null default '[]'::jsonb,
  inventory_quantity int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_variants_product_idx
  on public.product_variants (product_id);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  alt_text text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists product_images_product_idx
  on public.product_images (product_id, position);

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text,
  currency text not null default 'PKR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists carts_clerk_user_idx
  on public.carts (clerk_user_id);

create table if not exists public.cart_lines (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity int not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);

create index if not exists cart_lines_cart_idx
  on public.cart_lines (cart_id);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  clerk_user_id text not null,
  email text not null,
  status text not null default 'open'
    check (status in ('open', 'fulfilled', 'cancelled')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid', 'refunded')),
  currency text not null default 'PKR',
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  total numeric(12, 2) not null check (total >= 0),
  shipping_address jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_clerk_user_created_idx
  on public.orders (clerk_user_id, created_at desc);

create index if not exists orders_status_created_idx
  on public.orders (status, created_at desc);

create table if not exists public.order_line_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_title text not null,
  variant_title text not null,
  quantity int not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  created_at timestamptz not null default now()
);

create index if not exists order_line_items_order_idx
  on public.order_line_items (order_id);

-- Wishlist / recently viewed: shopify_product_id → product_id (uuid text-compatible during transition)
alter table public.wishlist_items
  add column if not exists product_id uuid;

alter table public.recently_viewed_items
  add column if not exists product_id uuid;

-- Prefer product_id going forward; keep shopify_product_id nullable for legacy rows
alter table public.wishlist_items
  alter column shopify_product_id drop not null;

alter table public.recently_viewed_items
  alter column shopify_product_id drop not null;

create unique index if not exists wishlist_items_user_product_uidx
  on public.wishlist_items (auth_user_id, product_id)
  where product_id is not null;

create unique index if not exists recently_viewed_user_product_uidx
  on public.recently_viewed_items (auth_user_id, product_id)
  where product_id is not null;

alter table public.products enable row level security;
alter table public.product_options enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.carts enable row level security;
alter table public.cart_lines enable row level security;
alter table public.orders enable row level security;
alter table public.order_line_items enable row level security;

-- API server uses service-role; no anon policies.
