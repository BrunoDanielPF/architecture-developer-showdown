import type {Incident,IncidentKind,IncidentSeverity,Telemetry} from '../domain/types';

export type IncidentDraft=Pick<Incident,'kind'|'type'|'severity'|'locus'|'nodeId'|'detail'>;

const labels:Record<IncidentKind,string>={
 retry_storm:'Retry storm',cache_stampede:'Cache stampede',queue_backlog:'Backlog de fila',
 connection_exhaustion:'Exaustão de conexões',stale_data:'Dados desatualizados',
 inventory_race:'Disputa de estoque',cascading_failure:'Falha em cascata',
};
const kindByLabel=new Map(Object.entries(labels).map(([kind,label])=>[label,kind as IncidentKind]));

export function incident(kind:IncidentKind,nodeId:string,detail:string,severity:IncidentSeverity='warning',locus:Incident['locus']={type:'node',id:nodeId}):IncidentDraft{
 return {kind,type:labels[kind],severity,locus,nodeId,detail};
}

const key=(value:Pick<Incident,'kind'|'locus'>)=>`${value.kind}:${value.locus.type}:${value.locus.id}`;

export function reconcileIncidents(current:IncidentDraft[],previous:Pick<Telemetry,'incidents'>|undefined,round:number):Incident[]{
 const prior=(previous?.incidents??[]).filter(item=>item.phase!=='recovered');
 const priorByKey=new Map(prior.map(item=>[key(item),item]));
 const active=current.map(item=>{
  const previousIncident=priorByKey.get(key(item));
  return {...item,id:`incident:${key(item)}`,phase:previousIncident?'ongoing':'triggered',firstSeenRound:previousIncident?.firstSeenRound??round} as Incident;
 });
 const activeKeys=new Set(active.map(key));
 const recovered=prior.filter(item=>!activeKeys.has(key(item))).map(item=>({...item,severity:'warning' as const,phase:'recovered' as const,detail:`${item.type} não foi detectado nesta medição.`}));
 return [...active,...recovered];
}

export function upgradeIncidentHistory(history:Telemetry[]):Telemetry[]{
 let previous:Telemetry|undefined;
 return history.map((telemetry,round)=>{
  const drafts=(telemetry.incidents??[]).filter(value=>value.phase!=='recovered').map(value=>{
   if(value.kind&&value.locus&&value.severity)return {kind:value.kind,type:value.type,severity:value.severity,locus:value.locus,nodeId:value.nodeId,detail:value.detail};
   const legacy=value as Partial<Incident>&Pick<Incident,'type'|'nodeId'|'detail'>,kind=kindByLabel.get(legacy.type)??'cascading_failure';
   return {...incident(kind,legacy.nodeId,legacy.detail),type:legacy.type};
  });
  const updated={...telemetry,incidents:reconcileIncidents(drafts,previous,round)};previous=updated;return updated;
 });
}
