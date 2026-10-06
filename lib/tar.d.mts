export type ArchiveFile={name:string;size:number;bytes?:Uint8Array;body?:ReadableStream<Uint8Array>};
export function archiveStream(files:AsyncIterable<ArchiveFile>):ReadableStream<Uint8Array>;
export function tarHeader(name:string,size:number):Uint8Array;
export function tarFiles(files:AsyncIterable<ArchiveFile>):AsyncGenerator<Uint8Array>;
