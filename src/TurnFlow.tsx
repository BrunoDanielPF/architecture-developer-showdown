import {useEffect,useState} from 'react';
import {Check,Flag,Lock,Radio,Timer,GitBranch} from 'lucide-react';
import type {PlayerView} from '../packages/domain/types';
import './turn-flow.css';
import {MetricTrend} from './round-feedback';

export default function TurnFlow({view}:{view:PlayerView}){
 const [countdown,setCountdown]=useState({key:'',seconds:0});
 const remaining=view.clock?(countdown.key===view.clock.key?countdown.seconds:Math.max(0,Math.ceil((view.clock.deadline-view.clock.serverNow)/1000))):0;
 const [announce,setAnnounce]=useState(true);
 const [settled,setSettled]=useState(false);
 const key=`${view.round}:${view.phase}`;
 useEffect(()=>{
  if(!view.clock)return;
  const clock=view.clock,received=performance.now();
  const update=()=>setCountdown({key:clock.key,seconds:Math.max(0,Math.ceil((clock.deadline-clock.serverNow-(performance.now()-received))/1000))});
  update();const timer=setInterval(update,100);return()=>clearInterval(timer);
 },[view.clock?.deadline,view.clock?.serverNow]);
 useEffect(()=>{setAnnounce(true);setSettled(false);const stage=setTimeout(()=>setSettled(true),1000);return()=>clearTimeout(stage);},[key]);
 const telemetry=view.phase==='telemetry',showdown=view.phase==='showdown',setup=view.phase==='setup';
 const title=setup?'Prepare sua mão':showdown?'Arquiteturas reveladas':telemetry?`Rodada ${view.round} · simulação concluída`:view.phase==='adjustment'?'Ajuste de mercado':`Rodada ${view.round} · novo contexto`;
 const activeStage=setup?-1:telemetry?(settled?4:3):view.player.locked?2:settled?1:0;
 const status=(locked:boolean)=>locked?'PRONTO':setup?'PREPARANDO':telemetry?'OBSERVANDO':'PLANEJANDO';
 return <>
  <aside className={`round-rail ${remaining<=10&&view.clock&&!telemetry?'urgent':''}`} aria-label="Progresso da partida">
   <div className="rail-heading"><GitBranch size={16}/><span>RODADAS</span></div>
   <ol>{[1,2,3,4,5,6].map(n=>{
    const active=showdown?n===6:n===view.round,done=showdown?n<6:n<view.round;
    return <li key={n} className={`${active?'active':''} ${done?'done':''}`} aria-current={active?'step':undefined}>
     <span className="rail-node">{n===6?<Flag size={17}/>:n}</span>
     <span className="rail-label">{n===6?'SHOWDOWN':active?'EM CURSO':done?'RESOLVIDA':`RODADA ${n}`}</span>
    </li>;
   })}</ol>
   <div className="round-clock" role="timer" aria-label={view.clock?`${remaining} segundos restantes`:'Sem cronômetro'}>
    <Timer size={16}/><strong>{view.clock?String(remaining).padStart(2,'0'):showdown?'✓':'—'}</strong><small>{showdown?'CONCLUÍDO':telemetry?'PRÓXIMA':setup?'PREPARO':'SEGUNDOS'}</small>
    <div className="clock-track"><i style={{transform:`scaleX(${view.clock?remaining/(view.clock.duration/1000):0})`}}/></div>
   </div>
  </aside>
  {!showdown&&<section className="sync-dock" aria-label="Estado dos jogadores">
   <div className="sync-phase"><Radio size={14}/>{telemetry?'LEITURA DE TELEMETRIA':setup?'PREPARAÇÃO LIVRE':view.phase==='adjustment'?'REPLANEJAMENTO':'PLANEJAMENTO SIMULTÂNEO'}</div>
   <div className="sync-players">{[{name:view.player.name,locked:view.player.locked},{...view.opponent}].map((p,i)=><div key={i} className={p.locked?'ready':'working'}><span className="sync-port">{p.locked?<Check size={12}/>:<i/>}</span><strong>{p.name}</strong><small>{status(p.locked)}</small></div>)}</div>
   <div className="phase-circuit" aria-label="Etapas da rodada">{['Cenário','Planejar','Sincronizar','Simular','Telemetria'].map((label,i)=><span key={label} className={i===activeStage?'active':i<activeStage?'done':''}>{label}</span>)}</div>
   {!setup&&<button className="text-button recap-button" onClick={()=>setAnnounce(true)}>Rever {telemetry?"resultado":"contexto"}</button>}<p>{view.player.locked?`Aguardando ${view.opponent.name}. Sua mesa continua privada.`:telemetry?'Próximo contexto em 8s, ou quando ambos continuarem.':setup?'Cada jogador prepara sua mão na própria sessão.':'Ao zerar, as jogadas preparadas são confirmadas e o EC restante é preservado.'}</p>
  </section>}
  {announce&&!setup&&<div key={key} className={`phase-reveal ${telemetry?'resolved':''}`} role="status"><span>{showdown?<Flag/>:telemetry?<Check/>:<GitBranch/>}</span><div><small>{showdown?'SHOWDOWN':telemetry?'GRAFOS PROCESSADOS':`SCENARIO DECK / 0${view.round}`}</small><strong>{telemetry||showdown?title:view.revealed.at(-1)?.title}</strong><p>{telemetry?'A rodada foi simulada. Veja abaixo o que mudou; o resultado também fica salvo no painel do contexto.':view.revealed.at(-1)?.description}</p>{!telemetry&&!showdown&&<p>{view.revealed.at(-1)?.signals.join(' · ')}</p>}{telemetry&&<div className="result-changes">{([{key:'p95',label:'Latência',unit:'ms',lower:true},{key:'errorRate',label:'Erros',unit:'p.p.',lower:true},{key:'throughput',label:'Vazão',unit:'req/s',lower:false},{key:'cost',label:'Custo mensal',unit:'$',lower:true}] as const).map(m=><div key={m.key}><b>{m.label}</b><MetricTrend value={view.player.telemetry[m.key]} previous={view.measurements?.at(-2)?.telemetry[m.key]} unit={m.unit} lower={m.lower}/></div>)}</div>}<button className="secondary" onClick={()=>setAnnounce(false)}>Entendi · ver tabuleiro</button></div></div>}
 </>;
}
