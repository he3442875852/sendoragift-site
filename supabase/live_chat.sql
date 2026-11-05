-- Additive migration. Run once in the existing Supabase SQL Editor.
-- Existing inquiries are untouched. Chat stays disabled until enabled in /admin/chat/.
begin;
create table if not exists public.chat_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  available_until timestamptz
);
insert into public.chat_settings(id) values(true) on conflict do nothing;
create table if not exists public.chat_conversations (
  id uuid primary key,
  token_hash text not null check(length(token_hash)=64),
  name text not null default '', company text not null default '',
  email text not null, product text not null default '', quantity text not null default '',
  destination text not null default '', deadline text not null default '',
  context jsonb not null default '{}',
  status text not null default 'active' check(status in ('active','waiting','closed')),
  notes text not null default '',
  last_seq bigint not null default 0, last_visitor_seq bigint not null default 0,
  admin_read_seq bigint not null default 0,
  last_message text not null default '', last_role text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create sequence if not exists public.chat_messages_seq_seq;
create table if not exists public.chat_messages (
  seq bigint primary key,
  conversation_id uuid not null references public.chat_conversations(id),
  client_id uuid not null,
  role text not null check(role in ('visitor','agent')),
  content text not null check(length(trim(content)) between 1 and 2000),
  created_at timestamptz not null default now(),
  unique(conversation_id,client_id)
);
create index if not exists chat_conversations_updated_idx on public.chat_conversations(updated_at desc,id desc);
create index if not exists chat_messages_conversation_idx on public.chat_messages(conversation_id,seq);
create table if not exists public.chat_rate_limits (
  key text primary key, hits integer not null, resets_at timestamptz not null
);
-- A row lock prevents a later message becoming visible before an earlier one
-- in the same conversation. Message insert and conversation summary are atomic.
create or replace function public.sendora_chat_message_guard() returns trigger
language plpgsql set search_path='' as $$
begin
  perform 1 from public.chat_conversations where id=new.conversation_id for update;
  new.seq=nextval('public.chat_messages_seq_seq');
  return new;
end; $$;
create or replace function public.sendora_chat_message_summary() returns trigger
language plpgsql set search_path='' as $$
begin
  update public.chat_conversations set last_seq=new.seq,
    last_visitor_seq=case when new.role='visitor' then new.seq else last_visitor_seq end,
    last_message=left(new.content,180),last_role=new.role,updated_at=now(),
    status=case when new.role='visitor' and status='closed' then 'active' else status end
  where id=new.conversation_id;
  return new;
end; $$;
drop trigger if exists chat_message_guard on public.chat_messages;
create trigger chat_message_guard before insert on public.chat_messages
for each row execute function public.sendora_chat_message_guard();
drop trigger if exists chat_message_summary on public.chat_messages;
create trigger chat_message_summary after insert on public.chat_messages
for each row execute function public.sendora_chat_message_summary();
create or replace function public.sendora_chat_rate_limit(p_key text,p_limit integer,p_seconds integer)
returns boolean language plpgsql set search_path='' as $$
declare used integer;
begin
  insert into public.chat_rate_limits(key,hits,resets_at)
  values(p_key,1,now()+make_interval(secs=>p_seconds))
  on conflict(key) do update set
    hits=case when public.chat_rate_limits.resets_at<=now() then 1 else public.chat_rate_limits.hits+1 end,
    resets_at=case when public.chat_rate_limits.resets_at<=now() then now()+make_interval(secs=>p_seconds) else public.chat_rate_limits.resets_at end
  returning hits into used;
  delete from public.chat_rate_limits where resets_at<now()-interval '1 day';
  return used<=p_limit;
end; $$;
alter table public.chat_settings enable row level security;
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_rate_limits enable row level security;
revoke all on public.chat_settings,public.chat_conversations,public.chat_messages,public.chat_rate_limits from anon,authenticated;
grant all on public.chat_settings,public.chat_conversations,public.chat_messages,public.chat_rate_limits to service_role;
grant usage,select on sequence public.chat_messages_seq_seq to service_role;
revoke execute on function public.sendora_chat_rate_limit(text,integer,integer) from public,anon,authenticated;
revoke execute on function public.sendora_chat_message_guard() from public,anon,authenticated;
revoke execute on function public.sendora_chat_message_summary() from public,anon,authenticated;
grant execute on function public.sendora_chat_rate_limit(text,integer,integer) to service_role;
grant execute on function public.sendora_chat_message_guard() to service_role;
grant execute on function public.sendora_chat_message_summary() to service_role;
notify pgrst,'reload schema';
commit;
