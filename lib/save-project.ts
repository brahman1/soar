import { authorize,body,db,failure,HttpError,json } from './security';
import { getProject } from './projects';
import { validateProject } from './project-validation.mjs';
export async function saveProject(request:Request,id?:string){try{
 const user=authorize(request,true),data=await body(request);
 let p;try{p=validateProject(data)}catch(e){throw new HttpError(400,(e as Error).message)}
 const d=db(),now=new Date().toISOString(),token=crypto.randomUUID();
 if(id){
  if(!Number.isInteger(data.version))throw new HttpError(400,'Version du projet manquante.');
  const old=await getProject(id,true);if(!old)throw new HttpError(404,'Projet introuvable.');
  if(old.version!==data.version)throw new HttpError(409,'Ce projet a été modifié ailleurs. Rechargez la liste avant de réessayer.');
  const clause=p.images.length?`(SELECT COUNT(*) FROM media WHERE id IN (${p.images.map(()=>'?').join(',')}) AND (project_id=? OR (project_id IS NULL AND created_by=?)))=?`:'1=1';
  const args=p.images.length?[...p.images.map(i=>i.id),id,user.id,p.images.length]:[];
  const result=await d.batch([
   d.prepare(`UPDATE projects SET title=?,category=?,location=?,year=?,description=?,status=?,position=?,updated_at=?,version=version+1,mutation_token=? WHERE id=? AND version=? AND ${clause}`).bind(p.title,p.category,p.location,p.year,p.description,p.status,p.position,now,token,id,data.version,...args),
   d.prepare('UPDATE media SET project_id=NULL WHERE project_id=? AND EXISTS (SELECT 1 FROM projects WHERE id=? AND mutation_token=?)').bind(id,id,token),
   ...p.images.map((i,n)=>d.prepare('UPDATE media SET project_id=?,alt=?,position=? WHERE id=? AND EXISTS (SELECT 1 FROM projects WHERE id=? AND mutation_token=?)').bind(id,i.alt,n,i.id,id,token))
  ]);
  if(!result[0].meta.changes)throw new HttpError(409,'Une modification simultanée a eu lieu. Rechargez le projet.');
  return json({id,version:data.version+1});
 }
 const newId=crypto.randomUUID();
 const clause=p.images.length?`(SELECT COUNT(*) FROM media WHERE id IN (${p.images.map(()=>'?').join(',')}) AND project_id IS NULL AND created_by=?)=?`:'1=1';
 const args=p.images.length?[...p.images.map(i=>i.id),user.id,p.images.length]:[];
 const result=await d.batch([
  d.prepare(`INSERT INTO projects (id,title,category,location,year,description,status,position,version,created_by,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,1,?,?,? WHERE ${clause}`).bind(newId,p.title,p.category,p.location,p.year,p.description,p.status,p.position,user.id,now,now,...args),
  ...p.images.map((i,n)=>d.prepare('UPDATE media SET project_id=?,alt=?,position=? WHERE id=? AND project_id IS NULL AND created_by=? AND EXISTS (SELECT 1 FROM projects WHERE id=?)').bind(newId,i.alt,n,i.id,user.id,newId))
 ]);
 if(!result[0].meta.changes)throw new HttpError(409,'Une photo a été utilisée ailleurs. Rechargez les photos avant de réessayer.');
 return json({id:newId},201);
 }catch(e){return failure(e)}}
