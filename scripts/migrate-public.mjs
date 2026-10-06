import fs from 'node:fs';
const filename='public/app.js';let js=fs.readFileSync(filename,'utf8');js=js.replace("p=>p.addEventListener('click',()=>{","p=>p.tagName==='BUTTON'&&p.addEventListener('click',()=>{");js=js.replace("document.querySelector('#brief').addEventListener", "document.querySelector('#brief')?.addEventListener").replace("document.querySelector('#message').addEventListener", "document.querySelector('#message')?.addEventListener");fs.writeFileSync(filename,js);
fs.writeFileSync('.dev.vars','ADMIN_EMAILS=seedy@sites.test\n');
