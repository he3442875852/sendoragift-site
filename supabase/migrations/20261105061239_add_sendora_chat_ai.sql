-- Apply after live_chat.sql and chat_auto_reception.sql. AI starts disabled.
begin;
alter table public.chat_settings add column if not exists ai_enabled boolean not null default false;
alter table public.chat_settings add column if not exists ai_key_ciphertext text not null default '';
alter table public.chat_settings add column if not exists ai_model text not null default 'gpt-6-luna';
alter table public.chat_settings add column if not exists ai_daily_limit integer not null default 50 check(ai_daily_limit between 1 and 200);
alter table public.chat_messages drop constraint if exists chat_messages_role_check;
alter table public.chat_messages add constraint chat_messages_role_check check(role in ('visitor','agent','assistant','ai'));
create table if not exists public.chat_ai_jobs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id),
  visitor_seq bigint not null unique references public.chat_messages(seq),
  status text not null default 'running' check(status in ('running','done','failed','cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists chat_ai_jobs_conversation_idx on public.chat_ai_jobs(conversation_id);
alter table public.chat_ai_jobs enable row level security;
revoke all on public.chat_ai_jobs from public,anon,authenticated;
grant all on public.chat_ai_jobs to service_role;

create or replace function public.sendora_chat_ai_begin(p_conversation_id uuid,p_client_id uuid,p_content text,p_choice text default '',p_prompt_seq bigint default 0)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  convo public.chat_conversations%rowtype;
  cfg public.chat_settings%rowtype;
  msg public.chat_messages%rowtype;
  job uuid;
  state jsonb;
  used integer;
  limited boolean;
begin
  if p_content is null or length(trim(p_content)) not between 1 and 2000 or p_choice not in ('','skip','handoff') or p_prompt_seq<0 then raise exception 'Invalid message' using errcode='22023'; end if;
  select * into convo from public.chat_conversations where id=p_conversation_id for update;
  if not found then raise exception 'Unknown conversation' using errcode='22023'; end if;
  select * into cfg from public.chat_settings where id=true;
  if not cfg.enabled or not cfg.ai_enabled or cfg.ai_key_ciphertext='' or cfg.available_until>now() or convo.intake_state->>'mode' in ('human','waiting') or p_choice='handoff' or lower(trim(p_content)) in ('human','agent','talk to a person','talk to the team','转人工','人工客服') then
    return public.sendora_chat_receive(p_conversation_id,p_client_id,p_content,p_choice,p_prompt_seq);
  end if;
  select * into msg from public.chat_messages where conversation_id=p_conversation_id and client_id=p_client_id;
  if found then
    if msg.role<>'visitor' or msg.content<>trim(p_content) then raise exception 'Message conflict' using errcode='23505'; end if;
    return jsonb_build_object('message',jsonb_build_object('seq',msg.seq,'role',msg.role,'content',msg.content,'client_id',msg.client_id,'created_at',msg.created_at),'intake',convo.intake_state);
  end if;
  insert into public.chat_messages(conversation_id,client_id,role,content) values(p_conversation_id,p_client_id,'visitor',trim(p_content)) returning * into msg;
  state:=convo.intake_state || jsonb_build_object('mode','ai','brief',coalesce(convo.intake_state->>'brief',trim(p_content)));
  if trim(p_content) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or trim(p_content) ~ '^\+[0-9 ()-]{8,30}$' then
    state:=jsonb_set(state,'{answers}',coalesce(state->'answers','{}')||jsonb_build_object('contact',trim(p_content)));
    if position('@' in p_content)>0 then update public.chat_conversations set email=trim(p_content) where id=p_conversation_id; end if;
  end if;
  select count(*) into used from public.chat_ai_jobs where conversation_id=p_conversation_id;
  limited:=used>=20;
  if not limited then limited:=not public.sendora_chat_rate_limit('ai:daily:'||(now() at time zone 'Asia/Shanghai')::date::text,cfg.ai_daily_limit,86400); end if;
  if limited then
    insert into public.chat_messages(conversation_id,client_id,role,content) values(p_conversation_id,gen_random_uuid(),'assistant','Your message is saved for our team. A person will follow up here when available. You can add details or optional contact information.');
    state:=state || '{"mode":"waiting"}'::jsonb;
  else
    insert into public.chat_ai_jobs(conversation_id,visitor_seq) values(p_conversation_id,msg.seq) returning id into job;
  end if;
  update public.chat_conversations set intake_state=state,status='waiting' where id=p_conversation_id;
  return jsonb_build_object('message',jsonb_build_object('seq',msg.seq,'role',msg.role,'content',msg.content,'client_id',msg.client_id,'created_at',msg.created_at),'intake',state,'job_id',job);
end; $$;

create or replace function public.sendora_chat_ai_finish(p_job_id uuid,p_reply text,p_answers jsonb,p_handoff boolean default false,p_failed boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  job public.chat_ai_jobs%rowtype;
  convo public.chat_conversations%rowtype;
  cfg public.chat_settings%rowtype;
  state jsonb;
  answers jsonb;
  field text;
  bot_seq bigint;
begin
  if length(trim(p_reply)) not between 1 and 2000 or p_answers is null or jsonb_typeof(p_answers)<>'object' then raise exception 'Invalid reply' using errcode='22023'; end if;
  select * into job from public.chat_ai_jobs where id=p_job_id;
  if not found then raise exception 'Unknown job' using errcode='22023'; end if;
  select * into convo from public.chat_conversations where id=job.conversation_id for update;
  select * into job from public.chat_ai_jobs where id=p_job_id for update;
  select * into cfg from public.chat_settings where id=true;
  if job.status<>'running' then return jsonb_build_object('intake',convo.intake_state,'published',false); end if;
  if not cfg.enabled or not cfg.ai_enabled or cfg.available_until>now() or convo.intake_state->>'mode'<>'ai' or convo.last_visitor_seq<>job.visitor_seq or exists(select 1 from public.chat_messages where conversation_id=convo.id and role='agent' and seq>job.visitor_seq) then
    update public.chat_ai_jobs set status='cancelled' where id=p_job_id;
    return jsonb_build_object('intake',convo.intake_state,'published',false);
  end if;
  state:=convo.intake_state;
  answers:=coalesce(state->'answers','{}');
  foreach field in array array['product','quantity','logo','destination','deadline'] loop
    if jsonb_typeof(p_answers->field)='string' and length(trim(p_answers->>field)) between 1 and 500 then answers:=answers||jsonb_build_object(field,trim(p_answers->>field)); end if;
  end loop;
  state:=state||jsonb_build_object('answers',answers,'mode',case when p_handoff or p_failed then 'waiting' else 'ai' end);
  insert into public.chat_messages(conversation_id,client_id,role,content) values(convo.id,gen_random_uuid(),case when p_failed then 'assistant' else 'ai' end,trim(p_reply)) returning seq into bot_seq;
  state:=state||jsonb_build_object('prompt_seq',bot_seq);
  update public.chat_conversations set intake_state=state,
    product=coalesce(answers->>'product',product),quantity=coalesce(answers->>'quantity',quantity),
    destination=coalesce(answers->>'destination',destination),deadline=coalesce(answers->>'deadline',deadline),status='waiting' where id=convo.id;
  update public.chat_ai_jobs set status=case when p_failed then 'failed' else 'done' end where id=p_job_id;
  return jsonb_build_object('intake',state,'published',true);
end; $$;
create or replace function public.sendora_chat_resume_auto(p_conversation_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
  update public.chat_conversations set intake_state=intake_state||'{"mode":"ai"}'::jsonb where id=p_conversation_id;
end; $$;
revoke execute on function public.sendora_chat_ai_begin(uuid,uuid,text,text,bigint) from public,anon,authenticated;
revoke execute on function public.sendora_chat_ai_finish(uuid,text,jsonb,boolean,boolean) from public,anon,authenticated;
revoke execute on function public.sendora_chat_resume_auto(uuid) from public,anon,authenticated;
grant execute on function public.sendora_chat_ai_begin(uuid,uuid,text,text,bigint) to service_role;
grant execute on function public.sendora_chat_ai_finish(uuid,text,jsonb,boolean,boolean) to service_role;
grant execute on function public.sendora_chat_resume_auto(uuid) to service_role;
notify pgrst,'reload schema';
commit;
