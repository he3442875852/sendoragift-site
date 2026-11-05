"use strict";
const {test}=require("node:test"), assert=require("node:assert/strict"), fs=require("node:fs"), path=require("node:path"), {randomUUID}=require("node:crypto");
let PGlite;try{({PGlite}=require("@electric-sql/pglite"));}catch(_){}
const migration=fs.readdirSync(path.join(__dirname,"../supabase/migrations")).find(file=>file.endsWith("_add_sendora_chat_ai.sql"));
async function fixture(run){const db=new PGlite();try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;");
  for(const file of ["live_chat.sql","chat_auto_reception.sql","migrations/"+migration,"migrations/"+migration])await db.exec(fs.readFileSync(path.join(__dirname,"../supabase",file),"utf8"));
  assert.equal((await db.query("select ai_enabled from public.chat_settings")).rows[0].ai_enabled,false);
  await db.exec("update public.chat_settings set enabled=true,ai_enabled=true,ai_key_ciphertext='test-encrypted-placeholder';");
  const create=async()=>{const id=randomUUID();await db.query("insert into public.chat_conversations(id,token_hash,email) values($1,$2,'')",[id,"a".repeat(64)]);return id;};
  const begin=async(id,content="Can you customize a logo?",client=randomUUID())=>(await db.query("select public.sendora_chat_ai_begin($1,$2,$3,'',0) as result",[id,client,content])).rows[0].result;
  const finish=async(job,answers={},handoff=false,failed=false)=>(await db.query("select public.sendora_chat_ai_finish($1,$2,$3,$4,$5) as result",[job,"Logo options depend on the selected product. What item are you considering?",JSON.stringify(answers),handoff,failed])).rows[0].result;
  await run(db,create,begin,finish);
}finally{await db.close();}}
test("AI delivery is idempotent and records the reply and partial project summary",{skip:!PGlite},()=>fixture(async(db,create,begin,finish)=>{
  const id=await create(),client=randomUUID();const r=await begin(id,undefined,client);assert.ok(r.job_id);
  const duplicate=await begin(id,undefined,client);assert.equal(duplicate.job_id,undefined);assert.equal(duplicate.message.seq,r.message.seq);
  const result=await finish(r.job_id,{product:"PU folders",quantity:"200",destination:"Australia"});assert.equal(result.published,true);
  assert.equal(result.intake.answers.product,"PU folders");assert.equal(result.intake.mode,"ai");
  assert.equal((await finish(r.job_id)).published,false);
  const row=(await db.query("select product,quantity,last_role,last_seq,last_visitor_seq from public.chat_conversations where id=$1",[id])).rows[0];assert.equal(row.product,"PU folders");assert.equal(row.quantity,"200");assert.equal(row.last_role,"ai");assert.ok(Number(row.last_seq)>Number(row.last_visitor_seq));
  assert.equal((await db.query("select count(*)::int as n from public.chat_messages where role='ai'")).rows[0].n,1);
}));
test("an in-flight AI reply is suppressed after a human takes over, then can be explicitly resumed",{skip:!PGlite},()=>fixture(async(db,create,begin,finish)=>{
  const id=await create(),r=await begin(id);
  await db.query("insert into public.chat_messages(conversation_id,client_id,role,content) values($1,$2,'agent','A person is helping now')",[id,randomUUID()]);
  assert.equal((await finish(r.job_id)).published,false);
  assert.equal((await begin(id,"Thank you")).job_id,undefined);
  await db.query("select public.sendora_chat_resume_auto($1)",[id]);
  const resumed=await begin(id,"Another logo question");assert.ok(resumed.job_id);assert.equal((await finish(resumed.job_id)).published,true);
}));
test("newer visitor messages, online presence, or disabling AI cancel stale replies",{skip:!PGlite},()=>fixture(async(db,create,begin,finish)=>{
  const id=await create(),old=await begin(id),latest=await begin(id,"Actually, a metal pen");assert.equal((await finish(old.job_id)).published,false);assert.equal((await finish(latest.job_id)).published,true);
  const second=await create(),online=await begin(second);await db.exec("update public.chat_settings set available_until=now()+interval '1 minute'");assert.equal((await finish(online.job_id)).published,false);
  await db.exec("update public.chat_settings set available_until=null");const third=await create(),disabled=await begin(third);await db.exec("update public.chat_settings set ai_enabled=false");assert.equal((await finish(disabled.job_id)).published,false);
}));
test("the global daily cap prevents a second external call and customer handoff stays human",{skip:!PGlite},()=>fixture(async(db,create,begin,finish)=>{
  await db.exec("update public.chat_settings set ai_daily_limit=1");
  const first=await begin(await create());assert.ok(first.job_id);
  const second=await begin(await create());assert.equal(second.job_id,null);assert.equal(second.intake.mode,"waiting");
  await finish(first.job_id,{},true);const next=await begin(first.message.conversation_id || (await db.query("select conversation_id from public.chat_ai_jobs where id=$1",[first.job_id])).rows[0].conversation_id,"Please contact me");assert.equal(next.job_id,undefined);
}));
test("AI outage produces one saved fallback and never forces contact or clears existing answers",{skip:!PGlite},()=>fixture(async(db,create,begin,finish)=>{
  const id=await create();await db.query("update public.chat_conversations set intake_state=$1 where id=$2",[JSON.stringify({answers:{product:"Metal pens"}}),id]);
  const r=await begin(id);const done=await finish(r.job_id,{},false,true);assert.equal(done.intake.mode,"waiting");assert.equal(done.intake.answers.product,"Metal pens");
  const row=(await db.query("select role from public.chat_messages order by seq desc limit 1")).rows[0];assert.equal(row.role,"assistant");
  assert.equal((await db.query("select email from public.chat_conversations where id=$1",[id])).rows[0].email,"");
}));
test("AI jobs and all privileged RPCs remain inaccessible to public and authenticated roles",{skip:!PGlite},()=>fixture(async(db,create,begin)=>{
  const id=await create();for(const role of ["anon","authenticated"]){await db.exec("set role "+role);await assert.rejects(begin(id),e=>e.code==="42501");await assert.rejects(db.query("select * from public.chat_ai_jobs"),e=>e.code==="42501");await assert.rejects(db.query("select ai_key_ciphertext from public.chat_settings"),e=>e.code==="42501");await assert.rejects(db.query("select public.sendora_chat_resume_auto($1)",[id]),e=>e.code==="42501");await db.exec("reset role");}
}));
test("a conversation cannot reserve more than twenty model calls",{skip:!PGlite},()=>fixture(async(db,create,begin)=>{
  const id=await create();for(let i=0;i<20;i++)assert.ok((await begin(id,"Question "+i)).job_id);
  const result=await begin(id,"Another question");assert.equal(result.job_id,null);assert.equal(result.intake.mode,"waiting");
  assert.equal((await db.query("select count(*)::int as n from public.chat_ai_jobs where conversation_id=$1",[id])).rows[0].n,20);
}));
