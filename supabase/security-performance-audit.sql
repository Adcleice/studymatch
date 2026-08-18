-- StudyMatch: auditoria de segurança e desempenho
-- Seguro para executar mais de uma vez no Supabase SQL Editor.

-- 1) Corrige política excessivamente ampla do Fórum.
drop policy if exists "forum posts update authenticated" on public.forum_posts;
drop policy if exists "forum posts update own or admin" on public.forum_posts;
create policy "forum posts update own or admin"
on public.forum_posts for update to authenticated
using (
  auth.uid() = user_id
  or coalesce(auth.jwt() ->> 'email','') = 'adcleice24@gmail.com'
)
with check (
  auth.uid() = user_id
  or coalesce(auth.jwt() ->> 'email','') = 'adcleice24@gmail.com'
);

-- Permite ao autor editar a própria resposta e à moderação ocultá-la.
drop policy if exists "forum replies update own or admin" on public.forum_replies;
create policy "forum replies update own or admin"
on public.forum_replies for update to authenticated
using (
  auth.uid() = user_id
  or coalesce(auth.jwt() ->> 'email','') = 'adcleice24@gmail.com'
)
with check (
  auth.uid() = user_id
  or coalesce(auth.jwt() ->> 'email','') = 'adcleice24@gmail.com'
);

-- 2) Mantém reply_count no banco, sem depender do cliente alterar posts de terceiros.
create or replace function public.sync_forum_reply_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_id uuid := coalesce(new.post_id, old.post_id);
begin
  update public.forum_posts p
  set reply_count = (
    select count(*)::integer
    from public.forum_replies r
    where r.post_id = v_post_id
      and coalesce(r.hidden,false) = false
  )
  where p.id = v_post_id;
  return coalesce(new,old);
end;
$$;

drop trigger if exists forum_reply_count_insert on public.forum_replies;
create trigger forum_reply_count_insert
after insert on public.forum_replies
for each row execute function public.sync_forum_reply_count();

drop trigger if exists forum_reply_count_delete on public.forum_replies;
create trigger forum_reply_count_delete
after delete on public.forum_replies
for each row execute function public.sync_forum_reply_count();

drop trigger if exists forum_reply_count_update on public.forum_replies;
create trigger forum_reply_count_update
after update of hidden, post_id on public.forum_replies
for each row execute function public.sync_forum_reply_count();

-- 3) Índices das consultas mais usadas pelo aplicativo.
create index if not exists forum_posts_created_at_idx on public.forum_posts(created_at desc);
create index if not exists forum_posts_user_created_idx on public.forum_posts(user_id, created_at desc);
create index if not exists forum_replies_post_created_idx on public.forum_replies(post_id, created_at);
create index if not exists connection_requests_recipient_status_idx on public.connection_requests(recipient_id, status, created_at desc);
create index if not exists matches_user1_idx on public.matches(user1_id);
create index if not exists matches_user2_idx on public.matches(user2_id);
create index if not exists messages_match_created_idx on public.messages(match_id, created_at desc);
create index if not exists messages_unread_match_idx on public.messages(match_id, sender_id) where read = false;
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_user_idx on public.notifications(user_id) where read = false;
create index if not exists study_rooms_active_created_idx on public.study_rooms(active, created_at desc);
create index if not exists places_approved_rating_idx on public.places(approved, avg_rating desc, review_count desc);

-- 4) Garante integridade básica de edição.
alter table public.forum_posts add column if not exists updated_at timestamptz;

-- Atualiza contadores antigos uma vez.
update public.forum_posts p
set reply_count = (
  select count(*)::integer
  from public.forum_replies r
  where r.post_id = p.id
    and coalesce(r.hidden,false) = false
);
