import {describe,expect,it} from 'vitest';
import {edgeVisualModel,instanceOffsets,nodeVisualModel,visualEffectRegistry} from '../src/architecture-visual-model';
import type {Graph,Node} from '../packages/domain/types';

const node=(overrides:Partial<Node>={}):Node=>({id:'api',kind:'api',name:'API',x:0,z:0,config:{instances:1},upgrades:[],...overrides});

describe('modelo visual da arquitetura',()=>{
 it('materializa escala horizontal como instâncias internas reais',()=>{
  const model=nodeVisualModel(node({config:{instances:3},upgrades:['scale']}));
  expect(model.cluster).toBe(true);expect(model.instanceCount).toBe(3);expect(model.instances).toHaveLength(3);expect(new Set(model.instances.map(position=>position.x)).size).toBe(3);
 });
 it('distingue elasticidade, zonas e papéis de replicação',()=>{
  const primary=nodeVisualModel(node({kind:'database',upgrades:['replica','multi-az','observe']}));
  const replica=nodeVisualModel(node({kind:'database',config:{replica:1}}));
  const elastic=nodeVisualModel(node({config:{instances:5},upgrades:['autoscale']}));
  expect(primary.role).toBe('primary');expect(primary.zones).toBe(2);expect(primary.effects).toContain('observability');expect(replica.role).toBe('read-replica');expect(elastic.elastic).toBe(true);expect(elastic.instances).toEqual(instanceOffsets(5));
 });
 it('abre uma rota animada por réplica quando o balanceador alimenta um cluster',()=>{
  const graph:Graph={nodes:[node({id:'lb',kind:'balancer',name:'NLB'}),node({id:'api',config:{instances:3},upgrades:['scale']})],edges:[{id:'balanced',from:'lb',to:'api',protocol:'REST',read:100,write:100,config:{},policies:['waf','rate']}]};
  const visual=edgeVisualModel(graph.edges[0],graph);
  expect(visual.balanced).toBe(true);expect(visual.laneCount).toBe(3);expect(visual.laneOffsets).toHaveLength(3);expect(visual.effects).toEqual(['firewall','rate-limit']);
 });
 it('mantém registros declarativos para todas as cartas visuais suportadas',()=>{
  expect(Object.keys(visualEffectRegistry.node)).toEqual(expect.arrayContaining(['replica','autoscale','multi-az','health','index','pool','observe','idempotency','dlq','lock','iam','trace']));
  expect(Object.keys(visualEffectRegistry.edge)).toEqual(expect.arrayContaining(['timeout','retry','breaker','rate','waf','compression','bulkhead','backpressure','mtls']));
 });
});
