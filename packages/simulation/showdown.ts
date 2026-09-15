import { clone, random } from '../domain/random';
import type { Category, Match, Telemetry, World } from '../domain/types';
import { emptyRuntime, simulate } from './index';
const rounded=(n:number)=>Math.round(n*100)/100;
export function runShowdown(match:Match){
 const rng=random(`${match.seed}:showdown`),base=match.worldState.world;
 const specs:{id:string;name:string;description:string;unit:string;lower:boolean;world:World;value:(t:Telemetry,w:World)=>number}[]=[
  {id:'performance',name:'Performance',description:'Rampa de carga: latência e requisições efetivamente atendidas.',unit:'pontos',lower:false,world:{...base,reads:2000+Math.floor(rng()*600),writes:200,attack:50,paymentMs:500,paymentError:.02,failure:0},value:(t,w)=>Math.min(100,(t.throughput/(w.reads+w.writes))*100*Math.min(1,w.slo/Math.max(t.p95,1)))},
  {id:'availability',name:'Disponibilidade',description:'Interrupção de zona: quanto da jornada permanece disponível?',unit:'%',lower:false,world:{...base,reads:1000,writes:100,attack:40,paymentMs:500,paymentError:.04,failure:.18+Math.floor(rng()*8)/100},value:t=>t.availability},
  {id:'security',name:'Segurança',description:'Tráfego hostil cruza os caminhos reais; rejeitar compradores também pesa.',unit:'pontos',lower:false,world:{...base,reads:1300,writes:120,attack:1800+Math.floor(rng()*700),failure:0,paymentMs:500,paymentError:.02},value:(t,w)=>t.security*(t.throughput/(w.reads+w.writes))},
  {id:'consistency',name:'Consistência',description:'Escritas concorrentes, atualizações e duplicidade sob tentativas repetidas.',unit:'pontos',lower:false,world:{...base,reads:900,writes:220,hot:.9,updateRate:.13,attack:20,failure:0,paymentMs:800,paymentError:.12},value:t=>t.consistency*(.55+.45*t.completion/100)},
  {id:'cost',name:'Custo',description:'Custo mensal por mil operações atendidas em 30 dias, com penalidade por exceder o orçamento.',unit:'$/1k ops',lower:true,world:{...base,reads:1300,writes:150,attack:40,failure:0,paymentMs:600,paymentError:.03},value:(t,w)=>t.cost/(Math.max(t.throughput,1)*30*24*60*60)*1000*Math.max(1,t.cost/w.budget)},
  {id:'resilience',name:'Resiliência',description:'Dependência lenta: aceitação, conclusão, backlog e recuperação após o pico.',unit:'pontos',lower:false,world:{...base,reads:1000,writes:160,attack:80,failure:.04,paymentMs:4000+Math.floor(rng()*1000),paymentError:.3},value:(t,w)=>(t.completion*.65+t.availability*.35)*Math.min(1,w.slo/Math.max(t.p95,1))}
 ];
 const categories:Category[]=specs.map(spec=>{
   const ts=match.players.map(p=>{
     // Every architecture gets identical warm-up, three test windows and recovery; no mutated official graph.
     let rt=emptyRuntime();rt=simulate(p.graph,{...spec.world,reads:400,writes:40},rt,`${match.seed}:${spec.id}:warm`).runtime;
     const windows:Telemetry[]=[];for(let i=0;i<3;i++){const result=simulate(p.graph,{...spec.world,reads:spec.world.reads*(.65+i*.175),...(spec.id==='security'?{attackKind:i}:{})},rt,`${match.seed}:${spec.id}:${i}`);rt=result.runtime;windows.push(result.telemetry);}
     const t=clone(windows[2]);if(spec.id==='security'){t.security=windows.reduce((sum,w)=>sum+w.security,0)/3;t.throughput=windows.reduce((sum,w)=>sum+w.throughput,0)/3;t.traces.push('Suíte de segurança: padrões maliciosos, abuso de credenciais e operações privilegiadas. A nota combina as três janelas.');}
     if(spec.id==='resilience'){const recovery=simulate(p.graph,{...spec.world,reads:500,writes:70,paymentMs:400,paymentError:.02,failure:0},rt,`${match.seed}:recovery`).telemetry;t.completion=(t.completion+recovery.completion)/2;t.traces.push(`Recuperação: ${recovery.completion}% dos pedidos concluídos; ${recovery.backlog} tarefas restantes.`);}
     t.traces.unshift(`Carga comum: ${spec.world.reads} leituras/s, ${spec.world.writes} escritas/s, ${spec.world.attack} tentativas suspeitas/s.`);
     return t;
   }) as [Telemetry,Telemetry];
   const values=ts.map(t=>spec.id==='cost'?Math.round(spec.value(t,spec.world)*1e8)/1e8:rounded(spec.value(t,spec.world))) as [number,number];
   const delta=values[0]-values[1],winner=Math.abs(delta)<(spec.id==='cost'?1e-8:.01)?null:spec.lower?(delta<0?0:1):(delta>0?0:1);
   return {id:spec.id,name:spec.name,description:spec.description,unit:spec.unit,lower:spec.lower,values,winner,telemetry:ts,details:ts.map(t=>t.traces) as [string[],string[]]};
 });
 const wins:[number,number]=[0,0];categories.forEach(c=>{if(c.winner!==null)wins[c.winner]++;});
 const tieBreak:[number,number]=[0,0];categories.forEach(c=>{const max=Math.max(...c.values,1e-12);for(let p=0;p<2;p++)tieBreak[p]+=c.lower?1-c.values[p]/max:c.values[p]/max;});
 const difference=tieBreak[0]-tieBreak[1];
 return {categories,wins,tieBreak,winner:wins[0]===wins[1]?(Math.abs(difference)<.0001?null:difference>0?0:1):wins[0]>wins[1]?0:1,graphs:match.players.map(p=>clone(p.graph)) as [typeof match.players[0]['graph'],typeof match.players[1]['graph']]};
}
