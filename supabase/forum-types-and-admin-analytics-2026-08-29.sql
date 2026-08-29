-- Matchworking: tipos de publicação no Fórum + métricas administrativas
-- Seguro para executar mais de uma vez.

alter table public.forum_posts
add column if not exists post_type text not null default 'Discussão';

alter table public.forum_posts
drop constraint if exists forum_posts_post_type_check;

alter table public.forum_posts
add constraint forum_posts_post_type_check
check (post_type in ('Dúvida','Projeto','Pesquisa','Colaboração','Grupo de estudo','Oportunidade','Discussão'));

create index if not exists forum_posts_post_type_created_idx
on public.forum_posts(post_type, created_at desc);

create or replace function public.admin_product_metrics()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_now timestamptz:=now();
  v_result jsonb;
begin
  if v_user is null or not exists(select 1 from public.app_admins where user_id=v_user) then
    raise exception 'Sem permissão';
  end if;

  select jsonb_build_object(
    'users_total',(select count(*) from public.profiles),
    'users_7d',(select count(*) from public.profiles where created_at>=v_now-interval '7 days'),
    'users_30d',(select count(*) from public.profiles where created_at>=v_now-interval '30 days'),
    'profiles_actionable',(select count(*) from public.profiles where cardinality(coalesce(can_help,'{}'::text[]))>0 and cardinality(coalesce(need_help,'{}'::text[]))>0),
    'connection_requests_total',(select count(*) from public.connection_requests),
    'connection_requests_7d',(select count(*) from public.connection_requests where created_at>=v_now-interval '7 days'),
    'connections_total',(select count(*) from public.matches),
    'connections_7d',(select count(*) from public.matches where created_at>=v_now-interval '7 days'),
    'messages_total',(select count(*) from public.messages),
    'messages_7d',(select count(*) from public.messages where created_at>=v_now-interval '7 days'),
    'forum_posts_total',(select count(*) from public.forum_posts where coalesce(hidden,false)=false),
    'forum_posts_7d',(select count(*) from public.forum_posts where coalesce(hidden,false)=false and created_at>=v_now-interval '7 days'),
    'forum_replies_7d',(select count(*) from public.forum_replies where coalesce(hidden,false)=false and created_at>=v_now-interval '7 days'),
    'accepted_rate',(
      select case when count(*) filter(where status in ('accepted','rejected'))=0 then 0
      else round(100.0*count(*) filter(where status='accepted')/count(*) filter(where status in ('accepted','rejected')),1) end
      from public.connection_requests
    ),
    'users_with_connections',(select count(distinct u) from (select user1_id u from public.matches union select user2_id from public.matches)x),
    'users_with_messages',(select count(distinct sender_id) from public.messages),
    'forum_types',(
      select coalesce(jsonb_object_agg(post_type,cnt),'{}'::jsonb)
      from (select post_type,count(*) cnt from public.forum_posts where coalesce(hidden,false)=false group by post_type order by count(*) desc)t
    )
  ) into v_result;
  return v_result;
end;$$;

grant execute on function public.admin_product_metrics() to authenticated;
