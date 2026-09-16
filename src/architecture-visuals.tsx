import {RoundedBox,Line} from '@react-three/drei';
import {useFrame} from '@react-three/fiber';
import {useMemo,useRef,useState} from 'react';
import * as THREE from 'three';
import type {Edge,Graph,Node} from '../packages/domain/types';
import {edgeVisualEffects,edgeVisualModel,nodeVisualModel,type EdgeVisualEffect,type NodeVisualEffect} from './architecture-visual-model';

const effectColors:Record<NodeVisualEffect|string,string>={replication:'#b991ff',elasticity:'#65e7ef',zones:'#75a9ff',health:'#79e5a8',index:'#e9c56e',pool:'#6ed4ed',observability:'#70e1ff',idempotency:'#91dda8','dead-letter':'#ed8b76',locking:'#d6a8ff',identity:'#7eb9ff',tracing:'#f0b96f',timeout:'#f1b96c',retry:'#e5aa68',breaker:'#ed7c72','rate-limit':'#efc56d',firewall:'#69d3f0',compression:'#9ab7ff',bulkhead:'#c39aff',backpressure:'#e2ad65','secure-transport':'#71d9c6'};

function useReducedMotion(){return useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)[0];}

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

export function NodeHardware({node,color}:{node:Node;color:string}){
 const visual=nodeVisualModel(node),clusterCapable=['api','worker'].includes(node.kind);
 return <group>
  {visual.zones===2&&<RoundedBox args={[2.34,.08,1.74]} radius={.13} position={[0,.17,0]}><meshStandardMaterial color="#10243a" emissive="#6996ff" emissiveIntensity={.12} transparent opacity={.82}/></RoundedBox>}
  {clusterCapable&&visual.cluster?visual.instances.map((position,index)=><InstanceUnit key={index} {...position} color={color} index={index} elastic={visual.elastic}/>):node.kind==='balancer'?<BalancerCore color={color}/>:node.kind==='database'?<DatabaseCore color={color} replica={visual.role==='read-replica'}/>:<GenericCore color={color}/>}
  {visual.effects.filter(effect=>!['elasticity','replication'].includes(effect)).map((effect,index)=><EffectGlyph key={`${effect}-${index}`} effect={effect} index={index}/>)}
  {visual.role==='primary'&&<mesh position={[.78,.4,-.48]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.08,.12,18]}/><meshBasicMaterial color="#bd92ff"/></mesh>}
 </group>;
}

function PolicyGate({effect,index}:{effect:EdgeVisualEffect;index:number}){
 const color=effectColors[effect],x=(index-1)*.26;
 const animated=useRef<THREE.Group>(null),reduced=useReducedMotion();
 useFrame(({clock})=>{if(!animated.current||reduced)return;const wave=Math.sin(clock.elapsedTime*2.6+index);if(effect==='retry')animated.current.rotation.y=clock.elapsedTime*1.2;if(effect==='breaker')animated.current.rotation.z=-.45+Math.max(0,wave)*.22;if(['rate-limit','firewall','secure-transport','backpressure'].includes(effect))animated.current.scale.setScalar(1+wave*.07);});
 if(effect==='breaker')return <group ref={animated} position={[x,.17,0]} rotation={[0,0,-.45]}><mesh><boxGeometry args={[.34,.05,.06]}/><meshBasicMaterial color={color}/></mesh></group>;
 if(effect==='bulkhead')return <group ref={animated} position={[x,.15,0]}>{[-.07,.07].map(z=><mesh key={z} position={[0,0,z]}><boxGeometry args={[.05,.28,.05]}/><meshBasicMaterial color={color}/></mesh>)}</group>;
 if(effect==='firewall'||effect==='secure-transport')return <group ref={animated} position={[x,.17,0]}><mesh><octahedronGeometry args={[.14,0]}/><meshStandardMaterial color="#173342" emissive={color} emissiveIntensity={.55}/></mesh></group>;
 return <group ref={animated} position={[x,.17,0]} rotation={[Math.PI/2,0,0]}><mesh><torusGeometry args={[.1,.025,7,14]}/><meshBasicMaterial color={color}/></mesh></group>;
}

export function EdgePolicyHardware({edge,position}:{edge:Edge;position:[number,number,number]}){
 const effects=edgeVisualEffects(edge.policies);
 if(!effects.length)return null;return <group position={position}>{effects.slice(0,3).map((effect,index)=><PolicyGate key={effect} effect={effect} index={index}/>)}</group>;
}

function FlowPacket({points,offset,color}:{points:[number,number,number][];offset:number;color:string}){
 const mesh=useRef<THREE.Mesh>(null),reduced=useReducedMotion(),path=useMemo(()=>new THREE.CatmullRomCurve3(points.map(point=>new THREE.Vector3(...point))),[JSON.stringify(points)]);
 useFrame(({clock})=>{if(mesh.current&&!reduced)mesh.current.position.copy(path.getPoint((clock.elapsedTime*.42+offset)%1));});
 return reduced?null:<mesh ref={mesh}><sphereGeometry args={[.07,8,8]}/><meshBasicMaterial color={color}/></mesh>;
}

export function BalancedTraffic({edge,graph,color}:{edge:Edge;graph:Graph;color:string}){
 const source=graph.nodes.find(node=>node.id===edge.from),target=graph.nodes.find(node=>node.id===edge.to),visual=edgeVisualModel(edge,graph);
 if(!source||!target||!visual.balanced)return null;
 return <group>{visual.laneOffsets.map((offset,index)=>{const endX=target.x+offset.x,endZ=target.z+offset.z,points:[[number,number,number],[number,number,number],[number,number,number]]=[[source.x,.51,source.z],[source.x+(target.x-source.x)*.58,.51,source.z+(target.z-source.z)*.58],[endX,.51,endZ]];return <group key={index}><Line points={points} color={color} lineWidth={1.15} transparent opacity={.48}/><FlowPacket points={points} offset={index/visual.laneCount} color="#c1fbff"/></group>;})}</group>;
}
