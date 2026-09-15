import {CATALOG,defaults} from '../packages/content/catalog';
import type {CardInstance,Command,Config,LogEntry,Player,PlayerView,World} from '../packages/domain/types';
import {applyCommand,candidates,configFields} from '../packages/rules';
import {emptyRuntime,simulate} from '../packages/simulation';

// Deliberately excludes the match, its seed, hidden decks, runtime and opponent.
export type BotObservation=Pick<PlayerView,'phase'|'round'|'player'|'world'|'market'>;
const MODEL_SEED='architect-ai-v1';
const CANDIDATE_LIMIT=80;
const BEAM_WIDTH=5;

function modelPlayer(view:BotObservation):Player{
 const {deckCount,telemetry,...own}=view.player;
 return {...structuredClone(own),pending:[],deck:[],runtime:emptyRuntime(),
  telemetry:simulate(own.graph,view.world,emptyRuntime(),MODEL_SEED).telemetry};
}
// Estimates use only the revealed workload and a fresh, known model state.
// They are not the actual match telemetry or the final Showdown score.
function utility(p:Player,world:World){
 const t=simulate(p.graph,world,emptyRuntime(),MODEL_SEED).telemetry;
 return 25*t.throughput/Math.max(1,world.reads+world.writes)
  +20*t.completion/100+15*t.consistency/100+15*t.security/100
  +15*Math.min(1,world.slo/Math.max(t.p95,1))
  -8*t.cost/world.budget-16*Math.max(0,t.cost/world.budget-1)+.12*p.ec;
}
function configs(id:string):Config[]{
 const base=defaults(id),variants=[base];
 for(const [key,f] of Object.entries(CATALOG[id].fields)){
  for(const value of [f.min,f.max])if(value!==base[key])variants.push({...base,[key]:value});
 }
 return variants.slice(0,5);
}
function legalMoves(p:Player,view:BotObservation):{command:Command;after:Player;score:number}[]{
 if(!p.actions)return [];
 const proposals:Command[]=[];
 for(const card of p.hand){
  const definition=CATALOG[card.cardId];
  if(definition.kind==='action'||definition.ec>p.ec)continue;
  // An unconnected node cannot help this bounded planner; edge insertion and
  // queue/worker composition keep every proposed component on a real path.
  for(const target of candidates(definition,p.graph).filter(t=>t.type!=='slot').slice(0,6)){
   for(const config of configs(card.cardId))proposals.push({type:'play',uid:card.uid,target:target.id,config});
  }
 }
 // Tune deployed components as the workload changes, including cache freshness.
 for(const n of p.graph.nodes){
  for(const [key,f] of Object.entries(configFields(p.graph,n.id))){
   for(const value of [f.min,f.max])if((n.config[key]??f.default)!==value)
    proposals.push({type:'configure',target:n.id,config:{[key]:value}});
  }
 }
 if(p.hand.length<7){
  for(const c of p.backlog)proposals.push({type:'retrieve',uid:c.uid});
  // Never repeat a pending purchase; a contested purchase is replanned only
  // after the server resolves it and exposes the remaining market.
  for(const c of view.market)if(!p.hand.some(h=>h.uid===c.uid))proposals.push({type:'buy',uid:c.uid});
 }
 const moves=[];
 for(const command of proposals.slice(0,CANDIDATE_LIMIT)){
  try{
   const after=applyCommand(p,command,view.market,MODEL_SEED);
   let score=utility(after,view.world);
   // A useful card can be saved for a later round, without inventing a future
   // scenario. This small bonus never outweighs a substantial current gain.
   if(view.round<5&&(command.type==='buy'||command.type==='retrieve')){
    const card=after.hand.find(c=>c.uid===command.uid)!;
    if(usefulness(card,after)>0)score+=.35;
   }
   moves.push({command,after,score});
  }catch{/* The rules reject unaffordable or structurally invalid candidates. */}
 }
 return moves.sort((a,b)=>b.score-a.score);
}
function usefulness(card:CardInstance,p:Pick<Player,'graph'|'hand'>){
 const c=CATALOG[card.cardId];
 if(c.id==='research')return 1;
 if(c.kind==='action')return 0;
 const connected=candidates(c,p.graph).some(t=>t.type!=='slot');
 const combo=c.id==='worker'&&p.hand.some(h=>h.cardId==='queue');
 return connected||combo?6-c.ec:0;
}

export function nextBotEntry(view:BotObservation):Omit<LogEntry,'player'>|null{
 const p=view.player;
 if(p.locked||view.phase==='showdown')return null;
 if(view.phase==='setup'){
  if(!p.mulliganDone){
   const uids=p.hand.filter(c=>usefulness(c,p)===0).slice(0,2).map(c=>c.uid);
   if(uids.length)return {type:'mulligan',uids};
  }
  return {type:'ready'};
 }
 if(view.phase==='telemetry')return {type:'advance'};
 if(p.research?.length){
  const chosen=[...p.research].sort((a,b)=>usefulness(b,p)-usefulness(a,p))[0];
  return {type:'stage',command:{type:'researchChoice',uid:chosen.uid}};
 }
 if(!p.actions)return {type:'lock'};
 const current=modelPlayer(view),baseline=utility(current,view.world),moves=legalMoves(current,view);
 let best=moves[0],bestScore=best?.score??-Infinity;
 // Two actions of lookahead allow buying then deploying, or queue then worker.
 // The fixed beam/candidate limits bound CPU regardless of the room count.
 for(const first of moves.slice(0,BEAM_WIDTH)){
  if(first.after.actions<1)continue;
  const followup=legalMoves(first.after,view)[0];
  if(followup&&followup.score>bestScore){best=first;bestScore=followup.score;}
 }
 if(best&&bestScore>baseline+.05)return {type:'stage',command:best.command};
 const research=p.hand.find(c=>c.cardId==='research');
 if(research&&p.ec>=1&&p.actions>=2&&p.deckCount>0&&!p.pending.length)
  return {type:'stage',command:{type:'play',uid:research.uid,target:'self',config:{}}};
 return {type:'lock'};
}
