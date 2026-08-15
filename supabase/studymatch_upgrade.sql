-- StudyMatch: SQL de upgrade seguro para executar no Supabase SQL Editor

create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  area text default 'Geral',
  likes integer not null default 0,
  reply_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.forum_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.study_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text,
  created_by uuid references public.profiles(id) on delete set null,
  room_url text,
  pomodoro_minutes integer not null default 50,
  participant_count integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.forum_posts enable row level security;
alter table public.forum_replies enable row level security;
alter table public.study_rooms enable row level security;

drop policy if exists "forum posts readable" on public.forum_posts;
create policy "forum posts readable" on public.forum_posts for select to authenticated using (true);
drop policy if exists "forum posts insert own" on public.forum_posts;
create policy "forum posts insert own" on public.forum_posts for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "forum posts update authenticated" on public.forum_posts;
create policy "forum posts update authenticated" on public.forum_posts for update to authenticated using (true) with check (true);

drop policy if exists "forum replies readable" on public.forum_replies;
create policy "forum replies readable" on public.forum_replies for select to authenticated using (true);
drop policy if exists "forum replies insert own" on public.forum_replies;
create policy "forum replies insert own" on public.forum_replies for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "rooms readable" on public.study_rooms;
create policy "rooms readable" on public.study_rooms for select to authenticated using (true);
drop policy if exists "rooms create own" on public.study_rooms;
create policy "rooms create own" on public.study_rooms for insert to authenticated with check (auth.uid() = created_by);
drop policy if exists "rooms update creator" on public.study_rooms;
create policy "rooms update creator" on public.study_rooms for update to authenticated using (auth.uid() = created_by) with check (auth.uid() = created_by);

alter table public.places add column if not exists state text;
create unique index if not exists place_reviews_user_place_unique on public.place_reviews(user_id, place_id);

-- STORAGE: cria os buckets que o app usa para fotos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 8388608, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public = true, file_size_limit = 8388608;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('places', 'places', true, 10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public = true, file_size_limit = 10485760;

drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "avatars upload own" on storage.objects;
create policy "avatars upload own" on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars update own" on storage.objects;
create policy "avatars update own" on storage.objects for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars delete own" on storage.objects;
create policy "avatars delete own" on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "places public read" on storage.objects;
create policy "places public read" on storage.objects for select using (bucket_id = 'places');
drop policy if exists "places authenticated upload" on storage.objects;
create policy "places authenticated upload" on storage.objects for insert to authenticated with check (bucket_id = 'places');

-- DESFAZER MATCH: função segura; só participantes da conexão podem executá-la.
create or replace function public.unmatch_connection(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user1 uuid;
  v_user2 uuid;
begin
  select user1_id, user2_id into v_user1, v_user2
  from public.matches
  where id = p_match_id;

  if v_user1 is null then
    raise exception 'Conexão não encontrada';
  end if;

  if auth.uid() is null or auth.uid() not in (v_user1, v_user2) then
    raise exception 'Sem permissão para desfazer esta conexão';
  end if;

  delete from public.messages where match_id = p_match_id;
  delete from public.matches where id = p_match_id;
  delete from public.swipes
  where (user_id = v_user1 and target_id = v_user2)
     or (user_id = v_user2 and target_id = v_user1);
end;
$$;

grant execute on function public.unmatch_connection(uuid) to authenticated;
