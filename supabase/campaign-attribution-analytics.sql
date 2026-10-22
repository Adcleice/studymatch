-- Matchworking campaign attribution analytics
-- Execute this migration in the Supabase SQL Editor before deploying the frontend.

create table if not exists public.campaign_visits (
  id bigint generated always as identity primary key,
  session_id text not null,
  source text not null,
  medium text,
  campaign text,
  content text not null,
  landing_path text,
  visited_at timestamptz not null default now()
);
create index if not exists campaign_visits_visited_at_idx on public.campaign_visits (visited_at desc);
create index if not exists campaign_visits_source_content_idx on public.campaign_visits (source, content);

create table if not exists public.campaign_signups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  source text not null,
  medium text,
  campaign text,
  content text not null,
  registered_at timestamptz not null default now()
);
create index if not exists campaign_signups_registered_at_idx on public.campaign_signups (registered_at desc);
create index if not exists campaign_signups_source_content_idx on public.campaign_signups (source, content);

alter table public.campaign_visits enable row level security;
alter table public.campaign_signups enable row level security;

drop policy if exists "public can record campaign visits" on public.campaign_visits;
create policy "public can record campaign visits" on public.campaign_visits
  for insert to anon, authenticated
  with check (
    length(source) <= 100 and length(content) <= 100
    and (medium is null or length(medium) <= 100)
    and (campaign is null or length(campaign) <= 100)
    and (landing_path is null or length(landing_path) <= 500)
    and length(session_id) between 8 and 100
  );

revoke all on public.campaign_visits from anon, authenticated;
grant insert on public.campaign_visits to anon, authenticated;
revoke all on public.campaign_signups from anon, authenticated;

create or replace function public.capture_campaign_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare attribution jsonb;
begin
  attribution := new.raw_user_meta_data -> 'campaign_attribution';
  if attribution is not null
     and coalesce(attribution ->> 'source', '') <> ''
     and coalesce(attribution ->> 'content', '') <> '' then
    insert into public.campaign_signups(user_id, source, medium, campaign, content)
    values (
      new.id,
      left(attribution ->> 'source', 100),
      left(attribution ->> 'medium', 100),
      left(attribution ->> 'campaign', 100),
      left(attribution ->> 'content', 100)
    )
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists capture_campaign_signup on auth.users;
create trigger capture_campaign_signup
  after insert on auth.users
  for each row execute function public.capture_campaign_signup();

create or replace function public.admin_campaign_metrics(p_days integer default 30)
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

  with visit_counts as (
    select source, coalesce(content, 'sem identificação') as content,
      count(*)::bigint as visits, max(visited_at) as last_visit
    from public.campaign_visits
    where p_days is null or p_days = 0 or visited_at >= now() - make_interval(days => greatest(p_days, 1))
    group by source, coalesce(content, 'sem identificação')
  ), signup_counts as (
    select source, coalesce(content, 'sem identificação') as content,
      count(*)::bigint as registrations, max(registered_at) as last_registration
    from public.campaign_signups
    where p_days is null or p_days = 0 or registered_at >= now() - make_interval(days => greatest(p_days, 1))
    group by source, coalesce(content, 'sem identificação')
  ), combined as (
    select coalesce(v.source, s.source) as source,
      coalesce(v.content, s.content) as content,
      coalesce(v.visits, 0) as visits,
      coalesce(s.registrations, 0) as registrations,
      v.last_visit, s.last_registration
    from visit_counts v full outer join signup_counts s
      on v.source = s.source and v.content = s.content
  )
  select jsonb_build_object(
    'visits_total', coalesce((select sum(visits) from combined), 0),
    'registrations_total', coalesce((select sum(registrations) from combined), 0),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object(
        'source', source, 'content', content, 'visits', visits,
        'registrations', registrations,
        'conversion_rate', case when visits > 0 then round(registrations::numeric / visits * 100, 1) else 0 end,
        'last_visit', last_visit, 'last_registration', last_registration
      ) order by visits desc, registrations desc, source, content)
      from combined
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_campaign_metrics(integer) from public, anon;
grant execute on function public.admin_campaign_metrics(integer) to authenticated;
