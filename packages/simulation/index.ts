import { CATALOG } from '../content/catalog';
import { clone, random } from '../domain/random';
import type { Edge, Graph, Incident, Node, Runtime, Telemetry, World } from '../domain/types';

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
const round=(n:number)=>Math.round(n*100)/100;
export function topological(graph:Graph):Node[]{
 const degree=new Map(graph.nodes.map(n=>[n.id,0]));
 for(const e of graph.edges){if(!degree.has(e.from)||!degree.has(e.to))throw new Error('Conexão com componente ausente.');degree.set(e.to,degree.get(e.to)!+1);}
 const todo=graph.nodes.filter(n=>degree.get(n.id)===0).map(n=>n.id).sort(),ordered:Node[]=[];
 while(todo.length){const id=todo.shift()!;ordered.push(graph.nodes.find(n=>n.id===id)!);for(const e of graph.edges.filter(e=>e.from===id)){degree.set(e.to,degree.get(e.to)!-1);if(degree.get(e.to)===0){todo.push(e.to);todo.sort();}}}
 if(ordered.length!==graph.nodes.length)throw new Error('Ciclo de chamadas não permitido: use uma fila para desacoplar o fluxo.');return ordered;
}
export const emptyRuntime=():Runtime=>({queueBacklog:{},warm:{},history:[]});
const has=(node:Node,capability:string)=>node.upgrades.includes(capability);
const bases:Record<string,{capacity:number;latency:number;cost:number}>={client:{capacity:1e9,latency:8,cost:0},api:{capacity:2200,latency:22,cost:180},database:{capacity:1150,latency:18,cost:240},payment:{capacity:1300,latency:0,cost:0},cache:{capacity:12000,latency:4,cost:140},queue:{capacity:7000,latency:8,cost:100},worker:{capacity:850,latency:30,cost:140},balancer:{capacity:14000,latency:4,cost:90},cdn:{capacity:20000,latency:6,cost:150},storage:{capacity:5000,latency:35,cost:65}};
export function simulate(graph:Graph,world:World,previous:Runtime=emptyRuntime(),seed='simulation'): {telemetry:Telemetry;runtime:Runtime}{
 const runtime=clone(previous),order=topological(graph),rng=random(seed);
 const flow=new Map(graph.nodes.map(n=>[n.id,{read:0,write:0,attack:0}]));
 const latency=new Map<string,number>(),success=new Map<string,number>(),edgeDelay=new Map<string,number>();
 const incidents:Incident[]=[],traces:string[]=[],metrics:Telemetry['nodes']=[];
 let cost=0,stale=0,duplicate=0,oversell=0,dbReads=0,dbWrites=0,payWrites=0,cacheReads=0,maliciousExposure=0,blocked=0,falsePositive=0,queueDelay=0,queueAccepted=0,expiredFraction=0,apiSeen=false;
 const root=graph.nodes.find(n=>n.kind==='client'); if(root)flow.set(root.id,{read:world.reads,write:world.writes,attack:world.attack});
 const outgoing=(id:string)=>graph.edges.filter(e=>e.from===id);
 const activeEdges=graph.edges.filter(e=>e.read>0||e.write>0);
 const queueOnPath=(id:string,visited=new Set<string>()):boolean=>{if(visited.has(id))return false;visited.add(id);const n=graph.nodes.find(n=>n.id===id);return n?.kind==='queue'||outgoing(id).some(e=>e.write>0&&queueOnPath(e.to,visited));};
 function filter(input:{read:number;write:number;attack:number},caps:string[],cfg:Record<string,number>){
   const f={...input};
   if(caps.includes('waf')){const vector=world.attackKind??0;const ratio=(.50+.12*(cfg.strictness??2))*(vector===0?1:vector===1?.3:.08),bad=f.attack*ratio,fp=(f.read+f.write)*.003*(cfg.strictness??2)**2;f.attack-=bad;blocked+=bad;falsePositive+=fp;f.read*=1-.003*(cfg.strictness??2)**2;f.write*=1-.003*(cfg.strictness??2)**2;}
   if(caps.includes('rate')){const limit=cfg.limit??2400;if(cfg.identity){const bad=f.attack*.65;f.attack-=bad;blocked+=bad;}const total=f.read+f.write+f.attack;if(total>limit){const ratio=limit/total;falsePositive+=(f.read+f.write)*(1-ratio);blocked+=f.attack*(1-ratio);f.read*=ratio;f.write*=ratio;f.attack*=ratio;}}
   return f;
 }
 for(const node of order){
   const incoming=flow.get(node.id)!;let f=filter(incoming,node.upgrades,node.config);
   const base=bases[node.kind],cfg=node.config;let cap=base.capacity,lat=base.latency,unitCost=base.cost,availability=1;
   const incomingEdges=graph.edges.filter(e=>e.to===node.id);
   const balanced=incomingEdges.some(e=>graph.nodes.find(n=>n.id===e.from)?.kind==='balancer');
   const provisioned=has(node,'autoscale')?Math.min(cfg.instances??3,Math.max(1,Math.ceil((f.read+f.write+f.attack)/(base.capacity*.7)))):(cfg.instances??1);
   const instances=node.kind==='worker'?provisioned:node.kind==='api'&&balanced?provisioned:1;
   if(node.kind==='api'||node.kind==='worker'){cap*=instances;unitCost*=provisioned;}
   if(node.kind==='api'){
     apiSeen=f.read+f.write>0;
     const payEdge=outgoing(node.id).find(e=>graph.nodes.find(n=>n.id===e.to)?.kind==='payment');
     if(payEdge){const delay=Math.min(world.paymentMs,payEdge.config.timeout??world.paymentMs);const isolation=payEdge.policies.includes('bulkhead')?(payEdge.config.isolation??60)/100:0;cap/=1+Math.max(0,delay-400)/1800*(world.writes/Math.max(world.reads+world.writes,1)*4)*(1-isolation);}
     if((cfg.instances??1)>1&&!balanced)traces.push(`${node.name}: ${cfg.instances} instâncias provisionadas, mas apenas uma recebe tráfego sem distribuição.`);
   }
   let weighted=f.read+f.write+f.attack;
   if(node.kind==='database'){
     const readWork=has(node,'index')?1-(cfg.coverage??60)/100*.72:1;
     const writeWork=cfg.replica?.7:has(node,'index')?3.8:3;
     weighted=f.read*readWork+f.write*writeWork+f.attack*1.4;
     if(!cfg.replica){if(has(node,'lock')){const coverage=(cfg.locking??80)/100;weighted+=f.write*world.hot*coverage*1.2;oversell+=f.write*world.hot*.075*(1-coverage);}else oversell+=f.write*world.hot*.075;}
     if(cfg.replica){unitCost=180;const replicating=incomingEdges.some(e=>e.protocol==='replication'&&e.write>0);stale+=f.read*(replicating?clamp(world.updateRate*.9+world.writes/12000)*.18:.35);}
     if(has(node,'multi-az')){weighted+=f.write*.25;lat+=5;}
   }
   if(node.kind==='api'||node.kind==='worker'){
     const syncDelay=outgoing(node.id).reduce((m,e)=>Math.max(m,graph.nodes.find(n=>n.id===e.to)?.kind==='payment'?Math.min(world.paymentMs,e.config.timeout??world.paymentMs):25),25);
     const connections=f.write*syncDelay/1000+(f.read/100);
     const limit=has(node,'pool')?(cfg.poolSize??80):160;
     if(connections>limit){cap*=clamp(limit/connections,.12,1);incidents.push({type:'Exaustão de conexões',nodeId:node.id,detail:`${round(connections)} conexões solicitadas para limite ${limit}.`});}
   }
   if(has(node,'idempotency'))weighted*=1.04;
   for(const c of node.upgrades){if(c!=='scale'&&c!=='replica')unitCost+=CATALOG[c]?.infra??0;}
   if(node.kind!=='client'&&node.kind!=='payment'){
     availability=1-world.failure;
     if(has(node,'multi-az'))availability=1-world.failure*world.failure-(cfg.failover??4)/600;
     if(has(node,'health'))availability=1-(1-availability)*.6;
   }
   let utilization=weighted/cap;
   const congestion=utilization<=.7?1:utilization<1?1+((utilization-.7)/.3)**2*4:5+(utilization-1)*14;
   lat*=congestion;
   const served=clamp(cap/Math.max(weighted,1))*availability;
   if(utilization>1.05)traces.push(`${node.name}: demanda ${round(weighted)} / capacidade ${round(cap)}; ${round((1-served)*100)}% não atendido neste trecho.`);
   if(node.kind==='payment'){lat=world.paymentMs;availability=1-world.paymentError;}
   success.set(node.id,served*(node.kind==='payment'?availability:1));latency.set(node.id,lat);
   if(node.kind==='cache'||node.kind==='cdn'){
     const warm=previous.warm[node.id]??.55;
     const hasOrigin=(id:string):boolean=>outgoing(id).some(e=>{const n=graph.nodes.find(n=>n.id===e.to)!;return ['database','storage'].includes(n.kind)||hasOrigin(n.id);});
     const hit=hasOrigin(node.id)?clamp((cfg.ttl??45)/((cfg.ttl??45)+20)*(cfg.memory??2)/((cfg.memory??2)+1)*(1-world.hot*.2)*warm*(node.kind==='cdn'?.55:1),0,.88):0;
     const hits=f.read*hit*served;cacheReads+=hits;stale+=hits*clamp(1-Math.exp(-(cfg.ttl??45)*world.updateRate*.04))*.14;
     f.read-=hits;runtime.warm[node.id]=Math.min(1,warm+.25);
     if(warm<.8&&f.read>700){incidents.push({type:'Cache stampede',nodeId:node.id,detail:`Cache frio: ${round(f.read)} misses/s seguem juntos para a origem.`});}
     traces.push(`${node.name}: ${round(hit*100)}% de hits nas leituras roteadas; ${round(f.read)} leituras/s seguem para a origem.`);
   }
   if(node.kind==='queue'){
     const workers=outgoing(node.id).map(e=>graph.nodes.find(n=>n.id===e.to)!).filter(n=>n.kind==='worker');
     const consumer=workers.reduce((sum,n)=>sum+850*(n.config.instances??1)/(1+world.paymentMs/1000*.25),0);
     let produced=f.read+f.write;
     if(has(node,'backpressure')){const allowed=Math.min(produced,cfg.admission??800),fraction=allowed/Math.max(produced,1);f.read*=fraction;f.write*=fraction;produced=allowed;}
     f.read*=served;f.write*=served;produced=f.read+f.write;const old=previous.queueBacklog[node.id]??0;
     const amplification=has(node,'dlq')?1:1+world.paymentError*.8;
     const unbounded=Math.max(0,old+(produced*amplification-consumer)*60),retained=Math.max(produced,1)*(cfg.retention??120),expired=Math.max(0,unbounded-retained),next=Math.min(unbounded,retained);
     expiredFraction=Math.max(expiredFraction,clamp(expired/Math.max(produced*60,1)));
     if(expired>0)traces.push(`${node.name}: ${round(expired)} tarefas expiraram após o limite de retenção de ${cfg.retention??120} s.`);
     runtime.queueBacklog[node.id]=Math.min(next,1e7);
     const delay=next/Math.max(consumer,1);queueDelay=Math.max(queueDelay,delay);queueAccepted+=f.write;
     if(delay>world.completionSlo)incidents.push({type:'Backlog de fila',nodeId:node.id,detail:`Produção ${round(produced)}/s, consumo ${round(consumer)}/s; atraso ${round(delay)} s.`});
     const ratio=clamp(consumer/Math.max(produced*amplification+old/60,1));f.read*=ratio;f.write*=ratio;
     traces.push(`${node.name}: ${round(next)} tarefas pendentes; conclusão estimada em ${round(delay)} s.`);
     if(!workers.length)traces.push(`${node.name}: nenhum Worker conectado; aceitar a tarefa não a conclui.`);
   }
   if(node.kind==='database'){dbReads+=f.read*served;if(!cfg.replica)dbWrites+=f.write*served;if(has(node,'iam'))maliciousExposure+=f.attack*((world.attackKind??0)===2?.1:.25);else maliciousExposure+=f.attack;}
   if(node.kind==='storage'){dbReads+=f.read*served*.35;maliciousExposure+=f.attack*(has(node,'iam')?.2:1);traces.push(`${node.name}: atende somente a fração de objetos públicos (35%); consultas transacionais ainda precisam de persistência consultável.`);}
   if(node.kind==='payment')payWrites+=f.write*served*availability;
   if(node.kind==='worker')duplicate+=f.write*world.paymentError*.15*(has(node,'idempotency')?.03:1);
   metrics.push({id:node.id,demand:round(weighted),capacity:round(cap),utilization:round(utilization),latency:round(lat),cost:round(unitCost)});cost+=unitCost;
   const readTotal=outgoing(node.id).reduce((sum,e)=>sum+e.read,0);
   if(readTotal>100)traces.push(`${node.name}: pesos de leitura somam ${readTotal}; distribuição proporcional normalizada entre os caminhos.`);
   for(const edge of outgoing(node.id)){
     const readShare=edge.read/Math.max(100,readTotal);
     let traffic={read:f.read*readShare,write:f.write*edge.write/100,attack:f.attack*Math.max(readShare,edge.write/100)};
     const dest=graph.nodes.find(n=>n.id===edge.to)!;
     traffic=filter(traffic,edge.policies,edge.config);
     let transport=edge.protocol==='gRPC'?2:edge.protocol==='SQL'?3:edge.protocol==='WebSocket'?6:12;
     if(edge.policies.includes('compression')){transport*=.6;traffic.read*=1.025;}
     if(edge.protocol==='WebSocket')traffic.read*=1.1;
     if(edge.policies.includes('mtls')){transport+=5;if(node.kind!=='client'&&(world.attackKind??0)===2)traffic.attack*=.6;}
     if(edge.protocol==='replication')traffic.attack=0;
     if(edge.policies.includes('retry')){
       const expectedError=dest.kind==='payment'?world.paymentError:clamp((traffic.read+traffic.write*3)/bases[dest.kind].capacity-1,0,.7);
       const retries=edge.config.retries??1,backoff=edge.config.backoff??400;
       const amplification=1+expectedError*retries/(1+backoff/500);
       traffic.read*=amplification;traffic.write*=amplification;traffic.attack*=amplification;
       duplicate+=traffic.write*expectedError*retries*.12*(has(dest,'idempotency')||has(node,'idempotency')?.02:1);
       if(amplification>1.35&&backoff<200){incidents.push({type:'Retry storm',nodeId:node.id,detail:`${node.name} → ${dest.name}: carga ×${round(amplification)} com backoff ${backoff} ms.`});}
       transport+=expectedError*backoff;
     }
     if(edge.policies.includes('breaker')&&world.paymentError>(edge.config.threshold??10)/100&&dest.kind==='payment'){
       const fallback=(edge.config.fallback??40)/100;
       payWrites+=traffic.write*fallback*.65;traffic.write*=.15;traffic.read*=.15;transport+=8;
       traces.push(`${node.name} → ${dest.name}: circuito aberto; ${round(fallback*100)}% elegível a operação degradada, restante aguarda ou falha.`);
     }
     if(edge.policies.includes('timeout')&&dest.kind==='payment'&&world.paymentMs>(edge.config.timeout??1800)){
       const ratio=clamp((edge.config.timeout??1800)/world.paymentMs,.05,1);traffic.write*=ratio;
       traces.push(`${node.name} → ${dest.name}: timeout de ${edge.config.timeout} ms interrompe chamadas antes da resposta de ${world.paymentMs} ms.`);
     }
     edgeDelay.set(edge.id,transport);
     const target=flow.get(edge.to)!;
     const effective=node.kind==='client'||node.kind==='queue'?1:served;
     target.read+=traffic.read*effective;target.write+=traffic.write*effective;target.attack+=traffic.attack*effective;
     cost+= (traffic.read+traffic.write)*.002*(edge.policies.includes('compression')?.65:1)+(edge.protocol==='WebSocket'?45:0);
     for(const c of edge.policies)cost+=CATALOG[c]?.infra??0;
   }
 }
 const pathLatency=(id:string,completion=false):number=>{
   const n=graph.nodes.find(n=>n.id===id)!;
   if(n.kind==='queue'&&!completion)return latency.get(id)??8;
   const paths=outgoing(id).filter(e=>e.read>0||e.write>0).map(e=>{
     let child=pathLatency(e.to,completion);if(e.policies.includes('timeout'))child=Math.min(child,e.config.timeout??1800);
     if(e.policies.includes('breaker')&&graph.nodes.find(n=>n.id===e.to)?.kind==='payment'&&world.paymentError>(e.config.threshold??10)/100)child=80;
     return child+(edgeDelay.get(e.id)??0);
   });return (latency.get(id)??0)+Math.max(0,...paths);
 };
 const readSuccess=clamp((dbReads+cacheReads)/Math.max(world.reads,1));
 const writeSuccess=Math.min(clamp(dbWrites/Math.max(world.writes,1)),clamp(payWrites/Math.max(world.writes,1)));
 const completion=clamp(writeSuccess*(queueDelay>world.completionSlo?world.completionSlo/queueDelay:1)*(1-expiredFraction));
 const acceptedWrite=queueAccepted>0?Math.min(clamp(dbWrites/Math.max(world.writes,1)),clamp(queueAccepted/world.writes)):writeSuccess;
 const serviced=apiSeen?(world.reads*readSuccess+world.writes*acceptedWrite)/(world.reads+world.writes):0;
 const p95=(root?pathLatency(root.id):20000)+world.regionMs;
 const consistency=clamp(1-(stale+duplicate+oversell)/Math.max(world.reads+world.writes,1));
 const security=clamp(1-maliciousExposure/Math.max(world.attack,1)*.7-falsePositive/Math.max(world.reads+world.writes,1)*.5);
 const complexity=graph.nodes.filter(n=>n.kind!=='client').length*.8+activeEdges.length*.35+graph.nodes.reduce((s,n)=>s+n.upgrades.length*.3,0);
 cost+=complexity*4;
 if(stale/(world.reads+world.writes)>.012)incidents.push({type:'Dados desatualizados',nodeId:graph.nodes.find(n=>n.kind==='cache'||n.config.replica)?.id??'db',detail:`${round(stale)} leituras/s potencialmente desatualizadas por TTL ou atraso de replicação.`});
 if(oversell/Math.max(world.writes,1)>.03)incidents.push({type:'Disputa de estoque',nodeId:'db',detail:`${round(oversell)} escritas/s expostas à concorrência nas chaves mais disputadas.`});
 if(metrics.some(n=>n.utilization>1.5)&&!queueOnPath('api'))incidents.push({type:'Falha em cascata',nodeId:'api',detail:'Saturação em dependência síncrona propaga espera e erros ao caminho de aceitação.'});
 traces.push(`Leituras atendidas: ${round(readSuccess*100)}%; pedidos concluídos: ${round(completion*100)}%. Caminhos ausentes não atendem operações.`);
 traces.push(`Custo $${round(cost)}/mês: componentes, políticas, tráfego e operação de ${graph.nodes.length} nós / ${graph.edges.length} conexões.`);
 const telemetry:Telemetry={p95:round(Math.min(60000,p95*(.99+rng()*.02))),throughput:round((world.reads+world.writes)*serviced),errorRate:round((1-serviced)*100),availability:round(serviced*100),consistency:round(consistency*100),security:round(security*100),completion:round(completion*100),cost:round(cost),complexity:round(complexity),blocked:round(blocked),falsePositive:round(falsePositive),nodes:metrics,incidents,traces,backlog:round(Object.values(runtime.queueBacklog).reduce((a,b)=>a+b,0)),observed:graph.nodes.some(n=>has(n,'observe')||has(n,'trace')),diagnostic:graph.nodes.some(n=>has(n,'trace'))};
 runtime.history.push(telemetry);return {telemetry,runtime};
}
