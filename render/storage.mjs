import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,readdirSync} from 'node:fs';
import {readFile,writeFile,rename,unlink,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const root=resolve(process.env.DATA_DIR||'data');
mkdirSync(join(root,'photos'),{recursive:true});
const sql=new DatabaseSync(join(root,'soar.sqlite'));
sql.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS migrations(name TEXT PRIMARY KEY);');
for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort()){
 if(sql.prepare('SELECT name FROM migrations WHERE name=?').get(name))continue;
 sql.exec('BEGIN IMMEDIATE');try{sql.exec(readFileSync(join('drizzle',name),'utf8'));sql.prepare('INSERT INTO migrations VALUES(?)').run(name);sql.exec('COMMIT')}catch(e){sql.exec('ROLLBACK');throw e}
}
class Statement{
 constructor(query,args=[]){this.query=query;this.args=args}
 bind(...args){return new Statement(this.query,args)}
 first(){return sql.prepare(this.query).get(...this.args)||null}
 all(){return {results:sql.prepare(this.query).all(...this.args),success:true}}
 run(){const result=sql.prepare(this.query).run(...this.args);return {meta:{changes:Number(result.changes)},success:true}}
}
export const DB={prepare:q=>new Statement(q),batch(statements){sql.exec('BEGIN IMMEDIATE');try{const result=statements.map(s=>s.run());sql.exec('COMMIT');return result}catch(e){sql.exec('ROLLBACK');throw e}}};
const objectPath=key=>join(root,'photos',createHash('sha256').update(key).digest('hex'));
export const BUCKET={
 async put(key,bytes,{httpMetadata}={}){const path=objectPath(key),temp=path+'.'+randomUUID();await writeFile(temp,Buffer.from(bytes));await rename(temp,path);await writeFile(path+'.json',JSON.stringify({key,httpMetadata}));},
 async get(key){try{const bytes=await readFile(objectPath(key)),metadata=JSON.parse(await readFile(objectPath(key)+'.json','utf8'));return {size:bytes.length,body:new ReadableStream({start(c){c.enqueue(bytes);c.close()}}),httpMetadata:metadata.httpMetadata,httpEtag:'"'+createHash('sha256').update(bytes).digest('hex')+'"'}}catch(e){if(e.code==='ENOENT')return null;throw e}},
 async delete(keys){for(const key of Array.isArray(keys)?keys:[keys])for(const path of [objectPath(key),objectPath(key)+'.json'])await unlink(path).catch(e=>{if(e.code!=='ENOENT')throw e})},
 async list({limit=1000}={}){return {objects:(await readdir(join(root,'photos'))).filter(n=>n.endsWith('.json')).slice(0,limit)}}
};
export const env={...process.env,DB,BUCKET,ADMIN_EMAILS:process.env.ADMIN_EMAIL,SITE_ORIGIN:process.env.SITE_ORIGIN||process.env.RENDER_EXTERNAL_URL};
