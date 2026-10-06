import {saveProject} from '../../../../../lib/save-project';
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){const{id}=await params;return saveProject(request,id)}
