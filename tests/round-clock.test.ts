import {describe,expect,it} from 'vitest';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createMatch,dispatch,exportReplay,replay} from '../packages/session';
import {expirePhase,startClock} from '../server/round-clock';
import {createApp} from '../server/app';

function planning(seed='clock'){
 let m=createMatch(seed);for(const player of [0,1])m=dispatch(m,{type:'ready',player});return m;
}
describe('relógio simultâneo',()=>{
 it('confirma o rascunho de quem não terminou e preserva EC de quem esperou',()=>{
  let m=planning();m=dispatch(m,{type:'stage',player:0,command:{type:'configure',target:'data',config:{read:70}}});
  m=dispatch(m,{type:'lock',player:1});
  expect(startClock(m,1000)).toMatchObject({deadline:46000,duration:45000});
  m=expirePhase(m);expect(m.phase).toBe('telemetry');expect(m.players[0].graph.edges.find(e=>e.id==='data')?.read).toBe(70);
  expect(m.players[0].ec).toBe(7);expect(m.players[1].ec).toBe(8);expect(m.log.at(-1)).toEqual({type:'lock',player:0});
  expect(startClock(m,46000)?.deadline).toBe(54000);expect(expirePhase(m).round).toBe(2);
 });
 it('finaliza pesquisa pendente sem bloquear o timeout nem o replay',()=>{
  let m=planning();const p=m.players[0],i=p.deck.findIndex(c=>c.cardId==='research');
  if(i>=0)p.hand.unshift(...p.deck.splice(i,1));
  const card=p.hand.find(c=>c.cardId==='research')!;
  m=dispatch(m,{type:'stage',player:0,command:{type:'play',uid:card.uid,target:'self',config:{}}});
  const chosen=m.players[0].research![0].uid;m=expirePhase(m);
  expect(m.phase).toBe('telemetry');expect(m.players[0].research).toBeUndefined();expect(m.players[0].hand.some(c=>c.uid===chosen)).toBe(true);
  expect(m.log).toContainEqual({type:'stage',player:0,command:{type:'researchChoice',uid:chosen}});
 });
 it('dá 45s para ajustar compra disputada e chega ao Showdown com replay exato',()=>{
  let m=planning('clock-market');const uid=m.market[0].uid;
  for(const player of [0,1])m=dispatch(m,{type:'stage',player,command:{type:'buy',uid}});
  m=expirePhase(m);expect(m.phase).toBe('adjustment');expect(startClock(m,45000)?.deadline).toBe(90000);
  m=expirePhase(m);expect(m.phase).toBe('telemetry');
  while(m.phase!=='showdown')m=expirePhase(m);
  expect(replay(exportReplay(m)).showdown).toEqual(m.showdown);
 });
 it('impõe prazo no servidor, mantém prazo ao reconectar e rejeita ação após expirar',async()=>{
  let time=1000;const dataDir=await mkdtemp(path.join(tmpdir(),'showdown-clock-'));
  let app=await createApp({dataDir,now:()=>time});
  try{
   const room=(await app.inject({method:'POST',url:'/api/matches',payload:{seed:'transport-clock'}})).json();
   const url=`/api/matches/${room.id}`,headers={authorization:`Bearer ${room.tokens[0]}`};
   const get=async()=> (await app.inject({url,headers})).json();
   expect((await get()).clock).toBeUndefined();
   for(const player of [0,1])await app.inject({method:'POST',url:url+'/command',headers:{authorization:`Bearer ${room.tokens[player]}`},payload:{version:player,entry:{type:'ready'}}});
   const before=await get();expect(before.clock.deadline).toBe(46000);
   time=45999;expect((await get()).phase).toBe('planning');
   await app.close();app=await createApp({dataDir,now:()=>time});expect((await get()).clock.deadline).toBe(46000);
   time=46000;
   const late=await app.inject({method:'POST',url:url+'/command',headers,payload:{version:before.version,entry:{type:'stage',command:{type:'configure',target:'data',config:{read:70}}}}});
   expect(late.json().code).toBe('STALE_VERSION');const after=await get();expect(after.phase).toBe('telemetry');expect(after.player.graph.edges.find((e:any)=>e.id==='data').read).toBe(100);
   // No connected client is needed: the background scheduler advances the persisted room.
   time=54000;await new Promise(resolve=>setTimeout(resolve,400));
   const saved=JSON.parse(await readFile(path.join(dataDir,`room-${room.id}.json`),'utf8'));
   expect(saved.match.round).toBe(2);expect(saved.match.phase).toBe('planning');
  }finally{await app.close();}
 },20000);
});
