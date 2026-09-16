import {describe,it,expect} from 'vitest';
import {CATALOG,CORE,SPECIALTIES,BASE_WORLD,initialGraph,defaults} from '../packages/content/catalog';
import {createMatch,dispatch,project,exportReplay,replay} from '../packages/session';
import {hash,clone} from '../packages/domain/random';
import {applyCommand,candidates,ECONOMY,isPositionFree,NODE_CLEARANCE,validateGraph} from '../packages/rules';
import {emptyRuntime,simulate} from '../packages/simulation';
import {runShowdown} from '../packages/simulation/showdown';
import {scenarioRun,initialWorld,reveal} from '../packages/world';
import type {Match,Player,Command} from '../packages/domain/types';
function ready(seed='tests'){let m=createMatch(seed);m=dispatch(m,{type:'ready',player:0});return dispatch(m,{type:'ready',player:1});}
function turn(m:Match){m=dispatch(m,{type:'lock',player:0});m=dispatch(m,{type:'lock',player:1});expect(m.phase).toBe('telemetry');m=dispatch(m,{type:'advance',player:0});return dispatch(m,{type:'advance',player:1});}
function fixture(){const p=createMatch('fixture').players[0];p.ec=100;p.actions=100;return p;}
function play(p:Player,id:string,target:string,config:Record<string,number>={}){const uid=`f-${id}-${p.graph.nodes.length}`;p=clone(p);p.hand.push({uid,cardId:id});return applyCommand(p,{type:'play',uid,target,config},[],'fixture');}

describe('decks e mundo',()=>{
 it('compõe 24 cartas únicas, 16 Core e 8 especializações; mão 5 e pilha 19',()=>{
  for(const specialty of Object.keys(SPECIALTIES)){const m=createMatch('decks',['A','B'],[specialty,specialty]);for(const p of m.players){const cards=[...p.deck,...p.hand];expect(cards).toHaveLength(24);expect(new Set(cards.map(c=>c.cardId)).size).toBe(24);expect(CORE.every(c=>cards.some(x=>x.cardId===c))).toBe(true);expect(p.hand).toHaveLength(5);expect(p.deck).toHaveLength(19);}}
 });
 it('gera runs progressivas, diversas e reproduzíveis sem adaptar mercado',()=>{
  const signatures=new Set<string>();for(let i=0;i<150;i++){const s=`seed-${i}`,run=scenarioRun(s);expect(run).toHaveLength(5);expect(run.map(c=>c.heat)).toEqual([1,2,3,4,5]);expect(new Set(run.map(c=>c.axis)).size).toBeGreaterThanOrEqual(3);expect(scenarioRun(s)).toEqual(run);signatures.add(run.map(c=>c.id).join());}
  expect(signatures.size).toBeGreaterThan(30);const m=ready();const market=clone(m.market);const next=turn(m);expect(next.market).toEqual(market);
 });
 it('expira efeitos temporários preservando as mudanças permanentes',()=>{
  let w=initialWorld();const r=scenarioRun('expiry');w=reveal(w,{...r[0],duration:0,mutation:{budget:1250}},1);w=reveal(w,{...r[1],duration:1,mutation:{reads:9000}},2);expect(w.world.reads).toBe(9000);w=reveal(w,{...r[2],duration:0,mutation:{writes:100}},3);expect(w.world.reads).toBe(BASE_WORLD.reads);expect(w.world.budget).toBe(1250);
 });
 it('mulligan é limitado, privado e não duplica cartas',()=>{
  let m=createMatch('mulligan');const ids=m.players[0].hand.slice(0,2).map(c=>c.uid);m=dispatch(m,{type:'mulligan',player:0,uids:ids});expect(m.players[0].hand).toHaveLength(5);expect(new Set([...m.players[0].deck,...m.players[0].hand].map(c=>c.uid)).size).toBe(24);expect(()=>dispatch(m,{type:'mulligan',player:0,uids:[]})).toThrow();
 });
});
describe('regras e sigilo',()=>{
 it('uma jogada pending não altera o grafo oficial nem revela o adversário',()=>{
  let m=ready('privacy');const before=clone(m.players[0].graph);m=dispatch(m,{type:'stage',player:0,command:{type:'configure',target:'data',config:{read:70}}});expect(m.players[0].graph).toEqual(before);expect(project(m,0).player.graph.edges.find(e=>e.id==='data')?.read).toBe(70);
  const v=project(m,1);expect(Object.keys(v.opponent).sort()).toEqual(['activity','handCount','locked','name']);expect(v.opponent).not.toHaveProperty('hand');expect(v).not.toHaveProperty('seed');expect(v).not.toHaveProperty('scenarios');expect(v.player).not.toHaveProperty('deck');expect(v.player).not.toHaveProperty('runtime');expect(v.player.telemetry).not.toHaveProperty('traces');expect(v.revealed[0]).not.toHaveProperty('heat');expect(JSON.stringify(v)).not.toContain('expectedStateVersion');
  m=dispatch(m,{type:'lock',player:0});expect(m.players[0].graph).toEqual(before);m=dispatch(m,{type:'lock',player:1});expect(m.players[0].graph.edges.find(e=>e.id==='data')?.read).toBe(70);expect(project(m,1).opponent).not.toHaveProperty('graph');
 });
 it('resolve uma disputa, devolve recursos e permite ajuste real',()=>{
   let m=ready('market'),uid=m.market[0].uid;for(const player of [0,1])m=dispatch(m,{type:'stage',player,command:{type:'buy',uid}});
   for(const player of [0,1])m=dispatch(m,{type:'lock',player});expect(m.phase).toBe('adjustment');const loser=m.players.find(p=>!p.locked)!,winner=m.players.find(p=>p.locked)!;
   expect(winner.hand.some(c=>c.uid===uid)).toBe(true);expect(loser.hand.some(c=>c.uid===uid)).toBe(false);expect(loser.ec).toBe(8);expect(loser.actions).toBe(2);expect(m.market).toHaveLength(5);expect(m.marketDeck).toHaveLength(24);
   m=dispatch(m,{type:'stage',player:loser.id,command:{type:'configure',target:'data',config:{read:90}}});m=dispatch(m,{type:'lock',player:loser.id});expect(m.phase).toBe('telemetry');expect(m.players[loser.id].actions).toBe(1);
 });
 it('undo restaura economia e alterações privadas; lock impede desfazer',()=>{
   let m=ready(),p=project(m,0).player;m=dispatch(m,{type:'stage',player:0,command:{type:'configure',target:'data',config:{read:80}}});expect(project(m,0).player.ec).toBe(p.ec-1);m=dispatch(m,{type:'undo',player:0});expect(project(m,0).player.ec).toBe(p.ec);m=dispatch(m,{type:'lock',player:0});expect(()=>dispatch(m,{type:'undo',player:0})).toThrow();
 });
 it('limita ações, EC, backlog, mão e reserva de capacidade',()=>{
   let p=fixture();p.actions=2;p.ec=2;const command:Command={type:'configure',target:'data',config:{read:80}};p=applyCommand(p,command,[],'t');p=applyCommand(p,command,[],'t');expect(()=>applyCommand(p,command,[],'t')).toThrow();
   let m=ready();m=turn(m);expect(m.players[0].ec).toBe(12);m=turn(m);expect(m.players[0].hand).toHaveLength(7);expect(m.players[0].discard.length).toBe(1);
 });
 it('rejeita alvo incompatível, valores ilegais, IDs ausentes e ciclos',()=>{
  const p=fixture();expect(candidates(CATALOG.replica,p.graph).map(t=>t.id)).toEqual(['db']);expect(()=>play(p,'replica','api')).toThrow();expect(()=>play(p,'cache','data',{ttl:Infinity})).toThrow();expect(()=>applyCommand(p,{type:'configure',target:'data',config:{read:-1}},[],'t')).toThrow();
  const g=initialGraph();g.edges.push({id:'cycle',from:'db',to:'api',read:100,write:100,protocol:'REST',config:{},policies:[]});expect(()=>validateGraph(g)).toThrow();
 });
 it('mantém espaço visual ao inserir vários componentes no mesmo caminho',()=>{
  let p=play(fixture(),'cdn','entry');const cdn=p.graph.nodes.find(n=>n.kind==='cdn')!;
  const edgeToApi=p.graph.edges.find(e=>e.from===cdn.id&&e.to==='api')!;p=play(p,'balancer',edgeToApi.id);
  for(const node of p.graph.nodes){
   const others={...p.graph,nodes:p.graph.nodes.filter(n=>n.id!==node.id)};
   expect(isPositionFree(others,node),`${node.name} deve ficar sem sobreposição`).toBe(true);
  }
  const balancer=p.graph.nodes.find(n=>n.kind==='balancer')!;
  expect(Math.abs(balancer.x-cdn.x)>=NODE_CLEARANCE.x||Math.abs(balancer.z-cdn.z)>=NODE_CLEARANCE.z).toBe(true);
  expect(()=>applyCommand(p,{type:'move',target:balancer.id,x:(cdn.x-6)/2,z:cdn.z},[],'fixture')).toThrow('não comporta');
 });
});
describe('causalidade do Simulation Engine',()=>{
 it('mantém determinismo, números finitos e independência do nome/posição',()=>{
   for(let i=0;i<100;i++){const w={...BASE_WORLD,reads:i*170,writes:i*8,attack:i*25};const g=initialGraph();const a=simulate(g,w,emptyRuntime(),'same');expect(simulate(g,w,emptyRuntime(),'same')).toEqual(a);for(const [key,value] of Object.entries(a.telemetry))if(typeof value==='number'){expect(Number.isFinite(value),key).toBe(true);expect(value,key).toBeGreaterThanOrEqual(0);}}
   const g=initialGraph(),original=simulate(g,BASE_WORLD);g.nodes.forEach(n=>{n.name='Tecnologia mágica';n.x+=.1;});const changed=simulate(g,BASE_WORLD);expect(changed.telemetry.throughput).toBe(original.telemetry.throughput);expect(changed.telemetry.p95).toBe(original.telemetry.p95);
 });
 it('réplica sem leituras e cache desconectado custam sem aumentar throughput',()=>{
   const p=fixture(),w={...BASE_WORLD,reads:2300};const base=simulate(p.graph,w).telemetry;
   const inert=simulate(play(p,'replica','db',{split:0}).graph,w).telemetry;
   expect(inert.throughput).toBe(base.throughput);expect(inert.cost).toBeGreaterThan(base.cost);
   const routed=simulate(play(p,'replica','db',{split:60}).graph,w).telemetry;expect(routed.throughput).toBeGreaterThan(base.throughput);
   const disconnected=simulate(play(p,'cache','slot:0').graph,w).telemetry;expect(disconnected.throughput).toBe(base.throughput);expect(disconnected.cost).toBeGreaterThan(base.cost);
 });
 it('fila sem worker aceita trabalho, mas não conclui; backlog atravessa janelas',()=>{
   const p=play(fixture(),'queue','pay'),w={...BASE_WORLD,writes:150};const a=simulate(p.graph,w),b=simulate(p.graph,w,a.runtime);
   expect(a.telemetry.completion).toBe(0);expect(b.telemetry.backlog).toBeGreaterThan(a.telemetry.backlog);expect(a.telemetry.incidents.some(i=>i.type==='Backlog de fila')).toBe(true);
   const worker=play(p,'worker',p.graph.nodes.find(n=>n.kind==='queue')!.id);expect(simulate(worker.graph,w).telemetry.completion).toBeGreaterThan(80);
 });
 it('retry agressivo gera tempestade; backoff altera amplificação e duplicidade',()=>{
   const p=fixture(),w={...BASE_WORLD,paymentError:.4,paymentMs:1800};const aggressive=play(p,'retry','pay',{retries:4,backoff:0}),bounded=play(p,'retry','pay',{retries:1,backoff:1000});
   const a=simulate(aggressive.graph,w).telemetry,b=simulate(bounded.graph,w).telemetry;expect(a.incidents.some(i=>i.type==='Retry storm')).toBe(true);expect(b.incidents.some(i=>i.type==='Retry storm')).toBe(false);expect(a.consistency).toBeLessThan(b.consistency);
 });
 it('TTL alto tem custo de consistência; WAF respeita cobertura e falsos positivos',()=>{
   const p=fixture(),w={...BASE_WORLD,reads:1500,updateRate:.15,attack:1300};const short=simulate(play(p,'cache','data',{ttl:5}).graph,w).telemetry,long=simulate(play(p,'cache','data',{ttl:300}).graph,w).telemetry;expect(long.consistency).toBeLessThan(short.consistency);
   const low=simulate(play(p,'waf','entry',{strictness:1}).graph,w).telemetry,high=simulate(play(p,'waf','entry',{strictness:3}).graph,w).telemetry;expect(high.blocked).toBeGreaterThan(low.blocked);expect(high.falsePositive).toBeGreaterThan(low.falsePositive);expect(high.security).toBeLessThan(100);
 });
 it('remover os caminhos obrigatórios não cria uma arquitetura vencedora',()=>{
   const g=initialGraph();g.edges=[];const t=simulate(g,BASE_WORLD).telemetry;expect(t.throughput).toBe(0);expect(t.completion).toBe(0);expect(t.errorRate).toBe(100);
 });
 it('ramificações de leitura não duplicam requisições e armazenamento não substitui todas as consultas',()=>{
   let p=fixture();p=play(p,'storage','slot:0');const node=p.graph.nodes.find(n=>n.kind==='storage')!;p=applyCommand(p,{type:'connect',from:'api',to:node.id,protocol:'REST',read:100,write:0},[],'test');const t=simulate(p.graph,{...BASE_WORLD,reads:2000}).telemetry;expect(t.throughput).toBeLessThan(1600);expect(t.traces.some(t=>t.includes('35%'))).toBe(true);expect(t.traces.some(t=>t.includes('normalizada'))).toBe(true);
 });
});
describe('partida completa e replay',()=>{
 it('converte custo mensal em custo por mil operações e preserva diferenças pequenas',()=>{
   const m=ready('cost-units');
   // Idle infrastructure changes cost without increasing completed traffic.
   m.players[1]=play(m.players[1],'cache','slot:0');
   const result=runShowdown(m),cost=result.categories.find(c=>c.id==='cost')!;
   for(const i of [0,1]){
     const t=cost.telemetry[i],expected=t.cost/(t.throughput*30*24*60*60)*1000*Math.max(1,t.cost/m.worldState.world.budget);
     expect(cost.values[i]).toBeCloseTo(expected,8);
     expect(cost.values[i]).toBeGreaterThan(0);
   }
   expect(cost.values[0]).toBeLessThan(cost.values[1]);expect(cost.winner).toBe(0);
 });
 it('reproduz 5 rodadas, revela grafos somente no Showdown e rejeita adulteração',()=>{
  let m=ready('replay');for(let round=1;round<=5;round++){
    m=dispatch(m,{type:'stage',player:0,command:{type:'configure',target:'data',config:{read:100-round*10}}});m=turn(m);
  }
  expect(m.phase).toBe('showdown');expect(m.showdown?.categories.map(c=>c.id)).toEqual(['performance','availability','security','consistency','cost','resilience']);expect(project(m,0).showdown?.graphs).toHaveLength(2);expect(m.showdown?.graphs[0]).not.toEqual(m.showdown?.graphs[1]);
  const record=exportReplay(m),rebuilt=replay(record);expect(hash(rebuilt.showdown)).toBe(record.resultHash);expect(rebuilt.players.map(p=>p.graph)).toEqual(m.players.map(p=>p.graph));expect(()=>replay({...record,resultHash:'bad'})).toThrow();expect(()=>dispatch(m,{type:'stage',player:0,command:{type:'pass'}})).toThrow();
 });
});
