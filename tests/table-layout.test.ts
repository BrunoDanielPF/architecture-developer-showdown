import {describe,expect,it} from 'vitest';
import {initialGraph} from '../packages/content/catalog';
import type {Node} from '../packages/domain/types';
import {spreadTableGraph,SHOWDOWN_NODE_GAP,TABLE_LAYOUT_SCALE,TABLE_NODE_GAP} from '../src/table-layout';

const node=(id:string,name:string,x:number,z:number):Node=>({id,kind:'cache',name,x,z,config:{},upgrades:[]});
function expectReadable(nodes:Node[]){
 for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
  const dx=Math.abs(nodes[i].x-nodes[j].x),dz=Math.abs(nodes[i].z-nodes[j].z);
  expect(dx>=TABLE_NODE_GAP.x-.02||dz>=TABLE_NODE_GAP.z-.02,`${nodes[i].name} e ${nodes[j].name}`).toBe(true);
 }
}

describe('layout legível da mesa',()=>{
 it('abre margem em uma cadeia horizontal sem alterar o grafo oficial',()=>{
  const graph=initialGraph();graph.nodes.push({...node('lb','Load Balancer',-4,0),kind:'balancer'});
  const before=structuredClone(graph),spread=spreadTableGraph(graph);
  expectReadable(spread.nodes);expect(graph).toEqual(before);
  expect(Math.abs(spread.nodes.find(n=>n.id==='client')!.x-spread.nodes.find(n=>n.id==='api')!.x)).toBeGreaterThan(TABLE_NODE_GAP.x);
 });
 it('expande o grafo base em torno do próprio centro sem deslocar o conjunto',()=>{
  const graph=initialGraph(),beforeCenter=graph.nodes.reduce((sum,current)=>sum+current.x,0)/graph.nodes.length,spread=spreadTableGraph(graph),afterCenter=spread.nodes.reduce((sum,current)=>sum+current.x,0)/spread.nodes.length;
  const originalDistance=Math.abs(graph.nodes.find(n=>n.id==='client')!.x-graph.nodes.find(n=>n.id==='api')!.x),expandedDistance=Math.abs(spread.nodes.find(n=>n.id==='client')!.x-spread.nodes.find(n=>n.id==='api')!.x);
  expect(expandedDistance).toBeGreaterThanOrEqual(originalDistance*TABLE_LAYOUT_SCALE.x-.02);expect(afterCenter).toBeCloseTo(beforeCenter,5);
 });
 it('separa componentes recursivos inseridos na diagonal',()=>{
  const graph=initialGraph();graph.nodes.push(node('cache-1','Cache 1',.5,-1),node('cache-2','Cache 2',1.75,-1.5));
  const spread=spreadTableGraph(graph);expectReadable(spread.nodes);
  const first=spread.nodes.find(n=>n.id==='cache-1')!,second=spread.nodes.find(n=>n.id==='cache-2')!;
  expect(Math.abs(first.x-second.x)>=TABLE_NODE_GAP.x-.02||Math.abs(first.z-second.z)>=TABLE_NODE_GAP.z-.02).toBe(true);
 });
 it('abre mais espaço no Showdown sem sobrepor módulos nem alterar o grafo',()=>{
  const graph=initialGraph();graph.nodes.push({...node('lb','Load Balancer',-4,0),kind:'balancer'},node('cache-1','Cache',.5,-1),node('replica','Read Replica',4,-4));
  const before=structuredClone(graph),planning=spreadTableGraph(graph),showdown=spreadTableGraph(graph,true);
  expect(graph).toEqual(before);
  for(let i=0;i<showdown.nodes.length;i++)for(let j=i+1;j<showdown.nodes.length;j++){
   const dx=Math.abs(showdown.nodes[i].x-showdown.nodes[j].x),dz=Math.abs(showdown.nodes[i].z-showdown.nodes[j].z);
   expect(dx>=SHOWDOWN_NODE_GAP.x-.02||dz>=SHOWDOWN_NODE_GAP.z-.02,`${showdown.nodes[i].name} e ${showdown.nodes[j].name}`).toBe(true);
  }
  const span=(nodes:Node[])=>Math.max(...nodes.map(n=>n.x))-Math.min(...nodes.map(n=>n.x));
  expect(span(showdown.nodes)).toBeGreaterThan(span(planning.nodes));
 });
});
