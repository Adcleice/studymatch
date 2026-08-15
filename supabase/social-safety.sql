-- StudyMatch: bloqueios e denúncias
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint cannot_block_self check (blocker_id <> blocked_id)
);

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint cannot_report_self check (reporter_id <> reported_id)
);

alter table public.user_blocks enable row level security;
alter table public.user_reports enable row level security;

drop policy if exists "blocks own read" on public.user_blocks;
create policy "blocks own read" on public.user_blocks for select to authenticated
using (auth.uid() = blocker_id or auth.uid() = blocked_id);

drop policy if exists "blocks own insert" on public.user_blocks;
create policy "blocks own insert" on public.user_blocks for insert to authenticated
with check (auth.uid() = blocker_id);

drop policy if exists "blocks own delete" on public.user_blocks;
create policy "blocks own delete" on public.user_blocks for delete to authenticated
using (auth.uid() = blocker_id);

drop policy if exists "reports own insert" on public.user_reports;
create policy "reports own insert" on public.user_reports for insert to authenticated
with check (auth.uid() = reporter_id);

drop policy if exists "reports own read" on public.user_reports;
create policy "reports own read" on public.user_reports for select to authenticated
using (auth.uid() = reporter_id);

-- Bloquear também desfaz conexões existentes e impede que a conversa continue acessível.
create or replace function public.block_user(p_blocked_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Usuário não autenticado'; end if;
  if p_blocked_id = v_user_id then raise exception 'Não é possível bloquear a si mesmo'; end if;

  insert into public.user_blocks(blocker_id, blocked_id)
  values(v_user_id, p_blocked_id)
  on conflict do nothing;

  delete from public.matches
  where (user1_id = v_user_id and user2_id = p_blocked_id)
     or (user1_id = p_blocked_id and user2_id = v_user_id);
end;
$$;

grant execute on function public.block_user(uuid) to authenticated;
