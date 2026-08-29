-- Matchworking — auditoria de autorização administrativa (2026-08-29)
-- Execute uma vez no SQL Editor do Supabase. Seguro para repetir.
-- Torna public.app_admins a única fonte de verdade para privilégios de administração.

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

-- Configuração do CMS.
drop policy if exists "admins insert app settings" on public.app_settings;
create policy "admins insert app settings" on public.app_settings
for insert to authenticated with check (public.is_app_admin());

drop policy if exists "admins update app settings" on public.app_settings;
create policy "admins update app settings" on public.app_settings
for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

-- Denúncias de usuários.
alter table public.user_reports enable row level security;
drop policy if exists "reports own read" on public.user_reports;
drop policy if exists "reports own read or admin" on public.user_reports;
create policy "reports own read or admin" on public.user_reports
for select to authenticated using (auth.uid() = reporter_id or public.is_app_admin());

drop policy if exists "reports admin update" on public.user_reports;
create policy "reports admin update" on public.user_reports
for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

-- Fórum: autores editam o próprio conteúdo; administradores podem moderar.
alter table public.forum_posts enable row level security;
drop policy if exists "forum posts update authenticated" on public.forum_posts;
drop policy if exists "forum posts update own or admin" on public.forum_posts;
create policy "forum posts update own or admin" on public.forum_posts
for update to authenticated
using (auth.uid() = user_id or public.is_app_admin())
with check (auth.uid() = user_id or public.is_app_admin());

alter table public.forum_replies enable row level security;
drop policy if exists "forum replies update own or admin" on public.forum_replies;
create policy "forum replies update own or admin" on public.forum_replies
for update to authenticated
using (auth.uid() = user_id or public.is_app_admin())
with check (auth.uid() = user_id or public.is_app_admin());

-- Lugares: mantém a lógica atual, mas sem depender de um e-mail fixo.
alter table public.places enable row level security;
drop policy if exists "places readable" on public.places;
create policy "places readable" on public.places
for select to authenticated
using (approved = true or added_by = auth.uid() or public.is_app_admin());

drop policy if exists "places insert own" on public.places;
create policy "places insert own" on public.places
for insert to authenticated
with check (added_by = auth.uid() and (approved = false or public.is_app_admin()));

drop policy if exists "places update admin" on public.places;
create policy "places update admin" on public.places
for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists "places delete admin" on public.places;
create policy "places delete admin" on public.places
for delete to authenticated using (public.is_app_admin());

alter table public.place_reviews enable row level security;
drop policy if exists "place reviews delete own or admin" on public.place_reviews;
create policy "place reviews delete own or admin" on public.place_reviews
for delete to authenticated using (auth.uid() = user_id or public.is_app_admin());

-- Avaliações de conexão: detalhes continuam restritos às pessoas envolvidas e admins.
alter table public.connection_reviews enable row level security;
drop policy if exists "connection reviews read involved" on public.connection_reviews;
create policy "connection reviews read involved" on public.connection_reviews
for select to authenticated
using (auth.uid() = reviewer_id or auth.uid() = reviewed_id or public.is_app_admin());

-- Storage de identidade visual.
drop policy if exists "admins upload brand assets" on storage.objects;
create policy "admins upload brand assets" on storage.objects
for insert to authenticated with check (bucket_id='brand-assets' and public.is_app_admin());

drop policy if exists "admins update brand assets" on storage.objects;
create policy "admins update brand assets" on storage.objects
for update to authenticated
using (bucket_id='brand-assets' and public.is_app_admin())
with check (bucket_id='brand-assets' and public.is_app_admin());

drop policy if exists "admins delete brand assets" on storage.objects;
create policy "admins delete brand assets" on storage.objects
for delete to authenticated using (bucket_id='brand-assets' and public.is_app_admin());

-- Storage de lugares.
drop policy if exists "places owner update" on storage.objects;
create policy "places owner update" on storage.objects
for update to authenticated
using (bucket_id='places' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_app_admin()))
with check (bucket_id='places' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_app_admin()));

drop policy if exists "places owner delete" on storage.objects;
create policy "places owner delete" on storage.objects
for delete to authenticated
using (bucket_id='places' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_app_admin()));

-- Storage do Fórum.
drop policy if exists "forum media owner delete" on storage.objects;
create policy "forum media owner delete" on storage.objects
for delete to authenticated
using (bucket_id='forum-media' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_app_admin()));

-- Atualizações de denúncias no painel administrativo em tempo real.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='user_reports'
  ) then
    alter publication supabase_realtime add table public.user_reports;
  end if;
end $$;

-- Conferência: deve retornar true quando executado por uma conta administradora autenticada pelo app.
-- select public.is_app_admin();
