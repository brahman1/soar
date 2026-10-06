import { getProject } from '../../../lib/projects';
import { detail,htmlResponse } from '../../../lib/render';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){const{id}=await params;const p=await getProject(id);if(!p)return htmlResponse('<!doctype html><html lang="fr"><title>Projet introuvable — SOAR</title><h1>Ce projet n’est pas disponible.</h1><a href="/">Retour au studio</a></html>',404);return htmlResponse(detail(p))}
