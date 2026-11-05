"use strict";
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let PGlite;try{({PGlite}=require('@electric-sql/pglite'));}catch(_){}
test('live-chat migration runs twice; messages, permissions and rate limits work in PostgreSQL', {skip:!PGlite},async()=>{
  const db=new PGlite();
  try{
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    const sql=fs.readFileSync(path.join(__dirname,'../supabase/live_chat.sql'),'utf8');await db.exec(sql);await db.exec(sql);
    assert.equal((await db.query('select enabled from public.chat_settings')).rows[0].enabled,false);
    await db.exec('set role anon');await assert.rejects(db.query('select * from public.chat_conversations'),error=>error.code==='42501');
    await assert.rejects(db.query("select public.sendora_chat_rate_limit('untrusted',1,60)"),error=>error.code==='42501');
    await db.exec('reset role; set role service_role;');
    const id='12345678-1234-4234-8234-123456789abc',client='22345678-1234-4234-8234-123456789abc';
    await db.query('insert into public.chat_conversations(id,token_hash,email,status) values($1,$2,$3,$4)',[id,'a'.repeat(64),'','closed']);
    const inserted=await db.query('insert into public.chat_messages(conversation_id,client_id,role,content) values($1,$2,$3,$4) returning seq',[id,client,'visitor','Please quote 200 pens.']);
    const seq=Number(inserted.rows[0].seq),summary=(await db.query('select * from public.chat_conversations where id=$1',[id])).rows[0];
    assert.equal(summary.status,'active');assert.equal(Number(summary.last_seq),seq);assert.equal(Number(summary.last_visitor_seq),seq);assert.equal(summary.last_message,'Please quote 200 pens.');
    await db.query('insert into public.chat_messages(conversation_id,client_id,role,content) values($1,$2,$3,$4) on conflict(conversation_id,client_id) do nothing',[id,client,'visitor','Please quote 200 pens.']);
    assert.equal((await db.query('select count(*)::int as count from public.chat_messages')).rows[0].count,1);
    await db.query('insert into public.chat_messages(conversation_id,client_id,role,content) values($1,$2,$3,$4)',[id,'32345678-1234-4234-8234-123456789abc','agent','Could you share the logo?']);
    const after=(await db.query('select last_seq,last_visitor_seq from public.chat_conversations where id=$1',[id])).rows[0];assert.ok(Number(after.last_seq)>seq);assert.equal(Number(after.last_visitor_seq),seq);
    for(const expected of [true,true,false])assert.equal((await db.query('select public.sendora_chat_rate_limit($1,2,60) as allowed',['test-ip-hash'])).rows[0].allowed,expected);
    await db.query("update public.chat_rate_limits set resets_at=now()-interval '1 second' where key=$1",['test-ip-hash']);
    assert.equal((await db.query('select public.sendora_chat_rate_limit($1,2,60) as allowed',['test-ip-hash'])).rows[0].allowed,true);
  }finally{await db.close();}
});
