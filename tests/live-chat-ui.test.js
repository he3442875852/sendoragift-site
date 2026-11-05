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
  const sandbox={window,document,fetch,localStorage:storage,sessionStorage:storage,crypto:webcrypto,AbortSignal,URL,Date,Map,Set,Uint8Array,Intl,navigator:{language:'en'},location:{href:'https://www.sendoragift.com/custom-metal-pens.html'},setInterval:fn=>intervals.push(fn),setTimeout,clearTimeout,console};
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

test('a new visitor sends the first message without filling contact fields',{skip:!parseHTML},async()=>{
  const writes=[];let delivered=null;
  const s=surface('<html><head></head><body></body></html>',async(url,options)=>{
    if(url.includes('action=status'))return Response.json({ready:true,online:true});
    if(url.includes('turnstile-site-key'))return Response.json({siteKey:'test-key'});
    if(options?.method==='POST'){const body=JSON.parse(options.body);writes.push(body);if(body.action==='start')return Response.json({ok:true,id:ID});if(body.action==='send'){delivered={...message(1,'visitor',body.content),client_id:body.client_id};return Response.json({message:delivered});}return Response.json({ok:true});}
    return Response.json({messages:delivered?[delivered]:[]});
  });
  s.values.delete('sendora_chat_session');s.window.turnstile={render(_node,options){assert.equal(options.appearance,'interaction-only');options.callback('test-proof');return 0;},reset(){}};
  s.run('assets/js/live-chat.js');await flush();s.document.getElementById('sg-chat-launch').click();await flush();
  assert.equal(s.document.getElementById('sg-chat-start'),null);assert.equal(s.document.getElementById('sg-chat-contact').hidden,true);
  s.document.getElementById('sg-chat-input').value='Hi, can I customize a pen?';s.submit('sg-chat-composer');await flush();
  assert.deepEqual(writes.map(x=>x.action),['start','send']);assert.equal(writes[0].email,undefined);assert.equal(writes[0].name,undefined);assert.equal(writes[0].challenge,'test-proof');
  assert.match(s.document.getElementById('sg-chat-messages').textContent,/Hi, can I customize a pen/);assert.equal(s.document.getElementById('sg-chat-input').value,'');
});

test('contact details are optional and can be added after a conversation exists',{skip:!parseHTML},async()=>{
  let profile;
  const s=surface('<html><head></head><body></body></html>',async(url,options)=>{if(url.includes('action=status'))return Response.json({ready:true,online:false});if(options?.method==='POST'){profile=JSON.parse(options.body);return Response.json({ok:true});}return Response.json({messages:[]});});
  s.run('assets/js/live-chat.js');await flush();s.document.getElementById('sg-chat-launch').click();
  assert.equal(s.document.getElementById('sg-chat-contact').hidden,true);s.document.getElementById('sg-chat-contact-toggle').click();assert.equal(s.document.getElementById('sg-chat-contact').hidden,false);
  assert.equal(s.document.getElementById('sg-chat-contact-email').hasAttribute('required'),false);
  s.document.getElementById('sg-chat-contact-name').value='Alex';s.submit('sg-chat-contact-form');await flush();assert.equal(profile.action,'profile');assert.equal(profile.name,'Alex');assert.equal(profile.email,'');assert.equal(s.document.getElementById('sg-chat-contact-result').textContent,'Saved');
});

test('the workspace labels an anonymous customer with a readable visitor number',{skip:!parseHTML},async()=>{
  const html=fs.readFileSync(path.join(__dirname,'../admin/chat/index.html'),'utf8');
  const s=surface(html,async url=>Response.json(url==='/api/admin-auth'?{ok:true}:{conversations:[{id:ID,name:'',email:'',context:{},status:'active',last_message:'Hello',updated_at:'2026-11-05T08:00:00Z'}],settings:{enabled:true}}));
  s.run('admin/chat/chat.js');await flush();assert.match(s.document.querySelector('.conversation-card').textContent,/访客 789ABC/);
});

test('background refresh preserves a stable conversation button when nothing changed',{skip:!parseHTML},async()=>{
  const html=fs.readFileSync(path.join(__dirname,'../admin/chat/index.html'),'utf8');
  const s=surface(html,async url=>Response.json(url==='/api/admin-auth'?{ok:true}:{conversations:[{id:ID,name:'',email:'',context:{},status:'active',last_message:'Hello',updated_at:'2026-11-05T08:00:00Z'}],settings:{enabled:true}}));
  s.run('admin/chat/chat.js');await flush();const original=s.document.querySelector('.conversation-card');s.intervals[0]();await flush();assert.equal(s.document.querySelector('.conversation-card'),original);
});

test('the agent workspace reads all incoming messages before advancing its read cursor',{skip:!parseHTML},async()=>{
  const html=fs.readFileSync(path.join(__dirname,'../admin/chat/index.html'),'utf8');let sent=false;const reads=[];
  const customer={id:ID,name:'QA Buyer',email:'qa@example.com',status:'active',context:{},last_seq:1,last_visitor_seq:1,admin_read_seq:0,updated_at:'2026-11-05T08:00:00Z'};
  const s=surface(html,async(url,options)=>{if(url==='/api/admin-auth')return Response.json({ok:true});if(options.method==='POST'){const body=JSON.parse(options.body);if(body.action==='reply'){sent=true;return Response.json({message:message(3,'agent','Could you share the logo?')});}if(body.action==='read')reads.push(body.seq);return Response.json({ok:true});}if(url.includes('?id=')){const after=Number(new URL(url,'https://test').searchParams.get('after'));return Response.json({messages:(sent?[message(1,'visitor','Hi'),message(2,'visitor','We need 200 pens'),message(3,'agent','Could you share the logo?')]:[message(1,'visitor','Hi')]).filter(m=>m.seq>after)});}return Response.json({conversations:[customer],settings:{enabled:true}});});
  s.run('admin/chat/chat.js');await flush();s.document.querySelector('.conversation-card').click();await flush();s.document.getElementById('reply').value='Could you share the logo?';s.submit('replyForm');await flush();
  assert.deepEqual(Array.from(s.document.getElementById('messages').children).map(node=>node.dataset.seq),['1','2','3']);assert.equal(reads.at(-1),3);assert.equal(s.document.getElementById('reply').value,'');
});

test('automated questions are labelled and can be skipped without a form or contact details',{skip:!parseHTML},async()=>{
  let state={mode:'collecting',step:0,prompt_seq:2};const writes=[];
  const s=surface('<html><head></head><body></body></html>',async(url,options)=>{
    if(url.includes('action=status'))return Response.json({ready:true,online:false});
    if(options?.method==='POST'){const body=JSON.parse(options.body);writes.push(body);state={mode:'collecting',step:1,prompt_seq:4};return Response.json({message:message(3,'visitor',body.content),intake:state});}
    return Response.json({messages:[message(2,'assistant','Which product or gift set?')],intake:state});
  });
  s.run('assets/js/live-chat.js');await flush();s.document.getElementById('sg-chat-launch').click();await flush();
  assert.match(s.document.getElementById('sg-chat-status').textContent,/Automated assistant/);
  assert.match(s.document.querySelector('.sg-chat-message.assistant small').textContent,/Automated assistant/);
  assert.match(s.document.getElementById('sg-chat-progress').textContent,/1 of 6/);
  s.document.querySelector('#sg-chat-prompts button').click();await flush();
  assert.equal(writes[0].choice,'skip');assert.equal(writes[0].prompt_seq,2);assert.equal(writes[0].content,'Skip this question');
  assert.match(s.document.getElementById('sg-chat-progress').textContent,/2 of 6/);
  assert.equal(s.document.getElementById('sg-chat-contact').hidden,true);
});

test('a human response hides stale automated controls and keeps free chat available',{skip:!parseHTML},async()=>{
  let human=false;
  const s=surface('<html><head></head><body></body></html>',async(url)=>{
    if(url.includes('action=status'))return Response.json({ready:true,online:false});
    return Response.json({messages:human?[message(3,'agent','Hello, I can help')]:[message(2,'assistant','Which product?')],intake:{mode:human?'human':'collecting',step:0,prompt_seq:2}});
  });
  s.run('assets/js/live-chat.js');await flush();s.document.getElementById('sg-chat-launch').click();await flush();
  assert.equal(s.document.getElementById('sg-chat-progress').hidden,false);
  human=true;s.intervals[0]();await flush();
  assert.equal(s.document.getElementById('sg-chat-progress').hidden,true);assert.equal(s.document.querySelectorAll('#sg-chat-prompts button').length,0);
  assert.equal(s.document.getElementById('sg-chat-input').disabled,false);
});

test('the workspace refreshes the collected summary without clearing an agent draft',{skip:!parseHTML},async()=>{
  const html=fs.readFileSync(path.join(__dirname,'../admin/chat/index.html'),'utf8');
  const customer={id:ID,name:'',email:'',status:'waiting',context:{},intake_state:{mode:'collecting',step:1,brief:'Hello',answers:{product:'PU folders'}},updated_at:'2026-11-05T08:00:00Z'};
  const s=surface(html,async(url)=>Response.json(url==='/api/admin-auth'?{ok:true}:url.includes('?id=')?{messages:[message(2,'assistant','How many?')]}:{conversations:[customer],settings:{enabled:true}}));
  s.run('admin/chat/chat.js');await flush();s.document.querySelector('.conversation-card').click();await flush();
  assert.match(s.document.getElementById('messages').textContent,/自动接待助手/);
  s.document.getElementById('reply').value='An unsent staff draft';s.document.getElementById('notes').value='An unsaved note';
  customer.intake_state={mode:'completed',answers:{product:'PU folders',logo:'Silver logo',contact:'WhatsApp +61 example'}};
  s.intervals[0]();await flush();
  assert.match(s.document.getElementById('buyingDetails').textContent,/Silver logo/);assert.match(s.document.getElementById('buyingDetails').textContent,/待人工跟进/);
  assert.match(s.document.getElementById('contactDetails').textContent,/WhatsApp \+61 example/);
  assert.equal(s.document.getElementById('reply').value,'An unsent staff draft');assert.equal(s.document.getElementById('notes').value,'An unsaved note');
});
test('AI replies are clearly labelled, escaped and offer a human handoff without a fixed interview',{skip:!parseHTML},async()=>{
  const s=surface('<html><head></head><body></body></html>',async url=>Response.json(url.includes('action=status')?{ready:true,online:false,ai_available:true}:{messages:[message(2,'ai','<img src=x> We can review logo options.')],intake:{mode:'ai',step:null,prompt_seq:2}}));
  s.run('assets/js/live-chat.js');await flush();s.document.getElementById('sg-chat-launch').click();await flush();
  assert.match(s.document.getElementById('sg-chat-status').textContent,/AI assistant/);assert.match(s.document.querySelector('.sg-chat-message.ai small').textContent,/AI assistant/);
  assert.equal(s.document.querySelector('#sg-chat-messages img'),null);assert.equal(s.document.getElementById('sg-chat-progress').hidden,true);
  assert.match(s.document.getElementById('sg-chat-prompts').textContent,/Leave for the team/);assert.doesNotMatch(s.document.getElementById('sg-chat-prompts').textContent,/Skip this/);
});
test('the AI configuration form never persists a key in browser storage and clears it on save',{skip:!parseHTML},async()=>{
  const html=fs.readFileSync(path.join(__dirname,'../admin/chat/index.html'),'utf8');const saved=[];
  const s=surface(html,async(_url,options)=>{if(options.method==='POST')saved.push(JSON.parse(options.body));return Response.json({ok:true,ai:{enabled:saved.length>0,configured:saved.length>0,model:'gpt-6-luna',daily_limit:50}});});
  s.run('admin/chat/ai-settings.js');s.document.getElementById('aiSettingsToggle').click();await flush();assert.match(s.document.getElementById('aiConfigState').textContent,/尚未配置/);
  s.document.getElementById('aiApiKey').value='sk-test-key-only-123456789';s.document.getElementById('aiEnabled').checked=true;s.submit('aiSettingsForm');await flush();
  assert.equal(saved[0].key,'sk-test-key-only-123456789');assert.equal(s.document.getElementById('aiApiKey').value,'');assert.ok(!JSON.stringify(Array.from(s.values)).includes('sk-test-key-only'));
});
