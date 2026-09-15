import {describe,expect,it} from 'vitest';
import {initialGraph} from '../packages/content/catalog';
import type {Node} from '../packages/domain/types';
import {spreadTableGraph,TABLE_NODE_GAP} from '../src/table-layout';

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
  expect(spread.nodes.find(n=>n.id==='client')!.x).toBeLessThan(-6);
  expect(spread.nodes.find(n=>n.id==='api')!.x).toBeGreaterThan(-2);
 });
 it('separa componentes recursivos inseridos na diagonal',()=>{
  const graph=initialGraph();graph.nodes.push(node('cache-1','Cache 1',.5,-1),node('cache-2','Cache 2',1.75,-1.5));
  const spread=spreadTableGraph(graph);expectReadable(spread.nodes);
  const first=spread.nodes.find(n=>n.id==='cache-1')!,second=spread.nodes.find(n=>n.id==='cache-2')!;
  expect(Math.abs(first.x-second.x)>=TABLE_NODE_GAP.x-.02||Math.abs(first.z-second.z)>=TABLE_NODE_GAP.z-.02).toBe(true);
 });
});
