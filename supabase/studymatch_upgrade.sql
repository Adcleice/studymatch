-- StudyMatch: execute uma vez no SQL Editor do Supabase

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

-- Necessário para o ranking por estado. Seguro rodar mesmo se a coluna já existir.
alter table public.places add column if not exists state text;

-- Recomendado para garantir uma avaliação por usuário/lugar.
create unique index if not exists place_reviews_user_place_unique on public.place_reviews(user_id, place_id);
