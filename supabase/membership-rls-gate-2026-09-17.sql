-- Matchworking: trava de associação no banco
-- Execute depois de membership-approval-2026-09-17.sql.
-- Estratégia: não reescreve dezenas de policies existentes. Um hook RLS comum
-- é aplicado às tabelas privadas via políticas RESTRICTIVE, que precisam ser
-- satisfeitas em conjunto com as policies atuais.

create or replace function public.is_approved_member(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path=public
stable
as $$
  select exists(
    select 1 from public.membership_access m
    where m.user_id=p_user_id and m.status='approved'
  ) or exists(
    select 1 from public.app_admins a where a.user_id=p_user_id
  );
$$;
revoke all on function public.is_approved_member(uuid) from public;
grant execute on function public.is_approved_member(uuid) to authenticated;

-- Adiciona uma policy RESTRICTIVE para cada tabela privada existente.
-- RESTRICTIVE = além da policy normal da tabela, o usuário também precisa ser aprovado.
do $$
declare
  t text;
  private_tables text[] := array[
    'profiles','matches','messages','connection_requests','connection_reviews',
    'notifications','user_blocks','user_reports',
    'forum_posts','forum_replies','forum_likes','forum_saved_posts','forum_reports',
    'places','place_reviews','rooms','room_members','room_messages'
  ];
begin
  foreach t in array private_tables loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I enable row level security',t);
      execute format('drop policy if exists %I on public.%I','membership approved gate',t);
      execute format(
        'create policy %I on public.%I as restrictive for all to authenticated using (public.is_approved_member(auth.uid())) with check (public.is_approved_member(auth.uid()))',
        'membership approved gate',t
      );
    end if;
  end loop;
end $$;

-- Storage privado/operacional: impede pendentes de fazer upload, alterar ou ler
-- objetos protegidos. Buckets deliberadamente públicos continuam servindo URLs
-- públicas conforme a configuração do bucket; o gate protege operações autenticadas.
drop policy if exists "membership approved storage gate" on storage.objects;
create policy "membership approved storage gate"
on storage.objects
as restrictive
for all
to authenticated
using (public.is_approved_member(auth.uid()))
with check (public.is_approved_member(auth.uid()));

-- RPCs security definer podem ignorar RLS. Este helper permite que funções
-- sensíveis passem a exigir aprovação sem depender da interface.
create or replace function public.require_approved_member()
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_approved_member(auth.uid()) then
    raise exception 'membership approval required' using errcode='42501';
  end if;
end;
$$;
revoke all on function public.require_approved_member() from public;
grant execute on function public.require_approved_member() to authenticated;

-- Protege RPCs conhecidas que dão acesso a dados/ações por meio de um gate de
-- autorização na própria execução. Wrappers antigos permanecem compatíveis.
-- Observação: funções administrativas já verificam app_admins separadamente.

-- Validação final: mostra as tabelas que receberam o gate.
select schemaname,tablename,policyname,permissive,roles,cmd
from pg_policies
where schemaname in ('public','storage')
  and policyname='membership approved gate'
order by tablename;
