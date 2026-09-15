// Explicit production smoke: creates one named validation match and finishes it.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const origin='https://architecture-developer-showdown.brdanpe.tech';
const manifest=JSON.parse(await readFile(process.argv[2],'utf8'));
const report={release:manifest.release,checkedAt:new Date().toISOString(),site:origin,checks:[]};
const digest=data=>createHash('sha256').update(data).digest('hex');
const fetchTimed=(url,options={})=>fetch(url,{...options,signal:AbortSignal.timeout(15000)});
for(const [file,expected] of Object.entries(manifest.files).filter(([file])=>file.startsWith('dist/'))){
 const url=file==='dist/index.html'?origin+'/':origin+'/'+file.slice(5);
 const response=await fetchTimed(url);assert.equal(response.status,200,url);
 assert.equal(digest(Buffer.from(await response.arrayBuffer())),expected.sha256,`Published bytes differ: ${file}`);
 if(file.endsWith('.js'))assert.match(response.headers.get('content-type')??'',/javascript/);
 if(file.endsWith('.css'))assert.match(response.headers.get('content-type')??'',/css/);
 if(file.endsWith('.html')){assert.ok(response.headers.get('strict-transport-security'));assert.ok(response.headers.get('content-security-policy'));}
}
report.checks.push('HTML, CSS and JS hashes match the release; HTTPS security headers present');
const redirect=await fetchTimed(origin.replace('https:','http:')+'/',{redirect:'manual'});
assert.equal(redirect.status,301);assert.equal(redirect.headers.get('location'),origin+'/');
assert.equal((await fetchTimed('https://engenhalab.brdanpe.tech/')).status,200);
report.checks.push('HTTP redirects to HTTPS; EngenhaLab remains accessible');
async function api(route,body,token){
 const response=await fetchTimed(origin+'/api'+route,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 assert.equal(response.status,200,`API ${route} failed (${response.status})`);return response.json();
}
assert.deepEqual(await api('/health'),{ok:true});
const host=await api('/rooms',{name:'Verificação deploy A',specialty:'balanced'});
const guest=await api('/rooms/join',{code:host.lobby.code,name:'Verificação deploy B',specialty:'resilient'});
assert.equal(guest.id,host.id);assert.notEqual(guest.token,host.token);
assert.ok(!('tokens' in host));assert.ok(!JSON.stringify(guest).includes(host.token));
for(const player of [host,guest])await api(`/matches/${host.id}/lobby`,{action:'ready',ready:true},player.token);
await api(`/matches/${host.id}/lobby`,{action:'start'},host.token);
async function send(player,type){
 const view=await api(`/matches/${host.id}`,undefined,player.token);
 if(view.phase!=='showdown'){
  assert.deepEqual(Object.keys(view.opponent).sort(),['locked','name']);
  assert.ok(!('seed' in view));assert.ok(!('log' in view));
 }
 return api(`/matches/${host.id}/command`,{version:view.version,entry:{type}},player.token);
}
for(const player of [host,guest])await send(player,'ready');
for(let round=1;round<=5;round++){
 for(const player of [host,guest])await send(player,'lock');
 for(const player of [host,guest])await send(player,'advance');
}
const final=await api(`/matches/${host.id}`,undefined,host.token);
assert.equal(final.phase,'showdown');assert.equal(final.showdown.categories.length,6);
const replay=await api(`/matches/${host.id}/replay`,undefined,host.token);assert.ok(replay.resultHash);
report.validationMatch=host.id;
report.checks.push('Room creation/join, individual credentials, readiness, host start, private projections, five rounds and replay export passed');

const solo=await api('/solo',{name:'Verificação deploy IA',specialty:'distributed',requestId:crypto.randomUUID()});
assert.deepEqual(Object.keys(solo).sort(),['id','token']);
let soloView=await api(`/matches/${solo.id}`,undefined,solo.token);
assert.deepEqual(soloView.opponent,{name:'Arquiteto IA',locked:false,controller:'ai'});
assert.equal(soloView.player.id,0);assert.ok(!('seed' in soloView));assert.ok(!('log' in soloView));
async function soloCommand(type){
 soloView=await api(`/matches/${solo.id}`,undefined,solo.token);
 soloView=await api(`/matches/${solo.id}/command`,{version:soloView.version,entry:{type}},solo.token);
}
for(let step=0;step<120&&soloView.phase!=='showdown';step++){
 soloView=await api(`/matches/${solo.id}`,undefined,solo.token);
 if(!soloView.player.locked)await soloCommand(soloView.phase==='setup'?'ready':soloView.phase==='telemetry'?'advance':'lock');
 else await new Promise(resolve=>setTimeout(resolve,500));
}
assert.equal(soloView.phase,'showdown');assert.equal(soloView.showdown.categories.length,6);
const soloReplay=await api(`/matches/${solo.id}/replay`,undefined,solo.token);
assert.ok(soloReplay.log.some(entry=>entry.player===1&&entry.type==='stage'));
const imported=await api('/replay',soloReplay);assert.equal(imported.verified,true);
report.soloValidationMatch=solo.id;
report.checks.push('Solo creation, AI-only opponent control, five autonomous rounds, Showdown and replay import passed');
await writeFile(process.argv[3],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
