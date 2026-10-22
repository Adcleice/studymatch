-- Saved campaign links and QR codes for Matchworking
-- Run this migration in Supabase SQL Editor before using the saved campaign list.

create table if not exists public.campaign_links (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  medium text not null,
  campaign text not null,
  content text not null,
  landing_url text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint campaign_links_source_length check (length(source) between 1 and 100),
  constraint campaign_links_medium_length check (length(medium) between 1 and 100),
  constraint campaign_links_campaign_length check (length(campaign) between 1 and 100),
  constraint campaign_links_content_length check (length(content) between 1 and 100),
  constraint campaign_links_url_length check (length(landing_url) <= 2000)
);

create index if not exists campaign_links_created_at_idx
  on public.campaign_links (created_at desc);
create index if not exists campaign_links_campaign_dimensions_idx
  on public.campaign_links (source, medium, campaign, content);

alter table public.campaign_links enable row level security;
revoke all on public.campaign_links from anon, authenticated;
grant select, insert, delete on public.campaign_links to authenticated;

drop policy if exists "admins can view saved campaign links" on public.campaign_links;
create policy "admins can view saved campaign links" on public.campaign_links
  for select to authenticated
  using (exists (select 1 from public.app_admins a where a.user_id = auth.uid()));

drop policy if exists "admins can save campaign links" on public.campaign_links;
create policy "admins can save campaign links" on public.campaign_links
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (select 1 from public.app_admins a where a.user_id = auth.uid())
  );

drop policy if exists "admins can delete saved campaign links" on public.campaign_links;
create policy "admins can delete saved campaign links" on public.campaign_links
  for delete to authenticated
  using (exists (select 1 from public.app_admins a where a.user_id = auth.uid()));

create or replace function public.admin_campaign_links()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.app_admins a where a.user_id = auth.uid()
  ) then
    raise exception 'Acesso administrativo não autorizado';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', l.id,
      'source', l.source,
      'medium', l.medium,
      'campaign', l.campaign,
      'content', l.content,
      'link', l.landing_url,
      'created_at', l.created_at,
      'visits', (
        select count(*) from public.campaign_visits v
        where v.source = l.source
          and coalesce(v.medium, '') = l.medium
          and coalesce(v.campaign, '') = l.campaign
          and v.content = l.content
      ),
      'registrations', (
        select count(*) from public.campaign_signups s
        where s.source = l.source
          and coalesce(s.medium, '') = l.medium
          and coalesce(s.campaign, '') = l.campaign
          and s.content = l.content
      )
    ) order by l.created_at desc
  ), '[]'::jsonb)
  into result
  from public.campaign_links l;

  return result;
end;
$$;

revoke all on function public.admin_campaign_links() from public, anon;
grant execute on function public.admin_campaign_links() to authenticated;
