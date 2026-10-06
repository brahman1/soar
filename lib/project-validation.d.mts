export const categories: string[];
export type ValidProject={title:string;category:string;location:string;year:string;description:string;status:'draft'|'published'|'archived';position:number;images:{id:string;alt:string}[]};
export function validateProject(value:unknown):ValidProject;
export function imageType(bytes:Uint8Array):string|null;
