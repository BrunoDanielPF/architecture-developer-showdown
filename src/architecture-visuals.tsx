import {RoundedBox,Line,Html} from '@react-three/drei';
import {useFrame} from '@react-three/fiber';
import {useMemo,useRef,useState} from 'react';
import * as THREE from 'three';
import type {Edge,Node} from '../packages/domain/types';
import {CATALOG} from '../packages/content/catalog';
import {edgeVisualEffects,nodeVisualModel,type EdgeVisualEffect,type NodeVisualEffect} from './architecture-visual-model';
import {attachmentDefinition,edgeAttachmentProgress,nodeAttachmentSlots,type ArchitectureAttachmentDefinition} from './architecture-attachment-model';
import {Icon} from './icons';

const effectColors:Record<NodeVisualEffect|string,string>={replication:'#b991ff',elasticity:'#65e7ef',zones:'#75a9ff',health:'#79e5a8',index:'#e9c56e',pool:'#6ed4ed',observability:'#70e1ff',idempotency:'#91dda8','dead-letter':'#ed8b76',locking:'#d6a8ff',identity:'#7eb9ff',tracing:'#f0b96f',timeout:'#f1b96c',retry:'#e5aa68',breaker:'#ed7c72','rate-limit':'#efc56d',firewall:'#69d3f0',compression:'#9ab7ff',bulkhead:'#c39aff',backpressure:'#e2ad65','secure-transport':'#71d9c6'};

function useReducedMotion(){return useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)[0];}

function ArchitectureAttachment({definition,position,active=false}:{definition:ArchitectureAttachmentDefinition;position:[number,number,number];active?:boolean}){
 const group=useRef<THREE.Group>(null),material=useRef<THREE.MeshStandardMaterial>(null),signal=useRef<THREE.Group>(null),reduced=useReducedMotion(),inline=definition.placement==='inline-gate';
 useFrame(({clock})=>{
  const wave=Math.sin(clock.elapsedTime*(active?4.2:2.1)+position[0]*.7);
  if(group.current)group.current.position.y=position[1]+(reduced?0:wave*.018);
  if(material.current)material.current.emissiveIntensity=(active ? .42 : .22)+(reduced?0:Math.max(0,wave)*.12);
  if(signal.current&&!reduced){if(definition.motion==='rotate')signal.current.rotation.y=clock.elapsedTime*1.6;signal.current.scale.setScalar(definition.motion==='pulse'?1+wave*.12:1);}
 });
 const label=CATALOG[definition.cardId]?.name??definition.shortLabel;
 return <group ref={group} position={position}>
  {inline&&<>{[-.34,.34].map(side=><mesh key={side} position={[side,.02,0]}><boxGeometry args={[.055,.34,.09]}/><meshStandardMaterial color={definition.color} emissive={definition.color} emissiveIntensity={.28}/></mesh>)}</>}
  <RoundedBox args={[.72,.16,.62]} radius={.075} castShadow><meshStandardMaterial ref={material} color="#102733" emissive={definition.color} emissiveIntensity={.24} metalness={.5} roughness={.32}/></RoundedBox>
  <group ref={signal}><mesh position={[0,.095,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.23,.255,24]}/><meshBasicMaterial color={definition.color} transparent opacity={active ? .85 : .55}/></mesh></group>
  <Html position={[0,.105,0]} transform rotation={[-Math.PI/2,0,0]} distanceFactor={8} center zIndexRange={[13,2]}>
   <div className="architecture-attachment-icon" data-architecture-attachment={definition.effect} data-attachment-card={definition.cardId} data-attachment-scope={definition.scope} data-attachment-placement={definition.placement} style={{'--attachment-color':definition.color} as React.CSSProperties} title={`${label} anexado à arquitetura`} aria-label={`${label} anexado à arquitetura`}>
    <Icon name={definition.cardId} size={15}/><small>{definition.shortLabel}</small>
   </div>
  </Html>
 </group>;
}

function InstanceUnit({x,z,color,index,elastic}:{x:number;z:number;color:string;index:number;elastic:boolean}){
 const group=useRef<THREE.Group>(null),material=useRef<THREE.MeshStandardMaterial>(null),reduced=useReducedMotion();
 useFrame(({clock})=>{if(reduced)return;const wave=Math.sin(clock.elapsedTime*2.2+index*.9);if(group.current)group.current.position.y=.31+wave*.025;if(material.current)material.current.emissiveIntensity=.16+Math.max(0,wave)*.14;});
 return <group ref={group} position={[x,.31,z]}>
  <RoundedBox args={[.5,.28,.52]} radius={.07} castShadow><meshStandardMaterial ref={material} color="#142c39" emissive={color} emissiveIntensity={.18} metalness={.42} roughness={.35}/></RoundedBox>
  <mesh position={[0,.16,.19]}><boxGeometry args={[.3,.025,.04]}/><meshBasicMaterial color={color}/></mesh>
  <mesh position={[-.16,.16,-.18]}><circleGeometry args={[.025,8]}/><meshBasicMaterial color={index%2?'#81efb0':'#b4fbff'}/></mesh>
  {elastic&&<mesh position={[0,.18,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.3,.32,24]}/><meshBasicMaterial color="#69e8ef" transparent opacity={.65}/></mesh>}
 </group>;
}

function BalancerCore({color}:{color:string}){
 const rotor=useRef<THREE.Group>(null),reduced=useReducedMotion();
 useFrame(({clock})=>{if(rotor.current&&!reduced)rotor.current.rotation.y=clock.elapsedTime*.75;});
 return <group ref={rotor} position={[0,.3,0]}>
  <mesh castShadow><cylinderGeometry args={[.32,.4,.24,12]}/><meshStandardMaterial color="#173443" emissive={color} emissiveIntensity={.18} metalness={.65} roughness={.28}/></mesh>
  {[0,Math.PI*2/3,Math.PI*4/3].map((angle,index)=><group key={index} rotation={[0,angle,0]}><mesh position={[.43,.03,0]}><boxGeometry args={[.45,.06,.07]}/><meshBasicMaterial color={color}/></mesh><mesh position={[.67,.03,0]}><sphereGeometry args={[.08,10,10]}/><meshBasicMaterial color="#b9fbff"/></mesh></group>)}
 </group>;
}

function DatabaseCore({color,replica}:{color:string;replica:boolean}){
 return <group position={[0,.3,0]}>
  {[0,.1,.2].map((y,index)=><mesh key={y} position={[0,y-.1,0]} castShadow><cylinderGeometry args={[.42,.42,.12,20]}/><meshStandardMaterial color={index===2?'#263b52':'#172b3a'} emissive={color} emissiveIntensity={replica?.24:.1} metalness={.45} roughness={.38}/></mesh>)}
  {replica&&<mesh position={[0,.28,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.24,.29,24]}/><meshBasicMaterial color="#c09cff"/></mesh>}
 </group>;
}

function GenericCore({color}:{color:string}){return <RoundedBox args={[.9,.32,.66]} radius={.09} position={[0,.3,0]} castShadow><meshStandardMaterial color="#17303d" emissive={color} emissiveIntensity={.12} metalness={.48} roughness={.4}/></RoundedBox>;}

function EffectGlyph({effect,index}:{effect:NodeVisualEffect;index:number}){
 const color=effectColors[effect],angle=(index/6)*Math.PI*2,x=Math.cos(angle)*.91,z=Math.sin(angle)*.62;
 const animated=useRef<THREE.Group>(null),reduced=useReducedMotion();
 useFrame(({clock})=>{if(!animated.current||reduced)return;const pulse=1+Math.sin(clock.elapsedTime*2.4+index)*.08;if(['health','observability','tracing','pool','idempotency'].includes(effect))animated.current.scale.setScalar(pulse);if(['pool','idempotency'].includes(effect))animated.current.rotation.y=clock.elapsedTime*.8;});
 if(effect==='zones')return <group ref={animated}>{[-1,1].map(side=><Line key={side} points={[[side*.97,.17,-.65],[side*.97,.54,-.65],[side*.97,.54,.65],[side*.97,.17,.65]]} color={color} lineWidth={1.2}/>)}</group>;
 if(effect==='observability'||effect==='tracing')return <group ref={animated}><mesh position={[0,.2,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.78,.82,36]}/><meshBasicMaterial color={color} transparent opacity={effect==='tracing'?.8:.46}/></mesh></group>;
 if(effect==='locking'||effect==='identity')return <group ref={animated} position={[x,.43,z]}><mesh><boxGeometry args={[.2,.2,.06]}/><meshStandardMaterial color="#162b39" emissive={color} emissiveIntensity={.35}/></mesh><mesh position={[0,.13,0]}><torusGeometry args={[.07,.018,6,12,Math.PI]}/><meshBasicMaterial color={color}/></mesh></group>;
 if(effect==='health')return <group ref={animated} position={[x,.43,z]}><mesh><sphereGeometry args={[.07,10,10]}/><meshBasicMaterial color={color}/></mesh><pointLight color={color} intensity={.35} distance={1.2}/></group>;
 if(effect==='index')return <group ref={animated} position={[x,.39,z]}>{[0,1,2].map(i=><mesh key={i} position={[0,i*.045,0]}><boxGeometry args={[.27,.025,.2]}/><meshBasicMaterial color={color}/></mesh>)}</group>;
 if(effect==='dead-letter')return <group ref={animated} position={[x,.36,z]}><mesh><boxGeometry args={[.3,.22,.26]}/><meshStandardMaterial color="#4b2525" emissive={color} emissiveIntensity={.25}/></mesh><mesh position={[0,.13,0]}><boxGeometry args={[.34,.035,.3]}/><meshBasicMaterial color={color}/></mesh></group>;
 return <group ref={animated} position={[x,.4,z]}><mesh><torusGeometry args={[.1,.025,7,14]}/><meshBasicMaterial color={color}/></mesh></group>;
}

function NodeAttachmentRack({effects,cluster,active}:{effects:NodeVisualEffect[];cluster:boolean;active:boolean}){
 const slots=nodeAttachmentSlots(effects.length,cluster);
 return <group>{effects.map((effect,index)=>{const slot=slots[index];return <ArchitectureAttachment key={effect} definition={attachmentDefinition(effect)} position={[slot.x,.53,slot.z]} active={active}/>;})}</group>;
}

export function NodeHardware({node,color,active=false}:{node:Node;color:string;active?:boolean}){
 const visual=nodeVisualModel(node),clusterCapable=['api','worker'].includes(node.kind);
 return <group>
  {visual.zones===2&&<RoundedBox args={[2.34,.08,1.74]} radius={.13} position={[0,.17,0]}><meshStandardMaterial color="#10243a" emissive="#6996ff" emissiveIntensity={.12} transparent opacity={.82}/></RoundedBox>}
  {clusterCapable&&visual.cluster?visual.instances.map((position,index)=><InstanceUnit key={index} {...position} color={color} index={index} elastic={visual.elastic}/>):node.kind==='balancer'?<BalancerCore color={color}/>:node.kind==='database'?<DatabaseCore color={color} replica={visual.role==='read-replica'}/>:<GenericCore color={color}/>}
  {visual.effects.filter(effect=>!['elasticity','replication'].includes(effect)).map((effect,index)=><EffectGlyph key={`${effect}-${index}`} effect={effect} index={index}/>)}
  <NodeAttachmentRack effects={visual.effects} cluster={visual.cluster} active={active}/>
  {visual.role==='primary'&&<mesh position={[.78,.4,-.48]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.08,.12,18]}/><meshBasicMaterial color="#bd92ff"/></mesh>}
 </group>;
}

type EdgePoint=[number,number,number];
function edgePath(points:EdgePoint[]){const path=new THREE.CurvePath<THREE.Vector3>();for(let index=1;index<points.length;index++){const start=new THREE.Vector3(...points[index-1]),end=new THREE.Vector3(...points[index]);if(start.distanceToSquared(end)>.0001)path.add(new THREE.LineCurve3(start,end));}return path;}

export function EdgePolicyHardware({edge,points,active=false}:{edge:Edge;points:EdgePoint[];active?:boolean}){
 const effects=edgeVisualEffects(edge.policies),key=points.map(point=>point.join(',')).join('|');
 const placements=useMemo(()=>{
  const path=edgePath(points),progress=edgeAttachmentProgress(effects.length);
  return effects.map((effect,index)=>{
   const definition=attachmentDefinition(effect),at=progress[index],point=path.getPoint(at),before=path.getPoint(Math.max(0,at-.015)),after=path.getPoint(Math.min(1,at+.015)),tangent=after.sub(before).normalize(),perpendicular=new THREE.Vector3(-tangent.z,0,tangent.x);
   const anchor=point.clone(),position=definition.placement==='sidecar'?point.addScaledVector(perpendicular,index%2?.56:-.56):point;
   position.y=.63;anchor.y=.54;
   return {definition,position:[position.x,position.y,position.z] as EdgePoint,anchor:[anchor.x,anchor.y,anchor.z] as EdgePoint};
  });
 },[effects.join('|'),key]);
 if(!effects.length)return null;
 return <group>{placements.map(({definition,position,anchor})=><group key={definition.effect}>
  {definition.placement==='sidecar'&&<Line points={[anchor,position]} color={definition.color} lineWidth={1.1} transparent opacity={.7}/>}<ArchitectureAttachment definition={definition} position={position} active={active}/>
 </group>)}</group>;
}
