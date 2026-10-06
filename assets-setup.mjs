import fs from 'node:fs/promises';
await fs.mkdir('dist/assets',{recursive:true});
const images={hero:'photo-1600210492486-724fe5c67fb0',material:'photo-1600607687939-ce8a6c25118c',light:'photo-1600607687920-4e2a09cf159d'};
for(const [name,id] of Object.entries(images)){const res=await fetch(`https://images.unsplash.com/${id}?auto=format&fit=crop&w=1800&q=85`);if(!res.ok)throw new Error(`${name}: ${res.status}`);await fs.writeFile(`dist/assets/${name}.jpg`,Buffer.from(await res.arrayBuffer()));console.log(name+' downloaded');}
