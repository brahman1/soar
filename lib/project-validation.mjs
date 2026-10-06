export const categories=['Réhabilitation','Intérieur','Architecture'];
export function validateProject(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Projet invalide.');
 const clean=(key,max,required=false)=>{if(typeof value[key]!=='string')throw new Error('Champ invalide : '+key);const text=value[key].trim();if(text.length>max||required&&!text)throw new Error('Vérifiez le champ '+key+'.');return text};
 const title=clean('title',140,true),category=clean('category',40,true),location=clean('location',140),year=clean('year',4),description=clean('description',12000);
 if(!categories.includes(category))throw new Error('Choisissez une catégorie valide.');if(year&&!/^\d{4}$/.test(year))throw new Error('L’année doit contenir quatre chiffres.');
 if(!['draft','published','archived'].includes(value.status))throw new Error('Statut invalide.');
 if(!Number.isInteger(value.position)||value.position<0||value.position>9999)throw new Error('Ordre invalide.');
 if(!Array.isArray(value.images)||value.images.length>20)throw new Error('Maximum : 20 photos par projet.');
 const images=value.images.map(i=>{if(!i||typeof i.id!=='string'||!/^[-a-z0-9]{36}$/.test(i.id)||typeof i.alt!=='string'||i.alt.trim().length>250)throw new Error('Photo invalide.');return{id:i.id,alt:i.alt.trim()}});
 if(new Set(images.map(i=>i.id)).size!==images.length)throw new Error('Une photo est présente plusieurs fois.');
 if(value.status==='published'&&!images.length)throw new Error('Ajoutez au moins une photo avant de publier.');
 if(value.status==='published'&&images.some(i=>!i.alt))throw new Error('Renseignez la description de chaque image avant de publier.');
 return{title,category,location,year,description,status:value.status,position:value.position,images};
}
export function imageType(bytes){if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return'image/jpeg';if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10)return'image/png';if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')return'image/webp';return null}
