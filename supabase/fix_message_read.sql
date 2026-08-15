-- StudyMatch: correção definitiva de mensagens não lidas

create or replace function public.mark_match_messages_read(p_match_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not exists (
    select 1
    from public.matches
    where id = p_match_id
      and (user1_id = v_user_id or user2_id = v_user_id)
  ) then
    raise exception 'Sem permissão para acessar esta conversa';
  end if;

  update public.messages
  set read = true
  where match_id = p_match_id
    and sender_id <> v_user_id
    and read = false;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.mark_match_messages_read(uuid) to authenticated;
