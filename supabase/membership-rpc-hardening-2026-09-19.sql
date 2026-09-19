-- Matchworking: endurecimento final dos RPCs de produto para o gate de associação
-- Execute depois de membership-rls-gate-2026-09-17.sql.

-- Tabela legada ainda tocada por unmatch_connection.
do $$
begin
  if to_regclass('public.swipes') is not null then
    alter table public.swipes enable row level security;
    drop policy if exists "membership approved gate" on public.swipes;
    create policy "membership approved gate" on public.swipes
      as restrictive for all to authenticated
      using (public.is_approved_member(auth.uid()))
      with check (public.is_approved_member(auth.uid()));
  end if;
end $$;

create or replace function public.send_connection_request(p_recipient_id uuid,p_reason text default null,p_message text default null)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_user uuid:=auth.uid();v_id uuid;v_reason text:=nullif(btrim(p_reason),'');v_message text:=nullif(btrim(p_message),'');
begin
 perform public.require_approved_member();
 if v_user is null then raise exception 'Usuário não autenticado'; end if;
 if p_recipient_id=v_user then raise exception 'Você não pode conectar consigo mesmo'; end if;
 if not public.is_approved_member(p_recipient_id) then raise exception 'Conexão indisponível'; end if;
 if v_reason is not null and v_reason not in ('Trocar conhecimento','Estudar juntos','Projeto','Pesquisa','Networking','Mentoria','Outro') then raise exception 'Motivo de conexão inválido'; end if;
 if char_length(coalesce(v_message,''))>300 then raise exception 'A mensagem deve ter no máximo 300 caracteres'; end if;
 if exists(select 1 from public.user_blocks where (blocker_id=v_user and blocked_id=p_recipient_id) or (blocker_id=p_recipient_id and blocked_id=v_user)) then raise exception 'Conexão indisponível'; end if;
 if exists(select 1 from public.matches where (user1_id=v_user and user2_id=p_recipient_id) or (user1_id=p_recipient_id and user2_id=v_user)) then raise exception 'Vocês já estão conectados'; end if;
 select id into v_id from public.connection_requests where status='pending' and ((requester_id=v_user and recipient_id=p_recipient_id) or (requester_id=p_recipient_id and recipient_id=v_user)) limit 1;
 if v_id is not null then return v_id; end if;
 insert into public.connection_requests(requester_id,recipient_id,reason,message) values(v_user,p_recipient_id,v_reason,v_message) returning id into v_id;
 return v_id;
end;$$;

create or replace function public.send_connection_request(p_recipient_id uuid)
returns uuid language sql security definer set search_path=public
as $$ select public.send_connection_request(p_recipient_id,null,null); $$;

create or replace function public.accept_connection_request(p_request_id uuid)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_user uuid:=auth.uid();v_req public.connection_requests%rowtype;v_match uuid;
begin
 perform public.require_approved_member();
 select * into v_req from public.connection_requests where id=p_request_id for update;
 if v_req.id is null then raise exception 'Solicitação não encontrada'; end if;
 if v_req.recipient_id<>v_user then raise exception 'Sem permissão'; end if;
 if v_req.status<>'pending' then raise exception 'Solicitação já respondida'; end if;
 if not public.is_approved_member(v_req.requester_id) then raise exception 'Conexão indisponível'; end if;
 select id into v_match from public.matches where (user1_id=v_req.requester_id and user2_id=v_req.recipient_id) or (user1_id=v_req.recipient_id and user2_id=v_req.requester_id) limit 1;
 if v_match is null then insert into public.matches(user1_id,user2_id,created_at) values(v_req.requester_id,v_req.recipient_id,now()) returning id into v_match; end if;
 update public.connection_requests set status='accepted',responded_at=now() where id=p_request_id;
 return v_match;
end;$$;

create or replace function public.reject_connection_request(p_request_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
begin
 perform public.require_approved_member();
 update public.connection_requests set status='rejected',responded_at=now() where id=p_request_id and recipient_id=auth.uid() and status='pending';
 if not found then raise exception 'Solicitação não encontrada ou sem permissão'; end if;
end;$$;

create or replace function public.cancel_connection_request(p_request_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
begin
 perform public.require_approved_member();
 update public.connection_requests set status='cancelled',responded_at=now() where id=p_request_id and requester_id=auth.uid() and status='pending';
 if not found then raise exception 'Solicitação não encontrada ou sem permissão'; end if;
end;$$;

create or replace function public.block_user(p_blocked_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare v_user_id uuid:=auth.uid();
begin
 perform public.require_approved_member();
 if v_user_id is null then raise exception 'Usuário não autenticado'; end if;
 if p_blocked_id=v_user_id then raise exception 'Não é possível bloquear a si mesmo'; end if;
 insert into public.user_blocks(blocker_id,blocked_id) values(v_user_id,p_blocked_id) on conflict do nothing;
 delete from public.matches where (user1_id=v_user_id and user2_id=p_blocked_id) or (user1_id=p_blocked_id and user2_id=v_user_id);
end;$$;

create or replace function public.unmatch_connection(p_match_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare v_user1 uuid;v_user2 uuid;
begin
 perform public.require_approved_member();
 select user1_id,user2_id into v_user1,v_user2 from public.matches where id=p_match_id;
 if v_user1 is null then raise exception 'Conexão não encontrada'; end if;
 if auth.uid() is null or auth.uid() not in (v_user1,v_user2) then raise exception 'Sem permissão para desfazer esta conexão'; end if;
 delete from public.messages where match_id=p_match_id;
 delete from public.matches where id=p_match_id;
 if to_regclass('public.swipes') is not null then
   execute 'delete from public.swipes where (user_id=$1 and target_id=$2) or (user_id=$2 and target_id=$1)' using v_user1,v_user2;
 end if;
end;$$;

create or replace function public.refresh_place_rating(p_place_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
begin
 perform public.require_approved_member();
 update public.places p set
 avg_rating=coalesce((select round(avg(r.rating)::numeric,1) from public.place_reviews r where r.place_id=p_place_id),0),
 review_count=(select count(*)::integer from public.place_reviews r where r.place_id=p_place_id)
 where p.id=p_place_id;
end;$$;

create or replace function public.get_public_connection_reviews(p_user_id uuid)
returns table(rating integer,tags text[]) language plpgsql stable security definer set search_path=public
as $$
begin
 perform public.require_approved_member();
 return query select r.rating::integer,coalesce(r.tags,'{}'::text[]) from public.connection_reviews r where r.reviewed_id=p_user_id and r.rating between 1 and 5;
end;$$;

revoke all on function public.send_connection_request(uuid,text,text) from public;
revoke all on function public.send_connection_request(uuid) from public;
revoke all on function public.accept_connection_request(uuid) from public;
revoke all on function public.reject_connection_request(uuid) from public;
revoke all on function public.cancel_connection_request(uuid) from public;
revoke all on function public.block_user(uuid) from public;
revoke all on function public.unmatch_connection(uuid) from public;
revoke all on function public.refresh_place_rating(uuid) from public;
revoke all on function public.get_public_connection_reviews(uuid) from public;

grant execute on function public.send_connection_request(uuid,text,text) to authenticated;
grant execute on function public.send_connection_request(uuid) to authenticated;
grant execute on function public.accept_connection_request(uuid) to authenticated;
grant execute on function public.reject_connection_request(uuid) to authenticated;
grant execute on function public.cancel_connection_request(uuid) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unmatch_connection(uuid) to authenticated;
grant execute on function public.refresh_place_rating(uuid) to authenticated;
grant execute on function public.get_public_connection_reviews(uuid) to authenticated;

-- Permanecem deliberadamente fora do gate:
-- get_public_forum_post(uuid): descoberta pública opt-in.
-- ensure_my_membership()/my_membership_status(): necessários antes da aprovação.
-- admin_set_membership(...): possui sua própria verificação de app_admins.
