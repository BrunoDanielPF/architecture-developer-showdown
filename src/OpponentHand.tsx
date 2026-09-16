import {useCallback,useEffect,useRef,useState} from 'react';
import {GitBranch,Lock} from 'lucide-react';
import type {PlayerView,PublicHandActivity} from '../packages/domain/types';
import './opponent-hand.css';

type Back={id:number;phase:'entering'|'steady'|'leaving'};
type Opponent=PlayerView['opponent'];
const motionLabel:Record<PublicHandActivity['kind'],string>={gain:'CARTA ENTROU',spend:'CARTA SAIU',prepare:'AÇÃO PREPARADA',shuffle:'MÃO REORGANIZADA'};
const announcement:Record<PublicHandActivity['kind'],string>={gain:'Uma carta entrou na mão adversária.',spend:'Uma carta saiu da mão adversária.',prepare:'O adversário preparou uma ação.',shuffle:'O adversário reorganizou a mão.'};

function reconcile(backs:Back[],count:number):Back[]{
 const active=backs.filter(back=>back.phase!=='leaving');
 if(count===active.length)return active.length===backs.length?backs:active;
 if(count<active.length)return [...active.slice(0,count),...active.slice(count).map(back=>({...back,phase:'leaving' as const}))];
 const first=Math.max(-1,...backs.map(back=>back.id))+1;
 return [...active,...Array.from({length:count-active.length},(_,index)=>({id:first+index,phase:'entering' as const}))];
}

export default function OpponentHand({opponent}:{opponent:Opponent}){
 const [backs,setBacks]=useState<Back[]>(()=>Array.from({length:opponent.handCount},(_,id)=>({id,phase:'steady'})));
 const [motion,setMotion]=useState<PublicHandActivity|null>(null);
 const seen=useRef(opponent.activity.at(-1)?.seq??0),queue=useRef<PublicHandActivity[]>([]),latestCount=useRef(opponent.handCount),processing=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const advance=useCallback(function next(){
  const event=queue.current.shift();
  if(!event){processing.current=false;setBacks(current=>reconcile(current,latestCount.current));setMotion(null);return;}
  processing.current=true;setMotion(event);setBacks(current=>reconcile(current,event.count));
  timer.current=setTimeout(next,470);
 },[]);
 useEffect(()=>{
  latestCount.current=opponent.handCount;
  const unseen=opponent.activity.filter(event=>event.seq>seen.current);
  if(unseen.length){seen.current=unseen.at(-1)!.seq;queue.current.push(...unseen);if(!processing.current)advance();}
  else if(!processing.current)setBacks(current=>reconcile(current,opponent.handCount));
 },[opponent.handCount,opponent.activity,advance]);
 useEffect(()=>{
  if(!backs.some(back=>back.phase==='entering'))return;
  const frame=requestAnimationFrame(()=>setBacks(current=>current.map(back=>back.phase==='entering'?{...back,phase:'steady'}:back)));
  return()=>cancelAnimationFrame(frame);
 },[backs]);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 const visible=backs.filter(back=>back.phase!=='leaving').length;
 return <section className={`opponent-hand ${opponent.locked?'opponent-hand-locked':''}`} aria-label={`Mão oculta de ${opponent.name}: ${visible} cartas`} data-opponent-hand data-opponent-count={visible} data-opponent-event-seq={motion?.seq??''} data-opponent-motion={motion?.kind??''}>
  <div className="opponent-hand-heading"><span className="opponent-hand-avatar">{opponent.name[0]}</span><span className="opponent-hand-name">{opponent.name}</span><span className="opponent-hand-count">{visible} {visible===1?'CARTA':'CARTAS'}</span>{opponent.locked&&<span className="opponent-hand-ready"><Lock size={11}/>PRONTO</span>}</div>
  <div className="opponent-hand-cards" aria-hidden="true">{backs.map((back,index)=>{
   const offset=index-(visible-1)/2;
   return <span key={back.id} className={`opponent-card-back ${back.phase}`} style={{'--opponent-angle':`${-offset*6.5}deg`,'--opponent-rise':`${-Math.abs(offset)*11}px`,'--opponent-order':String(20-Math.abs(offset))} as React.CSSProperties}><span className="opponent-card-corner">ADS / 01</span><span className="opponent-card-mark"><GitBranch size={38}/></span><span className="opponent-card-footer">ARQUITETURA OCULTA</span></span>;
  })}</div>
  <div className="opponent-hand-activity" key={motion?.seq??'idle'} aria-live="polite">{motion?<><span className="opponent-activity-dot"/>{motionLabel[motion.kind]}<span className="sr-only">{announcement[motion.kind]}</span></>:<span>{opponent.locked?'DECISÕES TRAVADAS':'CARTAS OCULTAS'}</span>}</div>
 </section>;
}
