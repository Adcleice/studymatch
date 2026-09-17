-- Matchworking: acesso controlado por aprovação
-- Execute no Supabase SQL Editor antes de publicar a interface.

create table if not exists public.membership_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  source text not null default 'request' check (source in ('existing','waitlist','invite','request','admin')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id),
  note text
);
create unique index if not exists membership_access_email_idx on public.membership_access (lower(email));

create table if not exists public.access_invites (
  email text primary key,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  note text
);

alter table public.membership_access enable row level security;
alter table public.access_invites enable row level security;

-- Usuário pode ver somente o próprio estado.
drop policy if exists membership_access_self_read on public.membership_access;
create policy membership_access_self_read on public.membership_access
for select to authenticated using (user_id = auth.uid());

-- Administradores gerenciam todos os acessos.
drop policy if exists membership_access_admin_all on public.membership_access;
create policy membership_access_admin_all on public.membership_access
for all to authenticated
using (exists(select 1 from public.app_admins a where a.user_id=auth.uid()))
with check (exists(select 1 from public.app_admins a where a.user_id=auth.uid()));

drop policy if exists access_invites_admin_all on public.access_invites;
create policy access_invites_admin_all on public.access_invites
for all to authenticated
using (exists(select 1 from public.app_admins a where a.user_id=auth.uid()))
with check (exists(select 1 from public.app_admins a where a.user_id=auth.uid()));

-- Todas as contas que já existem ficam aprovadas para não quebrar o acesso atual.
insert into public.membership_access(user_id,email,status,source,decided_at)
select id, lower(email), 'approved', 'existing', now()
from auth.users
where email is not null
on conflict (user_id) do nothing;

-- Cria/atualiza o estado de acesso depois do cadastro/login.
-- Lista de espera e convite entram aprovados automaticamente.
create or replace function public.ensure_my_membership()
returns table(status text, source text)
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_email text;
  v_status text;
  v_source text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select lower(u.email) into v_email from auth.users u where u.id=auth.uid();

  select m.status,m.source into v_status,v_source
  from public.membership_access m where m.user_id=auth.uid();

  if v_status is null then
    if exists(select 1 from public.access_invites i where lower(i.email)=v_email) then
      v_status:='approved'; v_source:='invite';
    elsif exists(select 1 from public.waitlist w where lower(w.email)=v_email) then
      v_status:='approved'; v_source:='waitlist';
    else
      v_status:='pending'; v_source:='request';
    end if;
    insert into public.membership_access(user_id,email,status,source,decided_at)
    values(auth.uid(),v_email,v_status,v_source,case when v_status='approved' then now() else null end)
    on conflict(user_id) do nothing;
  end if;
  return query select v_status,v_source;
end;
$$;
revoke all on function public.ensure_my_membership() from public;
grant execute on function public.ensure_my_membership() to authenticated;

-- Estado resumido usado pelo app.
create or replace function public.my_membership_status()
returns table(status text, source text)
language sql
security definer
set search_path=public
stable
as $$
 select m.status,m.source from public.membership_access m where m.user_id=auth.uid() limit 1
$$;
revoke all on function public.my_membership_status() from public;
grant execute on function public.my_membership_status() to authenticated;

-- Administração: aprovar, recusar, suspender ou reabrir como pendente.
create or replace function public.admin_set_membership(p_user_id uuid,p_status text,p_note text default null)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
 if not exists(select 1 from public.app_admins where user_id=auth.uid()) then raise exception 'admin only'; end if;
 if p_status not in ('pending','approved','rejected','suspended') then raise exception 'invalid status'; end if;
 update public.membership_access
 set status=p_status,note=p_note,decided_at=case when p_status='pending' then null else now() end,decided_by=case when p_status='pending' then null else auth.uid() end
 where user_id=p_user_id;
end;
$$;
revoke all on function public.admin_set_membership(uuid,text,text) from public;
grant execute on function public.admin_set_membership(uuid,text,text) to authenticated;

-- Observação de segurança:
-- a interface bloqueará contas não aprovadas. Para proteção total de dados contra acesso REST direto,
-- as políticas RLS das tabelas de produto devem, em uma segunda migração, incorporar status='approved'.
