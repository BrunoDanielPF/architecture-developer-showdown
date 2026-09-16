import { CARDS, CATALOG, CORE, SPECIALTIES, initialGraph } from '../content/catalog';
import { clone, hash, shuffle } from '../domain/random';
import type { Command, LogEntry, Match, Player, PlayerView } from '../domain/types';
import { ECONOMY, applyCommand, draft } from '../rules';
import { emptyRuntime, simulate } from '../simulation';
import { runShowdown } from '../simulation/showdown';
import { initialWorld, reveal, scenarioRun } from '../world';
export const CONTENT_VERSION='0.1.0',ENGINE_VERSION='0.4.0';
export function createMatch(seed:string,names:string[]=['Arquiteta A','Arquiteto B'],specialties:string[]=['balanced','resilient']):Match{
 if(!seed||seed.length>80)throw new Error('Seed deve ter entre 1 e 80 caracteres.');
 const worldState=initialWorld();
 const players=[0,1].map(id=>{
   if(!SPECIALTIES[specialties[id]])throw new Error('Especialização inválida.');
   const deck=shuffle([...CORE,...SPECIALTIES[specialties[id]].cards].map((cardId,i)=>({uid:`p${id}-${i}`,cardId})),`${seed}:architecture:${id}`);
   const graph=initialGraph(),result=simulate(graph,worldState.world,emptyRuntime(),`${seed}:setup`);
   return {id,name:(names[id]||`Jogador ${id+1}`).trim().slice(0,30),specialty:specialties[id],deck,hand:deck.splice(0,5),backlog:[],discard:[],graph,ec:ECONOMY.initialEC,actions:ECONOMY.actions,budget:1500,runtime:result.runtime,telemetry:result.telemetry,locked:false,mulliganDone:false,pending:[]} as Player;
 }) as [Player,Player];
 const marketDeck=shuffle(CARDS.filter(c=>c.kind!=='action').slice(0,30).map((c,i)=>({uid:`m${i}`,cardId:c.id})),`${seed}:market`);
 return {id:`match-${hash(seed+names.join()+specialties.join())}`,seed,version:0,phase:'setup',round:0,players,market:marketDeck.splice(0,5),marketDeck,scenarios:scenarioRun(seed),revealed:[],worldState,log:[],notices:[[],[]],contentVersion:CONTENT_VERSION,engineVersion:ENGINE_VERSION};
}
export function project(match:Match,playerId:number):PlayerView{
 const source=match.players[playerId];if(!source)throw new Error('Jogador inválido.');
 const p=['planning','adjustment'].includes(match.phase)?draft(source,match.market,match.seed):clone(source);
 const {deck,runtime,telemetry,...safe}=p;
 const visibleTelemetry=(t:typeof telemetry):Partial<typeof telemetry>=>({
  p95:t.p95,errorRate:t.errorRate,cost:t.cost,throughput:t.throughput,completion:t.completion,observed:t.observed,diagnostic:t.diagnostic,
  ...(t.observed?{nodes:clone(t.nodes),backlog:t.backlog,incidents:clone(t.incidents)}:{}),
  ...(t.diagnostic?{traces:clone(t.traces)}:{}),
 });
 const visible=visibleTelemetry(telemetry);
 const measurements=runtime.history.map((t,round)=>({round,telemetry:visibleTelemetry(t)}));
 let previousState=initialWorld();
 for(const [i,card] of match.revealed.slice(0,-1).entries())previousState=reveal(previousState,card,i+1);

 return {previousWorld:clone(previousState.world),measurements,id:match.id,version:match.version,phase:match.phase,round:match.round,player:{...safe,deckCount:deck.length,telemetry:visible},opponent:{name:match.players[1-playerId].name,locked:match.players[1-playerId].locked},market:clone(match.market),marketRemaining:match.marketDeck.length,scenarioRemaining:5-match.revealed.length,revealed:match.revealed.map(({heat,axis,mutation,...s})=>clone(s)),world:clone(match.worldState.world),notices:clone(match.notices[playerId]),...(match.phase==='showdown'?{showdown:clone(match.showdown)}:{})};
}
function nextRound(m:Match){
 m.round++;m.phase='planning';m.notices=[[],[]];const card=m.scenarios[m.round-1];m.revealed.push(clone(card));m.worldState=reveal(m.worldState,card,m.round);
 for(const p of m.players){p.locked=false;p.actions=ECONOMY.actions;p.pending=[];p.budget=m.worldState.world.budget;if(m.round>1)p.ec=Math.min(ECONOMY.maxEC,p.ec+ECONOMY.refreshEC);if(p.deck.length){const c=p.deck.shift()!;if(p.hand.length<ECONOMY.hand)p.hand.push(c);else{p.discard.push(c);m.notices[p.id].push('Compra automática descartada porque a mão tinha 7 cartas. Reserve ou use cartas antes da próxima rodada.');}}}
}
function resolve(m:Match){
 const priority=parseInt(hash(`${m.seed}:market-priority:${m.round}`),16)%2,order=[priority,1-priority];let failed=false;
 const pending=m.players.map(p=>clone(p.pending));m.players.forEach(p=>p.pending=[]);
 for(const pid of order){let p=m.players[pid];for(const command of pending[pid]){
   try{
     if(command.type==='buy'&&!m.market.some(c=>c.uid===command.uid))throw new Error('Compra disputada: o outro jogador recebeu esta carta. EC e ação preservados.');
     p=applyCommand(p,command,m.market,`${m.seed}:${m.round}`);
     if(command.type==='buy'){const index=m.market.findIndex(c=>c.uid===command.uid);m.market.splice(index,1);if(m.marketDeck.length)m.market.splice(index,0,m.marketDeck.shift()!);}
   }catch(error){failed=true;p.locked=false;m.notices[pid].push((error as Error).message);}
 }m.players[pid]=p;}
 if(failed){m.phase='adjustment';return;}
 for(const p of m.players){const result=simulate(p.graph,m.worldState.world,p.runtime,`${m.seed}:round:${m.round}`);p.telemetry=result.telemetry;p.runtime=result.runtime;p.locked=false;}
 m.phase='telemetry';
}
export function dispatch(input:Match,entry:LogEntry):Match{
 const m=clone(input),p=m.players[entry.player];if(!p)throw new Error('Jogador inválido.');
 if(entry.type==='mulligan'){
   if(m.phase!=='setup'||p.mulliganDone||p.locked)throw new Error('Mulligan indisponível.');
   const uids=entry.uids??[];if(uids.length>2||new Set(uids).size!==uids.length||uids.some(uid=>!p.hand.some(c=>c.uid===uid)))throw new Error('Escolha até duas cartas da mão.');
   const removed=p.hand.filter(c=>uids.includes(c.uid));p.hand=p.hand.filter(c=>!uids.includes(c.uid));p.deck=shuffle([...p.deck,...removed],`${m.seed}:mulligan:${p.id}`);p.hand.push(...p.deck.splice(0,removed.length));p.mulliganDone=true;
 }else if(entry.type==='ready'){
   if(m.phase!=='setup'||p.locked)throw new Error('Setup já confirmado.');p.locked=true;if(m.players.every(p=>p.locked))nextRound(m);
 }else if(entry.type==='stage'){
   if(!['planning','adjustment'].includes(m.phase)||p.locked)throw new Error('Planejamento está fechado.');
   if(!entry.command)throw new Error('Comando ausente.');
   const research=entry.command.type==='play'&&p.hand.find(c=>c.uid===(entry.command as any).uid)?.cardId==='research';
   if(p.research&&entry.command.type!=='researchChoice')throw new Error('Conclua a escolha da pesquisa antes de continuar.');
   if(research||entry.command.type==='researchChoice'){
     if(p.pending.length)throw new Error('Desfaça as ações preparadas antes de pesquisar. A pesquisa confirma seu custo ao revelar cartas.');
     m.players[entry.player]=applyCommand(p,entry.command,m.market,m.seed);
   }else{if(p.pending.length>=40)throw new Error('Limite de alterações pendentes.');p.pending.push(clone(entry.command));draft(p,m.market,m.seed);}
 }else if(entry.type==='undo'){
   if(!['planning','adjustment'].includes(m.phase)||p.locked)throw new Error('Não é possível desfazer após o lock.');p.pending.pop();
 }else if(entry.type==='lock'){
   if(!['planning','adjustment'].includes(m.phase)||p.locked)throw new Error('Rodada já travada.');if(p.research)throw new Error('Escolha uma carta da pesquisa antes de travar.');p.locked=true;if(m.players.every(p=>p.locked))resolve(m);
 }else if(entry.type==='advance'){
   if(m.phase!=='telemetry')throw new Error('A rodada ainda não foi resolvida.');
   p.locked=true;if(m.players.every(p=>p.locked)){if(m.round===5){m.phase='showdown';m.showdown=runShowdown(m);}else nextRound(m);}
 }else throw new Error('Operação inválida.');
 m.log.push(clone(entry));m.version++;return m;
}
export function exportReplay(m:Match){if(m.phase!=='showdown')throw new Error('Replay completo disponível após o Showdown.');return {format:'architecture-showdown-replay',contentVersion:m.contentVersion,engineVersion:m.engineVersion,seed:m.seed,names:m.players.map(p=>p.name),specialties:m.players.map(p=>p.specialty),log:clone(m.log),resultHash:hash(m.showdown)};}
export function replay(record:ReturnType<typeof exportReplay>):Match{
 if(record.format!=='architecture-showdown-replay'||record.contentVersion!==CONTENT_VERSION||record.engineVersion!==ENGINE_VERSION)throw new Error('Formato ou versão de replay incompatível.');
 if(!Array.isArray(record.log)||record.log.length>2000)throw new Error('Log de replay inválido.');
 let m=createMatch(record.seed,record.names,record.specialties);for(const entry of record.log)m=dispatch(m,entry);
 if(m.phase!=='showdown'||hash(m.showdown)!==record.resultHash)throw new Error('Replay não reproduz o resultado registrado.');return m;
}
