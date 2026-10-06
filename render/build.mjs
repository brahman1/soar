import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('dist-render',{recursive:true});
await build({entryPoints:['render/server.mjs'],outfile:'dist-render/server.mjs',bundle:true,platform:'node',format:'esm',target:'node22',alias:{'cloudflare:workers':'./render/storage.mjs'}});
console.log('SOAR Render production server built.');
