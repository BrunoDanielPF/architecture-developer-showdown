import {Canvas, useThree, useFrame} from '@react-three/fiber';
import {Html, Line, OrbitControls, RoundedBox} from '@react-three/drei';
import {Suspense, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import * as THREE from 'three';
import type {Graph, Target, Telemetry} from '../packages/domain/types';
import {slots} from '../packages/rules';
import {Icon} from './icons';
import {CATALOG} from '../packages/content/catalog';
import {protocolInfo} from './protocols';
import {spreadTableGraph} from './table-layout';
const cameraOptions={position:[0,27,15.5] as [number,number,number],zoom:40,near:.1,far:100};
const colors:Record<string,string>={client:'#b4c5d4',api:'#69b8cc',database:'#b498eb',payment:'#e8b365',cache:'#b498eb',queue:'#e8b365',worker:'#69b8cc',balancer:'#69b8cc',cdn:'#b498eb',storage:'#b498eb'};
const kindLabels:Record<string,string>={client:'ENTRADA',api:'SERVIÇO',database:'DADOS',payment:'PAGAMENTO',cache:'CACHE',queue:'FILA',worker:'PROCESSAMENTO',balancer:'DISTRIBUIÇÃO',cdn:'ENTREGA',storage:'ARMAZENAMENTO'};
type Props={focusArchitecture?:boolean;market?:ReactNode[];scenario?:ReactNode;graph:Graph;targets:Target[];selected?:string;onTarget:(id:string)=>void;onInspect:(id:string)=>void;telemetry?:Partial<Telemetry>;showActivity?:boolean;resetKey?:string};
type ArchitectureModuleProps={node:Graph['nodes'][number];color:string;valid:boolean;hot:boolean;utilization?:number;events:{onClick:(e:React.MouseEvent)=>void;onDragOver:(e:React.DragEvent)=>void;onDrop:(e:React.DragEvent)=>void}};
function TrafficPacket({points}:{points:[number,number,number][]}){
 const mesh=useRef<THREE.Mesh>(null),[reduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 const path=useMemo(()=>{const p=new THREE.CurvePath<THREE.Vector3>();for(let i=1;i<points.length;i++)p.add(new THREE.LineCurve3(new THREE.Vector3(...points[i-1]),new THREE.Vector3(...points[i])));return p;},[JSON.stringify(points)]);
 useFrame(({clock})=>{if(mesh.current)mesh.current.position.copy(path.getPoint((clock.elapsedTime*.35)%1)).add(new THREE.Vector3(0,.09,0));});
 return reduced?null:<mesh ref={mesh}><sphereGeometry args={[.09,8,8]}/><meshBasicMaterial color="#b4fbff"/></mesh>;
}
function PerimeterRail(){
 const horizontal=useMemo(()=>Array.from({length:12},(_,i)=>-12.65+i*2.3),[]);
 const vertical=useMemo(()=>Array.from({length:8},(_,i)=>-6.7+i*2),[]);
 return <group>
   {[-8.05,11.45].flatMap(z=>horizontal.map((x,i)=><group key={`h-${z}-${i}`} position={[x,.72,z]}>
     <mesh castShadow><cylinderGeometry args={[.055,.075,.72,7]}/><meshStandardMaterial color="#9ba6a2" metalness={.8} roughness={.28}/></mesh>
     <mesh position={[1.15,.22,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.035,.035,2.3,7]}/><meshStandardMaterial color="#889793" metalness={.75}/></mesh>
   </group>))}
   {[-13.8,13.8].flatMap(x=>vertical.map((z,i)=><group key={`v-${x}-${i}`} position={[x,.72,z+1.7]}>
     <mesh castShadow><cylinderGeometry args={[.055,.075,.72,7]}/><meshStandardMaterial color="#9ba6a2" metalness={.8} roughness={.28}/></mesh>
     <mesh position={[0,.22,1]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.035,.035,2,7]}/><meshStandardMaterial color="#889793" metalness={.75}/></mesh>
   </group>))}
 </group>;
}
function City(){
 const buildings=useMemo(()=>Array.from({length:16},(_,i)=>({x:-13.2+i*1.76,z:i%2?-9.8:-10.7,h:1.15+(i*7%5)*.5,w:.9+(i%3)*.18})),[]);
 const trees=useMemo(()=>[-6.1,-3.9,-1.7,.5,2.7,4.9,7.1],[]);
 return <group>
   <mesh receiveShadow position={[0,-.82,1.5]}><boxGeometry args={[37,.3,31]}/><meshStandardMaterial color="#080f1d" roughness={1}/></mesh>
   {buildings.map((b,i)=><group key={i} position={[b.x,-.65,b.z]}>
     <mesh castShadow position={[0,b.h/2,0]}><boxGeometry args={[b.w,b.h,1.2]}/><meshStandardMaterial color={['#3f5b56','#6c7770','#303f48','#526863'][i%4]} roughness={.9}/></mesh>
     <mesh position={[0,b.h+.03,0]}><boxGeometry args={[b.w+.09,.1,1.29]}/><meshStandardMaterial color="#8c9691"/></mesh>
     {Array.from({length:3},(_,k)=><mesh key={k} position={[-.24+k*.24,b.h*.62,.61]}><boxGeometry args={[.1,.28,.025]}/><meshStandardMaterial color="#ffd783" emissive="#ffc85e" emissiveIntensity={.7}/></mesh>)}
   </group>)}
   {[-1,1].flatMap(side=>trees.map((z,i)=><group key={`${side}-${i}`} position={[side*15,-.65,z+1.4]}>
      <mesh castShadow position={[0,.38,0]}><cylinderGeometry args={[.06,.1,.76,6]}/><meshStandardMaterial color="#7a5b3d"/></mesh>
      <mesh castShadow position={[0,1.06,0]}><icosahedronGeometry args={[.62,0]}/><meshStandardMaterial color={i%2?'#365e50':'#53765b'} roughness={.85}/></mesh>
   </group>))}
   <PerimeterRail/>
 </group>;
}
function BoardMarkings(){
 const zone=(x:number,z:number,w:number,h:number,color:string)=><Line points={[[x-w/2,.455,z-h/2],[x+w/2,.455,z-h/2],[x+w/2,.455,z+h/2],[x-w/2,.455,z+h/2],[x-w/2,.455,z-h/2]]} color={color} lineWidth={1.4} dashed dashSize={.18} gapSize={.13}/>;
 return <group>
   {zone(-4.7,.5,7.7,11.4,'#2f8d96')}{zone(4.7,.5,7.7,11.4,'#2f8d96')}
   {zone(0,.5,17.3,13.3,'#265d70')}
   <Line points={[[-8.65,.456,-2.25],[8.65,.456,-2.25]]} color="#244b5c" lineWidth={1}/>
   <Line points={[[0,.456,-6.15],[0,.456,7.15]]} color="#244b5c" lineWidth={1}/>
   {[-6.9,-2.3,2.3,6.9].map(x=><mesh key={x} position={[x,.47,7.38]}><boxGeometry args={[.09,.035,.34]}/><meshBasicMaterial color="#63dce4"/></mesh>)}
   {[-6.9,-2.3,2.3,6.9].map(x=><mesh key={`b-${x}`} position={[x,.47,-6.38]}><boxGeometry args={[.09,.035,.34]}/><meshBasicMaterial color="#63dce4"/></mesh>)}
 </group>;
}
function ArchitectureModule({node,color,valid,hot,utilization,events}:ArchitectureModuleProps){
 const statusColor=valid?'#f1c66d':hot?'#e77f6d':color;
 return <group position={[node.x,.5,node.z]}>
   <RoundedBox args={[2.2,.38,1.62]} radius={.15} castShadow receiveShadow>
     <meshStandardMaterial color="#102a37" emissive={statusColor} emissiveIntensity={valid?.2:.055} metalness={.48} roughness={.42}/>
   </RoundedBox>
   <mesh position={[0,.06,.814]} castShadow><boxGeometry args={[1.5,.075,.035]}/><meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={valid?.85:.45} metalness={.35} roughness={.3}/></mesh>
   <mesh position={[-1.105,.01,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.08,.08,.08,12]}/><meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={.35}/></mesh>
   <mesh position={[1.105,.01,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.08,.08,.08,12]}/><meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={.35}/></mesh>
   <Html position={[0,.205,0]} transform rotation={[-Math.PI/2,0,0]} distanceFactor={5} center zIndexRange={[12,1]}><button data-target={node.id} data-node={node.kind} className={`node-label ${valid?'valid':''} ${hot?'saturated':''}`} style={{'--node-color':statusColor} as React.CSSProperties} {...events} aria-label={`Componente ${node.name}`}>
     <Icon name={node.kind} size={24}/><strong>{node.name}</strong><span className="node-kind">{kindLabels[node.kind]??'COMPONENTE'}</span>
     {node.config.instances>1&&<span className="instances">×{node.config.instances}</span>}
     {node.upgrades.length>0&&<div className="node-upgrades">{node.upgrades.map(c=><span key={c} title={CATALOG[c]?.name}><Icon name={c} size={11}/></span>)}</div>}
     {hot&&utilization!==undefined&&<small>{Math.round(utilization*100)}% carga</small>}
   </button></Html>
 </group>;
}
function Scene({graph,targets,onTarget,onInspect,telemetry,showActivity,selected,resetKey,market=[],scenario,resetControl,focusArchitecture}:Props&{resetControl:{current:(()=>void)|null}}){
 const controls=useRef<any>(null);const {camera,size}=useThree();const tableGraph=useMemo(()=>spreadTableGraph(graph),[graph]);
 useEffect(()=>{
  const resetCamera=()=>{
   const orbit=controls.current;
   if(orbit){orbit.enableDamping=false;orbit.update();}
   camera.position.set(0,27,15.5);camera.lookAt(0,0,1.6);
   if(camera instanceof THREE.OrthographicCamera){camera.zoom=focusArchitecture?Math.min(size.width/14,size.height/11.5):Math.min(size.width/29,size.height/22.4);camera.updateProjectionMatrix();}
   orbit?.target.set(0,0,1.6);orbit?.update();
   if(orbit)orbit.enableDamping=true;
  };
  resetControl.current=resetCamera;resetCamera();
  return()=>{resetControl.current=null;};
 },[resetKey,camera,size.width,size.height,resetControl,focusArchitecture]);

 const ids=new Set(targets.map(t=>t.id));
 function targetEvents(id:string){return {onClick:(e:React.MouseEvent)=>{e.stopPropagation();if(ids.has(id))onTarget(id);else if(!selected)onInspect(id);},onDragOver:(e:React.DragEvent)=>{if(ids.has(id)){e.preventDefault();e.dataTransfer.dropEffect='move';}},onDrop:(e:React.DragEvent)=>{e.preventDefault();e.stopPropagation();if(ids.has(id))onTarget(id);}};}
 return <>
   <color attach="background" args={['#070d1b']}/><fog attach="fog" args={['#070d1b',31,58]}/>
   <ambientLight intensity={.82}/><hemisphereLight args={['#bfe9ee','#17272b',1.2]}/><directionalLight castShadow position={[-9,17,7]} intensity={2.25} color="#ffe4b5" shadow-mapSize={[2048,2048]} shadow-camera-left={-18} shadow-camera-right={18} shadow-camera-top={18} shadow-camera-bottom={-18}/>
   <pointLight position={[-12,4,8]} color="#42e8f4" intensity={16} distance={9}/><pointLight position={[12,4,8]} color="#42e8f4" intensity={16} distance={9}/>
   <City/>
   <RoundedBox args={[28.4,.9,21.6]} radius={.32} position={[0,-.28,1.7]} receiveShadow castShadow><meshStandardMaterial color="#1b2d3e" roughness={.78}/></RoundedBox>
   <RoundedBox args={[28,.18,21.2]} radius={.25} position={[0,.18,1.7]}><meshStandardMaterial color="#668196" metalness={.72} roughness={.3}/></RoundedBox>
   <RoundedBox args={[27.35,.16,20.55]} radius={.21} position={[0,.31,1.7]} receiveShadow><meshStandardMaterial color="#101d28" roughness={.91}/></RoundedBox>
   {[-12.9,12.9].flatMap(x=>[-7.15,10.55].map(z=><group key={`${x}-${z}`} position={[x,.52,z]}><mesh><cylinderGeometry args={[.11,.11,.08,10]}/><meshStandardMaterial color="#7eeaf0" emissive="#31dce8" emissiveIntensity={1.2} metalness={.5}/></mesh><pointLight position={[0,.22,0]} color="#35eaf2" intensity={2.2} distance={2.8}/></group>))}
   <group position={[.9,.28,1.7]}><gridHelper args={[19,19,'#2d6072','#1d3c4c']} position={[0,.17,0]} scale={[1,1,.68]}/><BoardMarkings/>
   <Html position={[0,.47,-6.8]} transform rotation={[-Math.PI/2,0,0]} distanceFactor={9} center zIndexRange={[3,0]}><div className="board-wordmark">FLASHCART <span> / ARCHITECTURE LAB</span></div></Html>
   {tableGraph.edges.map(e=>{
     const a=tableGraph.nodes.find(n=>n.id===e.from)!,b=tableGraph.nodes.find(n=>n.id===e.to)!;
     const points:[number,number,number][]=[[a.x,.47,a.z],[a.x+(b.x-a.x)*.5,.47,a.z],[a.x+(b.x-a.x)*.5,.47,b.z],[b.x,.47,b.z]];
     const info=protocolInfo(e.protocol);
     const direction=new THREE.Vector3(b.x-a.x,0,b.x===a.x?b.z-a.z:0).normalize();
     const arrowRotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
     const color=ids.has(e.id)?'#ffd38b':e.protocol==='async'?'#d7a866':'#679ca9';
     return <group key={e.id}>
       <Line points={points} color={color} lineWidth={ids.has(e.id)?4:2.4} dashed={e.protocol==='async'} dashSize={.16} gapSize={.1}/>
       {showActivity&&<TrafficPacket points={points}/>}
       <mesh position={[b.x-direction.x*.95,.49,b.z-direction.z*.95]} quaternion={arrowRotation}><coneGeometry args={[.10,.25,3]}/><meshBasicMaterial color={color}/></mesh>
       <Html position={[(a.x+b.x)/2,.7,(a.z+b.z)/2]} center zIndexRange={[10,0]}><button data-target={e.id} className={`edge-label ${ids.has(e.id)?'valid':''}`} {...targetEvents(e.id)} title={`${info.name}: ${info.description} ${a.name} → ${b.name}`} aria-label={`${info.name}: ${a.name} para ${b.name}. ${info.description}`}>
         <strong>{info.name}</strong><span>→</span><span className="edge-description">{info.description}</span>{e.read!==100||e.write!==100?<small>R {Math.round(e.read)} · W {Math.round(e.write)}</small>:null}
         {e.policies.length>0&&<i>{e.policies.map(c=>CATALOG[c]?.name).join(' · ')}</i>}
       </button></Html>
     </group>;
   })}
   {tableGraph.nodes.map(n=>{const metric=telemetry?.nodes?.find(m=>m.id===n.id);return <ArchitectureModule key={n.id} node={n} color={colors[n.kind]} valid={ids.has(n.id)} hot={Boolean(showActivity&&metric&&metric.utilization>1)} utilization={metric?.utilization} events={targetEvents(n.id)}/>;})}
   {slots.filter(s=>ids.has(s.id)).map(s=><group key={s.id} position={[s.x,.5,s.z]}><mesh rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.3,.34,24]}/><meshBasicMaterial color="#e5bd7a" transparent opacity={.55}/></mesh><Html center position={[0,.15,0]} zIndexRange={[8,0]}><button data-target={s.id} className="slot-target" {...targetEvents(s.id)} aria-label={`Espaço ${Number(s.id.split(':')[1])+1}`}>+</button></Html></group>)}
   </group>
   {market.map((card,i)=><group key={i} position={[10.25,.57,-3.8+i*1.95]} rotation={[0,-.12,0]}>
     <RoundedBox args={[2.35,.1,2.8]} radius={.07} castShadow><meshStandardMaterial color="#6889a2" metalness={.5}/></RoundedBox>
     <Html transform rotation={[-Math.PI/2,0,0]} position={[0,.06,0]} distanceFactor={5} zIndexRange={[17,10]} center>{card}</Html>
   </group>)}
   {scenario&&<group position={[-10.25,.67,5.15]} rotation={[0,.12,0]}>{[0,1,2,3].map(i=><RoundedBox key={i} args={[2.8,.09,3.7]} radius={.07} position={[i*.05,i*.1,0]} castShadow><meshStandardMaterial color={i===3?'#49c7d0':'#315368'}/></RoundedBox>)}<Html transform rotation={[-Math.PI/2,0,0]} position={[.15,.36,0]} distanceFactor={6} center zIndexRange={[16,12]}>{scenario}</Html></group>}
   {market.length>0&&<Html position={[10.25,.62,-5.72]} center zIndexRange={[9,1]}><div className="table-zone-label">MERCADO <span>COMPARTILHADO</span></div></Html>}
   <OrbitControls ref={controls} makeDefault enableRotate={false} minPolarAngle={.3} maxPolarAngle={1.05} minZoom={12} maxZoom={85} maxAzimuthAngle={.5} minAzimuthAngle={-.5} enablePan screenSpacePanning={false} panSpeed={.8} mouseButtons={{LEFT:THREE.MOUSE.PAN,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN}} touches={{ONE:THREE.TOUCH.PAN,TWO:THREE.TOUCH.DOLLY_PAN}}/>
 </>;
}
export default function Table(props:Props){
 const resetControl=useRef<(()=>void)|null>(null);
 return <div className="table-viewport" data-testid="table-3d" onDragOver={e=>e.preventDefault()}>
   <Canvas shadows orthographic camera={cameraOptions} dpr={[1,1.7]} gl={{antialias:true}} fallback={<p>Este navegador precisa de WebGL para exibir a mesa 3D.</p>}><Suspense fallback={null}><Scene {...props} resetControl={resetControl}/></Suspense></Canvas>
   <div className="table-controls"><span>Arraste um espaço vazio para mover · use a roda para zoom</span><button className="text-button" onClick={()=>resetControl.current?.()}>Centralizar mesa</button></div>
 </div>;
}
