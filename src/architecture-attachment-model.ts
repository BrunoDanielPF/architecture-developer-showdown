import type {EdgeVisualEffect,NodeVisualEffect} from './architecture-visual-model';

export type AttachmentScope='node'|'edge';
export type AttachmentPlacement='node-rack'|'inline-gate'|'sidecar';
export type AttachmentMotion='static'|'pulse'|'rotate'|'signal';
export type ArchitectureAttachmentDefinition={
 effect:NodeVisualEffect|EdgeVisualEffect;
 cardId:string;
 shortLabel:string;
 color:string;
 scope:AttachmentScope;
 placement:AttachmentPlacement;
 motion:AttachmentMotion;
};

const attachments:Record<NodeVisualEffect|EdgeVisualEffect,ArchitectureAttachmentDefinition>={
 replication:{effect:'replication',cardId:'replica',shortLabel:'RÉPLICA',color:'#b991ff',scope:'node',placement:'node-rack',motion:'signal'},
 elasticity:{effect:'elasticity',cardId:'autoscale',shortLabel:'AUTO',color:'#65e7ef',scope:'node',placement:'node-rack',motion:'pulse'},
 zones:{effect:'zones',cardId:'multi-az',shortLabel:'MULTI-AZ',color:'#75a9ff',scope:'node',placement:'node-rack',motion:'signal'},
 health:{effect:'health',cardId:'health',shortLabel:'HEALTH',color:'#79e5a8',scope:'node',placement:'node-rack',motion:'pulse'},
 index:{effect:'index',cardId:'index',shortLabel:'ÍNDICE',color:'#e9c56e',scope:'node',placement:'node-rack',motion:'static'},
 pool:{effect:'pool',cardId:'pool',shortLabel:'POOL',color:'#6ed4ed',scope:'node',placement:'node-rack',motion:'rotate'},
 observability:{effect:'observability',cardId:'observe',shortLabel:'OBS',color:'#70e1ff',scope:'node',placement:'node-rack',motion:'pulse'},
 idempotency:{effect:'idempotency',cardId:'idempotency',shortLabel:'IDEMP',color:'#91dda8',scope:'node',placement:'node-rack',motion:'rotate'},
 'dead-letter':{effect:'dead-letter',cardId:'dlq',shortLabel:'DLQ',color:'#ed8b76',scope:'node',placement:'node-rack',motion:'signal'},
 locking:{effect:'locking',cardId:'lock',shortLabel:'LOCK',color:'#d6a8ff',scope:'node',placement:'node-rack',motion:'static'},
 identity:{effect:'identity',cardId:'iam',shortLabel:'IAM',color:'#7eb9ff',scope:'node',placement:'node-rack',motion:'signal'},
 tracing:{effect:'tracing',cardId:'trace',shortLabel:'TRACE',color:'#f0b96f',scope:'node',placement:'node-rack',motion:'pulse'},
 timeout:{effect:'timeout',cardId:'timeout',shortLabel:'TIMEOUT',color:'#f1b96c',scope:'edge',placement:'sidecar',motion:'signal'},
 retry:{effect:'retry',cardId:'retry',shortLabel:'RETRY',color:'#e5aa68',scope:'edge',placement:'sidecar',motion:'rotate'},
 breaker:{effect:'breaker',cardId:'breaker',shortLabel:'BREAKER',color:'#ed7c72',scope:'edge',placement:'inline-gate',motion:'signal'},
 'rate-limit':{effect:'rate-limit',cardId:'rate',shortLabel:'RATE',color:'#efc56d',scope:'edge',placement:'inline-gate',motion:'pulse'},
 firewall:{effect:'firewall',cardId:'waf',shortLabel:'WAF',color:'#e46888',scope:'edge',placement:'inline-gate',motion:'pulse'},
 compression:{effect:'compression',cardId:'compression',shortLabel:'ZIP',color:'#9ab7ff',scope:'edge',placement:'inline-gate',motion:'signal'},
 bulkhead:{effect:'bulkhead',cardId:'bulkhead',shortLabel:'BULK',color:'#c39aff',scope:'edge',placement:'inline-gate',motion:'static'},
 backpressure:{effect:'backpressure',cardId:'backpressure',shortLabel:'BACK',color:'#e2ad65',scope:'edge',placement:'inline-gate',motion:'pulse'},
 'secure-transport':{effect:'secure-transport',cardId:'mtls',shortLabel:'mTLS',color:'#71d9c6',scope:'edge',placement:'inline-gate',motion:'signal'}
};

export function attachmentDefinition(effect:NodeVisualEffect|EdgeVisualEffect){return attachments[effect];}

export function nodeAttachmentSlots(count:number,cluster=false){
 return Array.from({length:count},(_,index)=>{
  const row=Math.floor(index/3),columns=Math.min(3,count-row*3),column=index%3;
  return {x:(column-(columns-1)/2)*.76,z:(cluster?-1.06:-.9)-row*.68};
 });
}

export function edgeAttachmentProgress(count:number){
 if(count<=0)return[];
 if(count===1)return[.34];
 if(count===2)return[.27,.41];
 return Array.from({length:count},(_,index)=>.22+index*.12);
}

export const architectureAttachmentRegistry=attachments;
