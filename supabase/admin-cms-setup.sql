-- Matchworking visual admin / mini-CMS
-- Setup idempotente: pode ser executado novamente sem apagar configurações existentes.

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;
drop policy if exists "admin reads own membership" on public.app_admins;
create policy "admin reads own membership" on public.app_admins
for select to authenticated using (user_id = auth.uid());

create or replace function public.claim_first_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return false; end if;
  return exists(select 1 from public.app_admins where user_id = auth.uid());
end;
$$;
revoke all on function public.claim_first_admin() from public;
grant execute on function public.claim_first_admin() to authenticated;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists(select 1 from public.app_admins a where a.user_id = auth.uid());
$$;
revoke all on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to authenticated;

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.app_settings enable row level security;
drop policy if exists "public reads app settings" on public.app_settings;
create policy "public reads app settings" on public.app_settings
for select to anon, authenticated using (true);

drop policy if exists "admins insert app settings" on public.app_settings;
create policy "admins insert app settings" on public.app_settings
for insert to authenticated with check (public.is_app_admin());

drop policy if exists "admins update app settings" on public.app_settings;
create policy "admins update app settings" on public.app_settings
for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

insert into public.app_settings(key,value)
values ('site', jsonb_build_object(
  'brand_name','Matchworking',
  'brand_accent','#2cc7a9',
  'brand_background','#071820',
  'logo_url','',
  'hero_title','Encontre as pessoas certas para ir mais longe.',
  'hero_text','O Matchworking conecta pessoas pelo que sabem, pelo que procuram e pelo que podem construir juntas — para trocar conhecimento, colaborar e criar oportunidades.'
)) on conflict (key) do nothing;

-- Mantém a conta inicial como administradora sem remover outros administradores.
insert into public.app_admins(user_id)
select id from auth.users where lower(email)=lower('adcleice24@gmail.com')
on conflict do nothing;

insert into storage.buckets(id,name,public)
values ('brand-assets','brand-assets',true)
on conflict (id) do update set public = true;

drop policy if exists "public reads brand assets" on storage.objects;
create policy "public reads brand assets" on storage.objects
for select to public using (bucket_id = 'brand-assets');

drop policy if exists "admins upload brand assets" on storage.objects;
create policy "admins upload brand assets" on storage.objects
for insert to authenticated with check (bucket_id = 'brand-assets' and public.is_app_admin());

drop policy if exists "admins update brand assets" on storage.objects;
create policy "admins update brand assets" on storage.objects
for update to authenticated
using (bucket_id = 'brand-assets' and public.is_app_admin())
with check (bucket_id = 'brand-assets' and public.is_app_admin());

drop policy if exists "admins delete brand assets" on storage.objects;
create policy "admins delete brand assets" on storage.objects
for delete to authenticated using (bucket_id = 'brand-assets' and public.is_app_admin());
