create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  created_at timestamptz not null default now()
);

create table if not exists public.work_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.work_items(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(work_item_id, name)
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.work_items(id),
  site_id uuid not null references public.sites(id),
  member_id uuid not null references public.profiles(id),
  member_name text not null,
  memo text not null default '',
  image_path text not null,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists photos_captured_at_idx on public.photos(captured_at desc);
create index if not exists photos_member_id_idx on public.photos(member_id);
create index if not exists sites_work_item_id_idx on public.sites(work_item_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, 'スタッフ'), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.work_items enable row level security;
alter table public.sites enable row level security;
alter table public.photos enable row level security;

drop policy if exists "staff can view profiles" on public.profiles;
create policy "staff can view profiles"
  on public.profiles for select to authenticated using (true);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "staff can view work items" on public.work_items;
create policy "staff can view work items"
  on public.work_items for select to authenticated using (true);

drop policy if exists "admins can manage work items" on public.work_items;
create policy "admins can manage work items"
  on public.work_items for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

drop policy if exists "staff can view sites" on public.sites;
create policy "staff can view sites"
  on public.sites for select to authenticated using (true);

drop policy if exists "admins can manage sites" on public.sites;
create policy "admins can manage sites"
  on public.sites for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

drop policy if exists "staff can view photos" on public.photos;
create policy "staff can view photos"
  on public.photos for select to authenticated using (true);

drop policy if exists "staff can add own photos" on public.photos;
create policy "staff can add own photos"
  on public.photos for insert to authenticated
  with check ((select auth.uid()) = member_id);

drop policy if exists "owners and admins can delete photos" on public.photos;
create policy "owners and admins can delete photos"
  on public.photos for delete to authenticated
  using (
    (select auth.uid()) = member_id
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('field-photos', 'field-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "staff can view field photos" on storage.objects;
create policy "staff can view field photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'field-photos');

drop policy if exists "staff can upload own field photos" on storage.objects;
create policy "staff can upload own field photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'field-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "owners can delete own field photos" on storage.objects;
create policy "owners can delete own field photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'field-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
    )
  );

insert into public.work_items (name, sort_order)
values
  ('トイレ清掃', 10),
  ('定期清掃', 20),
  ('配管', 30),
  ('巡回清掃', 40),
  ('日常清掃', 50),
  ('その他', 60)
on conflict (name) do nothing;

insert into public.sites (work_item_id, name, sort_order)
select w.id, seed.name, seed.sort_order
from (
  values
    ('トイレ清掃', '第二小学校', 10),
    ('トイレ清掃', '第三小学校', 20),
    ('トイレ清掃', 'それ以外', 99),
    ('定期清掃', 'みらいマンション', 10),
    ('定期清掃', 'しんじゅくビル', 20),
    ('定期清掃', 'それ以外', 99),
    ('配管', '第一工場', 10),
    ('配管', 'それ以外', 99),
    ('巡回清掃', 'みらいマンション', 10),
    ('巡回清掃', 'しんじゅくビル', 20),
    ('巡回清掃', 'それ以外', 99),
    ('日常清掃', '第二小学校', 10),
    ('日常清掃', '第三小学校', 20),
    ('日常清掃', 'それ以外', 99),
    ('その他', 'それ以外', 99)
) as seed(work_name, name, sort_order)
join public.work_items w on w.name = seed.work_name
on conflict (work_item_id, name) do nothing;
