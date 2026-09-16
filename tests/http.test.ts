import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp} from '../server/app';
import type {Command,PlayerView} from '../packages/domain/types';
import {CATALOG,defaults} from '../packages/content/catalog';

describe('partida via HTTP entre dois clientes',()=>{
 let app:Awaited<ReturnType<typeof createApp>>,base:string,dataDir:string;
 beforeEach(async()=>{
   dataDir=await mkdtemp(path.join(tmpdir(),'showdown-http-'));
   app=await createApp({dataDir});base=await app.listen({port:0,host:'127.0.0.1'});
 });
 afterEach(async()=>{await app.close();});
 async function request(url:string,token?:string,body?:unknown){
   const response=await fetch(base+'/api'+url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
   return {status:response.status,body:await response.json()};
 }
 async function create(seed:string){
   const result=await request('/matches',undefined,{seed,names:['Alex','Sam'],specialties:['balanced','resilient']});
   expect(result.status).toBe(200);return result.body as {id:string;tokens:[string,string]};
 }
 it('autentica, isola projeções, rejeita escrita desatualizada e recupera o snapshot',async()=>{
   const room=await create('transport'),url=`/matches/${room.id}`;
   const a=(await request(url,room.tokens[0])).body as PlayerView;
   const b=(await request(url,room.tokens[1])).body as PlayerView;
   expect(a.player.id).toBe(0);expect(b.player.id).toBe(1);
   expect((await request(url)).status).toBe(400);
   expect((await request(url+'/targets/'+b.player.hand[0].uid,room.tokens[0])).status).toBe(400);
   expect((await request(url+'/replay',room.tokens[0])).status).toBe(400);
   // The supplied player field cannot impersonate the other bearer-token owner.
   const ready=await request(url+'/command',room.tokens[0],{version:a.version,entry:{type:'ready',player:1}});
   expect(ready.body.player.locked).toBe(true);expect(ready.body.opponent.locked).toBe(false);
   const planning=await request(url+'/command',room.tokens[1],{version:ready.body.version,entry:{type:'ready'}});
   const version=planning.body.version;
   const replies=await Promise.all([0,1].map(i=>request(url+'/command',room.tokens[i],{version,entry:{type:'stage',command:{type:'configure',target:'data',config:{read:70+i*10}}}})));
   expect(replies.map(r=>r.status).sort()).toEqual([200,400]);
   const before=await Promise.all(room.tokens.map(t=>request(url,t)));
   expect(before[0].body.version).toBe(version+1);
   for(const response of before){
     expect(Object.keys(response.body.opponent).sort()).toEqual(['locked','name']);
     expect(response.body).not.toHaveProperty('seed');expect(response.body).not.toHaveProperty('log');
     expect(response.body.player.telemetry).not.toHaveProperty('security');
     expect(response.body.player.telemetry).not.toHaveProperty('consistency');
   }
   await app.close();
   const snapshot=JSON.parse(await readFile(path.join(dataDir,`room-${room.id}.json`),'utf8'));
   expect(snapshot.match.version).toBe(version+1);
   // Unfinished pre-0.4 games normalize their additive incident history on load.
   snapshot.match.engineVersion='0.2.0';
   await writeFile(path.join(dataDir,`room-${room.id}.json`),JSON.stringify(snapshot));
   app=await createApp({dataDir});base=await app.listen({port:0,host:'127.0.0.1'});
   for(const i of [0,1]){const restored=(await request(url,room.tokens[i])).body;const {serverNow:_,...clock}=restored.clock;const {serverNow:__,...previousClock}=before[i].body.clock;expect(clock).toEqual(previousClock);expect({...restored,clock:undefined}).toEqual({...before[i].body,clock:undefined});}
   expect((await request(url+'/command',room.tokens[0],{version:version+1,entry:{type:'lock'}})).status).toBe(200);
   expect(JSON.parse(await readFile(path.join(dataDir,`room-${room.id}.json`),'utf8')).match.engineVersion).toBe('0.4.0');
 });
 it('constrói grafos distintos por 5 rodadas e reproduz o Showdown por replay',async()=>{
   const room=await create('flashcart-2026'),url=`/matches/${room.id}`;
   const view=async(player:number)=>(await request(url,room.tokens[player])).body as PlayerView;
   const send=async(player:number,entry:unknown)=>{
     const current=await view(player),result=await request(url+'/command',room.tokens[player],{version:current.version,entry});
     expect(result.status,JSON.stringify(result.body)).toBe(200);return result.body as PlayerView;
   };
   await send(0,{type:'ready'});await send(1,{type:'ready'});
   let commands=0;const revealTitles:string[]=[];
   const preferences=[['queue','worker','replica','index','lock','rate'],['bulkhead','balancer','scale','timeout','waf','multi-az']];
   for(let round=1;round<=5;round++){
     const start=await view(0);expect(start.round).toBe(round);expect(start.revealed.length).toBe(round);
     revealTitles.push(start.revealed.at(-1)!.title);
     for(const player of [0,1]){
       for(let action=0;action<2;action++){
         const p=(await view(player)).player;let command:Command|undefined;
         for(const id of preferences[player]){
           const card=p.hand.find(c=>c.cardId===id);if(!card||CATALOG[id].ec>p.ec)continue;
           const targets=(await request(url+'/targets/'+card.uid,room.tokens[player])).body as {id:string;type:string}[];
           const target=targets.find(t=>t.id==='pay')??targets.find(t=>t.id==='entry')??targets.find(t=>t.type!=='slot');
           if(target){command={type:'play',uid:card.uid,target:target.id,config:defaults(id)};break;}
         }
         if(!command)break;
         await send(player,{type:'stage',command});commands++;
       }
       const own=await view(player),other=await view(1-player);
       expect(other.opponent).not.toHaveProperty('graph');expect(other).not.toHaveProperty('showdown');
       expect(own.player.ec).toBeGreaterThanOrEqual(0);expect(own.player.actions).toBeGreaterThanOrEqual(0);
       expect(own.player.hand.length).toBeLessThanOrEqual(7);
       await send(player,{type:'lock'});
     }
     expect((await view(0)).phase).toBe('telemetry');
     await send(0,{type:'advance'});await send(1,{type:'advance'});
   }
   expect(commands).toBeGreaterThan(5);expect(new Set(revealTitles).size).toBe(5);
   const end=await view(0);expect(end.phase).toBe('showdown');
   expect(end.showdown!.graphs[0]).not.toEqual(end.showdown!.graphs[1]);
   expect(end.showdown!.categories.map(c=>c.id)).toEqual(['performance','availability','security','consistency','cost','resilience']);
   const record=(await request(url+'/replay',room.tokens[0])).body;
   const imported=await request('/replay',undefined,record);expect(imported.status).toBe(200);expect(imported.body.verified).toBe(true);
   const replayed=(await request(`/matches/${imported.body.id}`,imported.body.tokens[0])).body;
   expect(replayed.showdown).toEqual(end.showdown);
   expect((await request('/replay',undefined,{...record,resultHash:'tampered'})).status).toBe(400);
   expect((await request(url+'/command',room.tokens[0],{version:end.version,entry:{type:'undo'}})).status).toBe(400);
 },20000);
});
