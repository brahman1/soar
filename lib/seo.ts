import {env} from 'cloudflare:workers';
import {escape} from './render';
export function origin(request?:Request){return env.SITE_ORIGIN??(request?new URL(request.url).origin:'https://soar-soraya-studio.brahimarab-pro.chatgpt.site')}
export function indexing(){return env.INDEXING_ENABLED==='true'}
export function metadata(html:string,{title,description,url,image,jsonld}:{title:string;description:string;url:string;image:string;jsonld?:unknown}){
 const text=description.replace(/\s+/g,' ').slice(0,160);const imageUrl=new URL(image,url).href;
 const tags=`<link rel="canonical" href="${escape(url)}"><meta name="robots" content="${indexing()?'index,follow':'noindex,nofollow'}"><meta property="og:locale" content="fr_FR"><meta property="og:type" content="website"><meta property="og:site_name" content="SOAR — Soraya Architecture Studio"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(text)}"><meta property="og:url" content="${escape(url)}"><meta property="og:image" content="${escape(imageUrl)}"><meta name="twitter:card" content="summary_large_image">${jsonld?'<script type="application/ld+json">'+JSON.stringify(jsonld).replace(/</g,'\\u003c')+'</script>':''}`;
 return html.replace(/<title>[\s\S]*?<\/title>/,`<title>${escape(title)}</title>`).replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${escape(text)}">`).replace('</head>',tags+'</head>');
}
