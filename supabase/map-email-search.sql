-- Matchworking: busca segura de perfis por e-mail exato no mapa
-- Retorna apenas perfis visíveis no mapa; o e-mail nunca é incluído no resultado.

create or replace function public.search_public_profile_by_email(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  email_query text := lower(btrim(coalesce(p_email, '')));
begin
  if auth.uid() is null then
    raise exception 'É necessário entrar para buscar perfis';
  end if;

  if email_query = '' or length(email_query) > 254
     or email_query !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return null;
  end if;

  select case
    when (p.city is not null and btrim(p.city) <> '')
      or (p.institution is not null and btrim(p.institution) <> '')
    then jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'username', p.username,
      'avatar_url', p.avatar_url,
      'bio', p.bio,
      'type', p.type,
      'institution', p.institution,
      'course_or_role', p.course_or_role,
      'city', p.city,
      'age', p.age,
      'can_help', p.can_help,
      'need_help', p.need_help,
      'interests', p.interests,
      'keywords', p.keywords,
      'show_age', p.show_age,
      'show_institution', p.show_institution,
      'show_city', p.show_city,
      'appear_on_map', p.appear_on_map,
      'allow_connection_requests', p.allow_connection_requests
    )
    else jsonb_build_object('id', p.id, 'city', p.city, 'institution', p.institution)
  end
  into result
  from public.profiles p
  where lower(p.email) = email_query
    and p.id <> auth.uid()
    and p.appear_on_map is distinct from false
  limit 1;

  return result;
end;
$$;

revoke all on function public.search_public_profile_by_email(text) from public, anon;
grant execute on function public.search_public_profile_by_email(text) to authenticated;
