-- Matchworking: remove dependência de e-mail fixo das políticas administrativas.
-- Execute no Supabase SQL Editor.

create or replace function public.is_app_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path=public
stable
as $$
 select exists(select 1 from public.app_admins a where a.user_id=p_user_id);
$$;
revoke all on function public.is_app_admin(uuid) from public;
grant execute on function public.is_app_admin(uuid) to authenticated;

-- Lugares
drop policy if exists "places readable" on public.places;
create policy "places readable" on public.places for select to authenticated
using (approved=true or added_by=auth.uid() or public.is_app_admin(auth.uid()));

drop policy if exists "places insert own" on public.places;
create policy "places insert own" on public.places for insert to authenticated
with check (added_by=auth.uid() and (approved=false or public.is_app_admin(auth.uid())));

drop policy if exists "places update admin" on public.places;
create policy "places update admin" on public.places for update to authenticated
using (public.is_app_admin(auth.uid())) with check (public.is_app_admin(auth.uid()));

drop policy if exists "places delete admin" on public.places;
create policy "places delete admin" on public.places for delete to authenticated
using (public.is_app_admin(auth.uid()));

drop policy if exists "place reviews delete own or admin" on public.place_reviews;
create policy "place reviews delete own or admin" on public.place_reviews for delete to authenticated
using (auth.uid()=user_id or public.is_app_admin(auth.uid()));

-- Denúncias
drop policy if exists "reports own read" on public.user_reports;
drop policy if exists "reports own read or admin" on public.user_reports;
create policy "reports own read or admin" on public.user_reports for select to authenticated
using (auth.uid()=reporter_id or public.is_app_admin(auth.uid()));

drop policy if exists "reports admin update" on public.user_reports;
create policy "reports admin update" on public.user_reports for update to authenticated
using (public.is_app_admin(auth.uid())) with check (public.is_app_admin(auth.uid()));

-- Fórum
drop policy if exists "forum posts update own or admin" on public.forum_posts;
create policy "forum posts update own or admin" on public.forum_posts for update to authenticated
using (auth.uid()=user_id or public.is_app_admin(auth.uid()))
with check (auth.uid()=user_id or public.is_app_admin(auth.uid()));

drop policy if exists "forum replies update own or admin" on public.forum_replies;
create policy "forum replies update own or admin" on public.forum_replies for update to authenticated
using (auth.uid()=user_id or public.is_app_admin(auth.uid()))
with check (auth.uid()=user_id or public.is_app_admin(auth.uid()));

-- Storage: mantém autoria e troca exceção por membership real de admin.
drop policy if exists "places owner update" on storage.objects;
create policy "places owner update" on storage.objects for update to authenticated
using(bucket_id='places' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_app_admin(auth.uid())))
with check(bucket_id='places' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_app_admin(auth.uid())));

drop policy if exists "places owner delete" on storage.objects;
create policy "places owner delete" on storage.objects for delete to authenticated
using(bucket_id='places' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_app_admin(auth.uid())));

drop policy if exists "forum media owner delete" on storage.objects;
create policy "forum media owner delete" on storage.objects for delete to authenticated
using(bucket_id='forum-media' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_app_admin(auth.uid())));
