-- Apply after live_chat.sql. Existing conversations and visitor credentials remain valid.
begin;
alter table public.chat_conversations add column if not exists intake_state jsonb not null default '{}';
alter table public.chat_messages drop constraint if exists chat_messages_role_check;
alter table public.chat_messages add constraint chat_messages_role_check check(role in ('visitor','agent','assistant'));

-- An actual human reply stops automated questions in this conversation.
create or replace function public.sendora_chat_message_summary() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  update public.chat_conversations set last_seq=new.seq,
    last_visitor_seq=case when new.role='visitor' then new.seq else last_visitor_seq end,
    last_message=left(new.content,180),last_role=new.role,updated_at=now(),
    intake_state=case when new.role='agent' then intake_state || '{"mode":"human"}'::jsonb else intake_state end,
    status=case when new.role='visitor' and status='closed' then 'active' else status end
  where id=new.conversation_id;
  return new;
end; $$;

-- One transaction serializes visitor messages, question progression and the reply.
-- This RPC is server-only; visitor authorization is checked by /api/chat first.
create or replace function public.sendora_chat_receive(
  p_conversation_id uuid, p_client_id uuid, p_content text,
  p_choice text default '', p_prompt_seq bigint default 0
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  convo public.chat_conversations%rowtype;
  delivered public.chat_messages%rowtype;
  bot public.chat_messages%rowtype;
  state jsonb;
  answers jsonb;
  question integer;
  field text;
  reply text;
  is_online boolean;
  questions text[] := array[
    'Which product or gift set are you looking for? You can describe the items or the occasion.',
    'About how many pieces or gift sets do you need? An estimate is fine.',
    'What would you like to customize: logo, colours, packaging, or a combination? You can share artwork later through WhatsApp or our inquiry form.',
    'Which country and city will the order ship to? A postal code helps our team check delivery options.',
    'When do you need the order delivered? Please include the event date if there is one.',
    'Optional: leave an email or WhatsApp number so our team can follow up after you leave. You can skip this and return to this chat in the same browser.'
  ];
  fields text[] := array['product','quantity','logo','destination','deadline','contact'];
begin
  if length(trim(p_content)) not between 1 and 2000 or p_choice not in ('','skip','handoff') or p_prompt_seq<0 then
    raise exception 'Invalid message' using errcode='22023';
  end if;
  select * into convo from public.chat_conversations where id=p_conversation_id for update;
  if not found then raise exception 'Unknown conversation' using errcode='22023'; end if;
  select * into delivered from public.chat_messages where conversation_id=p_conversation_id and client_id=p_client_id;
  if found then
    if delivered.role<>'visitor' or delivered.content<>trim(p_content) then
      raise exception 'Message conflict' using errcode='23505';
    end if;
    return jsonb_build_object('message',jsonb_build_object('seq',delivered.seq,'role',delivered.role,'content',delivered.content,'client_id',delivered.client_id,'created_at',delivered.created_at),'intake',convo.intake_state);
  end if;
  insert into public.chat_messages(conversation_id,client_id,role,content)
    values(p_conversation_id,p_client_id,'visitor',trim(p_content)) returning * into delivered;
  state := convo.intake_state;
  select coalesce(enabled and available_until>now(),false) into is_online from public.chat_settings where id=true;
  if is_online or state->>'mode'='human' or exists(select 1 from public.chat_messages where conversation_id=p_conversation_id and role='agent') then
    state := state || '{"mode":"human"}'::jsonb;
  elsif p_choice='handoff' or lower(trim(p_content)) in ('human','agent','talk to a person','talk to the team','转人工','人工客服') then
    if coalesce(state->>'mode','')<>'waiting' then
      reply := 'I have left your conversation for our team. A person will follow up when available. You can add more details here, or use Add contact (optional) so we can reach you after you leave.';
    end if;
    state := state || '{"mode":"waiting"}'::jsonb;
  elsif coalesce(state->>'mode','') in ('completed','waiting') then
    null; -- Follow-up text remains a normal customer message; do not restart questions.
  elsif state->>'mode'='collecting' and coalesce((state->>'prompt_seq')::bigint,0)<>p_prompt_seq then
    null; -- A stale tab can send a message but cannot answer the next tab's question.
  else
    answers := coalesce(state->'answers','{}'::jsonb);
    if state->>'mode'='collecting' then
      question := (state->>'step')::integer;
      field := fields[question+1];
      if p_choice<>'skip' then
        answers := answers || jsonb_build_object(field,trim(p_content));
      end if;
      question := question+1;
    else
      question := 0;
      state := jsonb_build_object('brief',trim(p_content));
      reply := 'Hi! I am Sendora''s automated assistant. Our team is away, so I can collect a few details for them. You can skip any question or leave a message for the team.' || chr(10) || chr(10);
    end if;
    if question<6 then
      reply := coalesce(reply,'') || questions[question+1];
      state := state || jsonb_build_object('mode','collecting','step',question,'answers',answers);
    else
      state := state || jsonb_build_object('mode','completed','answers',answers);
      reply := 'Thank you. I have saved your details for our team. A person will review your request and follow up in this chat when available. You can add more information at any time.';
    end if;
    update public.chat_conversations set
      product=coalesce(answers->>'product',product), quantity=coalesce(answers->>'quantity',quantity),
      destination=coalesce(answers->>'destination',destination), deadline=coalesce(answers->>'deadline',deadline),
      email=case when coalesce(answers->>'contact','') ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then answers->>'contact' else email end
    where id=p_conversation_id;
  end if;
  if reply is not null then
    insert into public.chat_messages(conversation_id,client_id,role,content)
      values(p_conversation_id,pg_catalog.gen_random_uuid(),'assistant',reply) returning * into bot;
    state := state || jsonb_build_object('prompt_seq',bot.seq);
  end if;
  update public.chat_conversations set intake_state=state,
    status=case when state->>'mode' in ('collecting','completed','waiting') then 'waiting' else status end
    where id=p_conversation_id;
  return jsonb_build_object('message',jsonb_build_object('seq',delivered.seq,'role',delivered.role,'content',delivered.content,'client_id',delivered.client_id,'created_at',delivered.created_at),'intake',state);
end; $$;
revoke execute on function public.sendora_chat_receive(uuid,uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function public.sendora_chat_receive(uuid,uuid,text,text,bigint) to service_role;
notify pgrst,'reload schema';
commit;
