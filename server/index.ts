import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApp} from './app';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dataDir=process.env.DATA_DIR?path.resolve(process.env.DATA_DIR):path.join(root,'data');
const port=Number(process.env.PORT??3001);
const host=process.env.HOST??'127.0.0.1';
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT deve ser um inteiro entre 1 e 65535.');
const app=await createApp({dataDir,serveDir:process.argv.includes('--production')?path.join(root,'dist'):undefined});
await app.listen({port,host});
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{void app.close().then(()=>process.exit(0));});
process.stdout.write(`Architecture Developer Showdown: servidor ativo em http://${host}:${port}\n`);
