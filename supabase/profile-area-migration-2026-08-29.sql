-- Matchworking — integra palavras-chave antigas aos campos do perfil.
-- Seguro para executar mais de uma vez.
-- O campo keywords permanece por compatibilidade com o schema, mas deixa de ser usado no perfil.

update public.profiles p
set
  interests = coalesce((
    select array_agg(v order by first_pos)
    from (
      select min(ord) as first_pos, min(term) as v
      from (
        select ord, btrim(term) as term, lower(btrim(term)) as normalized
        from unnest(coalesce(p.interests,'{}'::text[]) || coalesce(p.keywords,'{}'::text[])) with ordinality as u(term,ord)
        where btrim(term) <> ''
      ) x
      group by normalized
    ) d
  ),'{}'::text[]),
  keywords = '{}'::text[]
where cardinality(coalesce(p.keywords,'{}'::text[])) > 0;

-- Conferência: nenhum perfil deve continuar com palavras-chave legadas.
select count(*) as perfis_com_keywords_legadas
from public.profiles
where cardinality(coalesce(keywords,'{}'::text[])) > 0;
