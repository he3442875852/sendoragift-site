"use strict";
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const crypto=require('node:crypto');
const store=require('../lib/chat-store');
const visitorApi=require('../api/chat');
const adminApi=require('../api/admin-chat');
const auth=require('../lib/admin-auth');
const ID='12345678-1234-4234-8234-123456789abc';
const CLIENT='22345678-1234-4234-8234-123456789abc';
const SECRET='a'.repeat(64);
const settings={enabled:true,available_until:null};

async function environment(fn){
  const values={SUPABASE_URL:'https://chat-test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'private-test-key',ADMIN_DASHBOARD_SECRET:'b'.repeat(64),TURNSTILE_SECRET_KEY:'challenge-test',TURNSTILE_SITE_KEY:'public-test'};
  const saved=Object.fromEntries(Object.keys(values).map(key=>[key,process.env[key]]));
  Object.assign(process.env,values);const original=global.fetch;
  try{await fn();}finally{global.fetch=original;for(const [key,value] of Object.entries(saved)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
}
function response(data,status=200){return new Response(JSON.stringify(data),{status});}
function call(handler,{method='GET',body,headers={},url='/api/chat'}={}){
  const req=Readable.from(body===undefined?[]:[Buffer.from(typeof body==='string'?body:JSON.stringify(body))]);req.method=method;req.url=url;req.headers=Object.assign({host:'www.sendoragift.com',origin:'https://www.sendoragift.com'},headers);
  return new Promise((resolve,reject)=>{const res={headers:{},setHeader(key,value){this.headers[key]=value;},end(value){resolve({status:this.statusCode,headers:this.headers,body:JSON.parse(value)});}};Promise.resolve(handler(req,res)).catch(reject);});
}
function visitorHeaders(){return{authorization:'Bearer '+SECRET,'x-chat-session':ID};}

test('chat stays hidden when prerequisites or schema are unavailable',()=>environment(async()=>{
  delete process.env.TURNSTILE_SITE_KEY;
  assert.equal((await call(visitorApi,{url:'/api/chat?action=status'})).body.ready,false);
  process.env.TURNSTILE_SITE_KEY='public-test';global.fetch=async()=>response({code:'PGRST205'},404);
  const result=await call(visitorApi,{url:'/api/chat?action=status'});
  assert.equal(result.status,200);assert.equal(result.body.ready,false);assert.equal(result.headers['Cache-Control'],'no-store');
}));

test('online status expires without a current agent heartbeat',()=>environment(async()=>{
  global.fetch=async()=>response([{enabled:true,available_until:new Date(Date.now()-1000).toISOString()}]);
  const result=await call(visitorApi,{url:'/api/chat?action=status'});
  assert.equal(result.body.ready,true);assert.equal(result.body.online,false);
}));

test('a session ID without its secret cannot read any messages',()=>environment(async()=>{
  const paths=[];global.fetch=async url=>{paths.push(url);return response(url.includes('chat_settings')?[settings]:[]);};
  const result=await call(visitorApi,{headers:visitorHeaders()});
  assert.equal(result.status,401);assert.equal(paths.some(path=>path.includes('chat_messages')),false);
  assert.ok(paths.some(path=>path.includes('token_hash=eq.'+crypto.createHash('sha256').update(SECRET).digest('hex'))));
  assert.ok(paths.every(path=>!path.includes(SECRET)));
}));

test('visitor writes reject foreign origins before accessing the database',()=>environment(async()=>{
  let calls=0;global.fetch=async()=>{calls++;return response([]);};
  const result=await call(visitorApi,{method:'POST',body:{action:'start'},headers:{origin:'https://attacker.example'}});
  assert.equal(result.status,403);assert.equal(calls,0);
}));

test('chat creation validates Turnstile, rate limits, and saves attribution without returning secrets',()=>environment(async()=>{
  const calls=[];global.fetch=async(url,options)=>{calls.push({url,options});if(url.includes('siteverify'))return response({success:true,action:'sendora_chat',hostname:'www.sendoragift.com'});if(url.includes('chat_settings'))return response([settings]);if(url.includes('rpc/'))return response(true);if(options.method==='POST')return response([{id:ID,token_hash:'must-not-be-returned'}]);return response([]);};
  const result=await call(visitorApi,{method:'POST',headers:visitorHeaders(),body:{action:'start',email:'buyer@example.com',challenge:'test-challenge',product:'Metal pens',quantity:'200',context:{current_page:'https://www.sendoragift.com/custom-metal-pens.html',source_type:'google'}}});
  assert.equal(result.status,200);assert.deepEqual(result.body,{ok:true,id:ID});
  const create=calls.find(call=>call.url.includes('on_conflict=id'));
  const record=JSON.parse(create.options.body);assert.equal(record.product,'Metal pens');assert.equal(record.context.source_type,'google');assert.notEqual(record.token_hash,SECRET);
  const rate=JSON.parse(calls.find(call=>call.url.includes('rpc/')).options.body);assert.equal(rate.p_limit,8);assert.match(rate.p_key,/^start:[a-f0-9]{64}$/);
  assert.equal(create.options.headers.apikey,'private-test-key');
}));

test('a failed bot check never creates a chat conversation',()=>environment(async()=>{
  let created=false;global.fetch=async(url,options)=>{if(url.includes('siteverify'))return response({success:false});if(url.includes('chat_settings'))return response([settings]);if(url.includes('rpc/'))return response(true);if(options.method==='POST')created=true;return response([]);};
  const result=await call(visitorApi,{method:'POST',headers:visitorHeaders(),body:{action:'start',email:'buyer@example.com',challenge:'bad'}});
  assert.equal(result.status,400);assert.equal(created,false);
}));

test('a guest can create a protected chat without an email or name',()=>environment(async()=>{
  let record;
  global.fetch=async(url,options)=>{if(url.includes('siteverify'))return response({success:true,action:'sendora_chat',hostname:'www.sendoragift.com'});if(url.includes('chat_settings'))return response([settings]);if(url.includes('rpc/'))return response(true);if(options.method==='POST'){record=JSON.parse(options.body);return response([{id:ID}]);}return response([]);};
  const result=await call(visitorApi,{method:'POST',headers:visitorHeaders(),body:{action:'start',challenge:'valid-proof'}});
  assert.equal(result.status,200);assert.equal(record.email,'');assert.equal(record.name,'');assert.equal(record.id,ID);
}));

test('an optional email is still validated when supplied',()=>environment(async()=>{
  let created=false;global.fetch=async(url,options)=>{if(options.method==='POST')created=true;return response(url.includes('chat_settings')?[settings]:[]);};
  const result=await call(visitorApi,{method:'POST',headers:visitorHeaders(),body:{action:'start',email:'invalid-address',challenge:'proof'}});assert.equal(result.status,400);assert.equal(created,false);
}));

test('optional contact updates stay within the authenticated visitor session',()=>environment(async()=>{
  let update;
  global.fetch=async(url,options)=>{if(url.includes('chat_settings'))return response([settings]);if(url.includes('rpc/'))return response(true);if(options.method==='PATCH'){update={url,body:JSON.parse(options.body)};return response([{id:ID}]);}return response([{id:ID,status:'active'}]);};
  const result=await call(visitorApi,{method:'POST',headers:visitorHeaders(),body:{action:'profile',id:'00000000-0000-4000-8000-000000000000',name:'Alex',email:''}});
  assert.equal(result.status,200);assert.ok(update.url.endsWith('id=eq.'+ID));assert.deepEqual(update.body,{name:'Alex'});
}));

test('new sessions are rate limited before a challenge is spent',()=>environment(async()=>{
  let challenged=false;global.fetch=async url=>{if(url.includes('siteverify'))challenged=true;return response(url.includes('chat_settings')?[settings]:url.includes('rpc/')?false:[]);};
  const result=await call(visitorApi,{method:'POST',headers:visitorHeaders(),body:{action:'start',email:'buyer@example.com',challenge:'test'}});
  assert.equal(result.status,429);assert.equal(challenged,false);
}));

test('lost creation responses can be retried without creating another session',()=>environment(async()=>{
  let challengeCalls=0;global.fetch=async url=>{if(url.includes('siteverify'))challengeCalls++;return response(url.includes('chat_settings')?[settings]:[{id:ID}]);};
  const result=await call(visitorApi,{method:'POST',headers:visitorHeaders(),body:{action:'start'}});
  assert.equal(result.status,200);assert.equal(challengeCalls,0);
}));

test('duplicate message retries return the original delivery and never overwrite another role',()=>environment(async()=>{
  const message={seq:7,client_id:CLIENT,content:'Please quote 200 pens.',role:'visitor'};
  const calls=[];global.fetch=async(url,options)=>{calls.push({url,options});return response(options.method==='POST'?[]:[message]);};
  assert.equal((await store.sendMessage(ID,'visitor',{client_id:CLIENT,content:message.content})).seq,7);
  assert.match(calls[0].options.headers.Prefer,/ignore-duplicates/);
  await assert.rejects(store.sendMessage(ID,'agent',{client_id:CLIENT,content:message.content}),error=>error.status===409);
  await assert.rejects(store.sendMessage(ID,'visitor',{client_id:CLIENT,content:'Edited message'}),error=>error.status===409);
}));

test('visitor message reads are scoped, ordered, paged and contain no internal notes',()=>environment(async()=>{
  let messagesUrl='';global.fetch=async url=>{if(url.includes('chat_settings'))return response([settings]);if(url.includes('chat_conversations'))return response([{id:ID,status:'active'}]);messagesUrl=url;return response([{seq:101,role:'agent',content:'Hello'}]);};
  const result=await call(visitorApi,{url:'/api/chat?after=100',headers:visitorHeaders()});
  assert.equal(result.status,200);assert.match(messagesUrl,new RegExp('conversation_id=eq.'+ID));assert.match(messagesUrl,/seq=gt.100/);assert.match(messagesUrl,/order=seq.asc&limit=100/);assert.doesNotMatch(messagesUrl,/notes|token_hash/);
}));

test('admin data and writes require an authenticated session',()=>environment(async()=>{
  let calls=0;global.fetch=async()=>{calls++;return response([]);};
  for(const method of ['GET','POST','PATCH'])assert.equal((await call(adminApi,{method,body:method==='GET'?undefined:{action:'settings',enabled:true}})).status,401);
  assert.equal(calls,0);
}));

test('the admin inbox excludes visitor session hashes',()=>environment(async()=>{
  let inboxUrl='';global.fetch=async url=>{if(url.includes('chat_settings'))return response([settings]);inboxUrl=url;return response([]);};
  const result=await call(adminApi,{url:'/api/admin-chat',headers:{authorization:'Bearer '+auth.createSession()}});
  assert.equal(result.status,200);assert.doesNotMatch(inboxUrl,/token_hash/);assert.match(inboxUrl,/limit=100/);
}));

test('admin read markers cannot move backwards or exceed delivered sequence',()=>environment(async()=>{
  let update;global.fetch=async(url,options)=>{update={url,options};return response([{id:ID}]);};
  const result=await call(adminApi,{method:'POST',headers:{authorization:'Bearer '+auth.createSession()},body:{action:'read',id:ID,seq:42}});
  assert.equal(result.status,200);assert.match(update.url,/admin_read_seq=lt.42&last_seq=gte.42/);assert.equal(JSON.parse(update.options.body).admin_read_seq,42);
}));

test('an agent heartbeat is temporary and independent from enabling chat',()=>environment(async()=>{
  let patch;global.fetch=async(_url,options)=>{patch=JSON.parse(options.body);return response([patch]);};
  const now=Date.now();const result=await call(adminApi,{method:'POST',headers:{authorization:'Bearer '+auth.createSession()},body:{action:'settings',online:true}});
  assert.equal(result.status,200);assert.ok(Date.parse(patch.available_until)>now+60000);assert.ok(Date.parse(patch.available_until)<=Date.now()+75000);assert.equal(patch.enabled,undefined);
}));

test('invalid cursors, oversized bodies and non-string messages are rejected',()=>environment(async()=>{
  await assert.rejects(store.messages(ID,'1&select=*'),error=>error.status===400);
  await assert.rejects(store.sendMessage(ID,'visitor',{client_id:CLIENT,content:{text:'not a string'}}),error=>error.status===400);
  const req=Readable.from([Buffer.from(JSON.stringify({large:'x'.repeat(20000)}))]);
  await assert.rejects(store.readJson(req),error=>error.status===413);
}));

test('visitor intake writes use the verified session and expose only public progress',()=>environment(async()=>{
  let params;
  global.fetch=async(url,options)=>{
    if(url.includes('chat_settings'))return response([settings]);
    if(url.includes('rpc/sendora_chat_rate_limit'))return response(true);
    if(url.includes('rpc/sendora_chat_receive')){params=JSON.parse(options.body);return response({message:{seq:3,role:'visitor',content:'200'},intake:{mode:'collecting',step:2,prompt_seq:4,answers:{contact:'private'},brief:'private'}});}
    return response([{id:ID,status:'waiting',intake_state:{mode:'collecting',step:1,prompt_seq:2}}]);
  };
  const result=await call(visitorApi,{method:'POST',headers:visitorHeaders(),body:{action:'send',id:CLIENT,role:'assistant',content:'200',client_id:CLIENT,prompt_seq:2}});
  assert.equal(result.status,200);assert.equal(params.p_conversation_id,ID);assert.equal(params.p_prompt_seq,2);assert.equal(params.p_content,'200');
  assert.deepEqual(result.body.intake,{mode:'collecting',step:2,prompt_seq:4});assert.equal(result.body.message.role,'visitor');
  for(const body of [{choice:'admin'},{prompt_seq:'2&select=*'},{prompt_seq:-1}])
    await assert.rejects(store.receiveMessage(ID,{content:'200',client_id:CLIENT,...body}),error=>error.status===400);
}));

test('restoring a visitor session returns question progress without internal or contact fields',()=>environment(async()=>{
  global.fetch=async url=>response(url.includes('chat_settings')?[settings]:url.includes('chat_conversations')?[{id:ID,status:'waiting',intake_state:{mode:'collecting',step:4,prompt_seq:10,answers:{product:'pens'},notes:'internal'}}]:[]);
  const result=await call(visitorApi,{headers:visitorHeaders()});
  assert.deepEqual(result.body.intake,{mode:'collecting',step:4,prompt_seq:10});assert.equal(result.body.notes,undefined);
}));
