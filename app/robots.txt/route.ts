import {indexing,origin} from '../../lib/seo';
export async function GET(request:Request){const body=indexing()?'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: '+origin(request)+'/sitemap.xml\n':'User-agent: *\nDisallow: /\n';return new Response(body,{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}})}
