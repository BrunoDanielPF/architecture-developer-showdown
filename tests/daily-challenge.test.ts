import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server/app';
import {buildDailyChallenge,dailyDate} from '../server/daily-challenge';

describe('desafio diário autoritativo',()=>{
 let app:Awaited<ReturnType<typeof createApp>>,dataDir:string,time:number;
 const secret='segredo-de-teste-diario-com-32-caracteres';
 beforeEach(async()=>{time=Date.parse('2026-09-15T14:00:00Z');dataDir=await mkdtemp(path.join(tmpdir(),'showdown-daily-'));app=await createApp({dataDir,now:()=>time,dailyChallengeSecret:secret});});
 afterEach(async()=>{await app.close();});
 const req=async(url:string,body?:unknown,token?:string)=>{const response=await app.inject({method:body===undefined?'GET':'POST',url:'/api'+url,headers:token?{authorization:`Bearer ${token}`}:{},...(body===undefined?{}:{payload:body as any})});return {status:response.statusCode,body:response.json()};};

 it('mantém a definição no mesmo dia, muda na virada de São Paulo e nunca publica a seed',async()=>{
  const a=buildDailyChallenge(time,secret),b=buildDailyChallenge(time+60*60*1000,secret);
  expect(a).toEqual(b);expect(a.definition.date).toBe(dailyDate(time));expect(a.definition.expiresAt).toBeGreaterThan(time);
  expect(JSON.stringify((await req('/challenges/daily')).body)).not.toContain(a.seed);
  time=a.definition.expiresAt+1000;const next=(await req('/challenges/daily')).body;
  expect(next.id).not.toBe(a.definition.id);expect(next.date).not.toBe(a.definition.date);expect(next).not.toHaveProperty('seed');
 });

 it('inicia de forma idempotente, persiste após reinício e não expõe estado oculto',async()=>{
  const requestId=randomUUID(),body={name:'Alex',requestId};
  const first=await req('/challenges/daily/start',body),again=await req('/challenges/daily/start',body);
  expect(first.status).toBe(200);expect(again.body).toEqual(first.body);expect(first.body.challenge.objectives).toHaveLength(3);
  const view=(await req(`/matches/${first.body.id}`,undefined,first.body.token)).body;
  expect(view.challenge.id).toBe(first.body.challenge.id);expect(view.opponent.controller).toBe('ai');expect(view).not.toHaveProperty('seed');expect(view).not.toHaveProperty('scenarios');
  const snapshot=JSON.parse(await readFile(path.join(dataDir,`room-${first.body.id}.json`),'utf8'));
  expect(snapshot.match.seed).toBeTruthy();expect(snapshot.match.players[0].specialty).toBe(first.body.challenge.specialty);
  await app.close();app=await createApp({dataDir,now:()=>time,dailyChallengeSecret:secret});
  expect((await req('/challenges/daily/start',body)).body).toEqual(first.body);
 });

 it('calcula os três objetivos somente no Showdown e mantém o replay verificável',async()=>{
  const started=(await req('/challenges/daily/start',{name:'Alex',requestId:randomUUID()})).body;
  const view=async()=>(await req(`/matches/${started.id}`,undefined,started.token)).body;
  const send=async(type:string)=>{const current=await view();return req(`/matches/${started.id}/command`,{version:current.version,entry:{type}},started.token);};
  expect((await view())).not.toHaveProperty('challengeResult');await send('ready');
  for(let step=0;step<100;step++){
   time+=1500;const current=await view();if(current.phase==='showdown')break;
   if(!current.player.locked)await send(current.phase==='telemetry'?'advance':'lock');
  }
  const final=await view();expect(final.phase).toBe('showdown');expect(final.challengeResult.completed).toBe(true);expect(final.challengeResult.objectives).toHaveLength(3);expect(final.challengeResult.score).toBeGreaterThanOrEqual(0);expect(final.challengeResult.score).toBeLessThanOrEqual(3);
  const replay=(await req(`/matches/${started.id}/replay`,undefined,started.token)).body;expect(replay.seed).toBeTruthy();expect((await req('/replay',replay)).body.verified).toBe(true);
 },20000);
});
