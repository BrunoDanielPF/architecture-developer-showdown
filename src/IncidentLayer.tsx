import {Line} from '@react-three/drei';
import {useFrame} from '@react-three/fiber';
import {useMemo,useRef,useState} from 'react';
import * as THREE from 'three';
import type {Graph,Incident} from '../packages/domain/types';

const severityColor=(incident:Incident)=>incident.phase==='recovered'?'#7ee0b5':incident.severity==='critical'?'#ff6f61':'#ffc96b';
const order=(incident:Incident)=>(incident.phase==='recovered'?2:incident.severity==='critical'?0:1);
export const prioritizeIncidents=(incidents:Incident[],limit=4)=>[...incidents].sort((a,b)=>order(a)-order(b)||a.id.localeCompare(b.id)).slice(0,limit);

function PulseMarker({position,incident}:{position:[number,number,number];incident:Incident}){
 const group=useRef<THREE.Group>(null),color=severityColor(incident),[reduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 useFrame(({clock})=>{if(!group.current||reduced)return;const pulse=1+Math.sin(clock.elapsedTime*5)*.1;group.current.scale.setScalar(pulse);group.current.rotation.y=clock.elapsedTime*.45;});
 return <group ref={group} position={position}>
  <mesh rotation={[-Math.PI/2,0,0]}><torusGeometry args={[.72,.055,10,36]}/><meshBasicMaterial color={color} transparent opacity={.9}/></mesh>
  <mesh position={[0,.22,0]}><octahedronGeometry args={[.16,0]}/><meshBasicMaterial color={color}/></mesh>
  {!reduced&&<pointLight color={color} intensity={2.4} distance={3.4}/>}
 </group>;
}

function QueueBacklog({position,incident}:{position:[number,number,number];incident:Incident}){
 const group=useRef<THREE.Group>(null),[reduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),color=severityColor(incident);
 useFrame(({clock})=>{if(group.current&&!reduced)group.current.position.y=.88+Math.sin(clock.elapsedTime*3)*.07;});
 return <group ref={group} position={position}>{[0,1,2,3].map(i=><mesh key={i} position={[-.42+i*.28,i*.13,0]}><boxGeometry args={[.22,.16,.38]}/><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.45}/></mesh>)}<PulseMarker position={[0,0,0]} incident={incident}/></group>;
}

function CacheStampede({position,incident}:{position:[number,number,number];incident:Incident}){
 const group=useRef<THREE.Group>(null),[reduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),color=severityColor(incident);
 useFrame(({clock})=>{if(group.current&&!reduced)group.current.rotation.y=-clock.elapsedTime*1.8;});
 return <group ref={group} position={position}>{Array.from({length:6},(_,i)=>{const angle=i/6*Math.PI*2;return <mesh key={i} position={[Math.cos(angle)*(.55+i*.035),.18+(i%2)*.15,Math.sin(angle)*(.55+i*.035)]}><sphereGeometry args={[.09,8,8]}/><meshBasicMaterial color={color}/></mesh>;})}<PulseMarker position={[0,0,0]} incident={incident}/></group>;
}

function ConnectionExhaustion({position,incident}:{position:[number,number,number];incident:Incident}){
 const group=useRef<THREE.Group>(null),[reduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),color=severityColor(incident);
 useFrame(({clock})=>{if(group.current&&!reduced){group.current.rotation.z=clock.elapsedTime*1.7;group.current.position.y=.95+Math.sin(clock.elapsedTime*4)*.05;}});
 return <group ref={group} position={position}><mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[.46,.1,8,12]}/><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.7}/></mesh>{Array.from({length:4},(_,i)=><mesh key={i} rotation={[0,0,i*Math.PI/2]} position={[Math.cos(i*Math.PI/2)*.7,0,Math.sin(i*Math.PI/2)*.7]}><boxGeometry args={[.18,.18,.18]}/><meshBasicMaterial color={color}/></mesh>)}<PulseMarker position={[0,0,0]} incident={incident}/></group>;
}

function RetryPacket({from,to,offset,color,reduced}:{from:THREE.Vector3;to:THREE.Vector3;offset:number;color:string;reduced:boolean}){
 const mesh=useRef<THREE.Mesh>(null);
 useFrame(({clock})=>{if(!mesh.current||reduced)return;const progress=(clock.elapsedTime*.7+offset)%1;mesh.current.position.lerpVectors(to,from,progress);mesh.current.position.y+=.2+Math.sin(progress*Math.PI)*.35;});
 const resting=to.clone().lerp(from,offset);
 return <mesh ref={mesh} position={resting}><sphereGeometry args={[.11,8,8]}/><meshBasicMaterial color={color}/></mesh>;
}

function RetryStorm({from,to,incident}:{from:[number,number,number];to:[number,number,number];incident:Incident}){
 const color=severityColor(incident),[reduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),a=useMemo(()=>new THREE.Vector3(...from),[from.join(':')]),b=useMemo(()=>new THREE.Vector3(...to),[to.join(':')]);
 return <group><Line points={[from,to]} color={color} lineWidth={4} dashed dashSize={.18} gapSize={.12}/>{[0,.33,.66].map(offset=><RetryPacket key={offset} from={a} to={b} offset={offset} color={color} reduced={reduced}/>)}</group>;
}

export default function IncidentLayer({graph,incidents}:{graph:Graph;incidents:Incident[]}){
 return <group>{prioritizeIncidents(incidents).map(value=>{
  const node=graph.nodes.find(item=>item.id===value.nodeId),edge=value.locus.type==='edge'?graph.edges.find(item=>item.id===value.locus.id):undefined;
  const from=edge&&graph.nodes.find(item=>item.id===edge.from),to=edge&&graph.nodes.find(item=>item.id===edge.to);
  if(value.kind==='retry_storm'&&from&&to)return <RetryStorm key={value.id} incident={value} from={[from.x,.92,from.z]} to={[to.x,.92,to.z]}/>;
  if(!node)return null;const position:[number,number,number]=[node.x,.88,node.z];
  if(value.kind==='queue_backlog')return <QueueBacklog key={value.id} position={position} incident={value}/>;
  if(value.kind==='cache_stampede')return <CacheStampede key={value.id} position={position} incident={value}/>;
  if(value.kind==='connection_exhaustion')return <ConnectionExhaustion key={value.id} position={position} incident={value}/>;
  return <PulseMarker key={value.id} position={position} incident={value}/>;
 })}</group>;
}

export function IncidentDock({incidents}:{incidents:Incident[]}){
 const visible=prioritizeIncidents(incidents,3);if(!visible.length)return null;
 return <section className="incident-dock" aria-label="Incidentes observados" aria-live="polite">
  <div className="incident-dock-heading"><span>INCIDENTES OBSERVADOS</span><b>{incidents.filter(value=>value.phase!=='recovered').length}</b></div>
  {visible.map(value=><article key={value.id} className={`${value.severity} ${value.phase}`} data-incident-kind={value.kind}>
   <i/><div><strong>{value.phase==='recovered'?`${value.type} recuperado`:value.type}</strong><small>{value.detail}</small></div><span>{value.phase==='recovered'?'RECUPERADO':value.severity==='critical'?'CRÍTICO':'ATENÇÃO'}</span>
  </article>)}
  {incidents.length>visible.length&&<small className="incident-more">+{incidents.length-visible.length} ocorrências nesta medição</small>}
 </section>;
}
