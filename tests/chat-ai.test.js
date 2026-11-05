"use strict";
const {test}=require("node:test"), assert=require("node:assert/strict"), {Readable}=require("node:stream");
const ai=require("../lib/chat-ai"), auth=require("../lib/admin-auth"), handler=require("../api/admin-chat-ai");
const answer={reply:"We can review printing or engraving for a suitable metal pen. What quantity do you need?",handoff:false,answers:{product:"metal pens",quantity:"",logo:"",destination:"",deadline:"",contact:""}};
async function env(run){const keys={SUPABASE_URL:"https://qa.supabase.co",SUPABASE_SERVICE_ROLE_KEY:"test-db-key",ADMIN_DASHBOARD_SECRET:"a".repeat(64),TURNSTILE_SECRET_KEY:"qa",TURNSTILE_SITE_KEY:"qa"};const saved=Object.fromEntries(Object.keys(keys).map(k=>[k,process.env[k]])),fetch=global.fetch;Object.assign(process.env,keys);try{await run();}finally{global.fetch=fetch;for(const [k,v]of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}}
function call({method="GET",body,authorized=true,origin="https://www.sendoragift.com"}={}){const req=Readable.from(body?[Buffer.from(JSON.stringify(body))]:[]);Object.assign(req,{method,url:"/api/admin-chat-ai",headers:{host:"www.sendoragift.com",origin,...(authorized?{authorization:"Bearer "+auth.createSession()}:{} )}});return new Promise((resolve,reject)=>{const res={setHeader(){},end(value){resolve({status:this.statusCode,body:JSON.parse(value)});}};Promise.resolve(handler(req,res)).catch(reject);});}
test("API keys use authenticated encryption and never appear in public configuration",()=>env(async()=>{
 const key="sk-project-private-test-only-123456789";const encrypted=ai.encrypt(key);assert.ok(!encrypted.includes(key));assert.equal(ai.decrypt(encrypted),key);assert.notEqual(ai.encrypt(key),encrypted);
 assert.throws(()=>ai.decrypt(encrypted.slice(0,-6)+"AAAAAA"));assert.equal(ai.publicConfig({key,configured:true,enabled:false,model:ai.MODEL,daily_limit:50}).key,undefined);
}));
test("the model receives bounded redacted history, knowledge and a strict schema without tools or storage",()=>env(async()=>{
 let sent;global.fetch=async(url,options)=>{sent={url,headers:options.headers,body:JSON.parse(options.body)};return Response.json({status:"completed",output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(answer)}]}]});};
 const result=await ai.generate({key:"server-only",model:ai.MODEL},[{role:"visitor",content:"Please email buyer@example.com or +61 400 123 456 about metal pens"}]);
 assert.equal(result.answers.product,"metal pens");assert.equal(sent.url,"https://api.openai.com/v1/responses");assert.equal(sent.body.store,false);assert.equal(sent.body.tools,undefined);assert.equal(sent.body.text.format.strict,true);assert.ok(sent.body.instructions.includes("Prices, MOQ"));assert.ok(!JSON.stringify(sent.body.input).includes("buyer@example.com"));assert.ok(!JSON.stringify(sent.body.input).includes("+61 400"));
}));
test("refusals, truncated responses and invalid summaries fail safely",()=>env(async()=>{
 for(const body of [{status:"incomplete",output:[]},{status:"completed",output:[{type:"message",content:[{type:"refusal",refusal:"No"}]}]}]){global.fetch=async()=>Response.json(body);await assert.rejects(ai.generate({key:"test",model:ai.MODEL},[]));}
 assert.throws(()=>ai.validate({...answer,reply:""}));assert.throws(()=>ai.validate({...answer,answers:{}}));
}));
test("AI settings require admin auth and a same-origin request",()=>env(async()=>{
 let requests=0;global.fetch=async()=>{requests++;return Response.json([]);};assert.equal((await call({authorized:false})).status,401);assert.equal((await call({method:"POST",body:{action:"save"},origin:"https://evil.test"})).status,403);assert.equal(requests,0);
}));
test("configuration saves only encrypted key data and cannot enable with no key",()=>env(async()=>{
 let patch;global.fetch=async(url,options)=>{if(url.includes("rpc/"))return Response.json(true);if(options.method==="PATCH"){patch=JSON.parse(options.body);return Response.json([{ai_enabled:true}]);}return Response.json([{ai_enabled:false,ai_key_ciphertext:"",ai_model:ai.MODEL,ai_daily_limit:50}]);};
 const data={action:"save",enabled:true,key:"sk-project-test-only-123456789",model:ai.MODEL,daily_limit:50};
 assert.equal((await call({method:"POST",body:{...data,key:""}})).status,400);
 const result=await call({method:"POST",body:data});assert.equal(result.status,200);assert.equal(ai.decrypt(patch.ai_key_ciphertext),data.key);assert.ok(!JSON.stringify(result.body).includes(data.key));assert.equal(result.body.ai.configured,true);
}));
test("a saved-key connection test is rate limited, uses synthetic input and returns no credentials",()=>env(async()=>{
 const key="sk-project-test-only-123456789",calls=[];
 global.fetch=async(url,options)=>{calls.push({url,options});if(url.includes("api.openai.com"))return Response.json({status:"completed",output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(answer)}]}]});if(url.includes("rpc/"))return Response.json(true);return Response.json([{ai_enabled:false,ai_key_ciphertext:ai.encrypt(key),ai_model:ai.MODEL,ai_daily_limit:50}]);};
 const result=await call({method:"POST",body:{action:"test"}});assert.equal(result.status,200);assert.equal(result.body.reply,answer.reply);assert.ok(!JSON.stringify(result.body).includes(key));
 assert.ok(calls.some(call=>call.options.body?.includes('ai:daily:')));const input=JSON.parse(calls.find(call=>call.url.includes("api.openai.com")).options.body).input;assert.equal(input[0].content,"Can you customize a logo on a metal pen?");
}));
test("a provider error during connection testing never leaks upstream errors or keys",()=>env(async()=>{
 global.fetch=async(url)=>url.includes("api.openai.com")?Response.json({error:"secret upstream details"},{status:401}):url.includes("rpc/")?Response.json(true):Response.json([{ai_key_ciphertext:ai.encrypt("sk-project-test-only-123456789"),ai_daily_limit:50}]);
 const result=await call({method:"POST",body:{action:"test"}});assert.equal(result.status,503);assert.doesNotMatch(JSON.stringify(result.body),/secret upstream|sk-project/);
}));
