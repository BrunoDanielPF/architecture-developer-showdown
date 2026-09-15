import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server/app';

describe('salas multiplayer com código',()=>{
 let app:Awaited<ReturnType<typeof createApp>>,dataDir:string,time:number;
 beforeEach(async()=>{time=1800000000000;dataDir=await mkdtemp(path.join(tmpdir(),'showdown-lobby-'));app=await createApp({dataDir,now:()=>time});});
 afterEach(async()=>{await app.close();});
 const req=async(url:string,body?:unknown,token?:string)=>{const r=await app.inject({method:body===undefined?'GET':'POST',url:'/api'+url,headers:token?{authorization:`Bearer ${token}`}:{},...(body===undefined?{}:{payload:body as any})});return {status:r.statusCode,body:r.json(),headers:r.headers};};
 const create=async()=>{const r=await req('/rooms',{name:'Alex',specialty:'balanced'});expect(r.status).toBe(200);return r.body;};
 const join=async(code:string,name='Sam')=>req('/rooms/join',{code,name,specialty:'resilient'});
 const action=(s:any,action:string,ready?:boolean)=>req(`/matches/${s.id}/lobby`,{action,ready},s.token);
 async function started(){const a=await create(),b=(await join(a.lobby.code)).body;await action(a,'ready',true);await action(b,'ready',true);expect((await action(a,'start')).status).toBe(200);return {a,b};}
 it('não entrega credenciais adversárias, estado de jogo ou seed no lobby',async()=>{
  const a=await create();expect(a.lobby.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);expect(a).not.toHaveProperty('tokens');
  expect(a.lobby).not.toHaveProperty('match');expect(a.lobby).not.toHaveProperty('seed');expect(a.lobby).not.toHaveProperty('tokens');
  for(const suffix of ['', '/lobby','/targets/p0-0'])expect((await req(`/matches/${a.id}${suffix}`)).status).toBe(400);
  expect((await req(`/matches/${a.id}`,undefined,a.token)).status).toBe(400);
  expect((await req(`/matches/${a.id}/command`,{version:0,entry:{type:'ready'}},a.token)).status).toBe(400);
  expect((await req(`/matches/${a.id}/targets/p0-0`,undefined,a.token)).status).toBe(400);
  const b=(await join(a.lobby.code.toLowerCase())).body;expect(b.token).not.toBe(a.token);expect(JSON.stringify(b)).not.toContain(a.token);
  const l=await req(`/matches/${a.id}/lobby`,undefined,a.token);expect(JSON.stringify(l.body)).not.toContain(b.token);expect(l.headers['cache-control']).toBe('no-store');
 });
 it('reserva a última vaga atomicamente e impede invasão de sala cheia',async()=>{
  const a=await create();const results=await Promise.all([join(a.lobby.code,'Sam'),join(a.lobby.code,'Taylor')]);
  expect(results.map(r=>r.status).sort()).toEqual([200,400]);expect(results.find(r=>r.status===400)!.body.error).toContain('cheia');
  const b=results.find(r=>r.status===200)!.body;
  expect((await action(b,'start')).status).toBe(400);expect((await action(a,'start')).status).toBe(400);
  await action(a,'ready',true);await action(b,'ready',true);await action(b,'ready',false);expect((await action(a,'start')).status).toBe(400);
  await action(b,'ready',true);time+=11000;expect((await action(a,'start')).status).toBe(400);
  await req(`/matches/${a.id}/lobby`,undefined,b.token);expect((await action(a,'start')).status).toBe(200);
  expect((await join(a.lobby.code)).status).toBe(400);expect((await action(a,'start')).status).toBe(400);
 });
 it('sair libera a vaga, revoga a credencial e reinicia prontidão',async()=>{
  const a=await create(),b=(await join(a.lobby.code)).body;await action(a,'ready',true);await action(b,'leave');
  expect((await req(`/matches/${a.id}/lobby`,undefined,b.token)).status).toBe(400);
  const c=(await join(a.lobby.code,'Nova pessoa')).body;expect(c.token).not.toBe(b.token);expect(c.lobby.seats[0].ready).toBe(false);
  await action(a,'leave');expect((await req(`/matches/${a.id}/lobby`,undefined,c.token)).body.status).toBe('closed');expect((await join(a.lobby.code)).status).toBe(400);
 });
 it('expira salas esperando e valida código, nome e especialização',async()=>{
  for(const body of [{name:' ',specialty:'balanced'},{name:'A',specialty:'__proto__'},{name:[],specialty:'balanced'},{}])expect((await req('/rooms',body)).status).toBe(400);
  expect((await join('???')).status).toBe(400);expect((await join('ABCDEFGH')).status).toBe(400);
  const a=await create();time+=86400001;expect((await join(a.lobby.code)).status).toBe(400);expect((await req(`/matches/${a.id}/lobby`,undefined,a.token)).body.status).toBe('closed');
 });
 it('recupera lobby e partida privada após reiniciar, sem pausar prazos',async()=>{
  const a=await create(),b=(await join(a.lobby.code)).body;await app.close();app=await createApp({dataDir,now:()=>time});
  expect((await req(`/matches/${a.id}/lobby`,undefined,b.token)).body.seats[0].name).toBe('Alex');
  await action(a,'ready',true);await action(b,'ready',true);await action(a,'start');
  const send=async(s:any,type:string)=>{const v=(await req(`/matches/${s.id}`,undefined,s.token)).body;return req(`/matches/${s.id}/command`,{version:v.version,entry:{type,player:1}},s.token);};
  expect((await send(a,'ready')).body.player.id).toBe(0);const v=(await send(b,'ready')).body;expect(v.phase).toBe('planning');
  const snapshot=JSON.parse(await readFile(path.join(dataDir,`room-${a.id}.json`),'utf8'));expect(snapshot.tokens).toEqual([a.token,b.token]);
  await app.close();time+=46000;app=await createApp({dataDir,now:()=>time});
  const restored=(await req(`/matches/${a.id}`,undefined,a.token)).body;expect(restored.phase).toBe('telemetry');expect(Object.keys(restored.opponent).sort()).toEqual(['locked','name']);expect(restored).not.toHaveProperty('seed');expect(restored).not.toHaveProperty('log');
  expect((await req(`/matches/${a.id}/lobby`,undefined,a.token)).body.online).toEqual([true,false]);
  const guest=(await req(`/matches/${a.id}`,undefined,b.token)).body;expect(guest.player.id).toBe(1);expect(guest.player.hand).not.toEqual(restored.player.hand);
 });
 it('executa 5 rodadas online e preserva replay determinístico',async()=>{
  const {a,b}=await started();
  const send=async(s:any,type:string)=>{const v=(await req(`/matches/${s.id}`,undefined,s.token)).body;const r=await req(`/matches/${s.id}/command`,{version:v.version,entry:{type}},s.token);expect(r.status).toBe(200);return r.body;};
  await send(a,'ready');await send(b,'ready');
  for(let i=0;i<5;i++){await send(a,'lock');await send(b,'lock');await send(a,'advance');await send(b,'advance');}
  const final=(await req(`/matches/${a.id}`,undefined,a.token)).body;expect(final.phase).toBe('showdown');expect(final.showdown.categories).toHaveLength(6);
  const record=(await req(`/matches/${a.id}/replay`,undefined,a.token)).body;expect((await req('/replay',record)).body.verified).toBe(true);
 });
 it('limita tentativas por IP e libera a janela sem bloquear sessões',async()=>{
  const a=await create();for(let i=0;i<29;i++)await join('????????');expect((await join(a.lobby.code)).status).toBe(429);
  expect((await req(`/matches/${a.id}/lobby`,undefined,a.token)).status).toBe(200);time+=60001;expect((await join(a.lobby.code)).status).toBe(200);
 });
 it('repetir criação ou entrada após resposta perdida recupera a mesma sessão, inclusive após reinício',async()=>{
  const hostBody={name:'Alex',specialty:'balanced',requestId:randomUUID()};
  const [first,retry]=await Promise.all([req('/rooms',hostBody),req('/rooms',hostBody)]);expect(first.body.id).toBe(retry.body.id);expect(first.body.token).toBe(retry.body.token);
  const guestBody={name:'Sam',specialty:'balanced',code:first.body.lobby.code,requestId:randomUUID()};
  const [guest,guestRetry]=await Promise.all([req('/rooms/join',guestBody),req('/rooms/join',guestBody)]);expect(guest.body.token).toBe(guestRetry.body.token);
  expect(JSON.stringify(guest.body)).not.toContain(guestBody.requestId);expect(JSON.stringify(first.body)).not.toContain(hostBody.requestId);
  await app.close();app=await createApp({dataDir,now:()=>time});expect((await req('/rooms/join',guestBody)).body.token).toBe(guest.body.token);
  await action(guest.body,'leave');const replacement=(await join(first.body.lobby.code,'Taylor')).body;
  expect((await req('/rooms/join',guestBody)).status).toBe(400);expect(replacement.token).not.toBe(guest.body.token);
 });
});
