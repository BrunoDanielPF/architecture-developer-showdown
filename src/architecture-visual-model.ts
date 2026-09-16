import type {Edge,Graph,Node} from '../packages/domain/types';

export type NodeVisualEffect='replication'|'elasticity'|'zones'|'health'|'index'|'pool'|'observability'|'idempotency'|'dead-letter'|'locking'|'identity'|'tracing';
export type EdgeVisualEffect='timeout'|'retry'|'breaker'|'rate-limit'|'firewall'|'compression'|'bulkhead'|'backpressure'|'secure-transport';
export type InstanceOffset={x:number;z:number};

const nodeEffects:Record<string,NodeVisualEffect>={
 replica:'replication',autoscale:'elasticity','multi-az':'zones',health:'health',index:'index',pool:'pool',observe:'observability',
 idempotency:'idempotency',dlq:'dead-letter',lock:'locking',iam:'identity',trace:'tracing'
};
const edgeEffects:Record<string,EdgeVisualEffect>={
 timeout:'timeout',retry:'retry',breaker:'breaker',rate:'rate-limit',waf:'firewall',compression:'compression',bulkhead:'bulkhead',backpressure:'backpressure',mtls:'secure-transport'
};

export const edgeVisualEffects=(policies:string[])=>policies.map(id=>edgeEffects[id]).filter((effect):effect is EdgeVisualEffect=>Boolean(effect));

export function instanceOffsets(count:number):InstanceOffset[]{
 const safe=Math.max(1,Math.min(5,Math.round(count||1)));
 if(safe===1)return[{x:0,z:0}];
 if(safe===2)return[{x:-.43,z:0},{x:.43,z:0}];
 if(safe===3)return[{x:-.62,z:0},{x:0,z:0},{x:.62,z:0}];
 if(safe===4)return[{x:-.43,z:-.3},{x:.43,z:-.3},{x:-.43,z:.3},{x:.43,z:.3}];
 return[{x:-.62,z:-.3},{x:0,z:-.3},{x:.62,z:-.3},{x:-.32,z:.3},{x:.32,z:.3}];
}

export function nodeVisualModel(node:Node){
 const instanceCount=Math.max(1,Math.min(5,Math.round(node.config.instances??1)));
 const effects=node.upgrades.map(id=>nodeEffects[id]).filter((effect):effect is NodeVisualEffect=>Boolean(effect));
 const role:'read-replica'|'primary'|'standard'=node.config.replica?'read-replica':node.upgrades.includes('replica')?'primary':'standard';
 return {
  instanceCount,instances:instanceOffsets(instanceCount),cluster:instanceCount>1,
  elastic:node.upgrades.includes('autoscale'),zones:node.upgrades.includes('multi-az')?2:1,
  role,
  effects
 };
}

export function edgeVisualModel(edge:Edge,graph:Graph){
 const source=graph.nodes.find(node=>node.id===edge.from),target=graph.nodes.find(node=>node.id===edge.to);
 const targetModel=target?nodeVisualModel(target):null;
 const balanced=source?.kind==='balancer'&&Boolean(targetModel?.cluster);
 return {
  balanced,laneCount:balanced?targetModel!.instanceCount:1,laneOffsets:balanced?targetModel!.instances:[{x:0,z:0}],
  effects:edgeVisualEffects(edge.policies)
 };
}

export const visualEffectRegistry={node:nodeEffects,edge:edgeEffects};
