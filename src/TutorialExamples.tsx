import {useState} from 'react';
import {ArrowRight,Check,Database,Hand,Layers,RotateCcw,Server,ShoppingCart,SlidersHorizontal,Zap} from 'lucide-react';
import {CATALOG} from '../packages/content/catalog';
import {ECONOMY} from '../packages/rules';
import './tutorial-examples.css';

function Resources({ec,actions,explain=false}:{ec:number;actions:number;explain?:boolean}){
 return <div className="example-resources">
  <div className="effort-meter"><span><Zap size={16}/> EC · esforço disponível</span><strong>{ec}<small> {ec===1?'ponto':'pontos'}</small></strong>{explain&&<p className="meter-explanation">Cada mudança tem seu custo em pontos de esforço.</p>}<div className="effort-pips" aria-hidden="true">{Array.from({length:ECONOMY.maxEC},(_,i)=><i key={i} className={i<ec?'available':''}/>)}</div></div>
  <div className="action-meter"><span><Hand size={16}/> Ações · jogadas restantes</span><strong>{actions}<small> de {ECONOMY.actions}</small></strong>{explain&&<p className="meter-explanation">Implantar uma carta usa uma jogada, mesmo que custe vários EC.</p>}<div className="action-pips" aria-hidden="true">{Array.from({length:ECONOMY.actions},(_,i)=><i key={i} className={i<actions?'available':''}>{i<actions?'Disponível':'Usada'}</i>)}</div></div>
 </div>;
}
function Cost({ec,actions=1}:{ec:number;actions?:number}){return <div className="example-cost"><span><Zap size={13}/>{ec} EC</span><span><Hand size={13}/>{actions} {actions===1?'ação':'ações'}</span></div>;}
export function EconomyExample(){
 const [mode,setMode]=useState<'normal'|'low'>('normal'),[step,setStep]=useState(0),[nextRound,setNextRound]=useState(false);
 const initial=mode==='normal'?ECONOMY.initialEC:2,spent=step===0?0:mode==='normal'?CATALOG.cache.ec+(step===2?1:0):step;
 const previousEC=initial-spent,ec=nextRound?Math.min(ECONOMY.maxEC,previousEC+ECONOMY.refreshEC):previousEC;
 const actions=nextRound?ECONOMY.actions:ECONOMY.actions-step;
 function reset(next=mode){setMode(next);setStep(0);setNextRound(false);}
 const feedback=nextRound?`Você guardou ${previousEC} EC e recebeu mais ${ECONOMY.refreshEC}: agora tem ${ec} EC. As ações voltaram para ${ECONOMY.actions}.`
  :mode==='low'?(step===0?'Há 2 ações, mas só 2 EC. O Cache custa 3 EC: falta 1 ponto de esforço. Você ainda pode fazer uma mudança de 1 EC.':step===1?'Ajustar gastou 1 EC e 1 ação. Sobrou 1 EC e 1 ação: você ainda pode fazer outro ajuste de 1 EC.':'Dois ajustes gastaram 2 EC e 2 ações. Agora o esforço e as jogadas acabaram.')
  :step===0?'Comece implantando o Cache: uma mudança de 3 pontos de esforço que usa uma jogada.'
  :step===1?'8 − 3 = 5 EC. Você fez uma jogada e ainda tem outra. Agora experimente ajustar a conexão.'
  :'5 − 1 = 4 EC. As duas ações foram usadas. Sobrou esforço, mas nenhuma jogada disponível nesta rodada.';
 return <section className="tutorial-example" aria-label="Exemplo interativo de EC e ações">
  <div className="example-heading"><span className="eyebrow">EXPERIMENTE · SEM AFETAR SUA PARTIDA</span><button className="text-button" onClick={()=>reset()}><RotateCcw size={14}/> Reiniciar exemplo</button></div>
  <div className="example-switch"><button aria-pressed={mode==='normal'} onClick={()=>reset('normal')}>EC sobra, ações acabam</button><button aria-pressed={mode==='low'} onClick={()=>reset('low')}>Há ações, mas falta EC</button></div>
  {mode==='low'&&<p className="example-context">Imagine uma rodada em que você só tem 2 EC disponíveis.</p>}
  <Resources ec={ec} actions={actions} explain/>
  <div className="example-moves">
   <button className="example-move" disabled={mode==='low'||step>0||nextRound} onClick={()=>setStep(1)}><Database size={24}/><strong>Implantar Cache</strong><small>Colocar esta carta no sistema</small><Cost ec={CATALOG.cache.ec}/>{mode==='low'?<em>{CATALOG.cache.ec-ec===1?'Falta':'Faltam'} {CATALOG.cache.ec-ec} EC</em>:step>0?<em><Check size={12}/> Implantado</em>:<em>Experimente esta jogada</em>}</button>
   <button className="example-move" disabled={(mode==='normal'?step!==1:step>=2)||nextRound} onClick={()=>setStep(s=>s+1)}><SlidersHorizontal size={24}/><strong>Ajustar conexão</strong><small>Mudar uma configuração</small><Cost ec={1}/><em>{nextRound?'Exemplo concluído':mode==='normal'&&step===0?'Primeiro, implante o Cache':step===2?'Ajuste preparado':'Experimente esta jogada'}</em></button>
  </div>
  <p className="example-feedback" role="status">{feedback}</p>
  {mode==='normal'&&step===2&&!nextRound&&<button className="secondary" onClick={()=>setNextRound(true)}>Simular próxima rodada <ArrowRight size={16}/></button>}
  {nextRound&&<p className="example-context">EC acumula até 12. Ações não acumulam: a rodada sempre começa com 2. Este botão apenas demonstra a reposição do exemplo.</p>}
 </section>;
}

export function BuildExample(){
 const [placed,setPlaced]=useState(false);
 return <section className="tutorial-example" aria-label="Exemplo visual de implantação">
  <div className="example-heading"><span className="eyebrow">VEJA A CARTA VIRAR PARTE DO SISTEMA</span><button className="text-button" onClick={()=>setPlaced(false)}><RotateCcw size={14}/> Reiniciar</button></div>
  <div className="example-architecture" aria-label={placed?'API conectada ao Cache, conectado ao Banco':'API conectada ao Banco, com encaixe para Cache'}><div className="architecture-node"><Server/><strong>API</strong><small>recebe pedidos</small></div><ArrowRight size={18}/><div className={`architecture-node ${placed?'cache-placed':'cache-slot'}`}><Database/><strong>{placed?'Cache':'Encaixe'}</strong><small>{placed?'carta implantada':'para o Cache'}</small></div><ArrowRight size={18}/><div className="architecture-node"><Database/><strong>Banco</strong><small>guarda os dados</small></div></div>
  <button className="example-deploy secondary" disabled={placed} onClick={()=>setPlaced(true)}><Layers size={18}/>{placed?'Cache colocado no caminho':'Colocar Cache no encaixe'}<Cost ec={CATALOG.cache.ec}/></button>
  <p className="example-feedback" role="status">{placed?'A carta saiu da mão e entrou na arquitetura. Leituras passam por esse caminho; o efeito depende da configuração e do tráfego.':'No jogo, selecione a carta, escolha um encaixe destacado e confirme a implantação. Aqui, o botão mostra essa mudança na mesa.'}</p>
  <p className="example-context">Um encaixe indica que a carta pode ser colocada ali. O resultado depende do contexto; este exemplo ensina a interação.</p>
 </section>;
}

export function MarketExample(){
 const [step,setStep]=useState(0),cache=CATALOG.cache;
 const ec=ECONOMY.initialEC-(step>=1?cache.acquisition:0)-(step===2?cache.ec:0);
 return <section className="tutorial-example" aria-label="Exemplo de comprar e implantar">
  <div className="example-heading"><span className="eyebrow">COMPRAR E IMPLANTAR SÃO DUAS JOGADAS</span><button className="text-button" onClick={()=>setStep(0)}><RotateCcw size={14}/> Reiniciar compra</button></div>
  <Resources ec={ec} actions={ECONOMY.actions-step}/>
  <div className="card-journey">{[{label:'Mercado',Icon:ShoppingCart},{label:'Sua mão',Icon:Hand},{label:'Arquitetura',Icon:Server}].map(({label,Icon},i)=><div key={label} className={i===step?'current':''}><span><Icon size={16}/>{label}</span><div className="journey-slot">{i===step?<div className="mini-cache"><Database size={22}/><strong>Cache</strong></div>:<span>{i<step?'A carta saiu daqui':'Aguardando carta'}</span>}</div>{i<2&&<ArrowRight className="journey-arrow" size={18}/>}</div>)}</div>
  <button className="secondary" disabled={step===2} onClick={()=>setStep(s=>s+1)}>{step===0?'1. Comprar Cache':step===1?'2. Implantar Cache':'Compra e implantação concluídas'}{step<2&&<Cost ec={step===0?cache.acquisition:cache.ec}/>}</button>
  <p className="example-feedback" role="status">{step===0?'A carta está no mercado. Comprar custa 1 EC e 1 ação e leva a carta para sua mão.':step===1?'A carta está na sua mão, ainda sem efeito no sistema. Para colocá-la na arquitetura, pague mais 3 EC e use a outra ação.':'Você gastou 4 EC no total e usou as 2 ações. O Cache agora faz parte do sistema. Se já estivesse na sua mão, bastaria pagar a implantação.'}</p>
 </section>;
}

export function BudgetExample(){
 return <div className="budget-example"><strong>E o valor em $ na carta?</strong><p>É o custo mensal para manter o componente funcionando. O <b>orçamento (budget)</b> é o limite de custo mensal do sistema.</p><div><span><Zap size={16}/><b>{CATALOG.cache.ec} EC</b><small>esforço para implantar o Cache</small></span><span><Hand size={16}/><b>1 ação</b><small>uma jogada da rodada</small></span><span><Database size={16}/><b>+${CATALOG.cache.infra}/mês</b><small>custo base para manter o Cache</small></span></div><p>EC e ações são consumidos ao implantar. O custo mensal passa a compor a operação do sistema. Exceder o orçamento é permitido, mas prejudica a eficiência de custo no resultado final.</p></div>;
}
