-- Matchworking — limpeza inicial de valores estruturados já existentes.
-- Não altera biografias, mensagens nem textos do Fórum.

update public.profiles
set institution='Universidade de São Paulo'
where lower(regexp_replace(translate(coalesce(institution,''),'ÁÀÃÂÉÊÍÓÔÕÚÇáàãâéêíóôõúç','AAAAEEIOOOUCaaaaeeiooouc'),'[^a-zA-Z0-9]+','','g'))
  in ('usp','universidadedesaopaulo','universidadesaopaulo');

update public.profiles
set institution='Universidade Estadual Paulista Júlio de Mesquita Filho'
where lower(regexp_replace(translate(coalesce(institution,''),'ÁÀÃÂÉÊÍÓÔÕÚÇáàãâéêíóôõúç','AAAAEEIOOOUCaaaaeeiooouc'),'[^a-zA-Z0-9]+','','g'))
  in ('unesp','universidadeestadualpaulista','universidadeestadualpaulistajuliodemesquitafilho');

update public.profiles
set institution='Universidade Estadual de Campinas'
where lower(regexp_replace(translate(coalesce(institution,''),'ÁÀÃÂÉÊÍÓÔÕÚÇáàãâéêíóôõúç','AAAAEEIOOOUCaaaaeeiooouc'),'[^a-zA-Z0-9]+','','g'))
  in ('unicamp','universidadeestadualdecampinas');

update public.profiles
set course_or_role='Profissional de Publicidade'
where lower(regexp_replace(translate(coalesce(course_or_role,''),'ÁÀÃÂÉÊÍÓÔÕÚÇáàãâéêíóôõúç','AAAAEEIOOOUCaaaaeeiooouc'),'[^a-zA-Z0-9]+','','g'))
  in ('publicitaria','publicitario','profissionaldepublicidade');

update public.profiles
set course_or_role='Publicidade e Propaganda'
where lower(regexp_replace(translate(coalesce(course_or_role,''),'ÁÀÃÂÉÊÍÓÔÕÚÇáàãâéêíóôõúç','AAAAEEIOOOUCaaaaeeiooouc'),'[^a-zA-Z0-9]+','','g'))
  in ('publicidadeepropaganda','pp','publi');

-- Conferência dos valores atuais mais frequentes.
select institution,count(*) from public.profiles where institution is not null group by institution order by count(*) desc,institution;
select course_or_role,count(*) from public.profiles where course_or_role is not null group by course_or_role order by count(*) desc,course_or_role;
