-- ============================================================
-- OAuth 2.1 for the Claude connector (/api/mcp).
-- Lets the organization add "Informes Happyforce" as a custom connector in
-- claude.ai: each member clicks "Connect", signs in with their
-- @myhappyforce.com email (code by email) and approves — once.
--
-- oauth_clients  — dynamically registered clients (RFC 7591): claude.ai,
--                  Claude Code… Public clients (PKCE, no secret).
-- oauth_codes    — short-lived authorization codes (hash only).
-- oauth_grants   — one row per connection (user × client): current access +
--                  refresh token hashes, rotated on every refresh.
-- No RLS policies: only the service role touches these tables.
-- Safe to re-run.
-- ============================================================

create table if not exists public.oauth_clients (
  client_id      text primary key,
  client_name    text not null default 'Cliente MCP',
  redirect_uris  text[] not null,
  created_at     timestamptz not null default now()
);

create table if not exists public.oauth_codes (
  code_hash       text primary key,
  client_id       text not null references public.oauth_clients(client_id) on delete cascade,
  user_email      text not null,
  redirect_uri    text not null,
  code_challenge  text not null,
  expires_at      timestamptz not null,
  used_at         timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists public.oauth_grants (
  id                  uuid primary key default gen_random_uuid(),
  client_id           text not null references public.oauth_clients(client_id) on delete cascade,
  user_email          text not null,
  access_token_hash   text not null unique,
  access_expires_at   timestamptz not null,
  refresh_token_hash  text not null unique,
  refresh_expires_at  timestamptz not null,
  created_at          timestamptz not null default now(),
  last_used_at        timestamptz,
  revoked_at          timestamptz
);
create index if not exists oauth_grants_user_idx
  on public.oauth_grants (lower(user_email));

alter table public.oauth_clients enable row level security;
alter table public.oauth_codes enable row level security;
alter table public.oauth_grants enable row level security;
