import { CATALOG, defaults } from '../content/catalog';
import { clone, shuffle } from '../domain/random';
import type { Card, Command, Config, Edge, Field, Graph, Player, Target, CardInstance } from '../domain/types';
import { topological } from '../simulation';
export const ECONOMY={initialEC:8,refreshEC:5,maxEC:12,actions:2,hand:7,backlog:3};
export const slots=Array.from({length:24},(_,i)=>({x:-6+(i%6)*2.4,z:-4+Math.floor(i/6)*2.6,id:`slot:${i}`}));
export const NODE_CLEARANCE={x:2,z:2.1};
type Position={x:number;z:number};
export function isPositionFree(g:Graph,pos:Position,ignoreId?:string){
 return !g.nodes.some(n=>n.id!==ignoreId&&Math.abs(n.x-pos.x)<NODE_CLEARANCE.x&&Math.abs(n.z-pos.z)<NODE_CLEARANCE.z);
}
const nodeCard=(kind:string)=>Object.values(CATALOG).find(c=>c.nodeKind===kind);
export function configFields(graph:Graph,target:string):Record<string,Field>{
 const n=graph.nodes.find(n=>n.id===target),e=graph.edges.find(e=>e.id===target);
 if(n)return Object.assign({},nodeCard(n.kind)?.fields??{},...n.upgrades.filter(c=>c!=='replica').map(c=>CATALOG[c]?.fields??{}));
 if(e)return Object.assign({read:{label:'Leituras roteadas',min:0,max:100,default:e.read,step:10,unit:'%'},write:{label:'Escritas roteadas',min:0,max:100,default:e.write,step:10,unit:'%'}},...e.policies.map(c=>CATALOG[c]?.fields??{}));return {};
}
export function validateConfig(config:Config,fields:Record<string,Field>):Config{
 if(!config||typeof config!=='object'||Array.isArray(config))throw new Error('Configuração inválida.');
 const out:Config={};for(const [key,value] of Object.entries(config)){const f=fields[key];if(!f||!Number.isFinite(value)||value<f.min||value>f.max||Math.abs((value-f.min)/f.step-Math.round((value-f.min)/f.step))>1e-6)throw new Error(`Configuração inválida: ${key}.`);out[key]=value;}return out;
}
export function canConnect(g:Graph,from:string,to:string):boolean{
 const a=g.nodes.find(n=>n.id===from),b=g.nodes.find(n=>n.id===to);if(!a||!b||a.id===b.id||g.edges.some(e=>e.from===from&&e.to===to))return false;
 const grammar:Record<string,string[]>={client:['api','balancer','cdn'],api:['database','cache','queue','payment','storage'],balancer:['api'],cache:['database','api','storage'],cdn:['api','balancer','storage'],queue:['worker','payment','database'],worker:['database','payment','cache','queue'],database:[],payment:[],storage:[]};
 if(!grammar[a.kind]?.includes(b.kind))return false;
 try{topological({...g,edges:[...g.edges,{id:'candidate',from,to,read:100,write:100,protocol:'REST',policies:[],config:{}}]});return true;}catch{return false;}
}
export function candidates(card:Card,graph:Graph):Target[]{
 if(card.kind==='action'){
   if(card.id==='refactor')return graph.nodes.filter(n=>!['client','api','db','payment'].includes(n.id)).map(n=>({id:n.id,label:n.name,type:'node'}));
   return [{id:'self',label:'Pesquisar no deck pessoal',type:'self'}];
 }
 if(card.kind==='node'){
   if(card.nodeKind==='worker')return graph.nodes.filter(n=>n.kind==='queue').map(n=>({id:n.id,label:n.name,type:'node'}));
   const possible:Target[]=slots.filter(s=>isPositionFree(graph,s)).map(s=>({id:s.id,label:`Espaço ${Number(s.id.split(':')[1])+1}`,type:'slot'}));
   const compatible=graph.edges.filter(e=>{
     const from=graph.nodes.find(n=>n.id===e.from)!,to=graph.nodes.find(n=>n.id===e.to)!;
     if(card.nodeKind==='balancer')return to.kind==='api';
     if(card.nodeKind==='cdn')return from.kind==='client';
     if(card.nodeKind==='cache')return to.kind==='database'||to.kind==='storage';
     if(card.nodeKind==='queue')return from.kind==='api'||from.kind==='worker';
     if(card.nodeKind==='storage')return false;return true;
   });return [...compatible.map(e=>({id:e.id,label:`${graph.nodes.find(n=>n.id===e.from)!.name} → ${graph.nodes.find(n=>n.id===e.to)!.name}`,type:'edge' as const})),...possible];
 }
 const nodes:Target[]=graph.nodes.filter(n=>card.targets?.includes(n.kind)&&!n.upgrades.includes(card.id)&&!(card.id==='replica'&&n.config.replica)).map(n=>({id:n.id,label:n.name,type:'node'}));
 const edges:Target[]=card.targets?.includes('edge')?graph.edges.filter(e=>{
   if(e.policies.includes(card.id))return false;
   const a=graph.nodes.find(n=>n.id===e.from)!,b=graph.nodes.find(n=>n.id===e.to)!;
   if(card.id==='grpc')return ['api','worker'].includes(a.kind)&&['api','worker','payment'].includes(b.kind)&&e.protocol!=='gRPC';
   if(card.id==='websocket')return a.kind==='client'&&b.kind==='api'&&e.protocol!=='WebSocket';
   if(card.id==='mtls')return a.kind!=='client';
   if(['retry','breaker','timeout','bulkhead'].includes(card.id))return a.kind!=='queue'&&e.protocol!=='replication';return true;
 }).map(e=>({id:e.id,label:`${graph.nodes.find(n=>n.id===e.from)!.name} → ${graph.nodes.find(n=>n.id===e.to)!.name}`,type:'edge'})):[];
 return [...nodes,...edges];
}
export function validateGraph(g:Graph){
 if(g.nodes.length>40||g.edges.length>80)throw new Error('Limite da mesa: 40 nós e 80 conexões.');
 if(new Set(g.nodes.map(n=>n.id)).size!==g.nodes.length||new Set(g.edges.map(n=>n.id)).size!==g.edges.length)throw new Error('ID duplicado no grafo.');
 for(const n of g.nodes)if(!Number.isFinite(n.x)||!Number.isFinite(n.z)||Math.abs(n.x)>8||Math.abs(n.z)>6)throw new Error('Componente fora da mesa.');
 for(const e of g.edges)if(!Number.isFinite(e.read)||!Number.isFinite(e.write)||e.read<0||e.read>100||e.write<0||e.write>100)throw new Error('Roteamento fora de 0–100%.');
 topological(g);
}
function spend(p:Player,ec:number,action=1){if(p.ec<ec)throw new Error(`São necessários ${ec} EC.`);if(p.actions<action)throw new Error('Sem ações disponíveis nesta rodada.');p.ec-=ec;p.actions-=action;}
function freePosition(g:Graph,x:number,z:number):Position{
 const stepX=NODE_CLEARANCE.x+.2,stepZ=NODE_CLEARANCE.z+.2;
 const nearby:Position[]=[];
 for(let ring=0;ring<=4;ring++){
   if(ring===0){nearby.push({x,z});continue;}
   nearby.push(
    {x,z:z-ring*stepZ},{x,z:z+ring*stepZ},
    {x:x-ring*stepX,z},{x:x+ring*stepX,z},
    {x:x-ring*stepX,z:z-ring*stepZ},{x:x+ring*stepX,z:z-ring*stepZ},
    {x:x-ring*stepX,z:z+ring*stepZ},{x:x+ring*stepX,z:z+ring*stepZ}
   );
 }
 const candidates=[...nearby.filter(p=>Math.abs(p.x)<=8&&Math.abs(p.z)<=6),...[...slots].sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z))];
 const position=candidates.find(p=>isPositionFree(g,p));
 if(!position)throw new Error('Não há espaço livre para outro componente na mesa.');
 return {x:position.x,z:position.z};
}
function removeNode(p:Player,id:string){
 if(['client','api','db','payment'].includes(id))throw new Error('Componentes do setup não podem ser removidos.');
 const incoming=p.graph.edges.filter(e=>e.to===id),outgoing=p.graph.edges.filter(e=>e.from===id);
 if(!p.graph.nodes.some(n=>n.id===id))throw new Error('Componente não encontrado.');
 p.graph.edges=p.graph.edges.filter(e=>e.from!==id&&e.to!==id);
 for(const a of incoming)for(const b of outgoing){if(a.from!==b.to&&!p.graph.edges.some(e=>e.from===a.from&&e.to===b.to))p.graph.edges.push({...a,id:`${a.id}:ref:${b.id}`,to:b.to,read:a.read*b.read/100,write:a.write*b.write/100});}
 p.graph.nodes=p.graph.nodes.filter(n=>n.id!==id);
}
export function applyCommand(player:Player,command:Command,market:CardInstance[],seed:string):Player {
 const p=clone(player),g=p.graph;
 if(!command||typeof command.type!=='string')throw new Error('Comando inválido.');
 switch(command.type){
 case 'play':{
   const inst=p.hand.find(c=>c.uid===command.uid);if(!inst)throw new Error('Carta não está na mão.');const c=CATALOG[inst.cardId];
   if(!candidates(c,g).some(t=>t.id===command.target))throw new Error('Esta carta não encaixa nesse alvo.');
   const config={...defaults(c.id),...validateConfig(command.config,c.fields)};
   spend(p,c.ec);p.hand=p.hand.filter(x=>x.uid!==inst.uid);
   if(c.kind==='node'){
     const edge=g.edges.find(e=>e.id===command.target),target=g.nodes.find(n=>n.id===command.target),slot=slots.find(s=>s.id===command.target);
     const a=edge&&g.nodes.find(n=>n.id===edge.from)!,b=edge&&g.nodes.find(n=>n.id===edge.to)!;
     const desired=slot?{x:slot.x,z:slot.z}:edge&&a&&b?{x:(a.x+b.x)/2,z:(a.z+b.z)/2}:{x:target?.x??0,z:target?.z??0};
     const pos=isPositionFree(g,desired)?desired:freePosition(g,desired.x,desired.z);
     const node={id:inst.uid,kind:c.nodeKind!,name:c.name,...pos,config,upgrades:[]};g.nodes.push(node);
     if(edge){const oldTo=edge.to;edge.to=node.id;g.edges.push({id:`${inst.uid}:out`,from:node.id,to:oldTo,read:100,write:100,protocol:c.nodeKind==='queue'?'async':edge.protocol,config:{},policies:[]});}
     if(target?.kind==='queue'&&c.nodeKind==='worker'){
       const exits=g.edges.filter(e=>e.from===target.id);for(const e of exits)e.from=node.id;
       g.edges.push({id:`${inst.uid}:consume`,from:target.id,to:node.id,read:100,write:100,protocol:'async',config:{},policies:[]});
     }
   }else if(c.kind==='upgrade'||c.kind==='policy'){
     const node=g.nodes.find(n=>n.id===command.target),edge=g.edges.find(e=>e.id===command.target);
     if(node){node.upgrades.push(c.id);Object.assign(node.config,config);
       if(c.id==='replica'){
         const pos=freePosition(g,node.x,node.z);const replica={id:inst.uid,kind:node.kind,name:'Read Replica',...pos,config:{replica:1},upgrades:[]};
         const inbound=g.edges.filter(e=>e.to===node.id&&e.read>0);for(const e of inbound){const share=e.read*config.split/100;e.read-=share;g.edges.push({...clone(e),id:`${inst.uid}:${e.id}`,to:replica.id,read:share,write:0});}
         g.nodes.push(replica);g.edges.push({id:`${inst.uid}:replication`,from:node.id,to:replica.id,read:0,write:100,protocol:'replication',config:{},policies:[]});
       }
     }else if(edge){edge.policies.push(c.id);Object.assign(edge.config,config);}
   }else if(c.kind==='protocol'){const edge=g.edges.find(e=>e.id===command.target)!;edge.protocol=c.id==='grpc'?'gRPC':'WebSocket';}
   else if(c.id==='research'){
     const drawn=p.deck.splice(0,3);if(!drawn.length)throw new Error('O deck está vazio.');
     p.research=drawn;p.discard.push(inst);
   }else if(c.id==='refactor'){removeNode(p,command.target);p.discard.push(inst);}
   break;
 }
 case 'researchChoice':{const chosen=p.research?.find(c=>c.uid===command.uid);if(!chosen)throw new Error('Escolha uma das cartas pesquisadas.');if(p.hand.length>=ECONOMY.hand)throw new Error('Mão cheia.');p.hand.push(chosen);p.discard.push(...p.research!.filter(c=>c.uid!==chosen.uid));delete p.research;break;}
 case 'buy':{const c=market.find(c=>c.uid===command.uid);if(!c)throw new Error('Esta carta já saiu do mercado.');if(p.hand.length>=ECONOMY.hand)throw new Error('Mão cheia: limite de 7 cartas.');spend(p,CATALOG[c.cardId].acquisition);p.hand.push(clone(c));break;}
 case 'reserve':{const c=p.hand.find(c=>c.uid===command.uid);if(!c)throw new Error('Carta não está na mão.');if(p.backlog.length>=ECONOMY.backlog)throw new Error('Backlog cheio: limite de 3 cartas.');spend(p,1);p.hand=p.hand.filter(x=>x.uid!==c.uid);p.backlog.push(c);break;}
 case 'retrieve':{const c=p.backlog.find(c=>c.uid===command.uid);if(!c)throw new Error('Carta não está no backlog.');if(p.hand.length>=ECONOMY.hand)throw new Error('Mão cheia.');spend(p,0);p.backlog=p.backlog.filter(x=>x.uid!==c.uid);p.hand.push(c);break;}
 case 'configure':{
   const fields=configFields(g,command.target),config=validateConfig(command.config,fields);if(!Object.keys(config).length)throw new Error('Selecione um parâmetro.');spend(p,1);
   const n=g.nodes.find(n=>n.id===command.target),e=g.edges.find(e=>e.id===command.target);
   if(n)Object.assign(n.config,config);else if(e){if(config.read!==undefined)e.read=config.read;if(config.write!==undefined)e.write=config.write;const {read,write,...policies}=config;Object.assign(e.config,policies);}else throw new Error('Alvo ausente.');break;
 }
 case 'connect':{
   if(!canConnect(g,command.from,command.to))throw new Error('Conexão incompatível ou cíclica.');
   if(!['REST','SQL','async'].includes(command.protocol))throw new Error('Protocolo requer uma carta.');spend(p,1);
   g.edges.push({id:`edge:${p.id}:${g.edges.length}:${command.from}:${command.to}`,from:command.from,to:command.to,protocol:command.protocol,read:command.read,write:command.write,config:{},policies:[]});break;
 }
 case 'remove':{spend(p,3);const edge=g.edges.find(e=>e.id===command.target);if(edge)g.edges=g.edges.filter(e=>e.id!==edge.id);else removeNode(p,command.target);break;}
 case 'move':{const node=g.nodes.find(n=>n.id===command.target);if(!node)throw new Error('Alvo ausente.');if(!isPositionFree(g,command,node.id))throw new Error('Este espaço não comporta outro componente.');node.x=command.x;node.z=command.z;break;}
 case 'pass':p.actions=0;break;
 default:throw new Error('Tipo de comando desconhecido.');
 }
 validateGraph(g);return p;
}
export function draft(player:Player,market:CardInstance[],seed:string){let p=clone(player);const available=clone(market);for(const c of player.pending){p=applyCommand(p,c,available,seed);if(c.type==='buy'){const i=available.findIndex(x=>x.uid===c.uid);if(i>=0)available.splice(i,1);}}return p;}
