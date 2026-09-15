import {describe,it,expect} from 'vitest';
import {performance} from 'node:perf_hooks';
import {writeFileSync,mkdirSync} from 'node:fs';
import {createMatch,dispatch,project,exportReplay,replay} from '../packages/session';
import {CATALOG,BASE_WORLD,defaults,SCENARIOS} from '../packages/content/catalog';
import {clone,hash} from '../packages/domain/random';
import {candidates,draft} from '../packages/rules';
import {simulate,emptyRuntime} from '../packages/simulation';
import {strategyGraph} from './strategies';
import type {Command,Match,Telemetry} from '../packages/domain/types';

describe('aceitação sistêmica',()=>{
 it('três arquiteturas defensáveis sob a mesma carga, com vantagens distintas',()=>{
   // A controlled FlashCart workload for content validation; these are solver fixtures, not three scripted game answers.
   const world={...BASE_WORLD,reads:1400,writes:140,paymentMs:1200,paymentError:.08,attack:250,hot:.3,updateRate:.04,budget:1500,slo:1500};
   const data={} as Record<string,Telemetry>;
   for(const name of ['lean','replicated','async'] as const){
     let runtime=emptyRuntime();for(let i=0;i<3;i++){const result=simulate(strategyGraph(name),world,runtime,'shared-window');runtime=result.runtime;data[name]=result.telemetry;}
     const t=data[name];expect(t.errorRate,name).toBeLessThan(10);expect(t.completion,name).toBeGreaterThan(80);expect(t.p95,name).toBeLessThan(world.slo);expect(t.cost,name).toBeLessThan(world.budget);expect(t.consistency,name).toBeGreaterThan(99);
   }
   expect(data.lean.cost).toBeLessThan(data.async.cost);expect(data.async.p95).toBeLessThan(data.lean.p95/3);expect(data.replicated.throughput).toBeGreaterThan(data.lean.throughput);
   expect(new Set(['lean','replicated','async'].map(n=>hash(strategyGraph(n as any)))).size).toBe(3);
   mkdirSync('docs/evidence',{recursive:true});writeFileSync('docs/evidence/three-strategies.json',JSON.stringify({world,criteria:{errorRateBelow:10,completionAbove:80,p95Below:1500,costBelow:1500,consistencyAbove:99},results:data},null,2));
 });
 it('a mesma defesa não neutraliza padrões, credenciais e autorização',()=>{
   const graph=strategyGraph('replicated');const pattern=simulate(graph,{...BASE_WORLD,attack:1300,attackKind:0}).telemetry;const privilege=simulate(graph,{...BASE_WORLD,attack:1300,attackKind:2}).telemetry;expect(pattern.blocked).toBeGreaterThan(privilege.blocked*5);expect(privilege.security).toBeLessThan(80);
 });
 it('pesquisar cobra antes de revelar e impede obter informação gratuita via undo',()=>{
   let seed=0;while(!createMatch(`research-${seed}`).players[0].hand.some(c=>c.cardId==='research'))seed++;
   let m=createMatch(`research-${seed}`);m=dispatch(m,{type:'ready',player:0});m=dispatch(m,{type:'ready',player:1});const card=m.players[0].hand.find(c=>c.cardId==='research')!,before=m.players[0].deck.length;
   m=dispatch(m,{type:'stage',player:0,command:{type:'play',uid:card.uid,target:'self',config:{}}});expect(m.players[0].ec).toBe(7);expect(m.players[0].actions).toBe(1);expect(m.players[0].research).toHaveLength(3);expect(project(m,1).opponent).not.toHaveProperty('research');expect(()=>dispatch(m,{type:'lock',player:0})).toThrow();
   m=dispatch(m,{type:'undo',player:0});expect(m.players[0].ec).toBe(7);const chosen=m.players[0].research![2];m=dispatch(m,{type:'stage',player:0,command:{type:'researchChoice',uid:chosen.uid}});expect(m.players[0].hand.some(c=>c.uid===chosen.uid)).toBe(true);expect(m.players[0].deck.length).toBe(before-3);expect(m.players[0].research).toBeUndefined();
 });
 it('executa 24 partidas com ações legais, incidentes, diversidade e replay exato',()=>{
   const report:any[]=[],fingerprints=new Set<string>(),incidentTypes=new Set<string>();let totalCommands=0,buys=0;
   for(let run=0;run<24;run++){
     let m=createMatch(`playtest-${run}`,['A','B'],[run%2?'balanced':'distributed','resilient']);m=dispatch(m,{type:'ready',player:0});m=dispatch(m,{type:'ready',player:1});
     const styles=[['replica','index','balancer','scale','cache','rate','waf','lock','pool'],['queue','worker','timeout','bulkhead','breaker','multi-az','idempotency','observe','retry']];
     for(let round=1;round<=5;round++){
       for(const player of [0,1]){
         for(let action=0;action<2;action++){
           const p=draft(m.players[player],m.market,m.seed);if(!p.actions)break;let command:Command|undefined;
           for(const id of styles[player]){
             const inst=p.hand.find(c=>c.cardId===id),card=CATALOG[id];if(!inst||card.ec>p.ec)continue;
             const ts=candidates(card,p.graph).filter(t=>t.type!=='slot');if(!ts.length)continue;
             const t=ts.find(t=>t.id==='pay'&&['queue','timeout','bulkhead','breaker','retry'].includes(id))??ts.find(t=>t.id==='entry')??ts[0];command={type:'play',uid:inst.uid,target:t.id,config:defaults(id)};break;
           }
           if(!command&&p.hand.length<7&&p.ec>0){const inst=m.market.find(c=>styles[player].includes(c.cardId)&&!p.hand.some(h=>h.cardId===c.cardId)&&!p.pending.some(c2=>c2.type==='buy'&&c2.uid===c.uid));if(inst){command={type:'buy',uid:inst.uid};buys++;}}
           if(!command)break;
           m=dispatch(m,{type:'stage',player,command});totalCommands++;
         }
         m=dispatch(m,{type:'lock',player});
       }
       if(m.phase==='adjustment'){for(const p of m.players.filter(p=>!p.locked))m=dispatch(m,{type:'lock',player:p.id});}
       expect(m.phase).toBe('telemetry');for(const p of m.players){for(const i of p.telemetry.incidents)incidentTypes.add(i.type);expect(p.ec).toBeGreaterThanOrEqual(0);expect(p.actions).toBeGreaterThanOrEqual(0);expect(p.hand.length).toBeLessThanOrEqual(7);}
       m=dispatch(m,{type:'advance',player:0});m=dispatch(m,{type:'advance',player:1});
     }
     expect(m.phase).toBe('showdown');const record=exportReplay(m),rebuilt=replay(record);expect(rebuilt.players).toEqual(m.players);expect(rebuilt.worldState).toEqual(m.worldState);expect(rebuilt.showdown).toEqual(m.showdown);
     for(const p of m.players)fingerprints.add(hash(p.graph));report.push({seed:m.seed,commands:m.log.length,graphs:m.players.map(p=>({nodes:p.graph.nodes.length,edges:p.graph.edges.length})),wins:m.showdown!.wins,resultHash:record.resultHash});
   }
   expect(totalCommands).toBeGreaterThan(200);expect(buys).toBeGreaterThan(10);expect(fingerprints.size).toBeGreaterThan(20);expect(incidentTypes.size).toBeGreaterThanOrEqual(3);
   mkdirSync('docs/evidence',{recursive:true});writeFileSync('docs/evidence/automated-playtests.json',JSON.stringify({kind:'automated-functional-playtests-not-human-fun-validation',matches:24,totalCommands,buys,distinctGraphs:fingerprints.size,incidentTypes:[...incidentTypes],report},null,2));
 },20000);
 it('mede os limites de simulação e showdown com grafos de slice',()=>{
   const graph=strategyGraph('async'),times=[];for(let i=0;i<20;i++){const start=performance.now();simulate(graph,{...BASE_WORLD,reads:5000,writes:400});times.push(performance.now()-start);}
   expect(Math.max(...times)).toBeLessThan(200);
 });
});
