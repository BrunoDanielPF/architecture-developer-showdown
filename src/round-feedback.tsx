import type {PlayerView, Telemetry, World} from '../packages/domain/types';

const number=(value:number)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(value);
export function metricChange(value:number|undefined,previous:number|undefined){
 if(value===undefined||previous===undefined)return null;
 const delta=Math.round((value-previous)*10)/10;
 return {delta,direction:delta>0?'up':delta<0?'down':'same',symbol:delta>0?'↑':delta<0?'↓':'→'};
}
export function MetricTrend({value,previous,unit='',lower=true}:{value?:number;previous?:number;unit?:string;lower?:boolean}){
 const change=metricChange(value,previous);
 if(!change)return <span className="metric-trend neutral">— primeira medição</span>;
 const {delta,symbol}=change,good=lower?delta<0:delta>0;
 return <span className={`metric-trend ${delta===0?'neutral':good?'improved':'worsened'}`} title={`Antes: ${number(previous!)} ${unit}; agora: ${number(value!)} ${unit}`}>
  {symbol} {delta===0?'sem mudança':`${number(Math.abs(delta))} ${unit} · ${delta>0?'subiu':'caiu'}`}
 </span>;
}
const worldFields:{key:keyof World;label:string;unit:string;scale?:number}[]=[
 {key:'reads',label:'Leituras',unit:'/s'},{key:'writes',label:'Pedidos',unit:'/s'},
 {key:'updateRate',label:'Taxa de atualização',unit:''},{key:'hot',label:'Acesso concentrado',unit:'%',scale:100},
 {key:'paymentMs',label:'Tempo do pagamento',unit:'ms'},{key:'paymentError',label:'Falhas no pagamento',unit:'%',scale:100},
 {key:'attack',label:'Tráfego de ataque',unit:'/s'},{key:'regionMs',label:'Latência regional',unit:'ms'},
 {key:'failure',label:'Falha de capacidade',unit:'%',scale:100},{key:'budget',label:'Orçamento mensal',unit:'$'},
 {key:'slo',label:'Meta de latência',unit:'ms'},{key:'completionSlo',label:'Prazo de conclusão',unit:'s'},
];
export function WorldChanges({view}:{view:PlayerView}){
 if(!view.previousWorld||view.round===0)return null;
 const changes=worldFields.filter(f=>view.world[f.key]!==view.previousWorld![f.key]);
 return <section className="world-changes"><h3>O que mudou neste contexto</h3>{changes.length?changes.map(f=>{
  const before=Number(view.previousWorld![f.key])*(f.scale??1),after=Number(view.world[f.key])*(f.scale??1);
  return <p key={f.key}><strong>{after>before?'↑':'↓'} {f.label}</strong><span>{number(before)} → {number(after)} {f.unit}</span></p>;
 }):<p>As condições numéricas anteriores continuam.</p>}</section>;
}
const metrics:{key:keyof Pick<Telemetry,'p95'|'errorRate'|'throughput'|'cost'>;label:string;unit:string;lower:boolean}[]=[
 {key:'p95',label:'Latência',unit:'ms',lower:true},{key:'errorRate',label:'Erros',unit:'p.p.',lower:true},
 {key:'throughput',label:'Vazão',unit:'req/s',lower:false},{key:'cost',label:'Custo mensal',unit:'$',lower:true},
];
export function RoundResult({view}:{view:PlayerView}){
 const latest=view.measurements?.at(-1),before=view.measurements?.at(-2);
 if(!latest||latest.round===0)return <p className="round-baseline">Primeira rodada: as métricas acima são da loja inicial. O resultado aparece após a simulação.</p>;
 const t=latest.telemetry;
 return <section className="round-result" aria-label={`Resultado da rodada ${latest.round}`}>
  <h3>Rodada {latest.round} resolvida</h3><p>{view.revealed[latest.round-1]?.title}</p>
  <small>Comparação com {before?.round?`a rodada ${before.round}`:'a loja inicial'}. Inclui o cenário e as decisões aplicadas.</small>
  <div className="result-changes">{metrics.map(m=><div key={m.key}><strong>{m.label}</strong><MetricTrend value={t[m.key]} previous={before?.telemetry[m.key]} unit={m.unit} lower={m.lower}/></div>)}</div>
  <p>{t.observed?(t.incidents?.map(i=>`${i.type}: ${i.detail}`).join(' ')||'Sem incidentes detectados nesta medição.'):'Tempos e erros refletem a experiência dos usuários. Adicione instrumentação para investigar os componentes.'}</p>
  {t.diagnostic&&<details><summary>Investigar causas</summary>{t.traces?.map((trace,i)=><p key={i}>{trace}</p>)}</details>}
 </section>;
}
