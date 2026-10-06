import { authorize,bucket,db,failure,HttpError,json } from '../../../../lib/security';
import { imageType } from '../../../../lib/project-validation.mjs';
export async function POST(request:Request){try{
 const user=authorize(request,true);if(Number(request.headers.get('content-length'))>12*1024*1024)throw new HttpError(413,'Les photos préparées sont trop volumineuses.');
 const files:{suffix:string;bytes:ArrayBuffer;type:string}[]=[];let width=0,height=0;
 if(request.headers.get('content-type')?.startsWith('multipart/form-data')){const form=await request.formData();width=Number(form.get('width'))||0;height=Number(form.get('height'))||0;if(!Number.isInteger(width)||!Number.isInteger(height)||width<0||height<0||width>20000||height>20000)throw new HttpError(400,'Dimensions invalides.');for(const [field,suffix] of [['image',''],['small','/w640'],['medium','/w1280']]){const file=form.get(field);if(field==='image'&&!(file instanceof File))throw new HttpError(400,'Photo manquante.');if(file instanceof File){if(file.size<12||file.size>8*1024*1024)throw new HttpError(413,'La photo doit peser moins de 8 Mo.');const bytes=await file.arrayBuffer(),type=imageType(new Uint8Array(bytes));if(!type)throw new HttpError(415,'Choisissez une photo JPEG, PNG ou WebP.');files.push({suffix,bytes,type})}}}
 else{const bytes=await request.arrayBuffer();if(bytes.byteLength<12||bytes.byteLength>8*1024*1024)throw new HttpError(413,'La photo est vide ou trop volumineuse.');const type=imageType(new Uint8Array(bytes));if(!type)throw new HttpError(415,'Choisissez une photo JPEG, PNG ou WebP.');files.push({suffix:'',bytes,type})}
 if(files.reduce((size,f)=>size+f.bytes.byteLength,0)>12*1024*1024)throw new HttpError(413,'La photo est trop volumineuse.');
 const id=crypto.randomUUID(),key='photos/'+id,b=bucket(),d=db();
 try{for(const file of files)await b.put(key+file.suffix,file.bytes,{httpMetadata:{contentType:file.type}});await d.prepare('INSERT INTO media(id,object_key,content_type,alt,position,created_by,created_at,width,height) VALUES (?,?,?,\'\',0,?,?,?,?)').bind(id,key,files[0].type,user.id,new Date().toISOString(),width,height).run()}catch(e){await b.delete(files.map(f=>key+f.suffix));throw e}
 return json({id,alt:'',url:'/media/'+id},201)
 }catch(e){return failure(e)}}
