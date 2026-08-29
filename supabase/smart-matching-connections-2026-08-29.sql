-- Matchworking — conexão com propósito + base para recomendações explicáveis
-- Seguro para executar mais de uma vez.

alter table public.connection_requests add column if not exists reason text;
alter table public.connection_requests add column if not exists message text;

alter table public.connection_requests drop constraint if exists connection_requests_reason_check;
alter table public.connection_requests add constraint connection_requests_reason_check
check (reason is null or reason in ('Trocar conhecimento','Estudar juntos','Projeto','Pesquisa','Networking','Mentoria','Outro'));

alter table public.connection_requests drop constraint if exists connection_requests_message_length;
alter table public.connection_requests add constraint connection_requests_message_length
check (message is null or char_length(message) <= 300);

create or replace function public.send_connection_request(p_recipient_id uuid,p_reason text default null,p_message text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_user uuid:=auth.uid();v_id uuid;v_reason text:=nullif(btrim(p_reason),'');v_message text:=nullif(btrim(p_message),'');
begin
 if v_user is null then raise exception 'Usuário não autenticado'; end if;
 if p_recipient_id=v_user then raise exception 'Você não pode conectar consigo mesmo'; end if;
 if v_reason is not null and v_reason not in ('Trocar conhecimento','Estudar juntos','Projeto','Pesquisa','Networking','Mentoria','Outro') then raise exception 'Motivo de conexão inválido'; end if;
 if char_length(coalesce(v_message,''))>300 then raise exception 'A mensagem deve ter no máximo 300 caracteres'; end if;
 if exists(select 1 from public.user_blocks where (blocker_id=v_user and blocked_id=p_recipient_id) or (blocker_id=p_recipient_id and blocked_id=v_user)) then raise exception 'Conexão indisponível'; end if;
 if exists(select 1 from public.matches where (user1_id=v_user and user2_id=p_recipient_id) or (user1_id=p_recipient_id and user2_id=v_user)) then raise exception 'Vocês já estão conectados'; end if;
 select id into v_id from public.connection_requests where status='pending' and ((requester_id=v_user and recipient_id=p_recipient_id) or (requester_id=p_recipient_id and recipient_id=v_user)) limit 1;
 if v_id is not null then return v_id; end if;
 insert into public.connection_requests(requester_id,recipient_id,reason,message) values(v_user,p_recipient_id,v_reason,v_message) returning id into v_id;
 return v_id;
end;$$;

grant execute on function public.send_connection_request(uuid,text,text) to authenticated;

-- Mantém a assinatura antiga funcionando para clientes ainda não atualizados.
create or replace function public.send_connection_request(p_recipient_id uuid)
returns uuid language sql security definer set search_path=public
as $$ select public.send_connection_request(p_recipient_id,null,null); $$;
grant execute on function public.send_connection_request(uuid) to authenticated;
