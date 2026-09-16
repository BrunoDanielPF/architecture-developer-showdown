import assert from 'node:assert/strict';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {createApp} from '../server/app';
import {createMatch} from '../packages/session';

const output=path.resolve('docs/evidence/architecture-visuals');await mkdir(output,{recursive:true});
function seedWith(prefix:string,required:string[],specialty:string){for(let index=0;index<5000;index++){const candidate=`${prefix}-${index}`,match=createMatch(candidate,['Alex','Sam'],[specialty,'balanced']),cards=new Set(match.players[0].hand.map(card=>card.cardId));if(required.every(id=>cards.has(id)))return candidate;}throw new Error(`Mão determinística ausente: ${required.join(', ')}.`);}
const seed=seedWith('visual-cluster',['balancer','scale'],'distributed');
const app=await createApp({dataDir:await mkdtemp(path.join(tmpdir(),'showdown-visuals-')),serveDir:path.resolve('dist'),now:()=>100000});
const base=await app.listen({host:'127.0.0.1',port:0}),browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl']});
const dismissBriefing=async(page:any)=>{const button=page.getByRole('button',{name:'Entendi · ver tabuleiro'});try{await button.waitFor({state:'visible',timeout:3000});await button.click();}catch{/* The briefing may already have been dismissed for this session. */}};
try{
 const created=await (await fetch(base+'/api/matches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seed,names:['Alex','Sam'],specialties:['distributed','balanced']})})).json();
 const get=async(player=0)=>(await fetch(`${base}/api/matches/${created.id}`,{headers:{Authorization:`Bearer ${created.tokens[player]}`}})).json();
 const send=async(player:number,entry:any)=>{const view=await get(player),response=await fetch(`${base}/api/matches/${created.id}/command`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${created.tokens[player]}`},body:JSON.stringify({version:view.version,entry})});assert.equal(response.status,200);return response.json();};
 await send(0,{type:'ready'});await send(1,{type:'ready'});
 let view=await get(0),balancer=view.player.hand.find((card:any)=>card.cardId==='balancer'),scale=view.player.hand.find((card:any)=>card.cardId==='scale');assert.ok(balancer&&scale);
 await send(0,{type:'stage',command:{type:'play',uid:balancer.uid,target:'entry',config:{}}});
 view=await get(0);await send(0,{type:'stage',command:{type:'play',uid:scale.uid,target:'api',config:{instances:3}}});
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});await page.goto(`${base}/?room=${created.id}&token=${created.tokens[0]}`);
 await dismissBriefing(page);
 const api=page.locator('[data-node="api"]'),lb=page.locator('[data-node="balancer"]');await api.waitFor();await lb.waitFor();await page.waitForTimeout(1800);
 assert.equal(await api.getAttribute('data-instance-count'),'3');assert.match(await api.getAttribute('aria-label')??'',/3 instâncias/);
 const balancedEdge=page.locator('[data-balanced-lanes="3"]');await balancedEdge.waitFor();assert.equal(await balancedEdge.getAttribute('data-edge-effects'),'');
 assert.equal(await balancedEdge.getAttribute('data-communication-mode'),'request-response');assert.equal(await balancedEdge.getAttribute('data-communication-response'),'true');assert.match(await balancedEdge.locator('.protocol-mode').textContent()??'',/SÍNCRONO/);
 const sqlEdge=page.locator('[data-target="data"]');assert.equal(await sqlEdge.getAttribute('data-communication-mode'),'query-result');assert.equal(await sqlEdge.getAttribute('data-communication-synchronous'),'true');
 await page.screenshot({path:path.join(output,'nlb-three-replicas.png')});
 console.log(`Browser: cluster com 3 instâncias e ${await balancedEdge.getAttribute('data-balanced-lanes')} rotas balanceadas renderizado.`);
 await page.close();

 const grpcSeed=seedWith('visual-grpc',['grpc'],'distributed'),grpc=await (await fetch(base+'/api/matches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seed:grpcSeed,names:['Alex','Sam'],specialties:['distributed','balanced']})})).json();
 const grpcGet=async(player=0)=>(await fetch(`${base}/api/matches/${grpc.id}`,{headers:{Authorization:`Bearer ${grpc.tokens[player]}`}})).json();
 const grpcSend=async(player:number,entry:any)=>{const state=await grpcGet(player),response=await fetch(`${base}/api/matches/${grpc.id}/command`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${grpc.tokens[player]}`},body:JSON.stringify({version:state.version,entry})});assert.equal(response.status,200);return response.json();};
 await grpcSend(0,{type:'ready'});await grpcSend(1,{type:'ready'});view=await grpcGet(0);const grpcCard=view.player.hand.find((card:any)=>card.cardId==='grpc');assert.ok(grpcCard);await grpcSend(0,{type:'stage',command:{type:'play',uid:grpcCard.uid,target:'pay',config:{}}});
 const grpcPage=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});await grpcPage.goto(`${base}/?room=${grpc.id}&token=${grpc.tokens[0]}`);await dismissBriefing(grpcPage);const grpcEdge=grpcPage.locator('[data-target="pay"]');await grpcEdge.waitFor();assert.equal(await grpcEdge.getAttribute('data-communication-mode'),'multiplexed-request-response');assert.equal(await grpcEdge.getAttribute('data-communication-synchronous'),'true');assert.match(await grpcEdge.locator('.protocol-mode').textContent()??'',/MULTIPLEXADO/);await grpcPage.waitForTimeout(800);await grpcPage.screenshot({path:path.join(output,'grpc-multiplexed.png')});
 await grpcPage.close();

 const queueSeed=seedWith('visual-queue',['queue'],'balanced'),queue=await (await fetch(base+'/api/matches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seed:queueSeed,names:['Alex','Sam'],specialties:['balanced','distributed']})})).json();
 const queueGet=async(player=0)=>(await fetch(`${base}/api/matches/${queue.id}`,{headers:{Authorization:`Bearer ${queue.tokens[player]}`}})).json();
 const queueSend=async(player:number,entry:any)=>{const state=await queueGet(player),response=await fetch(`${base}/api/matches/${queue.id}/command`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${queue.tokens[player]}`},body:JSON.stringify({version:state.version,entry})});assert.equal(response.status,200);return response.json();};
 await queueSend(0,{type:'ready'});await queueSend(1,{type:'ready'});view=await queueGet(0);const queueCard=view.player.hand.find((card:any)=>card.cardId==='queue');assert.ok(queueCard);await queueSend(0,{type:'stage',command:{type:'play',uid:queueCard.uid,target:'pay',config:{}}});
 const queuePage=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});await queuePage.goto(`${base}/?room=${queue.id}&token=${queue.tokens[0]}`);await dismissBriefing(queuePage);const enqueueEdge=queuePage.locator('[data-target="pay"]'),consumeEdge=queuePage.locator('[data-communication-mode="consume"]');await enqueueEdge.waitFor();await consumeEdge.waitFor();assert.equal(await enqueueEdge.getAttribute('data-communication-mode'),'enqueue');assert.equal(await enqueueEdge.getAttribute('data-communication-acknowledgement'),'true');assert.equal(await consumeEdge.getAttribute('data-communication-response'),'false');await queuePage.waitForTimeout(800);await queuePage.screenshot({path:path.join(output,'queue-publish-consume.png')});
 await queuePage.close();
 console.log('Browser: REST, SQL, gRPC e fila exibem semânticas de comunicação distintas.');

 const resilientSeed=seedWith('visual-resilience',['multi-az','health'],'resilient'),resilient=await (await fetch(base+'/api/matches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seed:resilientSeed,names:['Alex','Sam'],specialties:['resilient','balanced']})})).json();
 const resilientGet=async(player=0)=>(await fetch(`${base}/api/matches/${resilient.id}`,{headers:{Authorization:`Bearer ${resilient.tokens[player]}`}})).json();
 const resilientSend=async(player:number,entry:any)=>{const state=await resilientGet(player),response=await fetch(`${base}/api/matches/${resilient.id}/command`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${resilient.tokens[player]}`},body:JSON.stringify({version:state.version,entry})});assert.equal(response.status,200);return response.json();};
 await resilientSend(0,{type:'ready'});await resilientSend(1,{type:'ready'});view=await resilientGet(0);const multiAz=view.player.hand.find((card:any)=>card.cardId==='multi-az'),health=view.player.hand.find((card:any)=>card.cardId==='health');
 await resilientSend(0,{type:'stage',command:{type:'play',uid:multiAz.uid,target:'api',config:{failover:4}}});await resilientSend(0,{type:'stage',command:{type:'play',uid:health.uid,target:'api',config:{}}});
 const resiliencePage=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});await resiliencePage.goto(`${base}/?room=${resilient.id}&token=${resilient.tokens[0]}`);await dismissBriefing(resiliencePage);
 const resilientApi=resiliencePage.locator('[data-node="api"]');await resilientApi.waitFor();await resiliencePage.waitForTimeout(1000);
 assert.match(await resilientApi.getAttribute('data-node-effects')??'',/zones/);assert.match(await resilientApi.getAttribute('data-node-effects')??'',/health/);
 const multiAzAttachment=resiliencePage.locator('[data-attachment-card="multi-az"]'),healthAttachment=resiliencePage.locator('[data-attachment-card="health"]');await multiAzAttachment.waitFor();await healthAttachment.waitFor();
 const multiAzBox=await multiAzAttachment.boundingBox(),healthBox=await healthAttachment.boundingBox();assert.ok(multiAzBox&&healthBox);assert.ok(multiAzBox.width>=20&&multiAzBox.height>=20);assert.ok(healthBox.width>=20&&healthBox.height>=20);assert.ok(multiAzBox.x+multiAzBox.width<=healthBox.x);assert.equal(await multiAzAttachment.getAttribute('data-attachment-placement'),'node-rack');
 await resiliencePage.screenshot({path:path.join(output,'multi-az-health.png')});
 await resiliencePage.close();

 const securitySeed=seedWith('visual-security',['waf','rate'],'balanced'),security=await (await fetch(base+'/api/matches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seed:securitySeed,names:['Alex','Sam'],specialties:['balanced','distributed']})})).json();
 const securityGet=async(player=0)=>(await fetch(`${base}/api/matches/${security.id}`,{headers:{Authorization:`Bearer ${security.tokens[player]}`}})).json();
 const securitySend=async(player:number,entry:any)=>{const state=await securityGet(player),response=await fetch(`${base}/api/matches/${security.id}/command`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${security.tokens[player]}`},body:JSON.stringify({version:state.version,entry})});assert.equal(response.status,200);return response.json();};
 await securitySend(0,{type:'ready'});await securitySend(1,{type:'ready'});view=await securityGet(0);const waf=view.player.hand.find((card:any)=>card.cardId==='waf'),rate=view.player.hand.find((card:any)=>card.cardId==='rate');
 await securitySend(0,{type:'stage',command:{type:'play',uid:waf.uid,target:'entry',config:{strictness:2}}});await securitySend(0,{type:'stage',command:{type:'play',uid:rate.uid,target:'entry',config:{limit:2400,identity:1}}});
 const securityPage=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});await securityPage.goto(`${base}/?room=${security.id}&token=${security.tokens[0]}`);await dismissBriefing(securityPage);const protectedEdge=securityPage.locator('[data-target="entry"]');await protectedEdge.waitFor();await securityPage.waitForTimeout(1000);const edgeEffects=await protectedEdge.getAttribute('data-edge-effects')??'';assert.match(edgeEffects,/firewall/);assert.match(edgeEffects,/rate-limit/);const wafAttachment=securityPage.locator('[data-attachment-card="waf"]'),rateAttachment=securityPage.locator('[data-attachment-card="rate"]');await wafAttachment.waitFor();await rateAttachment.waitFor();const wafBox=await wafAttachment.boundingBox(),rateBox=await rateAttachment.boundingBox();assert.ok(wafBox&&wafBox.width>=20&&wafBox.height>=20);assert.ok(rateBox&&rateBox.width>=20&&rateBox.height>=20);assert.equal((await wafAttachment.locator('small').textContent())?.trim(),'WAF');assert.equal((await rateAttachment.locator('small').textContent())?.trim(),'RATE');assert.equal(await wafAttachment.getAttribute('data-attachment-placement'),'inline-gate');assert.equal(await rateAttachment.getAttribute('data-attachment-placement'),'inline-gate');await securityPage.screenshot({path:path.join(output,'waf-rate-limit.png')});
 console.log('Browser: Multi-AZ, Health Checks, WAF e Rate Limit também refletidos nos componentes 3D.');
}finally{await browser.close();await app.close();}
