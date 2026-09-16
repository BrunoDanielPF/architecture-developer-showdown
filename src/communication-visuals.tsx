import {Line} from '@react-three/drei';
import {useFrame} from '@react-three/fiber';
import {useMemo,useRef,useState} from 'react';
import * as THREE from 'three';
import type {Edge,Graph} from '../packages/domain/types';
import {edgeVisualModel} from './architecture-visual-model';
import {communicationVisualModel,type CommunicationVisualModel} from './communication-visual-model';

type Point=[number,number,number];
type FlowProps={points:Point[];model:CommunicationVisualModel;active:boolean;offset:number};

function useReducedMotion(){return useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)[0];}
function route(points:Point[]){const path=new THREE.CurvePath<THREE.Vector3>();for(let index=1;index<points.length;index++){const start=new THREE.Vector3(...points[index-1]),end=new THREE.Vector3(...points[index]);if(start.distanceToSquared(end)>.0001)path.add(new THREE.LineCurve3(start,end));}return path;}
function useRoute(points:Point[]){return useMemo(()=>route(points),[points.map(point=>point.join(',')).join('|')]);}
function place(mesh:THREE.Object3D|null,path:THREE.Curve<THREE.Vector3>,progress:number,visible=true,y=.08){if(!mesh)return;mesh.visible=visible;if(visible){path.getPoint(THREE.MathUtils.clamp(progress,0,1),mesh.position);mesh.position.y+=y;}}

function RequestResponseFlow({points,model,active,offset}:FlowProps){
 const request=useRef<THREE.Mesh>(null),response=useRef<THREE.Mesh>(null),waiting=useRef<THREE.Mesh>(null),processing=useRef<THREE.Mesh>(null),path=useRoute(points),reduced=useReducedMotion();
 useFrame(({clock})=>{
  const phase=reduced?.72:(clock.elapsedTime*model.speed*(active?1.55:.72)+offset)%1;
  place(request.current,path,phase/.43,phase<.43);place(response.current,path,1-(phase-.62)/.38,phase>=.62);
  const waitingOn=phase<.62;if(waiting.current){waiting.current.visible=waitingOn;path.getPoint(0,waiting.current.position);waiting.current.position.y+=.09;waiting.current.scale.setScalar(1+(reduced?0:Math.sin(clock.elapsedTime*5)*.12));}
  const processingOn=phase>=.43&&phase<.62;if(processing.current){processing.current.visible=processingOn;path.getPoint(1,processing.current.position);processing.current.position.y+=.09;processing.current.scale.setScalar(.85+(reduced?0:Math.sin(clock.elapsedTime*8)*.18));}
 });
 const sql=model.mode==='query-result';
 return <group>
  <mesh ref={request}>{sql?<boxGeometry args={[.19,.11,.14]}/>:<sphereGeometry args={[.095,9,9]}/>}<meshBasicMaterial color={model.requestColor}/></mesh>
  <mesh ref={response}>{sql?<boxGeometry args={[.27,.12,.18]}/>:<octahedronGeometry args={[.105,0]}/>}<meshBasicMaterial color={model.responseColor}/></mesh>
  <mesh ref={waiting} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.17,.205,24]}/><meshBasicMaterial color={model.requestColor} transparent opacity={.58}/></mesh>
  <mesh ref={processing} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.2,.255,24]}/><meshBasicMaterial color={model.responseColor} transparent opacity={.78}/></mesh>
 </group>;
}

export function GrpcStreamFlow({points,model,active,offset}:FlowProps){
 const requests=useRef<Array<THREE.Mesh|null>>([]),responses=useRef<Array<THREE.Mesh|null>>([]),path=useRoute(points),reduced=useReducedMotion();
 useFrame(({clock})=>{for(let index=0;index<model.density;index++){const phase=reduced?(index+.3)/model.density:(clock.elapsedTime*model.speed*(active?1.5:.75)+offset+index/model.density)%1;place(requests.current[index],path,phase/.46,phase<.46,.08);place(responses.current[index],path,1-(phase-.46)/.54,phase>=.46,.13);}});
 return <group>{Array.from({length:model.density},(_,index)=><group key={index}>
  <mesh ref={mesh=>{requests.current[index]=mesh}}><boxGeometry args={[.16,.075,.09]}/><meshBasicMaterial color={model.requestColor}/></mesh>
  <mesh ref={mesh=>{responses.current[index]=mesh}}><boxGeometry args={[.16,.075,.09]}/><meshBasicMaterial color={model.responseColor}/></mesh>
 </group>)}</group>;
}

export function PersistentDuplexFlow({points,model,active,offset}:FlowProps){
 const outbound=useRef<Array<THREE.Mesh|null>>([]),inbound=useRef<Array<THREE.Mesh|null>>([]),path=useRoute(points),reduced=useReducedMotion();
 useFrame(({clock})=>{for(let index=0;index<2;index++){const phase=reduced?(index?.72:.28):(clock.elapsedTime*model.speed*(active?1.45:.72)+offset+index*.5)%1;place(outbound.current[index],path,phase,true,.08);place(inbound.current[index],path,1-phase,true,.16);}});
 return <group>
  <Line points={points.map(([x,y,z])=>[x,y+.035,z] as Point)} color={model.requestColor} lineWidth={1.15} transparent opacity={.48}/>
  <Line points={points.map(([x,y,z])=>[x,y+.115,z] as Point)} color={model.responseColor} lineWidth={1.15} transparent opacity={.45}/>
  {[0,1].map(index=><group key={index}><mesh ref={mesh=>{outbound.current[index]=mesh}}><sphereGeometry args={[.075,8,8]}/><meshBasicMaterial color={model.requestColor}/></mesh><mesh ref={mesh=>{inbound.current[index]=mesh}}><sphereGeometry args={[.075,8,8]}/><meshBasicMaterial color={model.responseColor}/></mesh></group>)}
 </group>;
}

export function QueueFlow({points,model,active,offset}:FlowProps){
 const events=useRef<Array<THREE.Mesh|null>>([]),ack=useRef<THREE.Mesh>(null),pulse=useRef<THREE.Mesh>(null),path=useRoute(points),reduced=useReducedMotion(),consume=model.mode==='consume';
 useFrame(({clock})=>{
  const base=reduced?.58:(clock.elapsedTime*model.speed*(active?1.55:.72)+offset)%1;
  for(let index=0;index<model.density;index++)place(events.current[index],path,(base+index/model.density)%1,true,.09);
  place(ack.current,path,1-(base-.72)/.28,!consume&&base>=.72,.15);
  if(pulse.current){pulse.current.visible=!consume&&base>.62;path.getPoint(1,pulse.current.position);pulse.current.position.y+=.09;pulse.current.scale.setScalar(.8+(reduced?0:Math.sin(clock.elapsedTime*7)*.18));}
 });
 return <group>{Array.from({length:model.density},(_,index)=><mesh key={index} ref={mesh=>{events.current[index]=mesh}}><boxGeometry args={[.16,.12,.16]}/><meshBasicMaterial color={model.requestColor}/></mesh>)}
  {!consume&&<><mesh ref={ack}><octahedronGeometry args={[.07,0]}/><meshBasicMaterial color={model.responseColor}/></mesh><mesh ref={pulse} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.2,.25,20]}/><meshBasicMaterial color={model.requestColor} transparent opacity={.7}/></mesh></>}
 </group>;
}

export function ReplicationFlow({points,model,active,offset}:FlowProps){
 const logs=useRef<Array<THREE.Mesh|null>>([]),lag=useRef<THREE.Mesh>(null),path=useRoute(points),reduced=useReducedMotion();
 useFrame(({clock})=>{for(let index=0;index<model.density;index++){const phase=reduced?(index+.45)/model.density:(clock.elapsedTime*model.speed*(active?1.55:.72)+offset+index/model.density)%1;place(logs.current[index],path,phase,true,.1);}if(lag.current){path.getPoint(.78,lag.current.position);lag.current.position.y+=.1;lag.current.scale.setScalar(.9+(reduced?0:Math.sin(clock.elapsedTime*3.2)*.14));}});
 return <group>{Array.from({length:model.density},(_,index)=><mesh key={index} ref={mesh=>{logs.current[index]=mesh}}><boxGeometry args={[.13,.08,.2]}/><meshBasicMaterial color={model.requestColor}/></mesh>)}<mesh ref={lag} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.15,.18,20]}/><meshBasicMaterial color={model.requestColor} transparent opacity={.35}/></mesh></group>;
}

function CommunicationLane(props:FlowProps){
 if(props.model.mode==='multiplexed-request-response')return <GrpcStreamFlow {...props}/>;
 if(props.model.mode==='persistent-duplex')return <PersistentDuplexFlow {...props}/>;
 if(props.model.mode==='enqueue'||props.model.mode==='consume')return <QueueFlow {...props}/>;
 if(props.model.mode==='replication')return <ReplicationFlow {...props}/>;
 return <RequestResponseFlow {...props}/>;
}

function balancedRoutes(edge:Edge,graph:Graph,points:Point[]){
 const visual=edgeVisualModel(edge,graph),target=graph.nodes.find(node=>node.id===edge.to);
 if(!visual.balanced||!target)return [points];
 const source=points[0],branch=points[Math.max(1,points.length-2)];
 return visual.laneOffsets.map(offset=>[source,[branch[0],.5,source[2]] as Point,[branch[0],.5,target.z+offset.z] as Point,[target.x+offset.x,.5,target.z+offset.z] as Point]);
}

export function CommunicationFlow({edge,graph,points,active,color}:{edge:Edge;graph:Graph;points:Point[];active:boolean;color:string}){
 const model=communicationVisualModel(edge,graph),routes=balancedRoutes(edge,graph,points),balanced=routes.length>1;
 return <group>{routes.map((lane,index)=><group key={index}>
  {balanced&&<Line points={lane} color={color} lineWidth={1.2} transparent opacity={.52}/>}<CommunicationLane points={lane} model={model} active={active} offset={index/routes.length}/>
 </group>)}</group>;
}
