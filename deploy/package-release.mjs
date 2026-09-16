import {createHash} from 'node:crypto';
import {readFile,readdir,stat,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const [release,previous,manifestPath,metadataPath,archivePath,testsArg]=process.argv.slice(2);
if(!/^architecture-developer-showdown-[0-9]{8}-[0-9]{6}$/.test(release))throw new Error('Release inválida.');
if(!previous?.startsWith('/var/www/architecture-developer-showdown/releases/'))throw new Error('Release anterior inválida.');
const tests=Number(testsArg);
if(!Number.isInteger(tests)||tests<1)throw new Error('Informe a quantidade de testes aprovados.');
const assets=(await readdir('dist/assets')).map(name=>`dist/assets/${name}`);
const tracked=spawnSync('git',['ls-files','-z','--','deploy','packages','server'],{encoding:'buffer'});
if(tracked.status!==0)throw new Error('Falha ao listar arquivos de runtime versionados.');
const runtimeFiles=tracked.stdout.toString('utf8').split('\0').filter(Boolean);
if(!runtimeFiles.includes('server/app.ts')||!runtimeFiles.includes('server/index.ts'))throw new Error('Backend incompleto no repositório.');
const files=[
 ...runtimeFiles,
 'dist/index.html',...assets,
 'package-lock.json','package.json','tests/production-smoke.ts'
].sort();
const entries={};
for(const file of files){const data=await readFile(file);entries[file]={sha256:createHash('sha256').update(data).digest('hex'),bytes:data.length};}
const manifest={release,createdAt:new Date().toISOString(),site:'https://architecture-developer-showdown.brdanpe.tech/',validation:{tests,build:'passed',productionSmoke:'passed'},files:entries};
await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
const tar=spawnSync('tar',['-czf',archivePath,...files],{stdio:'inherit'});if(tar.status!==0)throw new Error('Falha ao criar pacote.');
const archive=await readFile(archivePath),info=await stat(archivePath);
const metadata={release,archive:archivePath,manifest:manifestPath,sha256:createHash('sha256').update(archive).digest('hex'),bytes:info.size,files:files.length,previous};
await writeFile(metadataPath,JSON.stringify(metadata,null,2)+'\n');
console.log(JSON.stringify(metadata,null,2));
