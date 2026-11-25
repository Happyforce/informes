-- ============================================================
-- 1. Video reports: a new file kind next to html/pdf.
--    Large files (videos, heavy PDFs) are uploaded straight from the
--    browser / Claude to Storage with a signed upload URL, so they
--    never go through Vercel's 4.5 MB request limit.
-- 2. reports.created_by: who published it (audit).
-- 3. api_tokens: personal access tokens for the Claude MCP server
--    (/api/mcp). Only the SHA-256 hash is stored; the token itself is
--    shown once. No RLS policies: only the service role touches it.
-- Safe to re-run.
-- ============================================================

-- ─── 1. Video kind ─────────────────────────────────────────

alter table public.reports
  drop constraint if exists reports_kind_check;
alter table public.reports
  add constraint reports_kind_check
  check (kind in ('html', 'pdf', 'video', 'link'));

alter table public.reports
  drop constraint if exists reports_content_check;
alter table public.reports
  add constraint reports_content_check check (
    (kind in ('html', 'pdf', 'video') and storage_path is not null) or
    (kind = 'link' and external_url is not null)
  );

-- ─── 2. Audit ──────────────────────────────────────────────

alter table public.reports
  add column if not exists created_by text;

-- ─── 3. API tokens ─────────────────────────────────────────

create table if not exists public.api_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_email    text not null,
  name          text not null,
  token_hash    text not null unique,
  token_prefix  text not null,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz
);
create index if not exists api_tokens_user_idx
  on public.api_tokens (lower(user_email));

alter table public.api_tokens enable row level security;
-- (no policies on purpose: anon/authenticated can't read or write it)
