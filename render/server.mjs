import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {randomBytes,createHash,scryptSync,timingSafeEqual} from 'node:crypto';
import {Readable} from 'node:stream';
import {DB,env} from './storage.mjs';
import * as home from '../app/route.ts';
import * as admin from '../app/admin/route.ts';
import * as preview from '../app/admin/preview/[id]/route.ts';
import * as project from '../app/projets/[id]/route.ts';
import * as media from '../app/media/[id]/route.ts';
import * as projects from '../app/api/admin/projects/route.ts';
import * as update from '../app/api/admin/projects/[id]/route.ts';
import * as history from '../app/api/admin/projects/[id]/history/route.ts';
import * as drafts from '../app/api/admin/drafts/[key]/route.ts';
import * as uploads from '../app/api/admin/uploads/route.ts';
import * as backup from '../app/api/admin/backup/route.ts';
import * as exports from '../app/api/admin/export/route.ts';
import * as health from '../app/api/admin/health/route.ts';
import * as errors from '../app/api/admin/errors/route.ts';
import * as sitemap from '../app/sitemap.xml/route.ts';
import * as robots from '../app/robots.txt/route.ts';

if(!process.env.ADMIN_EMAIL||!process.env.ADMIN_PASSWORD||process.env.ADMIN_PASSWORD.length<16)throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 16 characters).');
if(process.env.RENDER&&!process.env.DATA_DIR)throw new Error('Configure a persistent Render disk and DATA_DIR before starting.');
const origin=env.SITE_ORIGIN||'http://localhost:'+ (process.env.PORT||3000);
env.SITE_ORIGIN=origin;
const secure=new URL(origin).protocol==='https:';
if(process.env.RENDER&&!secure)throw new Error('SITE_ORIGIN must use HTTPS on Render.');
const cookieName=secure?'__Host-soar_session':'soar_session';
const salt=randomBytes(32),passwordHash=scryptSync(process.env.ADMIN_PASSWORD,salt,64);
DB.prepare('CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,expires INTEGER)').run();
DB.prepare('CREATE TABLE IF NOT EXISTS login_limits(key TEXT PRIMARY KEY,count INTEGER,expires INTEGER)').run();
// Changing the administrator password invalidates all existing sessions.
const digest=value=>createHash('sha256').update(process.env.ADMIN_PASSWORD).update('\0').update(value).digest('hex');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function page(message='',logout=false){return new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Administration — SOAR</title><link rel="stylesheet" href="/style.css"></head><body><main style="max-width:460px;margin:10vh auto;padding:24px"><a href="/">SOAR · Retour au studio</a><h1 style="margin:30px 0">${logout?'Déconnexion':'Administration'}</h1><p role="alert">${escape(message)}</p><form method="post" action="${logout?'/auth/logout':'/auth/login'}">${logout?'':`<label>E-mail<input style="display:block;width:100%;margin:8px 0 20px;padding:12px" name="email" type="email" autocomplete="username" required></label><label>Mot de passe<input style="display:block;width:100%;margin:8px 0 20px;padding:12px" name="password" type="password" autocomplete="current-password" required maxlength="1024"></label>`}<button style="padding:14px 24px" type="submit">${logout?'Se déconnecter':'Se connecter'}</button></form></main></body></html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex'}})}
const cookie=value=>`${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${value?28800:0}${secure?'; Secure':''}`;
const redirect=(path,token)=>new Response(null,{status:303,headers:{Location:path,...(token!==undefined?{'Set-Cookie':cookie(token)}:{})}});
const routes=[[/^\/$/,home],[/^\/admin$/,admin],[/^\/admin\/preview\/([^/]+)$/,preview,'id'],[/^\/projets\/([^/]+)$/,project,'id'],[/^\/media\/([^/]+)$/,media,'id'],[/^\/api\/admin\/projects$/,projects],[/^\/api\/admin\/projects\/([^/]+)\/history$/,history,'id'],[/^\/api\/admin\/projects\/([^/]+)$/,update,'id'],[/^\/api\/admin\/drafts\/([^/]+)$/,drafts,'key'],[/^\/api\/admin\/uploads$/,uploads],[/^\/api\/admin\/backup$/,backup],[/^\/api\/admin\/export$/,exports],[/^\/api\/admin\/health$/,health],[/^\/api\/admin\/errors$/,errors],[/^\/sitemap\.xml$/,sitemap],[/^\/robots\.txt$/,robots]];
async function dispatch(request,ip){
 const path=new URL(request.url).pathname;
 if(path==='/healthz'){DB.prepare('SELECT 1').first();return Response.json({status:'ok'})}
 if(['/auth/login','/signin-with-chatgpt'].includes(path)){
  if(request.method==='GET')return page();
  if(request.method!=='POST')return new Response(null,{status:405});
  if(request.headers.get('origin')!==origin)return new Response('Requête refusée',{status:403});
  const now=Date.now();DB.prepare('DELETE FROM login_limits WHERE expires<?').bind(now).run();
  for(const key of ['global',digest(ip)]){const row=DB.prepare('SELECT count FROM login_limits WHERE key=?').bind(key).first();if(row?.count>=(key==='global'?50:10))return new Response('Trop de tentatives. Réessayez dans 15 minutes.',{status:429,headers:{'Retry-After':'900'}});DB.prepare('INSERT INTO login_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').bind(key,now+900000).run()}
  const data=await request.formData(),password=String(data.get('password')||'');
  if(password.length>1024||String(data.get('email')||'').toLowerCase()!==process.env.ADMIN_EMAIL.toLowerCase()||!timingSafeEqual(scryptSync(password,salt,64),passwordHash))return page('Identifiants incorrects.');
  const token=randomBytes(32).toString('hex');DB.prepare('DELETE FROM sessions WHERE expires<?').bind(now).run();DB.prepare('INSERT INTO sessions VALUES(?,?)').bind(digest(token),now+28800000).run();return redirect('/admin',token);
 }
 const token=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
 const session=token&&DB.prepare('SELECT expires FROM sessions WHERE hash=? AND expires>?').bind(digest(token),Date.now()).first();
 if(['/auth/logout','/signout-with-chatgpt'].includes(path)){if(request.method==='GET')return page('',true);if(request.method!=='POST'||request.headers.get('origin')!==origin)return new Response('Requête refusée',{status:403});if(token)DB.prepare('DELETE FROM sessions WHERE hash=?').bind(digest(token)).run();return redirect('/', '');}
 request.headers.delete('oai-authenticated-user-id');request.headers.delete('oai-authenticated-user-email');
 if(session){request.headers.set('oai-authenticated-user-id','render-admin');request.headers.set('oai-authenticated-user-email',process.env.ADMIN_EMAIL)}
 for(const [pattern,handlers,key] of routes){const match=path.match(pattern);if(!match)continue;const handler=handlers[request.method==='HEAD'?'GET':request.method];if(!handler)return new Response(null,{status:405});return handler(request,{params:Promise.resolve(key?{[key]:match[1]}:{})})}
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405});
 const root=resolve('public'),file=resolve(root,'.'+decodeURIComponent(path));
 if(!file.startsWith(root+sep))return new Response(null,{status:404});
 try{if(!(await stat(file)).isFile())return new Response(null,{status:404});const types={'.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'};return new Response(await readFile(file),{headers:{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'public, max-age=3600'}})}catch{return new Response('Introuvable',{status:404})}
}
const server=http.createServer(async(req,res)=>{try{
 let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>13*1024*1024){res.writeHead(413);res.end('Contenu trop volumineux');return}chunks.push(chunk)}
 const headers=new Headers();for(const [name,value]of Object.entries(req.headers))if(value!==undefined)headers.set(name,Array.isArray(value)?value.join(','):value);
 const request=new Request(new URL(req.url,origin),{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
 const response=await dispatch(request,req.socket.remoteAddress||'unknown');
 response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('Referrer-Policy','strict-origin-when-cross-origin');response.headers.set('X-Frame-Options','DENY');
 res.writeHead(response.status,Object.fromEntries(response.headers));
 if(req.method==='HEAD'||!response.body){res.end();return}Readable.fromWeb(response.body).on('error',()=>res.destroy()).pipe(res);
 }catch(e){console.error('SOAR request failed',e.message);if(!res.headersSent)res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'});res.end('Une erreur est survenue.')}});
server.requestTimeout=30000;server.headersTimeout=15000;
server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('SOAR production server ready'));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
