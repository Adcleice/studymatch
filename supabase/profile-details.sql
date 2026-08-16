-- StudyMatch: campos adicionais do perfil
alter table public.profiles add column if not exists age integer;
alter table public.profiles add column if not exists course_or_role text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists interests text[] default '{}';
alter table public.profiles add column if not exists exchange_note text;

alter table public.profiles drop constraint if exists profiles_age_check;
alter table public.profiles add constraint profiles_age_check check (age is null or (age >= 13 and age <= 100));
