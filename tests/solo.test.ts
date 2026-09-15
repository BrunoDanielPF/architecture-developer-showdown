import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server/app';

describe('partida solo autoritativa',()=>{
 let app:Awaited<ReturnType<typeof createApp>>,dataDir:string,time:number;
 beforeEach(async()=>{time=1800000000000;dataDir=await mkdtemp(path.join(tmpdir(),'showdown-solo-'));app=await createApp({dataDir,now:()=>time});});
 afterEach(async()=>{await app.close();});
 const req=async(url:string,body?:unknown,token?:string)=>{
  const r=await app.inject({method:body===undefined?'GET':'POST',url:'/api'+url,headers:token?{authorization:`Bearer ${token}`}:{},...(body===undefined?{}:{payload:body as any})});
  return {status:r.statusCode,body:r.json()};
 };
 const create=async()=>{const r=await req('/solo',{name:'Pessoa',specialty:'resilient',requestId:randomUUID()});expect(r.status).toBe(200);return r.body;};
 const view=async(s:any)=>(await req(`/matches/${s.id}`,undefined,s.token)).body;
 const snapshot=async(s:any)=>JSON.parse(await readFile(path.join(dataDir,`room-${s.id}.json`),'utf8'));
 async function send(s:any,type:string){const v=await view(s);const r=await req(`/matches/${s.id}/command`,{version:v.version,entry:{type,player:1}},s.token);expect(r.status).toBe(200);return r.body;}
 it('cria somente a credencial humana, valida perfil e recupera criação repetida após reinício',async()=>{
  for(const body of [{name:' ',specialty:'balanced'},{name:'A',specialty:'__proto__'},{name:'A',specialty:'balanced',requestId:'invalid'}])expect((await req('/solo',body)).status).toBe(400);
  const body={name:'Pessoa',specialty:'balanced',requestId:randomUUID()};
  const [a,b]=await Promise.all([req('/solo',body),req('/solo',body)]);expect(a.body).toEqual(b.body);expect(Object.keys(a.body).sort()).toEqual(['id','token']);
  const v=await view(a.body);expect(v.opponent).toEqual({name:'Arquiteto IA',locked:false,controller:'ai'});
  for(const key of ['seed','log','bot','tokens','soloKey'])expect(v).not.toHaveProperty(key);
  expect(v.player.id).toBe(0);expect((await snapshot(a.body)).tokens[1]).toBe('');
  expect((await req(`/matches/${a.body.id}`)).status).toBe(400);
  expect((await req(`/matches/${a.body.id}`,undefined,'invalid-ai-token')).status).toBe(400);
  expect((await send(a.body,'ready')).player.locked).toBe(true);
  expect((await snapshot(a.body)).match.players[1].locked).toBe(false);
  await app.close();app=await createApp({dataDir,now:()=>time});expect((await req('/solo',body)).body).toEqual(a.body);
 });
 it('faz a IA agir sem polling, retoma do disco e não reinicia o prazo',async()=>{
  const s=await create();await send(s,'ready');
  for(let i=0;i<3;i++){time+=1500;await new Promise(resolve=>setTimeout(resolve,300));}
  const before=await snapshot(s);expect(before.match.phase).toBe('planning');
  expect(before.match.log.some((e:any)=>e.player===1&&e.type==='ready')).toBe(true);
  await app.close();app=await createApp({dataDir,now:()=>time});
  expect((await view(s)).clock.deadline).toBe(before.clock.deadline);
  for(let i=0;i<8;i++){time+=1500;await view(s);}
  expect((await snapshot(s)).match.players[1].locked).toBe(true);
  time=before.clock.deadline+1;expect((await view(s)).phase).toBe('telemetry');
 });
 it('conclui cinco rodadas pela API, mantém conflitos de versão e exporta replay verificável',async()=>{
  const s=await create();await send(s,'ready');
  const stale=await req(`/matches/${s.id}/command`,{version:0,entry:{type:'ready'}},s.token);expect(stale.body.code).toBe('STALE_VERSION');
  for(let step=0;step<100;step++){
   time+=1500;const v=await view(s);if(v.phase==='showdown')break;
   if(!v.player.locked)await send(s,v.phase==='setup'?'ready':v.phase==='telemetry'?'advance':'lock');
  }
  const final=await view(s);expect(final.phase).toBe('showdown');expect(final.showdown.categories).toHaveLength(6);
  const record=(await req(`/matches/${s.id}/replay`,undefined,s.token)).body;
  expect(record.log.some((e:any)=>e.player===1&&e.type==='stage')).toBe(true);
  expect((await req('/replay',record)).body.verified).toBe(true);
 });
});
