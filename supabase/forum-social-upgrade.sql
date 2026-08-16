-- StudyMatch Fórum: mídia, exclusão e histórico
alter table public.forum_posts add column if not exists media_url text;
alter table public.forum_posts add column if not exists media_type text check (media_type is null or media_type in ('image','video'));

-- Autor pode apagar a própria publicação.
drop policy if exists "forum posts delete own" on public.forum_posts;
create policy "forum posts delete own"
on public.forum_posts for delete to authenticated
using (auth.uid() = user_id);

-- Autor pode apagar o próprio comentário/resposta.
drop policy if exists "forum replies delete own" on public.forum_replies;
create policy "forum replies delete own"
on public.forum_replies for delete to authenticated
using (auth.uid() = user_id);

-- Bucket de mídia do fórum.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'forum-media','forum-media',true,52428800,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']
)
on conflict (id) do update set
  public=true,
  file_size_limit=52428800,
  allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'];

drop policy if exists "forum media public read" on storage.objects;
create policy "forum media public read"
on storage.objects for select
using (bucket_id='forum-media');

drop policy if exists "forum media upload own" on storage.objects;
create policy "forum media upload own"
on storage.objects for insert to authenticated
with check (
  bucket_id='forum-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "forum media delete own" on storage.objects;
create policy "forum media delete own"
on storage.objects for delete to authenticated
using (
  bucket_id='forum-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);
