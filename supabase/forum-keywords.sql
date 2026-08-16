-- StudyMatch: palavras-chave livres para perfis e Fórum
alter table public.profiles
add column if not exists keywords text[] not null default '{}';

alter table public.forum_posts
add column if not exists keywords text[] not null default '{}';

create index if not exists forum_posts_keywords_gin
on public.forum_posts using gin (keywords);

create index if not exists profiles_keywords_gin
on public.profiles using gin (keywords);
