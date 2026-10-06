import {editorErrors} from './editor-validation.mjs';
const $=s=>document.querySelector(s);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={draft:'Brouillon',published:'En ligne',archived:'Archivé'};
const dialog=$('#editor'),userKey=document.body.dataset.userKey;
let projects=[],filter='all',editing=null,photos=[],dirty=false,busy=false,draftRevision=0,draftReady=false,draftConflict=false,autosaveTimer,autosaveTask=null,recoverable=null,history=[],dragged=null;
let serial=0,opening=0;
const draftKey=()=>editing?.id??'new';
const localKey=()=>`soar-draft:${userKey}:${draftKey()}`;
function values(){return Object.fromEntries(['title','category','location','year','description','position'].map(key=>[key,key==='position'?Number($('#'+key).value):$('#'+key).value]).concat([['images',photos.map(p=>({id:p.id,alt:p.alt}))]]))}
function snapshot(){return {values:values(),baseVersion:editing?.version??null,updatedAt:new Date().toISOString()}}
function cache(){try{localStorage.setItem(localKey(),JSON.stringify(snapshot()))}catch{}}
function localDraft(){try{return JSON.parse(localStorage.getItem(localKey())??'null')}catch{return null}}
function removeLocal(){try{localStorage.removeItem(localKey())}catch{}}
async function api(url,options={}){
 const response=await fetch(url,{...options,signal:options.signal??AbortSignal.timeout(15000),headers:{...(options.body?{'Content-Type':'application/json'}:{}),'X-SOAR-Admin':'1',...options.headers}});
 let data;try{data=await response.json()}catch{throw new Error('La connexion a été interrompue. Réessayez.')}
 if(!response.ok){const error=new Error(data.error||'Une erreur est survenue.');error.status=response.status;throw error}return data;
}
async function load(){try{projects=(await api('/api/admin/projects')).projects;render();$('#page-status').textContent=''}catch(e){$('#page-status').textContent=e.message;const retry=document.createElement('button');retry.type='button';retry.textContent='Réessayer';retry.className='secondary';retry.onclick=load;$('#page-status').append(' ',retry)}}
function render(){
 $('#total-count').textContent=projects.filter(p=>p.status!=='archived').length;$('#published-count').textContent=projects.filter(p=>p.status==='published').length;$('#draft-count').textContent=projects.filter(p=>p.status==='draft').length;
 const query=$('#search').value.toLocaleLowerCase('fr');
 const rows=projects.filter(p=>(filter==='all'?p.status!=='archived':p.status===filter)&&[p.title,p.location,p.category].join(' ').toLocaleLowerCase('fr').includes(query));
 $('#empty').hidden=projects.length>0||filter!=='all'||!!query;
 $('#project-list').innerHTML=rows.map(p=>`<article class="project-row">${p.images.length?`<img class="row-cover" src="/media/${esc(p.images[0].id)}?w=640" alt="${esc(p.images[0].alt||p.title)}" width="110" height="85" loading="lazy">`:'<div class="row-cover">＋</div>'}<div><h2 class="row-title">${esc(p.title)}</h2><div class="row-info"><span class="badge ${esc(p.status)}">${labels[p.status]}</span><span>${esc(p.category)}</span><span>${esc([p.location,p.year].filter(Boolean).join(' · '))}</span></div></div><div class="row-actions"><a href="/admin/preview/${esc(p.id)}" target="_blank" rel="noopener">Aperçu ↗</a><button data-edit="${esc(p.id)}" aria-label="Modifier ${esc(p.title)}">${p.status==='archived'?'Restaurer / modifier':'Modifier'}</button></div></article>`).join('');
 if(!rows.length&&projects.length)$('#project-list').innerHTML='<p class="no-results">Aucun projet dans cette sélection.</p>';
 $('#project-list').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>open(projects.find(p=>p.id===b.dataset.edit)));
}
function fill(data){for(const key of ['title','category','year','location','description','position'])$('#'+key).value=data?.[key]??(key==='category'?'Réhabilitation':key==='position'?0:'');photos=(data?.images??[]).map(m=>({id:m.id,alt:m.alt??''}));renderPhotos();clearErrors()}
async function open(project=null){
 editing=project;dirty=false;serial=0;draftRevision=0;draftReady=false;draftConflict=false;recoverable=null;history=[];const token=++opening;
 $('#project-form').reset();fill(project);$('#editor-title').textContent=project?(project.status==='archived'?'Restaurer le projet':'Modifier le projet'):'Nouveau projet';
 $('#publish-project').textContent=project?.status==='published'?'Mettre à jour le site ↗':'Publier sur le site ↗';$('#archive-project').hidden=!project||project.status==='archived';
 $('#editor-status').textContent='';$('#upload-status').textContent='';$('#autosave-status').textContent='Chargement de la sauvegarde…';$('#recovery').hidden=true;$('#history').hidden=true;
 dialog.showModal();$('#title').focus();
 try{const result=await api('/api/admin/drafts/'+draftKey());if(token!==opening||!dialog.open)return;draftRevision=result.draft?.revision??0;const local=localDraft(),server=result.draft?.snapshot;
  recoverable=local&&(!server||local.updatedAt>server.updatedAt)?local:server;
  if(recoverable&&JSON.stringify(recoverable.values)!==JSON.stringify(values())){$('#recovery').hidden=false;$('#recovery-text').textContent='Des modifications non publiées sont disponibles. Reprenez-les pour continuer votre travail.';}
  $('#autosave-status').textContent='Sauvegarde automatique activée.';
 }catch{$('#autosave-status').textContent='Connexion indisponible. Les modifications restent protégées sur cet appareil.';recoverable=localDraft();if(recoverable){$('#recovery').hidden=false;$('#recovery-text').textContent='Une sauvegarde sur cet appareil est disponible.'}}
 finally{if(token===opening){draftReady=true;if(dirty)scheduleAutosave()}}
 if(project){try{const data=await api('/api/admin/projects/'+project.id+'/history');if(token!==opening||!dialog.open)return;history=data.revisions;$('#history').hidden=!history.length;$('#history-select').innerHTML=history.map((r,i)=>`<option value="${i}">${esc(new Date(r.created_at).toLocaleString('fr-FR'))} · ${esc(r.snapshot.title)}</option>`).join('')}catch{}}
}
function markDirty(){dirty=true;serial++;cache();$('#autosave-status').textContent='Modifications en cours…';scheduleAutosave()}
function scheduleAutosave(){clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>persistDraft(),1200)}
async function persistDraft(){
 if(!dialog.open||!dirty||busy||!draftReady||draftConflict||!$('#recovery').hidden)return false;
 if(autosaveTask){await autosaveTask;if(dirty)scheduleAutosave();return false}
 const key=draftKey(),data=snapshot(),savedSerial=serial,token=opening;cache();$('#autosave-status').textContent='Sauvegarde du brouillon…';
 autosaveTask=(async()=>{try{const result=await api('/api/admin/drafts/'+key,{method:'PUT',body:JSON.stringify({snapshot:data,revision:draftRevision})});if(token!==opening)return false;draftRevision=result.revision;if(serial===savedSerial)dirty=false;$('#autosave-status').textContent='Modifications sauvegardées à '+new Date(result.updatedAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})+'. Le site publié reste inchangé.';return true}catch(e){if(token===opening){draftConflict=e.status===409;$('#autosave-status').textContent=draftConflict?e.message:'Sauvegarde en ligne indisponible. Vos modifications sont conservées sur cet appareil.'}return false}finally{autosaveTask=null}})();
 const ok=await autosaveTask;if(dialog.open&&dirty&&!draftConflict&&serial!==savedSerial)scheduleAutosave();return ok;
}
async function clearDraft(){removeLocal();if(draftRevision)try{await api('/api/admin/drafts/'+draftKey(),{method:'DELETE',body:JSON.stringify({revision:draftRevision})})}catch{}draftRevision=0;$('#recovery').hidden=true}
async function close(){if(busy)return;clearTimeout(autosaveTimer);if(autosaveTask)await autosaveTask;if(dirty)await persistDraft();cacheIfDirty();dialog.close();opening++;dirty=false}
function cacheIfDirty(){if(dirty)cache()}
function clearErrors(){document.querySelectorAll('.dynamic-error').forEach(e=>e.remove());$('#photos-error').textContent='';$('#editor').querySelectorAll('[aria-invalid]').forEach(e=>{e.removeAttribute('aria-invalid');e.removeAttribute('aria-describedby')})}
function showErrors(errors){clearErrors();let first;
 for(const[key,message]of Object.entries(errors)){const input=$('#'+key);if(key==='photos'){$('#photos-error').textContent=message;first??=$('#photo-files');continue}if(!input)continue;const note=document.createElement('span');note.id=key+'-error';note.className='field-error dynamic-error';note.textContent=message;input.setAttribute('aria-invalid','true');input.setAttribute('aria-describedby',note.id);(input.closest('label')??input).insertAdjacentElement('afterend',note);first??=input}
 if(first){$('#editor-status').textContent='Vérifiez les champs signalés ci-dessus.';first.focus()}
 return !!first;
}
function movePhoto(from,to){if(busy||from===to||to<0||to>=photos.length)return;const moved=photos.splice(from,1)[0];photos.splice(to,0,moved);markDirty();renderPhotos();$('#alt-'+to)?.focus();$('#upload-status').textContent='Ordre des photos mis à jour.'}
function renderPhotos(){
 $('#photo-count').textContent=photos.length+' / 20';
 $('#photo-list').innerHTML=photos.map((m,i)=>`<div class="photo-item" draggable="true" data-photo="${i}"><div><img src="/media/${esc(m.id)}?w=640" alt="${esc(m.alt||'Photo du projet')}" width="88" height="88">${i===0?'<span class="cover-badge">COUVERTURE</span>':''}</div><div><label for="alt-${i}">Description de l’image ${i+1}<input id="alt-${i}" data-alt="${i}" maxlength="250" value="${esc(m.alt)}" placeholder="Ex. Façade côté jardin"></label><div class="photo-controls"><button type="button" data-up="${i}" ${i===0?'disabled':''} aria-label="Monter la photo ${i+1}">↑</button><button type="button" data-down="${i}" ${i===photos.length-1?'disabled':''} aria-label="Descendre la photo ${i+1}">↓</button>${i?' <button type="button" data-cover="'+i+'" aria-label="Utiliser la photo '+(i+1)+' comme couverture">Couverture</button>':''}<button type="button" data-remove="${i}" aria-label="Retirer la photo ${i+1}">Retirer</button></div></div></div>`).join('');
 $('#photo-list').querySelectorAll('[data-alt]').forEach(input=>input.oninput=()=>{photos[Number(input.dataset.alt)].alt=input.value;input.removeAttribute('aria-invalid');$('#'+input.id+'-error')?.remove()});
 for(const action of ['up','down','remove','cover'])$('#photo-list').querySelectorAll('[data-'+action+']').forEach(b=>b.onclick=()=>{if(busy)return;const i=Number(b.dataset[action]);if(action==='remove'){photos.splice(i,1);markDirty();renderPhotos()}else movePhoto(i,action==='cover'?0:i+(action==='up'?-1:1))});
 $('#photo-list').querySelectorAll('[data-photo]').forEach(row=>{row.ondragstart=e=>{if(busy||e.target.closest('input,button')){e.preventDefault();return}dragged=Number(row.dataset.photo);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(dragged));row.classList.add('dragging')};row.ondragover=e=>{if(dragged!==null){e.preventDefault();row.classList.add('drop-target')}};row.ondragleave=()=>row.classList.remove('drop-target');row.ondrop=e=>{e.preventDefault();if(dragged!==null)movePhoto(dragged,Number(row.dataset.photo));dragged=null};row.ondragend=()=>{dragged=null;document.querySelectorAll('.dragging,.drop-target').forEach(e=>e.classList.remove('dragging','drop-target'))}});
}
function setBusy(value){busy=value;$('#editor').setAttribute('aria-busy',String(value));$('#editor').querySelectorAll('button,input,select,textarea').forEach(e=>e.disabled=value);if(!value)renderPhotos()}
async function save(status){
 if(busy)return;const payload={...values(),status,...(editing?{version:editing.version}:{})};if(showErrors(editorErrors(payload,status==='published')))return;
 clearTimeout(autosaveTimer);if(autosaveTask)await autosaveTask;setBusy(true);$('#editor-status').textContent='Enregistrement en cours…';
 try{await api(editing?'/api/admin/projects/'+editing.id:'/api/admin/projects',{method:editing?'PUT':'POST',body:JSON.stringify(payload)});dirty=false;await clearDraft();dialog.close();opening++;await load();$('#page-status').textContent=status==='published'?'Le projet est en ligne.':status==='archived'?'Le projet a été archivé et reste disponible dans les archives.':'Brouillon enregistré.'}
 catch(e){$('#editor-status').textContent=e.message;cache()}
 finally{setBusy(false)}
}
async function preparePhoto(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choisissez des images JPEG, PNG ou WebP.');if(file.size>8*1024*1024)throw new Error(file.name+' dépasse la limite de 8 Mo.');
 const image=await createImageBitmap(file);try{const form=new FormData();for(const[field,width]of[['image',2000],['medium',1280],['small',640]]){const scale=Math.min(1,width/image.width),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Impossible de préparer cette photo.')),'image/webp',.85));form.append(field,blob,field+'.webp');if(field==='image'){form.append('width',String(canvas.width));form.append('height',String(canvas.height))}}return form}finally{image.close()}
}
function uploadPhoto(form){return new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('POST','/api/admin/uploads');xhr.timeout=60000;xhr.setRequestHeader('X-SOAR-Admin','1');xhr.upload.onprogress=e=>{if(e.lengthComputable)$('#upload-progress').value=Math.round(e.loaded/e.total*100)};xhr.onload=()=>{try{const data=JSON.parse(xhr.responseText);xhr.status>=200&&xhr.status<300?resolve(data):reject(new Error(data.error??'Importation impossible.'))}catch{reject(new Error('Importation interrompue. Réessayez.'))}};xhr.onerror=xhr.ontimeout=()=>reject(new Error('Connexion interrompue pendant l’importation. Réessayez.'));xhr.send(form)})}
$('#photo-files').addEventListener('change',async e=>{
 const files=[...e.target.files];if(!files.length)return;if(photos.length+files.length>20){$('#upload-status').textContent='Un projet peut contenir 20 photos maximum.';e.target.value='';return}
 clearTimeout(autosaveTimer);if(autosaveTask)await autosaveTask;setBusy(true);$('#upload-progress').hidden=false;
 try{for(let i=0;i<files.length;i++){$('#upload-status').textContent='Préparation de la photo '+(i+1)+' / '+files.length+'…';$('#upload-progress').value=0;const form=await preparePhoto(files[i]);$('#upload-status').textContent='Importation de la photo '+(i+1)+' / '+files.length+'…';const result=await uploadPhoto(form);photos.push({id:result.id,alt:''});markDirty();renderPhotos()}$('#upload-status').textContent='Photos importées. Choisissez la couverture et décrivez les images.';$('#photos-error').textContent=''}catch(e){$('#upload-status').textContent=e.message}
 finally{setBusy(false);$('#photo-files').value='';$('#upload-progress').hidden=true;scheduleAutosave()}
});
$('#restore-draft').onclick=()=>{if(!recoverable)return;fill(recoverable.values);if(editing&&recoverable.baseVersion!==editing.version){$('#editor-status').textContent='Ce projet a changé depuis la sauvegarde. Vérifiez vos modifications avant de les publier.'}$('#recovery').hidden=true;markDirty()};
$('#discard-draft').onclick=async()=>{await clearDraft();recoverable=null;$('#autosave-status').textContent='Ancienne sauvegarde ignorée.'};
$('#restore-history').onclick=()=>{const version=history[Number($('#history-select').value)];if(version){fill(version.snapshot);markDirty();$('#editor-status').textContent='La version précédente est chargée dans l’éditeur. Vérifiez-la avant de publier.'}};
$('#new-project').onclick=()=>open();$('#empty-add').onclick=()=>open();$('#close-editor').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
$('#project-form').addEventListener('input',e=>{e.target.removeAttribute('aria-invalid');e.target.removeAttribute('aria-describedby');$('#'+e.target.id+'-error')?.remove();markDirty()});
$('#project-form').addEventListener('submit',e=>{e.preventDefault();save('published')});$('#save-draft').onclick=()=>save('draft');$('#archive-project').onclick=()=>{if(confirm('Archiver ce projet ? Il sera retiré du site et restera disponible dans les archives.'))save('archived')};
$('#search').oninput=render;document.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>{filter=b.dataset.status;document.querySelectorAll('[data-status]').forEach(t=>{t.classList.toggle('active',t===b);t.setAttribute('aria-pressed',String(t===b))});render()});
$('#health-button').onclick=async()=>{const button=$('#health-button');button.disabled=true;$('#health-status').textContent='Vérification en cours…';try{const info=await api('/api/admin/health');$('#health-status').textContent='Stockage des projets et des photos : opérationnel.'+(info.errors.length?' '+info.errors.length+' incident(s) récent(s) enregistré(s).':' Aucun incident enregistré.')}catch(e){$('#health-status').textContent=e.message}finally{button.disabled=false}};
window.addEventListener('beforeunload',e=>{if(dirty||busy){cacheIfDirty();e.preventDefault();e.returnValue=''}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&dialog.open&&dirty){cache();persistDraft()}});
window.addEventListener('online',()=>{if(dialog.open&&dirty){draftReady=true;persistDraft()}});
for(const[event,code]of[['error','browser_error'],['unhandledrejection','promise_error']])window.addEventListener(event,()=>{fetch('/api/admin/errors',{method:'POST',headers:{'Content-Type':'application/json','X-SOAR-Admin':'1'},body:JSON.stringify({code}),keepalive:true}).catch(()=>{})});
load();
