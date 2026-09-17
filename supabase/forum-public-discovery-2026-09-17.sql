-- Matchworking: opt-in de descoberta pública para publicações do Fórum
alter table public.forum_posts
  add column if not exists public_discovery boolean not null default false;

comment on column public.forum_posts.public_discovery is
  'Quando true, o autor permite que a publicação seja exibida fora do Matchworking e indexada por mecanismos de busca.';

-- Apenas o próprio autor pode alterar a opção em uma publicação existente.
-- As políticas atuais de UPDATE continuam controlando a autoria.

create index if not exists forum_posts_public_discovery_idx
  on public.forum_posts (created_at desc)
  where public_discovery = true and hidden = false;

-- RPC pública e limitada: expõe somente os campos necessários da publicação
-- e somente quando houve opt-in e o conteúdo não está oculto.
create or replace function public.get_public_forum_post(p_post_id uuid)
returns table (
  id uuid,
  title text,
  body text,
  area text,
  keywords text[],
  post_type text,
  media_url text,
  media_type text,
  created_at timestamptz,
  updated_at timestamptz,
  author_name text,
  author_username text,
  author_avatar_url text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,p.title,p.body,p.area,p.keywords,p.post_type,p.media_url,p.media_type,
    p.created_at,p.updated_at,
    pr.name,pr.username,pr.avatar_url
  from public.forum_posts p
  join public.profiles pr on pr.id = p.user_id
  where p.id = p_post_id
    and p.public_discovery = true
    and coalesce(p.hidden,false) = false
  limit 1;
$$;

revoke all on function public.get_public_forum_post(uuid) from public;
grant execute on function public.get_public_forum_post(uuid) to anon, authenticated;
