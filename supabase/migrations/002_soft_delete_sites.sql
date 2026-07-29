alter table public.sites
  add column if not exists is_active boolean not null default true;

create index if not exists sites_active_work_item_idx
  on public.sites(work_item_id, is_active, sort_order);
