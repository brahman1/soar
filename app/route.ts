import { listProjects } from '../lib/projects';
import { home,htmlResponse } from '../lib/render';
export async function GET(){return htmlResponse(home(await listProjects()))}
