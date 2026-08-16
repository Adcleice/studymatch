-- StudyMatch: solicitações de conexão com aceitar/recusar
create table if not exists public.connection_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint connection_request_not_self check (requester_id <> recipient_id)
);

create unique index if not exists connection_requests_one_pending_pair
on public.connection_requests (least(requester_id, recipient_id), greatest(requester_id, recipient_id))
where status = 'pending';

alter table public.connection_requests enable row level security;

drop policy if exists "connection requests own read" on public.connection_requests;
create policy "connection requests own read" on public.connection_requests
for select to authenticated
using (auth.uid() = requester_id or auth.uid() = recipient_id);

create or replace function public.send_connection_request(p_recipient_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then raise exception 'Usuário não autenticado'; end if;
  if p_recipient_id = v_user then raise exception 'Você não pode conectar consigo mesmo'; end if;

  if exists (
    select 1 from public.user_blocks
    where (blocker_id=v_user and blocked_id=p_recipient_id)
       or (blocker_id=p_recipient_id and blocked_id=v_user)
  ) then raise exception 'Conexão indisponível'; end if;

  if exists (
    select 1 from public.matches
    where (user1_id=v_user and user2_id=p_recipient_id)
       or (user1_id=p_recipient_id and user2_id=v_user)
  ) then raise exception 'Vocês já estão conectados'; end if;

  select id into v_id from public.connection_requests
  where status='pending'
    and ((requester_id=v_user and recipient_id=p_recipient_id)
      or (requester_id=p_recipient_id and recipient_id=v_user))
  limit 1;

  if v_id is not null then return v_id; end if;

  insert into public.connection_requests(requester_id,recipient_id)
  values(v_user,p_recipient_id)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.accept_connection_request(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_req public.connection_requests%rowtype;
  v_match uuid;
begin
  select * into v_req from public.connection_requests where id=p_request_id for update;
  if v_req.id is null then raise exception 'Solicitação não encontrada'; end if;
  if v_req.recipient_id <> v_user then raise exception 'Sem permissão'; end if;
  if v_req.status <> 'pending' then raise exception 'Solicitação já respondida'; end if;

  select id into v_match from public.matches
  where (user1_id=v_req.requester_id and user2_id=v_req.recipient_id)
     or (user1_id=v_req.recipient_id and user2_id=v_req.requester_id)
  limit 1;

  if v_match is null then
    insert into public.matches(user1_id,user2_id,created_at)
    values(v_req.requester_id,v_req.recipient_id,now()) returning id into v_match;
  end if;

  update public.connection_requests
  set status='accepted', responded_at=now()
  where id=p_request_id;

  return v_match;
end;
$$;

create or replace function public.reject_connection_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.connection_requests
  set status='rejected', responded_at=now()
  where id=p_request_id and recipient_id=auth.uid() and status='pending';
  if not found then raise exception 'Solicitação não encontrada ou sem permissão'; end if;
end;
$$;

create or replace function public.cancel_connection_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.connection_requests
  set status='cancelled', responded_at=now()
  where id=p_request_id and requester_id=auth.uid() and status='pending';
  if not found then raise exception 'Solicitação não encontrada ou sem permissão'; end if;
end;
$$;

grant execute on function public.send_connection_request(uuid) to authenticated;
grant execute on function public.accept_connection_request(uuid) to authenticated;
grant execute on function public.reject_connection_request(uuid) to authenticated;
grant execute on function public.cancel_connection_request(uuid) to authenticated;
