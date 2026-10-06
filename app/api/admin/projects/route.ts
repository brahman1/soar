import {authorize,failure,json} from '../../../../lib/security';
import {listProjects} from '../../../../lib/projects';
import {saveProject} from '../../../../lib/save-project';
export async function GET(request:Request){try{authorize(request);return json({projects:await listProjects(true)})}catch(e){return failure(e)}}
export async function POST(request:Request){return saveProject(request)}
