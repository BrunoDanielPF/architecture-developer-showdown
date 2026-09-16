import {type Lobby,admissionKey,profile,normalizeCode,roomCode,privateToken} from './lobby';
import {clockKey,startClock,expirePhase,type RoundClock} from './round-clock';
import Fastify from 'fastify';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { createMatch, dispatch, exportReplay, project, replay, ENGINE_VERSION } from '../packages/session';
import type { DailyChallengeDefinition, LogEntry, Match } from '../packages/domain/types';
import { candidates, draft } from '../packages/rules';
import { CATALOG } from '../packages/content/catalog';
import {nextBotEntry} from './bot';
import {buildDailyChallenge,dailySecret,evaluateDailyChallenge} from './daily-challenge';
import {upgradeIncidentHistory} from '../packages/simulation/incidents';

export async function createApp({dataDir,serveDir,now=Date.now,dailyChallengeSecret}:{dataDir:string;serveDir?:string;now?:()=>number;dailyChallengeSecret?:string}){
const app=Fastify({logger:false,bodyLimit:1024*1024});
type Room={match:Match;tokens:[string,string];clock?:RoundClock;admissionKeys?:[string,string];lobby?:Lobby;bot?:{player:1;key:string;nextAt:number};soloKey?:string;challengeKey?:string;challenge?:DailyChallengeDefinition};
const rooms=new Map<string,Room>();
await mkdir(dataDir,{recursive:true});
const challengeSecret=await dailySecret(dataDir,dailyChallengeSecret);
for(const name of await readdir(dataDir)){if(/^room-[a-f0-9]+\.json$/.test(name)){try{const room=JSON.parse(await readFile(path.join(dataDir,name),'utf8')) as Room;
// Incomplete pre-0.4 snapshots can adopt the additive incident contract after
// their history is normalized. Completed matches remain pinned to their engine.
if(['0.2.0','0.3.0'].includes(room.match.engineVersion)&&room.match.phase!=='showdown'){
 for(const player of room.match.players){player.runtime.history=upgradeIncidentHistory(player.runtime.history);player.telemetry=player.runtime.history.at(-1)??player.telemetry;}
 room.match.engineVersion=ENGINE_VERSION;
}
rooms.set(name.slice(5,-5),room);}catch{/* A damaged snapshot does not block starting new matches. */}}}
// Serialize snapshots per room. Atomic rename prevents a torn JSON snapshot after interruption.
const writes=new Map<string,Promise<void>>();
const save=(id:string)=>{
 const snapshot=JSON.stringify(rooms.get(id)),file=path.join(dataDir,`room-${id}.json`);
 const pending=(writes.get(id)??Promise.resolve()).catch(()=>{}).then(async()=>{
   await writeFile(file+'.next',snapshot);await rename(file+'.next',file);
 });
 writes.set(id,pending);return pending;
};
function syncClock(room:Room){
 if(room.lobby&&room.lobby.status!=='playing'){room.clock=undefined;return;}
 if(room.clock?.key!==clockKey(room.match))room.clock=startClock(room.match,now());
}
async function tick(id:string,room:Room){
 let changed=false;
 syncClock(room);
 if(room.clock&&now()>=room.clock.deadline){
  room.match=expirePhase(room.match);room.clock=startClock(room.match,now());changed=true;
 }
 if(room.bot){
  const bot=room.bot,key=clockKey(room.match);
  if(bot.key!==key){bot.key=key;bot.nextAt=now()+1200;changed=true;}
  if(room.match.phase!=='showdown'&&!room.match.players[bot.player].locked&&now()>=bot.nextAt){
   const {phase,round,player,world,market}=project(room.match,bot.player);
   try{
    const entry=nextBotEntry({phase,round,player,world,market});
    if(entry)room.match=dispatch(room.match,{...entry,player:bot.player});
   }catch(error){
    app.log.error(error);
    // A policy failure must never leave the human waiting forever in setup.
    const research=room.match.players[bot.player].research;
    const entry=phase==='setup'?{type:'ready' as const}:phase==='telemetry'?{type:'advance' as const}:research?.length?{type:'stage' as const,command:{type:'researchChoice' as const,uid:research[0].uid}}:{type:'lock' as const};
    room.match=dispatch(room.match,{...entry,player:bot.player});
   }
   bot.nextAt=now()+1200;syncClock(room);changed=true;
  }
 }
 if(changed)await save(id);
}
for(const [id,room] of rooms){syncClock(room);await save(id);}
const ticker=setInterval(()=>{for(const [id,room] of rooms)void tick(id,room).catch(error=>app.log.error(error));},250);
ticker.unref();
app.addHook('onClose',async()=>{clearInterval(ticker);await Promise.allSettled(writes.values());});
const seen=new Map<string,[number,number]>();
function presence(id:string,player:number){const times=seen.get(id)??[0,0];times[player]=now();seen.set(id,times);}
function lobbyView(id:string,room:Room,player:number){const l=room.lobby!;return {...l,player,serverNow:now(),online:[0,1].map(i=>!!l.seats[i]&&now()-(seen.get(id)?.[i]??-Infinity)<10000)};}
function playable(room:Room){if(room.lobby&&room.lobby.status!=='playing')throw new Error('A partida ainda não começou ou a sala foi encerrada.');}
function projection(room:Room,player:number){playable(room);const view=project(room.match,player);const challengeResult=room.challenge?evaluateDailyChallenge(room.match,player):undefined;return {...view,...(room.bot?{opponent:{...view.opponent,controller:'ai' as const}}:{}),...(room.clock?{clock:{...room.clock,serverNow:now()}}:{}),...(room.challenge?{challenge:room.challenge}:{}),...(challengeResult?{challengeResult}:{})};}
function auth(request:any):{room:Room;player:number;id:string}{
 const id=request.params.id as string,room=rooms.get(id);if(!room)throw new Error('Partida não encontrada.');
 const token=(request.headers.authorization??'').replace(/^Bearer /,'');const player=token?room.tokens.indexOf(token):-1;if(player<0||room.bot?.player===player)throw new Error('Sessão privada inválida.');presence(id,player);return {room,player,id};
}
app.setErrorHandler((error,_request,reply)=>reply.status((error as any).statusCode===429?429:400).send({error:(error as Error).message,code:(error as any).code}));
app.addHook('onSend',async(request,reply,payload)=>{if(request.url.startsWith('/api/'))reply.header('Cache-Control','no-store');return payload;});
app.get('/api/health',()=>({ok:true}));
app.get('/api/challenges/daily',()=>buildDailyChallenge(now(),challengeSecret).definition);
// Bounded per-IP admission limits; bearer-authenticated polling is unaffected.
const admission=new Map<string,{count:number;reset:number}>();
function limit(ip:string){
 for(const [key,value] of admission)if(value.reset<=now())admission.delete(key);
 const entry=admission.get(ip)??{count:0,reset:now()+60000};
 if(entry.count>=30||(!admission.has(ip)&&admission.size>=10000))throw Object.assign(new Error('Muitas tentativas. Aguarde um minuto.'),{statusCode:429});
 entry.count++;admission.set(ip,entry);
}
function activeLobby(room:Room){
 const l=room.lobby;if(!l)throw new Error('Sala multiplayer não encontrada.');
 if(l.status==='waiting'&&now()>=l.expiresAt){l.status='closed';l.revision++;}
 return l;
}
app.post('/api/rooms',async request=>{
 limit(request.ip);const host=profile(request.body),key=admissionKey(request.body);
 if(key){const previous=[...rooms].find(([,r])=>r.admissionKeys?.[0]===key);if(previous){const [id,room]=previous;presence(id,0);await save(id);return {id,token:room.tokens[0],lobby:lobbyView(id,room,0)};}}
 let code=roomCode();while([...rooms.values()].some(r=>r.lobby?.code===code))code=roomCode();
 const id=randomBytes(8).toString('hex'),tokens:[string,string]=[privateToken(),''];
 const match=createMatch(privateToken(),[host.name,'Aguardando'],[host.specialty,'balanced']);match.id=id;
 const room:Room={match,tokens,admissionKeys:[key,''],lobby:{code,status:'waiting',seats:[host,null],expiresAt:now()+86400000,revision:0}};
 rooms.set(id,room);presence(id,0);await save(id);return {id,token:tokens[0],lobby:lobbyView(id,room,0)};
});
app.post('/api/rooms/join',async request=>{
 limit(request.ip);const b=request.body as any,guest=profile(b),code=normalizeCode(b.code),key=admissionKey(b);
 const found=[...rooms].find(([,r])=>r.lobby?.code===code);if(!found)throw new Error('Sala não encontrada. Confira o código.');
 const [id,room]=found,l=activeLobby(room);
 if(key&&room.admissionKeys?.[1]===key&&l.seats[1]){presence(id,1);await save(id);return {id,token:room.tokens[1],lobby:lobbyView(id,room,1)};}
 if(l.status!=='waiting')throw new Error('Esta sala já começou, expirou ou foi encerrada.');
 if(l.seats[1])throw new Error('Sala cheia. Esta partida permite dois jogadores.');
 // Claim the seat before the first await, preventing two concurrent joins.
 room.admissionKeys??=['',''];room.admissionKeys[1]=key;
 l.seats[1]=guest;l.seats[0].ready=false;l.revision++;room.tokens[1]=privateToken();presence(id,1);
 const token=room.tokens[1];await save(id);return {id,token,lobby:lobbyView(id,room,1)};
});
app.get('/api/matches/:id/lobby',request=>{const {id,room,player}=auth(request);activeLobby(room);return lobbyView(id,room,player);});
app.post('/api/matches/:id/lobby',async request=>{
 const {id,room,player}=auth(request),l=activeLobby(room),b=request.body as any;
 if(l.status!=='waiting')throw new Error('O lobby já foi fechado.');
 if(b?.action==='ready'){
  if(typeof b.ready!=='boolean')throw new Error('Confirmação inválida.');
  l.seats[player]!.ready=b.ready;
 }else if(b?.action==='start'){
  if(player!==0)throw new Error('Somente o anfitrião pode iniciar.');
  if(!l.seats.every(s=>s?.ready)||!lobbyView(id,room,player).online.every(Boolean))throw new Error('Os dois jogadores devem estar conectados e prontos.');
  room.match=createMatch(privateToken(),l.seats.map(s=>s!.name),l.seats.map(s=>s!.specialty));room.match.id=id;l.status='playing';syncClock(room);
 }else if(b?.action==='leave'){
  if(player===0)l.status='closed';
  else {l.seats[1]=null;room.tokens[1]='';if(room.admissionKeys)room.admissionKeys[1]='';l.seats[0].ready=false;seen.get(id)![1]=0;}
 }else throw new Error('Ação de lobby inválida.');
 l.revision++;await save(id);return lobbyView(id,room,player);
});
app.post('/api/solo',async request=>{
 limit(request.ip);const human=profile(request.body),key=admissionKey(request.body);
 if(key){const previous=[...rooms].find(([,r])=>r.bot&&r.soloKey===key);if(previous){const [id,room]=previous;await save(id);return {id,token:room.tokens[0]};}}
 const id=randomBytes(8).toString('hex'),match=createMatch(privateToken(),[human.name,'Arquiteto IA'],[human.specialty,'balanced']);match.id=id;
 const room:Room={match,tokens:[privateToken(),''],soloKey:key,bot:{player:1,key:clockKey(match),nextAt:now()+1200}};
 rooms.set(id,room);await save(id);return {id,token:room.tokens[0]};
});
app.post('/api/challenges/daily/start',async request=>{
 limit(request.ip);const current=buildDailyChallenge(now(),challengeSecret),key=admissionKey(request.body);
 if(key){const previous=[...rooms].find(([,room])=>room.challenge?.id===current.definition.id&&room.challengeKey===key);if(previous){const [id,room]=previous;await save(id);return {id,token:room.tokens[0],challenge:room.challenge};}}
 const human=profile({...request.body as Record<string,unknown>,specialty:current.definition.specialty});
 const id=randomBytes(8).toString('hex'),match=createMatch(current.seed,[human.name,'Arquiteto IA'],[current.definition.specialty,'balanced']);match.id=id;
 const room:Room={match,tokens:[privateToken(),''],challengeKey:key,challenge:current.definition,bot:{player:1,key:clockKey(match),nextAt:now()+1200}};
 rooms.set(id,room);await save(id);return {id,token:room.tokens[0],challenge:room.challenge};
});
app.post('/api/matches',async(request)=>{
 limit(request.ip);const b=request.body as any;const id=randomBytes(8).toString('hex');const match=createMatch(String(b.seed??'flashcart'),b.names,b.specialties);match.id=id;
 const tokens:[string,string]=[randomBytes(24).toString('hex'),randomBytes(24).toString('hex')];rooms.set(id,{match,tokens});await save(id);return {id,tokens};
});
app.get('/api/matches/:id',async request=>{const {room,player,id}=auth(request);await tick(id,room);return projection(room,player);});
app.post('/api/matches/:id/command',async request=>{
 const {room,player,id}=auth(request),body=request.body as {version:number;entry:LogEntry};
 if(room.match.engineVersion!==ENGINE_VERSION)throw new Error('Esta partida pertence a uma versão anterior do motor. Inicie uma nova partida para usar a versão atual.');
 playable(room);await tick(id,room);
 if(body.version!==room.match.version)throw Object.assign(new Error('A partida mudou. A mesa será atualizada; tente novamente.'),{code:'STALE_VERSION'});
 room.match=dispatch(room.match,{...body.entry,player});syncClock(room);await save(id);return projection(room,player);
});
app.get('/api/matches/:id/targets/:uid',request=>{
 const {room,player}=auth(request);playable(room);const uid=(request.params as any).uid,p=draft(room.match.players[player],room.match.market,room.match.seed),instance=p.hand.find(c=>c.uid===uid);
 if(!instance)throw new Error('Carta não pertence à sua mão.');return candidates(CATALOG[instance.cardId],p.graph);
});
app.get('/api/matches/:id/replay',request=>{const {room}=auth(request);return exportReplay(room.match);});
app.post('/api/replay',async request=>{
 limit(request.ip);const match=replay(request.body as any),id=randomBytes(8).toString('hex');match.id=id;
 const tokens:[string,string]=[randomBytes(24).toString('hex'),randomBytes(24).toString('hex')];rooms.set(id,{match,tokens});await save(id);return {id,tokens,verified:true};
});
if(serveDir){
 app.get('/*',async(request,reply)=>{
   const url=request.url.split('?')[0],requested=path.resolve(serveDir,'.'+url);
   const dist=path.resolve(serveDir);if(!requested.startsWith(dist+path.sep)&&requested!==dist)return reply.status(404).send();
   const types:Record<string,string>={'.js':'application/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
   try{const data=await readFile(url==='/'?path.join(dist,'index.html'):requested);return reply.type(types[path.extname(requested)]??'text/html').send(data);}catch{return reply.type('text/html').send(await readFile(path.join(dist,'index.html')));}
 });
}
return app;
}
