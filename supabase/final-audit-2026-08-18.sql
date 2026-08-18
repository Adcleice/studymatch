-- StudyMatch — auditoria final consolidada (2026-08-18)
-- Seguro para executar mais de uma vez no Supabase SQL Editor.

-- ============================================================
-- 1) NOTIFICAÇÕES: tabela, RLS e índices
-- ============================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

drop policy if exists "notifications own read" on public.notifications;
create policy "notifications own read" on public.notifications
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "notifications own update" on public.notifications;
create policy "notifications own update" on public.notifications
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "notifications own delete" on public.notifications;
create policy "notifications own delete" on public.notifications
for delete to authenticated using (auth.uid() = user_id);

-- Não criamos policy de INSERT para clientes: notificações são geradas por funções/triggers security definer.
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_user_idx on public.notifications(user_id) where read = false;

-- ============================================================
-- 2) MENÇÕES @ COM NOME DE QUEM MARCOU
-- ============================================================
create or replace function public.create_mention_notifications(
  p_text text,
  p_old_text text,
  p_author uuid,
  p_post_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  mentioned record;
  old_handles text[];
  actor_name text;
begin
  if p_text is null or trim(p_text) = '' then return; end if;

  select coalesce(name, username, 'Alguém') into actor_name
  from public.profiles where id = p_author;

  select coalesce(array_agg(distinct lower(m[1])), '{}')
  into old_handles
  from regexp_matches(coalesce(p_old_text,''), '@([a-zA-Z0-9._-]{3,30})', 'g') as m;

  for mentioned in
    select distinct p.id, p.username
    from regexp_matches(p_text, '@([a-zA-Z0-9._-]{3,30})', 'g') as m
    join public.profiles p on lower(p.username) = lower(m[1])
    where p.id <> p_author
      and not (lower(p.username) = any(old_handles))
  loop
    insert into public.notifications(user_id,type,title,body,link,read,created_at)
    values(
      mentioned.id,
      'mention',
      'Você foi mencionado',
      coalesce(actor_name,'Alguém') || ' mencionou você em uma discussão.',
      '/forum/post/' || p_post_id::text,
      false,
      now()
    );
  end loop;
end;
$$;

create or replace function public.notify_forum_post_mentions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.create_mention_notifications(coalesce(new.title,'') || ' ' || coalesce(new.body,''),'',new.user_id,new.id);
  else
    perform public.create_mention_notifications(coalesce(new.title,'') || ' ' || coalesce(new.body,''),coalesce(old.title,'') || ' ' || coalesce(old.body,''),new.user_id,new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists forum_post_mentions_trigger on public.forum_posts;
create trigger forum_post_mentions_trigger
after insert or update of title,body on public.forum_posts
for each row execute function public.notify_forum_post_mentions();

create or replace function public.notify_forum_reply_mentions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.create_mention_notifications(coalesce(new.body,''),'',new.user_id,new.post_id);
  else
    perform public.create_mention_notifications(coalesce(new.body,''),coalesce(old.body,''),new.user_id,new.post_id);
  end if;
  return new;
end;
$$;

drop trigger if exists forum_reply_mentions_trigger on public.forum_replies;
create trigger forum_reply_mentions_trigger
after insert or update of body on public.forum_replies
for each row execute function public.notify_forum_reply_mentions();

-- ============================================================
-- 3) NOTIFICAÇÕES DE RESPOSTAS, CURTIDAS, CONEXÕES E AVALIAÇÕES
-- ============================================================
create or replace function public.notify_forum_reply_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner_id uuid;
  owner_username text;
  actor_name text;
  post_title text;
begin
  select fp.user_id, fp.title into owner_id, post_title from public.forum_posts fp where fp.id = new.post_id;
  if owner_id is null or owner_id = new.user_id then return new; end if;
  select username into owner_username from public.profiles where id = owner_id;
  -- Se a resposta já marcou explicitamente o autor, a notificação de menção é suficiente.
  if owner_username is not null and position('@' || lower(owner_username) in lower(coalesce(new.body,''))) > 0 then return new; end if;
  select coalesce(name,username,'Alguém') into actor_name from public.profiles where id = new.user_id;
  insert into public.notifications(user_id,type,title,body,link)
  values(owner_id,'forum_reply','Nova resposta',coalesce(actor_name,'Alguém') || ' respondeu à sua publicação' || case when post_title is not null then ': ' || left(post_title,80) else '.' end,'/forum/post/' || new.post_id::text);
  return new;
end;
$$;

drop trigger if exists forum_reply_owner_notification on public.forum_replies;
create trigger forum_reply_owner_notification after insert on public.forum_replies
for each row execute function public.notify_forum_reply_owner();

create or replace function public.notify_forum_like_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner_id uuid; actor_name text;
begin
  select user_id into owner_id from public.forum_posts where id = new.post_id;
  if owner_id is null or owner_id = new.user_id then return new; end if;
  select coalesce(name,username,'Alguém') into actor_name from public.profiles where id = new.user_id;
  insert into public.notifications(user_id,type,title,body,link)
  values(owner_id,'forum_like','Curtiram sua publicação',coalesce(actor_name,'Alguém') || ' curtiu sua publicação.','/forum/post/' || new.post_id::text);
  return new;
end;
$$;

drop trigger if exists forum_like_owner_notification on public.forum_likes;
create trigger forum_like_owner_notification after insert on public.forum_likes
for each row execute function public.notify_forum_like_owner();

create or replace function public.notify_connection_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare actor_name text;
begin
  select coalesce(name,username,'Alguém') into actor_name from public.profiles where id = new.requester_id;
  insert into public.notifications(user_id,type,title,body,link)
  values(new.recipient_id,'connection_request','Nova solicitação de conexão',coalesce(actor_name,'Alguém') || ' quer se conectar com você.','/matches');
  return new;
end;
$$;

drop trigger if exists connection_request_notification on public.connection_requests;
create trigger connection_request_notification after insert on public.connection_requests
for each row execute function public.notify_connection_request();

create or replace function public.notify_connection_accepted()
returns trigger language plpgsql security definer set search_path = public as $$
declare actor_name text;
begin
  if old.status = 'pending' and new.status = 'accepted' then
    select coalesce(name,username,'Alguém') into actor_name from public.profiles where id = new.recipient_id;
    insert into public.notifications(user_id,type,title,body,link)
    values(new.requester_id,'connection_accepted','Conexão aceita',coalesce(actor_name,'Alguém') || ' aceitou sua solicitação.','/matches');
  end if;
  return new;
end;
$$;

drop trigger if exists connection_accepted_notification on public.connection_requests;
create trigger connection_accepted_notification after update of status on public.connection_requests
for each row execute function public.notify_connection_accepted();

create or replace function public.notify_connection_review()
returns trigger language plpgsql security definer set search_path = public as $$
declare actor_name text;
begin
  if new.reviewed_id = new.reviewer_id then return new; end if;
  select coalesce(name,username,'Alguém') into actor_name from public.profiles where id = new.reviewer_id;
  insert into public.notifications(user_id,type,title,body,link)
  values(new.reviewed_id,'connection_review','Você recebeu uma avaliação',coalesce(actor_name,'Alguém') || ' avaliou a experiência de conexão com você.','/profile');
  return new;
end;
$$;

drop trigger if exists connection_review_notification on public.connection_reviews;
create trigger connection_review_notification after insert on public.connection_reviews
for each row execute function public.notify_connection_review();

-- ============================================================
-- 4) CHAT: mídia privada, visível somente aos participantes
-- ============================================================
update storage.buckets set public = false where id = 'chat-media';

drop policy if exists "chat media public read" on storage.objects;
drop policy if exists "chat media authenticated upload" on storage.objects;
drop policy if exists "chat media owner delete" on storage.objects;
drop policy if exists "chat media participants read" on storage.objects;
drop policy if exists "chat media participant upload" on storage.objects;

create policy "chat media participants read" on storage.objects
for select to authenticated
using (
  bucket_id = 'chat-media'
  and exists (
    select 1 from public.matches m
    where m.id::text = (storage.foldername(name))[2]
      and auth.uid() in (m.user1_id,m.user2_id)
  )
);

create policy "chat media participant upload" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'chat-media'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.matches m
    where m.id::text = (storage.foldername(name))[2]
      and auth.uid() in (m.user1_id,m.user2_id)
  )
);

create policy "chat media owner delete" on storage.objects
for delete to authenticated
using (bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- 5) LUGARES: RLS coerente com o produto e administração
-- ============================================================
alter table public.places enable row level security;
alter table public.place_reviews enable row level security;

drop policy if exists "places readable" on public.places;
drop policy if exists "places insert own" on public.places;
drop policy if exists "places update admin" on public.places;
drop policy if exists "places delete admin" on public.places;

create policy "places readable" on public.places for select to authenticated
using (
  approved = true
  or added_by = auth.uid()
  or coalesce(auth.jwt() ->> 'email','') = 'adcleice24@gmail.com'
);

create policy "places insert own" on public.places for insert to authenticated
with check (
  added_by = auth.uid()
  and (approved = false or coalesce(auth.jwt() ->> 'email','') = 'adcleice24@gmail.com')
);

create policy "places update admin" on public.places for update to authenticated
using (coalesce(auth.jwt() ->> 'email','') = 'adcleice24@gmail.com')
with check (coalesce(auth.jwt() ->> 'email','') = 'adcleice24@gmail.com');

create policy "places delete admin" on public.places for delete to authenticated
using (coalesce(auth.jwt() ->> 'email','') = 'adcleice24@gmail.com');

drop policy if exists "place reviews readable" on public.place_reviews;
drop policy if exists "place reviews insert own" on public.place_reviews;
drop policy if exists "place reviews update own" on public.place_reviews;
drop policy if exists "place reviews delete own or admin" on public.place_reviews;

create policy "place reviews readable" on public.place_reviews for select to authenticated using (true);
create policy "place reviews insert own" on public.place_reviews for insert to authenticated with check (auth.uid() = user_id);
create policy "place reviews update own" on public.place_reviews for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "place reviews delete own or admin" on public.place_reviews for delete to authenticated
using (auth.uid() = user_id or coalesce(auth.jwt() ->> 'email','') = 'adcleice24@gmail.com');

alter table public.place_reviews drop constraint if exists place_reviews_place_id_fkey;
alter table public.place_reviews add constraint place_reviews_place_id_fkey
foreign key(place_id) references public.places(id) on delete cascade;

-- ============================================================
-- 6) DENÚNCIAS: usuário vê a própria; administradora consegue moderar
-- ============================================================
alter table public.user_reports enable row level security;

drop policy if exists "reports own read" on public.user_reports;
create policy "reports own read or admin" on public.user_reports for select to authenticated
using (auth.uid() = reporter_id or coalesce(auth.jwt() ->> 'email','') = 'adcleice24@gmail.com');

drop policy if exists "reports admin update" on public.user_reports;
create policy "reports admin update" on public.user_reports for update to authenticated
using (coalesce(auth.jwt() ->> 'email','') = 'adcleice24@gmail.com')
with check (coalesce(auth.jwt() ->> 'email','') = 'adcleice24@gmail.com');

create index if not exists user_reports_status_created_idx on public.user_reports(status,created_at desc);

-- ============================================================
-- 7) FÓRUM: fecha políticas antigas excessivamente permissivas
-- ============================================================
drop policy if exists "forum posts update authenticated" on public.forum_posts;
drop policy if exists "forum posts update own or admin" on public.forum_posts;
create policy "forum posts update own or admin" on public.forum_posts for update to authenticated
using (auth.uid() = user_id or coalesce(auth.jwt() ->> 'email','') = 'adcleice24@gmail.com')
with check (auth.uid() = user_id or coalesce(auth.jwt() ->> 'email','') = 'adcleice24@gmail.com');

drop policy if exists "forum replies update own or admin" on public.forum_replies;
create policy "forum replies update own or admin" on public.forum_replies for update to authenticated
using (auth.uid() = user_id or coalesce(auth.jwt() ->> 'email','') = 'adcleice24@gmail.com')
with check (auth.uid() = user_id or coalesce(auth.jwt() ->> 'email','') = 'adcleice24@gmail.com');

-- Likes só podem ser criados/removidos pelo próprio usuário.
alter table public.forum_likes enable row level security;
drop policy if exists "forum likes readable" on public.forum_likes;
create policy "forum likes readable" on public.forum_likes for select to authenticated using (true);
drop policy if exists "forum likes insert own" on public.forum_likes;
create policy "forum likes insert own" on public.forum_likes for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "forum likes delete own" on public.forum_likes;
create policy "forum likes delete own" on public.forum_likes for delete to authenticated using (auth.uid() = user_id);

-- ============================================================
-- 8) USERNAME E ÍNDICES DE CONSULTA
-- ============================================================
create unique index if not exists profiles_username_unique_idx on public.profiles(lower(username));
create index if not exists profiles_username_search_idx on public.profiles(username);
create index if not exists connection_requests_recipient_status_idx on public.connection_requests(recipient_id,status,created_at desc);
create index if not exists messages_match_created_idx on public.messages(match_id,created_at desc);
create index if not exists forum_posts_created_at_idx on public.forum_posts(created_at desc);
create index if not exists forum_replies_post_created_idx on public.forum_replies(post_id,created_at);
