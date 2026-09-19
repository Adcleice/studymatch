-- Matchworking: controle de envio dos e-mails de acesso
alter table public.membership_access
  add column if not exists approval_email_sent_at timestamptz;

alter table public.access_invites
  add column if not exists invite_email_sent_at timestamptz;
