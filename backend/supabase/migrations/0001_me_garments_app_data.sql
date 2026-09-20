-- M&E Garments application data.
-- Shopify remains the source of truth for commerce records.

create extension if not exists pgcrypto;

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null unique,
  display_name text,
  preferred_currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  created_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists wishlist_items_user_created_idx
  on public.wishlist_items (auth_user_id, created_at desc);

create table if not exists public.recently_viewed_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  viewed_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists recently_viewed_user_time_idx
  on public.recently_viewed_items (auth_user_id, viewed_at desc);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text,
  session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (auth_user_id is not null or session_id is not null)
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  grounded_shopify_product_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_time_idx
  on public.ai_messages (conversation_id, created_at);

create table if not exists public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content_markdown text not null,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_sync_state (
  key text primary key,
  last_synced_at timestamptz,
  cursor text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  auth_user_id text,
  session_id text,
  path text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_name_time_idx
  on public.analytics_events (event_name, created_at desc);

alter table public.customer_profiles enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.recently_viewed_items enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.policy_documents enable row level security;
alter table public.catalog_sync_state enable row level security;
alter table public.analytics_events enable row level security;

-- The API server should connect with a service-role connection. No anon
-- policies are created here; customer authorization is enforced server-side.-- M&E Garments application data.
-- Shopify remains the source of truth for commerce records.

create extension if not exists pgcrypto;

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null unique,
  display_name text,
  preferred_currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  created_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists wishlist_items_user_created_idx
  on public.wishlist_items (auth_user_id, created_at desc);

create table if not exists public.recently_viewed_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  viewed_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists recently_viewed_user_time_idx
  on public.recently_viewed_items (auth_user_id, viewed_at desc);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text,
  session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (auth_user_id is not null or session_id is not null)
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  grounded_shopify_product_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_time_idx
  on public.ai_messages (conversation_id, created_at);

create table if not exists public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content_markdown text not null,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_sync_state (
  key text primary key,
  last_synced_at timestamptz,
  cursor text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  auth_user_id text,
  session_id text,
  path text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_name_time_idx
  on public.analytics_events (event_name, created_at desc);

alter table public.customer_profiles enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.recently_viewed_items enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.policy_documents enable row level security;
alter table public.catalog_sync_state enable row level security;
alter table public.analytics_events enable row level security;

-- The API server should connect with a service-role connection. No anon
-- policies are created here; customer authorization is enforced server-side.-- M&E Garments application data.
-- Shopify remains the source of truth for commerce records.

create extension if not exists pgcrypto;

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null unique,
  display_name text,
  preferred_currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  created_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists wishlist_items_user_created_idx
  on public.wishlist_items (auth_user_id, created_at desc);

create table if not exists public.recently_viewed_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  viewed_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists recently_viewed_user_time_idx
  on public.recently_viewed_items (auth_user_id, viewed_at desc);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text,
  session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (auth_user_id is not null or session_id is not null)
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  grounded_shopify_product_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_time_idx
  on public.ai_messages (conversation_id, created_at);

create table if not exists public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content_markdown text not null,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_sync_state (
  key text primary key,
  last_synced_at timestamptz,
  cursor text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  auth_user_id text,
  session_id text,
  path text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_name_time_idx
  on public.analytics_events (event_name, created_at desc);

alter table public.customer_profiles enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.recently_viewed_items enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.policy_documents enable row level security;
alter table public.catalog_sync_state enable row level security;
alter table public.analytics_events enable row level security;

-- The API server should connect with a service-role connection. No anon
-- policies are created here; customer authorization is enforced server-side.-- M&E Garments application data.
-- Shopify remains the source of truth for commerce records.

create extension if not exists pgcrypto;

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null unique,
  display_name text,
  preferred_currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  created_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists wishlist_items_user_created_idx
  on public.wishlist_items (auth_user_id, created_at desc);

create table if not exists public.recently_viewed_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  viewed_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists recently_viewed_user_time_idx
  on public.recently_viewed_items (auth_user_id, viewed_at desc);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text,
  session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (auth_user_id is not null or session_id is not null)
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  grounded_shopify_product_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_time_idx
  on public.ai_messages (conversation_id, created_at);

create table if not exists public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content_markdown text not null,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_sync_state (
  key text primary key,
  last_synced_at timestamptz,
  cursor text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  auth_user_id text,
  session_id text,
  path text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_name_time_idx
  on public.analytics_events (event_name, created_at desc);

alter table public.customer_profiles enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.recently_viewed_items enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.policy_documents enable row level security;
alter table public.catalog_sync_state enable row level security;
alter table public.analytics_events enable row level security;

-- The API server should connect with a service-role connection. No anon
-- policies are created here; customer authorization is enforced server-side.-- M&E Garments application data.
-- Shopify remains the source of truth for commerce records.

create extension if not exists pgcrypto;

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null unique,
  display_name text,
  preferred_currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  created_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists wishlist_items_user_created_idx
  on public.wishlist_items (auth_user_id, created_at desc);

create table if not exists public.recently_viewed_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  viewed_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists recently_viewed_user_time_idx
  on public.recently_viewed_items (auth_user_id, viewed_at desc);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text,
  session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (auth_user_id is not null or session_id is not null)
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  grounded_shopify_product_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_time_idx
  on public.ai_messages (conversation_id, created_at);

create table if not exists public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content_markdown text not null,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_sync_state (
  key text primary key,
  last_synced_at timestamptz,
  cursor text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  auth_user_id text,
  session_id text,
  path text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_name_time_idx
  on public.analytics_events (event_name, created_at desc);

alter table public.customer_profiles enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.recently_viewed_items enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.policy_documents enable row level security;
alter table public.catalog_sync_state enable row level security;
alter table public.analytics_events enable row level security;

-- The API server should connect with a service-role connection. No anon
-- policies are created here; customer authorization is enforced server-side.-- M&E Garments application data.
-- Shopify remains the source of truth for commerce records.

create extension if not exists pgcrypto;

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null unique,
  display_name text,
  preferred_currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  created_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists wishlist_items_user_created_idx
  on public.wishlist_items (auth_user_id, created_at desc);

create table if not exists public.recently_viewed_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  viewed_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists recently_viewed_user_time_idx
  on public.recently_viewed_items (auth_user_id, viewed_at desc);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text,
  session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (auth_user_id is not null or session_id is not null)
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  grounded_shopify_product_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_time_idx
  on public.ai_messages (conversation_id, created_at);

create table if not exists public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content_markdown text not null,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_sync_state (
  key text primary key,
  last_synced_at timestamptz,
  cursor text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  auth_user_id text,
  session_id text,
  path text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_name_time_idx
  on public.analytics_events (event_name, created_at desc);

alter table public.customer_profiles enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.recently_viewed_items enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.policy_documents enable row level security;
alter table public.catalog_sync_state enable row level security;
alter table public.analytics_events enable row level security;

-- The API server should connect with a service-role connection. No anon
-- policies are created here; customer authorization is enforced server-side.-- M&E Garments application data.
-- Shopify remains the source of truth for commerce records.

create extension if not exists pgcrypto;

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null unique,
  display_name text,
  preferred_currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  created_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists wishlist_items_user_created_idx
  on public.wishlist_items (auth_user_id, created_at desc);

create table if not exists public.recently_viewed_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  viewed_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists recently_viewed_user_time_idx
  on public.recently_viewed_items (auth_user_id, viewed_at desc);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text,
  session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (auth_user_id is not null or session_id is not null)
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  grounded_shopify_product_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_time_idx
  on public.ai_messages (conversation_id, created_at);

create table if not exists public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content_markdown text not null,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_sync_state (
  key text primary key,
  last_synced_at timestamptz,
  cursor text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  auth_user_id text,
  session_id text,
  path text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_name_time_idx
  on public.analytics_events (event_name, created_at desc);

alter table public.customer_profiles enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.recently_viewed_items enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.policy_documents enable row level security;
alter table public.catalog_sync_state enable row level security;
alter table public.analytics_events enable row level security;

-- The API server should connect with a service-role connection. No anon
-- policies are created here; customer authorization is enforced server-side.-- M&E Garments application data.
-- Shopify remains the source of truth for commerce records.

create extension if not exists pgcrypto;

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null unique,
  display_name text,
  preferred_currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  created_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists wishlist_items_user_created_idx
  on public.wishlist_items (auth_user_id, created_at desc);

create table if not exists public.recently_viewed_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  viewed_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists recently_viewed_user_time_idx
  on public.recently_viewed_items (auth_user_id, viewed_at desc);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text,
  session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (auth_user_id is not null or session_id is not null)
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  grounded_shopify_product_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_time_idx
  on public.ai_messages (conversation_id, created_at);

create table if not exists public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content_markdown text not null,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_sync_state (
  key text primary key,
  last_synced_at timestamptz,
  cursor text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  auth_user_id text,
  session_id text,
  path text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_name_time_idx
  on public.analytics_events (event_name, created_at desc);

alter table public.customer_profiles enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.recently_viewed_items enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.policy_documents enable row level security;
alter table public.catalog_sync_state enable row level security;
alter table public.analytics_events enable row level security;

-- The API server should connect with a service-role connection. No anon
-- policies are created here; customer authorization is enforced server-side.-- M&E Garments application data.
-- Shopify remains the source of truth for commerce records.

create extension if not exists pgcrypto;

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null unique,
  display_name text,
  preferred_currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  created_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists wishlist_items_user_created_idx
  on public.wishlist_items (auth_user_id, created_at desc);

create table if not exists public.recently_viewed_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  viewed_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists recently_viewed_user_time_idx
  on public.recently_viewed_items (auth_user_id, viewed_at desc);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text,
  session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (auth_user_id is not null or session_id is not null)
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  grounded_shopify_product_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_time_idx
  on public.ai_messages (conversation_id, created_at);

create table if not exists public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content_markdown text not null,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_sync_state (
  key text primary key,
  last_synced_at timestamptz,
  cursor text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  auth_user_id text,
  session_id text,
  path text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_name_time_idx
  on public.analytics_events (event_name, created_at desc);

alter table public.customer_profiles enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.recently_viewed_items enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.policy_documents enable row level security;
alter table public.catalog_sync_state enable row level security;
alter table public.analytics_events enable row level security;

-- The API server should connect with a service-role connection. No anon
-- policies are created here; customer authorization is enforced server-side.-- M&E Garments application data.
-- Shopify remains the source of truth for commerce records.

create extension if not exists pgcrypto;

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null unique,
  display_name text,
  preferred_currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  created_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists wishlist_items_user_created_idx
  on public.wishlist_items (auth_user_id, created_at desc);

create table if not exists public.recently_viewed_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  viewed_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists recently_viewed_user_time_idx
  on public.recently_viewed_items (auth_user_id, viewed_at desc);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text,
  session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (auth_user_id is not null or session_id is not null)
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  grounded_shopify_product_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_time_idx
  on public.ai_messages (conversation_id, created_at);

create table if not exists public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content_markdown text not null,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_sync_state (
  key text primary key,
  last_synced_at timestamptz,
  cursor text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  auth_user_id text,
  session_id text,
  path text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_name_time_idx
  on public.analytics_events (event_name, created_at desc);

alter table public.customer_profiles enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.recently_viewed_items enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.policy_documents enable row level security;
alter table public.catalog_sync_state enable row level security;
alter table public.analytics_events enable row level security;

-- The API server should connect with a service-role connection. No anon
-- policies are created here; customer authorization is enforced server-side.-- M&E Garments application data.
-- Shopify remains the source of truth for commerce records.

create extension if not exists pgcrypto;

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null unique,
  display_name text,
  preferred_currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  created_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists wishlist_items_user_created_idx
  on public.wishlist_items (auth_user_id, created_at desc);

create table if not exists public.recently_viewed_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  viewed_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists recently_viewed_user_time_idx
  on public.recently_viewed_items (auth_user_id, viewed_at desc);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text,
  session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (auth_user_id is not null or session_id is not null)
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  grounded_shopify_product_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_time_idx
  on public.ai_messages (conversation_id, created_at);

create table if not exists public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content_markdown text not null,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_sync_state (
  key text primary key,
  last_synced_at timestamptz,
  cursor text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  auth_user_id text,
  session_id text,
  path text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_name_time_idx
  on public.analytics_events (event_name, created_at desc);

alter table public.customer_profiles enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.recently_viewed_items enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.policy_documents enable row level security;
alter table public.catalog_sync_state enable row level security;
alter table public.analytics_events enable row level security;

-- The API server should connect with a service-role connection. No anon
-- policies are created here; customer authorization is enforced server-side.-- M&E Garments application data.
-- Shopify remains the source of truth for commerce records.

create extension if not exists pgcrypto;

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null unique,
  display_name text,
  preferred_currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  created_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists wishlist_items_user_created_idx
  on public.wishlist_items (auth_user_id, created_at desc);

create table if not exists public.recently_viewed_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  viewed_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists recently_viewed_user_time_idx
  on public.recently_viewed_items (auth_user_id, viewed_at desc);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text,
  session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (auth_user_id is not null or session_id is not null)
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  grounded_shopify_product_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_time_idx
  on public.ai_messages (conversation_id, created_at);

create table if not exists public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content_markdown text not null,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_sync_state (
  key text primary key,
  last_synced_at timestamptz,
  cursor text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  auth_user_id text,
  session_id text,
  path text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_name_time_idx
  on public.analytics_events (event_name, created_at desc);

alter table public.customer_profiles enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.recently_viewed_items enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.policy_documents enable row level security;
alter table public.catalog_sync_state enable row level security;
alter table public.analytics_events enable row level security;

-- The API server should connect with a service-role connection. No anon
-- policies are created here; customer authorization is enforced server-side.-- M&E Garments application data.
-- Shopify remains the source of truth for commerce records.

create extension if not exists pgcrypto;

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null unique,
  display_name text,
  preferred_currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  created_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists wishlist_items_user_created_idx
  on public.wishlist_items (auth_user_id, created_at desc);

create table if not exists public.recently_viewed_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  viewed_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists recently_viewed_user_time_idx
  on public.recently_viewed_items (auth_user_id, viewed_at desc);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text,
  session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (auth_user_id is not null or session_id is not null)
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  grounded_shopify_product_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_time_idx
  on public.ai_messages (conversation_id, created_at);

create table if not exists public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content_markdown text not null,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_sync_state (
  key text primary key,
  last_synced_at timestamptz,
  cursor text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  auth_user_id text,
  session_id text,
  path text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_name_time_idx
  on public.analytics_events (event_name, created_at desc);

alter table public.customer_profiles enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.recently_viewed_items enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.policy_documents enable row level security;
alter table public.catalog_sync_state enable row level security;
alter table public.analytics_events enable row level security;

-- The API server should connect with a service-role connection. No anon
-- policies are created here; customer authorization is enforced server-side.-- M&E Garments application data.
-- Shopify remains the source of truth for commerce records.

create extension if not exists pgcrypto;

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null unique,
  display_name text,
  preferred_currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  created_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists wishlist_items_user_created_idx
  on public.wishlist_items (auth_user_id, created_at desc);

create table if not exists public.recently_viewed_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  viewed_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists recently_viewed_user_time_idx
  on public.recently_viewed_items (auth_user_id, viewed_at desc);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text,
  session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (auth_user_id is not null or session_id is not null)
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  grounded_shopify_product_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_time_idx
  on public.ai_messages (conversation_id, created_at);

create table if not exists public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content_markdown text not null,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_sync_state (
  key text primary key,
  last_synced_at timestamptz,
  cursor text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  auth_user_id text,
  session_id text,
  path text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_name_time_idx
  on public.analytics_events (event_name, created_at desc);

alter table public.customer_profiles enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.recently_viewed_items enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.policy_documents enable row level security;
alter table public.catalog_sync_state enable row level security;
alter table public.analytics_events enable row level security;

-- The API server should connect with a service-role connection. No anon
-- policies are created here; customer authorization is enforced server-side.-- M&E Garments application data.
-- Shopify remains the source of truth for commerce records.

create extension if not exists pgcrypto;

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null unique,
  display_name text,
  preferred_currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  created_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists wishlist_items_user_created_idx
  on public.wishlist_items (auth_user_id, created_at desc);

create table if not exists public.recently_viewed_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  viewed_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists recently_viewed_user_time_idx
  on public.recently_viewed_items (auth_user_id, viewed_at desc);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text,
  session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (auth_user_id is not null or session_id is not null)
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  grounded_shopify_product_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_time_idx
  on public.ai_messages (conversation_id, created_at);

create table if not exists public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content_markdown text not null,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_sync_state (
  key text primary key,
  last_synced_at timestamptz,
  cursor text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  auth_user_id text,
  session_id text,
  path text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_name_time_idx
  on public.analytics_events (event_name, created_at desc);

alter table public.customer_profiles enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.recently_viewed_items enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.policy_documents enable row level security;
alter table public.catalog_sync_state enable row level security;
alter table public.analytics_events enable row level security;

-- The API server should connect with a service-role connection. No anon
-- policies are created here; customer authorization is enforced server-side.-- M&E Garments application data.
-- Shopify remains the source of truth for commerce records.

create extension if not exists pgcrypto;

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null unique,
  display_name text,
  preferred_currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  created_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists wishlist_items_user_created_idx
  on public.wishlist_items (auth_user_id, created_at desc);

create table if not exists public.recently_viewed_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  shopify_product_id text not null,
  product_handle text not null,
  viewed_at timestamptz not null default now(),
  unique (auth_user_id, shopify_product_id)
);

create index if not exists recently_viewed_user_time_idx
  on public.recently_viewed_items (auth_user_id, viewed_at desc);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text,
  session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (auth_user_id is not null or session_id is not null)
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  grounded_shopify_product_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_time_idx
  on public.ai_messages (conversation_id, created_at);

create table if not exists public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content_markdown text not null,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_sync_state (
  key text primary key,
  last_synced_at timestamptz,
  cursor text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  auth_user_id text,
  session_id text,
  path text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_name_time_idx
  on public.analytics_events (event_name, created_at desc);

alter table public.customer_profiles enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.recently_viewed_items enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.policy_documents enable row level security;
alter table public.catalog_sync_state enable row level security;
alter table public.analytics_events enable row level security;

-- The API server should connect with a service-role connection. No anon
-- policies are created here; customer authorization is enforced server-side.