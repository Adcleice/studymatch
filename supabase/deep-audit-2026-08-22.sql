-- StudyMatch — auditoria profunda 2026-08-22
-- Seguro para executar mais de uma vez no Supabase SQL Editor.

-- ============================================================
-- 1) LUGARES: nota e contagem sempre calculadas pelo banco
-- ============================================================
create or replace function public.refresh_place_rating(p_place_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.places p
  set
    avg_rating = coalesce((
      select round(avg(r.rating)::numeric, 1)
      from public.place_reviews r
      where r.place_id = p_place_id
    ), 0),
    review_count = (
      select count(*)::integer
      from public.place_reviews r
      where r.place_id = p_place_id
    )
  where p.id = p_place_id;
end;
$$;

revoke all on function public.refresh_place_rating(uuid) from public;
grant execute on function public.refresh_place_rating(uuid) to authenticated;

create or replace function public.sync_place_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_place_rating(old.place_id);
    return old;
  end if;

  perform public.refresh_place_rating(new.place_id);

  if tg_op = 'UPDATE' and old.place_id is distinct from new.place_id then
    perform public.refresh_place_rating(old.place_id);
  end if;

  return new;
end;
$$;

drop trigger if exists place_review_rating_insert on public.place_reviews;
create trigger place_review_rating_insert
after insert on public.place_reviews
for each row execute function public.sync_place_rating();

drop trigger if exists place_review_rating_update on public.place_reviews;
create trigger place_review_rating_update
after update of rating,place_id on public.place_reviews
for each row execute function public.sync_place_rating();

drop trigger if exists place_review_rating_delete on public.place_reviews;
create trigger place_review_rating_delete
after delete on public.place_reviews
for each row execute function public.sync_place_rating();

do $$
declare r record;
begin
  for r in select id from public.places loop
    perform public.refresh_place_rating(r.id);
  end loop;
end $$;

-- ============================================================
-- 2) STORAGE DE LUGARES: cada usuário só grava na própria pasta
-- ============================================================
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('places','places',true,10485760,array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict(id) do update
set public=true,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "places authenticated upload" on storage.objects;
drop policy if exists "places owner upload" on storage.objects;
drop policy if exists "places owner update" on storage.objects;
drop policy if exists "places owner delete" on storage.objects;

create policy "places owner upload" on storage.objects
for insert to authenticated
with check (
  bucket_id='places'
  and (storage.foldername(name))[1]=auth.uid()::text
);

create policy "places owner update" on storage.objects
for update to authenticated
using (
  bucket_id='places'
  and (
    (storage.foldername(name))[1]=auth.uid()::text
    or coalesce(auth.jwt() ->> 'email','')='adcleice24@gmail.com'
  )
)
with check (
  bucket_id='places'
  and (
    (storage.foldername(name))[1]=auth.uid()::text
    or coalesce(auth.jwt() ->> 'email','')='adcleice24@gmail.com'
  )
);

create policy "places owner delete" on storage.objects
for delete to authenticated
using (
  bucket_id='places'
  and (
    (storage.foldername(name))[1]=auth.uid()::text
    or coalesce(auth.jwt() ->> 'email','')='adcleice24@gmail.com'
  )
);

-- ============================================================
-- 3) STORAGE DO FÓRUM: fecha upload amplo e permite limpeza do autor
-- ============================================================
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('forum-media','forum-media',true,52428800,array['image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4','video/webm','video/quicktime'])
on conflict(id) do update
set public=true,file_size_limit=52428800,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "forum media authenticated upload" on storage.objects;
drop policy if exists "forum media upload" on storage.objects;
drop policy if exists "forum media owner upload" on storage.objects;
drop policy if exists "forum media owner delete" on storage.objects;

create policy "forum media owner upload" on storage.objects
for insert to authenticated
with check (
  bucket_id='forum-media'
  and (storage.foldername(name))[1]=auth.uid()::text
);

create policy "forum media owner delete" on storage.objects
for delete to authenticated
using (
  bucket_id='forum-media'
  and (
    (storage.foldername(name))[1]=auth.uid()::text
    or coalesce(auth.jwt() ->> 'email','')='adcleice24@gmail.com'
  )
);

-- ============================================================
-- 4) ÍNDICES ENCONTRADOS NA AUDITORIA DE FLUXOS
-- ============================================================
create index if not exists place_reviews_place_created_idx
on public.place_reviews(place_id,created_at desc);

create index if not exists places_state_city_idx
on public.places(state,city)
where approved=true;

create index if not exists connection_reviews_reviewed_idx
on public.connection_reviews(reviewed_id,created_at desc);

create index if not exists connection_reviews_match_reviewer_idx
on public.connection_reviews(match_id,reviewer_id);

create index if not exists user_blocks_blocked_idx
on public.user_blocks(blocked_id);

create index if not exists forum_saved_posts_user_idx
on public.forum_saved_posts(user_id);

-- ============================================================
-- 5) VALIDAÇÃO BÁSICA DE AVALIAÇÕES
-- ============================================================
update public.place_reviews set rating=1 where rating<1;
update public.place_reviews set rating=5 where rating>5;
update public.connection_reviews set rating=1 where rating<1;
update public.connection_reviews set rating=5 where rating>5;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='place_reviews_rating_range'
      and conrelid='public.place_reviews'::regclass
  ) then
    alter table public.place_reviews
    add constraint place_reviews_rating_range check (rating between 1 and 5);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='connection_reviews_rating_range'
      and conrelid='public.connection_reviews'::regclass
  ) then
    alter table public.connection_reviews
    add constraint connection_reviews_rating_range check (rating between 1 and 5);
  end if;
end $$;

-- ============================================================
-- 6) AVALIAÇÕES DE CONEXÃO: impede avaliação falsa e protege comentários
-- ============================================================
alter table public.connection_reviews enable row level security;

drop policy if exists "connection reviews readable" on public.connection_reviews;
drop policy if exists "connection reviews read involved" on public.connection_reviews;
drop policy if exists "connection reviews insert own" on public.connection_reviews;
drop policy if exists "connection reviews update own" on public.connection_reviews;
drop policy if exists "connection reviews delete own" on public.connection_reviews;

-- Comentário e identidade do avaliador ficam visíveis só às duas pessoas envolvidas
-- e à administradora. A reputação pública usa a função abaixo, sem expor comentário.
create policy "connection reviews read involved" on public.connection_reviews
for select to authenticated
using (
  auth.uid()=reviewer_id
  or auth.uid()=reviewed_id
  or coalesce(auth.jwt() ->> 'email','')='adcleice24@gmail.com'
);

create policy "connection reviews insert own" on public.connection_reviews
for insert to authenticated
with check (
  auth.uid()=reviewer_id
  and reviewer_id<>reviewed_id
  and exists (
    select 1 from public.matches m
    where m.id=match_id
      and auth.uid() in (m.user1_id,m.user2_id)
      and reviewed_id in (m.user1_id,m.user2_id)
      and reviewed_id<>auth.uid()
  )
);

create policy "connection reviews update own" on public.connection_reviews
for update to authenticated
using (auth.uid()=reviewer_id)
with check (
  auth.uid()=reviewer_id
  and reviewer_id<>reviewed_id
  and exists (
    select 1 from public.matches m
    where m.id=match_id
      and auth.uid() in (m.user1_id,m.user2_id)
      and reviewed_id in (m.user1_id,m.user2_id)
      and reviewed_id<>auth.uid()
  )
);

create policy "connection reviews delete own" on public.connection_reviews
for delete to authenticated
using (auth.uid()=reviewer_id);

create or replace function public.get_public_connection_reviews(p_user_id uuid)
returns table(rating integer,tags text[])
language sql
stable
security definer
set search_path = public
as $$
  select r.rating::integer,coalesce(r.tags,'{}'::text[])
  from public.connection_reviews r
  where r.reviewed_id=p_user_id
    and r.rating between 1 and 5;
$$;

revoke all on function public.get_public_connection_reviews(uuid) from public;
grant execute on function public.get_public_connection_reviews(uuid) to authenticated;

-- Conferência rápida
select
  (select count(*) from public.places) as lugares,
  (select count(*) from public.place_reviews) as avaliacoes_lugares,
  (select count(*) from public.connection_reviews) as avaliacoes_conexoes;
