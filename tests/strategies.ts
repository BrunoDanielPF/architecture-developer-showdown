import { createMatch } from '../packages/session';
import { applyCommand } from '../packages/rules';
import { clone } from '../packages/domain/random';
import type { Graph, Player } from '../packages/domain/types';
export type Strategy='lean'|'replicated'|'async';
export function install(p:Player,id:string,target:string,config:Record<string,number>={}){
 const uid=`strategy-${id}-${p.graph.nodes.length}`;p=clone(p);p.hand.push({uid,cardId:id});return applyCommand(p,{type:'play',uid,target,config},[],'strategy');
}
export function strategyGraph(strategy:Strategy):Graph{
 let p=createMatch('strategy-fixture').players[0];p.ec=100;p.actions=100;
 if(strategy==='lean'){
   p=install(p,'index','db',{coverage:90});p=install(p,'rate','entry',{limit:2400,identity:1});p=install(p,'bulkhead','pay',{isolation:80});p=install(p,'pool','api',{poolSize:200});p=install(p,'lock','db',{locking:80});
 }else if(strategy==='replicated'){
   p=install(p,'balancer','entry');p=install(p,'scale','api',{instances:2});p=install(p,'replica','db',{split:70});p=install(p,'waf','entry',{strictness:2});p=install(p,'pool','api',{poolSize:200});p=install(p,'multi-az','db');
 }else{
   p=install(p,'cache','data',{ttl:30,memory:4});p=install(p,'queue','pay');p=install(p,'worker',p.graph.nodes.find(n=>n.kind==='queue')!.id,{instances:2});p=install(p,'idempotency',p.graph.nodes.find(n=>n.kind==='worker')!.id);p=install(p,'rate','entry',{limit:2400,identity:1});p=install(p,'lock','db',{locking:80});
 }return p.graph;
}
