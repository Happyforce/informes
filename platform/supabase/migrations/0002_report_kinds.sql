-- ============================================================
-- Report kinds: HTML (default), PDF, or external link.
-- - html/pdf  → a file in the private "reports" bucket (storage_path)
-- - link      → lives elsewhere (Drive, etc.), we store external_url
-- Existing rows default to 'html' (backward compatible).
-- ============================================================

alter table public.reports
  add column if not exists kind text not null default 'html',
  add column if not exists external_url text;

-- Links have no file, so storage_path is no longer mandatory.
alter table public.reports
  alter column storage_path drop not null;

alter table public.reports
  drop constraint if exists reports_kind_check;
alter table public.reports
  add constraint reports_kind_check check (kind in ('html', 'pdf', 'link'));

-- A file kind needs a stored file; a link needs a URL.
alter table public.reports
  drop constraint if exists reports_content_check;
alter table public.reports
  add constraint reports_content_check check (
    (kind in ('html', 'pdf') and storage_path is not null) or
    (kind = 'link' and external_url is not null)
  );
