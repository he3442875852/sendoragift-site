"use strict";
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
let parseHTML;try{({parseHTML}=require('linkedom'));}catch(_){}
const ID='12345678-1234-4234-8234-123456789abc';
const saved={id:ID,secret:'a'.repeat(64),active:true,readSeq:1};
const message=(seq,role,content)=>({seq,role,content,created_at:'2026-11-05T08:00:00Z',client_id:'22345678-1234-4234-8234-123456789abc'});
const flush=async()=>{for(let i=0;i<15;i++)await new Promise(resolve=>setImmediate(resolve));};
function surface(html,fetch){
  const {window,document}=parseHTML(html);const values=new Map([['sendora_chat_session',JSON.stringify(saved)],['sendora_admin_token','signed-test-token']]);const intervals=[];
  const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  window.HTMLElement.prototype.focus=function(){};
  // LinkeDOM has a getter-only select.value; browsers expose a setter too.
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.querySelector('option[selected]')?.getAttribute('value')||'';},set(value){this.querySelectorAll('option').forEach(option=>{if(option.getAttribute('value')===value)option.setAttribute('selected','');else option.removeAttribute('selected');});}});
  const sandbox={window,document,fetch,localStorage:storage,sessionStorage:storage,crypto:webcrypto,AbortSignal,URL,Date,Map,Set,Uint8Array,Intl,navigator:{language:'en'},location:{href:'https://www.sendoragift.com/custom-metal-pens.html'},setInterval:fn=>intervals.push(fn),setTimeout,console};
  return{window,document,values,intervals,run(file){vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),sandbox);},submit(id){document.getElementById(id).dispatchEvent(new window.Event('submit',{cancelable:true}));}};
}

test('customer chat preserves incoming messages when a send response arrives first and escapes buyer text',{skip:!parseHTML},async()=>{
  let incoming=false;const calls=[];
  const s=surface('<html><head></head><body></body></html>',async(url,options)=>{calls.push({url,options});if(url.includes('action=status'))return Response.json({ready:true,online:false});if(options.method==='POST'){incoming=true;return Response.json({message:message(3,'visitor','My follow-up')});}const after=Number(new URL(url,'https://test').searchParams.get('after'));return Response.json({messages:incoming?[message(1,'visitor','Hello'),message(2,'agent','<img src=x onerror=alert(1)>'),message(3,'visitor','My follow-up')].filter(m=>m.seq>after):after<1?[message(1,'visitor','Hello')]:[]});});
  s.run('assets/js/live-chat.js');await flush();s.document.getElementById('sg-chat-launch').click();await flush();s.document.getElementById('sg-chat-input').value='My follow-up';s.submit('sg-chat-composer');await flush();
  const rows=Array.from(s.document.getElementById('sg-chat-messages').children);assert.deepEqual(rows.map(row=>row.dataset.seq),['1','2','3']);assert.equal(s.document.querySelector('#sg-chat-messages img'),null);assert.match(rows[1].textContent,/<img src=x/);
  assert.ok(calls.some(call=>call.url==='/api/chat?after=1'));assert.equal(s.document.getElementById('sg-chat-input').value,'');
});

test('customer retries keep their idempotency key and failed messages survive a reload',{skip:!parseHTML},async()=>{
  let fail=true;const writes=[];
  const s=surface('<html><head></head><body></body></html>',async(url,options)=>{if(url.includes('action=status'))return Response.json({ready:true,online:false});if(options.method==='POST'){writes.push(JSON.parse(options.body));return fail?Response.json({message:'Connection failed'},{status:503}):Response.json({message:message(2,'visitor','Keep this draft')});}return Response.json({messages:[]});});
  s.run('assets/js/live-chat.js');await flush();s.document.getElementById('sg-chat-launch').click();s.document.getElementById('sg-chat-input').value='Keep this draft';s.submit('sg-chat-composer');await flush();
  assert.equal(JSON.parse(s.values.get('sendora_chat_session')).pending.content,'Keep this draft');assert.equal(s.document.getElementById('sg-chat-input').value,'Keep this draft');
  fail=false;s.submit('sg-chat-composer');await flush();assert.equal(writes.length,2);assert.equal(writes[0].client_id,writes[1].client_id);assert.equal(JSON.parse(s.values.get('sendora_chat_session')).pending,undefined);
});

test('visitor chat remains absent when the server reports incomplete setup',{skip:!parseHTML},async()=>{
  const s=surface('<html><head></head><body><a href="/contact/">Existing inquiry form</a></body></html>',async()=>Response.json({ready:false,online:false}));s.run('assets/js/live-chat.js');await flush();assert.equal(s.document.getElementById('sg-chat'),null);assert.equal(s.document.querySelector('a').getAttribute('href'),'/contact/');
});

test('the agent workspace reads all incoming messages before advancing its read cursor',{skip:!parseHTML},async()=>{
  const html=fs.readFileSync(path.join(__dirname,'../admin/chat/index.html'),'utf8');let sent=false;const reads=[];
  const customer={id:ID,name:'QA Buyer',email:'qa@example.com',status:'active',context:{},last_seq:1,last_visitor_seq:1,admin_read_seq:0,updated_at:'2026-11-05T08:00:00Z'};
  const s=surface(html,async(url,options)=>{if(url==='/api/admin-auth')return Response.json({ok:true});if(options.method==='POST'){const body=JSON.parse(options.body);if(body.action==='reply'){sent=true;return Response.json({message:message(3,'agent','Could you share the logo?')});}if(body.action==='read')reads.push(body.seq);return Response.json({ok:true});}if(url.includes('?id=')){const after=Number(new URL(url,'https://test').searchParams.get('after'));return Response.json({messages:(sent?[message(1,'visitor','Hi'),message(2,'visitor','We need 200 pens'),message(3,'agent','Could you share the logo?')]:[message(1,'visitor','Hi')]).filter(m=>m.seq>after)});}return Response.json({conversations:[customer],settings:{enabled:true}});});
  s.run('admin/chat/chat.js');await flush();s.document.querySelector('.conversation-card').click();await flush();s.document.getElementById('reply').value='Could you share the logo?';s.submit('replyForm');await flush();
  assert.deepEqual(Array.from(s.document.getElementById('messages').children).map(node=>node.dataset.seq),['1','2','3']);assert.equal(reads.at(-1),3);assert.equal(s.document.getElementById('reply').value,'');
});
