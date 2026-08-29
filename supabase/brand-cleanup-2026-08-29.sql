-- Matchworking — limpeza segura de referências legadas da marca
-- Pode ser executado mais de uma vez no Supabase SQL Editor.
-- Não renomeia IDs técnicos, tabelas, buckets ou chaves necessárias para compatibilidade.

-- 1) Garante que a configuração central use Matchworking.
update public.app_settings
set value = jsonb_set(
  coalesce(value,'{}'::jsonb),
  '{brand_name}',
  to_jsonb('Matchworking'::text),
  true
),
updated_at = now()
where key = 'site';

-- 2) Limpa referências legadas em notificações geradas pelo próprio sistema.
-- Não altera conteúdo criado por usuários em fórum, perfil, chat etc.
update public.notifications
set
  title = replace(replace(title,'StudyMatch','Matchworking'),'Studymatch','Matchworking'),
  body = case when body is null then null else replace(replace(body,'StudyMatch','Matchworking'),'Studymatch','Matchworking') end
where title ilike '%studymatch%'
   or body ilike '%studymatch%';

-- 3) Conferência: deve retornar zero para os campos institucionais acima.
select
  (select count(*) from public.notifications where title ilike '%studymatch%' or body ilike '%studymatch%') as notificacoes_legadas,
  (select value->>'brand_name' from public.app_settings where key='site') as marca_atual;
