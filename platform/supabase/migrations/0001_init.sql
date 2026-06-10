-- ============================================================
-- Informes Happyforce — initial schema
-- clients · client_members (email allowlist) · reports
-- RLS: client isolation at the DB level; @myhappyforce.com = admin.
-- Report HTML files live in the private "reports" Storage bucket;
-- end users never touch Storage directly (route handlers mediate).
-- ============================================================

-- ─── Helpers ───────────────────────────────────────────────

-- Is the current JWT a Happyforce admin account?
create or replace function public.is_hf_admin()
returns boolean
language sql stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') ilike '%@myhappyforce.com'
$$;

-- Client ids the current user belongs to. SECURITY DEFINER so it can
-- read client_members without tripping that table's own RLS.
create or replace function public.member_client_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select client_id
  from public.client_members
  where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

-- ─── Tables ────────────────────────────────────────────────

create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name        text not null,
  color       text not null default '#f26522',
  cover       text not null default 'accent-orange',
  initials    text not null default '',
  created_at  timestamptz not null default now()
);

create table public.client_members (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  email       text not null,
  role        text not null default 'viewer' check (role in ('admin','viewer')),
  created_at  timestamptz not null default now()
);
create unique index client_members_unique_email
  on public.client_members (client_id, lower(email));

create table public.reports (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references public.clients(id) on delete cascade,
  slug          text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title         text not null,
  description   text,
  visibility    text not null default 'client' check (visibility in ('public','client')),
  cover         text not null default 'accent-orange',
  badges        text[] not null default '{}',
  stats         jsonb not null default '[]',
  edition       text,
  edition_label text,
  canva_url     text,
  storage_path  text not null,
  published_at  date not null default current_date,
  created_at    timestamptz not null default now(),
  -- a private report must belong to a client; a public one must not
  constraint visibility_client check (
    (visibility = 'public' and client_id is null) or
    (visibility = 'client' and client_id is not null)
  )
);
create index reports_client_idx on public.reports (client_id, published_at desc);

-- ─── RLS ───────────────────────────────────────────────────

alter table public.clients enable row level security;
alter table public.client_members enable row level security;
alter table public.reports enable row level security;

-- clients: members see their own client; admins see and manage all
create policy clients_select on public.clients
  for select using (
    public.is_hf_admin() or id in (select public.member_client_ids())
  );
create policy clients_admin_write on public.clients
  for all using (public.is_hf_admin()) with check (public.is_hf_admin());

-- client_members: you can see your own membership rows; admins manage all
create policy members_select on public.client_members
  for select using (
    public.is_hf_admin()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
create policy members_admin_write on public.client_members
  for all using (public.is_hf_admin()) with check (public.is_hf_admin());

-- reports: public rows visible to everyone (incl. anon landing);
-- client rows only to that client's members; admins manage all
create policy reports_select on public.reports
  for select using (
    visibility = 'public'
    or public.is_hf_admin()
    or client_id in (select public.member_client_ids())
  );
create policy reports_admin_write on public.reports
  for all using (public.is_hf_admin()) with check (public.is_hf_admin());

-- ─── Storage ───────────────────────────────────────────────

-- Private bucket. No object-level policies on purpose: all reads go
-- through /r/[slug] (permission check + service role download) and all
-- writes through admin server actions (requireAdmin + service role).
insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do nothing;
