import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const data=await mkdtemp(join(tmpdir(),'soar-render-')),base='http://127.0.0.1:5173',password='local-qa-password-8f94ac!',email='qa@example.test';
let child;
async function start(){child=spawn(process.execPath,['dist-render/server.mjs'],{env:{...process.env,PORT:'5173',DATA_DIR:data,ADMIN_EMAIL:email,ADMIN_PASSWORD:password,SITE_ORIGIN:base,INDEXING_ENABLED:'false',RENDER:''},stdio:['ignore','pipe','pipe']});let log='';child.stderr.on('data',d=>log+=d);for(let i=0;i<80;i++){try{if((await fetch(base+'/healthz')).ok)return}catch{}if(child.exitCode!==null)throw new Error(log);await new Promise(r=>setTimeout(r,100))}throw new Error('Server did not start: '+log)}
async function stop(){if(child&&child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r))}}
async function login(){const response=await fetch(base+'/auth/login',{method:'POST',headers:{Origin:base},body:new URLSearchParams({email,password}),redirect:'manual'});assert.equal(response.status,303);return response.headers.get('set-cookie').split(';')[0]}
const authCode=`const base=${JSON.stringify(base)};const login=await fetch(base+'/auth/login',{method:'POST',headers:{Origin:base},body:new URLSearchParams({email:${JSON.stringify(email)},password:${JSON.stringify(password)}}),redirect:'manual'});const cookie=login.headers.get('set-cookie').split(';')[0];`;
try{
 await start();
 assert.equal((await fetch(base+'/api/admin/projects',{headers:{'oai-authenticated-user-id':'render-admin','oai-authenticated-user-email':email}})).status,401);
 assert.equal((await fetch(base+'/auth/login',{method:'POST',headers:{Origin:'https://evil.test'},body:new URLSearchParams({email,password})})).status,403);
 const cookie=await login();assert.equal((await fetch(base+'/admin',{headers:{Cookie:cookie}})).status,200);
 for(const name of ['integration','improvements-integration']){
  let source=await readFile('tests/'+name+'.mjs','utf8');
  if(name==='integration')source=source.replace(/const base=.*?;\s*const login=[\s\S]*?assert\.ok\(cookie,'Local sign-in cookie'\);/,authCode);
  else source=source.replace(/const base=[\s\S]*?split\('; '\)\[0\];/,authCode); // explicit fallback below for compact source
  if(name==='improvements-integration'){const begin=source.indexOf('const base='),end=source.indexOf('\nconst headers=',begin);if(begin>=0&&end>=0)source=source.slice(0,begin)+authCode+'\n'+source.slice(end)}
  const path=join(data,name+'.mjs');await writeFile(path,source);await new Promise((resolve,reject)=>{const p=spawn(process.execPath,[path],{stdio:'inherit'});p.on('exit',code=>code===0?resolve():reject(new Error(name+' failed')))});
 }
 const before=await(await fetch(base+'/api/admin/projects',{headers:{Cookie:cookie}})).json();assert.ok(before.projects.length);
 await stop();await start();const after=await(await fetch(base+'/api/admin/projects',{headers:{Cookie:cookie}})).json();assert.equal(after.projects.length,before.projects.length);
 const photo=after.projects.find(p=>p.images.length).images[0];assert.equal((await fetch(base+'/media/'+photo.id,{headers:{Cookie:cookie}})).status,200);
 assert.equal((await fetch(base+'/auth/logout',{method:'POST',headers:{Cookie:cookie,Origin:base},redirect:'manual'})).status,303);assert.equal((await fetch(base+'/api/admin/projects',{headers:{Cookie:cookie}})).status,401);
 for(let i=0;i<12;i++)await fetch(base+'/auth/login',{method:'POST',headers:{Origin:base},body:new URLSearchParams({email,password:'incorrect'}),redirect:'manual'});
 assert.equal((await fetch(base+'/auth/login',{method:'POST',headers:{Origin:base},body:new URLSearchParams({email,password}),redirect:'manual'})).status,429);
 console.log('Render passed: spoof protection, login CSRF, integration suites, restart persistence, logout, rate limiting.');
}finally{await stop();await rm(data,{recursive:true,force:true})}
