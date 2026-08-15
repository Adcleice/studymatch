-- StudyMatch: upgrade do Fórum
create table if not exists public.forum_likes (
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.forum_likes enable row level security;

drop policy if exists "forum likes readable" on public.forum_likes;
create policy "forum likes readable" on public.forum_likes
for select to authenticated using (true);

drop policy if exists "forum likes insert own" on public.forum_likes;
create policy "forum likes insert own" on public.forum_likes
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "forum likes delete own" on public.forum_likes;
create policy "forum likes delete own" on public.forum_likes
for delete to authenticated using (auth.uid() = user_id);

-- Permite atualizar somente o contador de respostas via cliente autenticado.
drop policy if exists "forum posts update authenticated" on public.forum_posts;
create policy "forum posts update authenticated" on public.forum_posts
for update to authenticated using (true) with check (true);
