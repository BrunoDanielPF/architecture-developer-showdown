import type {Graph} from '../packages/domain/types';

export const TABLE_NODE_GAP={x:3.8,z:3.35};
export const TABLE_LAYOUT_SCALE={x:1.24,z:1.22};
export const SHOWDOWN_NODE_GAP={x:4.25,z:3.75};
export const SHOWDOWN_LAYOUT_SCALE={x:1.36,z:1.32};
const TABLE_BOUNDS={x:8.3,z:6.1};
const SHOWDOWN_BOUNDS={x:10.2,z:7.2};

export function spreadTableGraph(graph:Graph,showdown=false):Graph{
 const gap=showdown?SHOWDOWN_NODE_GAP:TABLE_NODE_GAP,scale=showdown?SHOWDOWN_LAYOUT_SCALE:TABLE_LAYOUT_SCALE,bounds=showdown?SHOWDOWN_BOUNDS:TABLE_BOUNDS;
 const center=graph.nodes.reduce((total,node)=>({x:total.x+node.x,z:total.z+node.z}),{x:0,z:0}),count=Math.max(1,graph.nodes.length);
 center.x/=count;center.z/=count;
 const nodes=graph.nodes.map(node=>({...node,x:center.x+(node.x-center.x)*scale.x,z:center.z+(node.z-center.z)*scale.z,config:{...node.config},upgrades:[...node.upgrades]}));
 for(let iteration=0;iteration<36;iteration++){
  let changed=false;
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
   const a=nodes[i],b=nodes[j],dx=b.x-a.x,dz=b.z-a.z;
   const overlapX=gap.x-Math.abs(dx),overlapZ=gap.z-Math.abs(dz);
   if(overlapX<=0||overlapZ<=0)continue;
   changed=true;
   if(overlapX/gap.x<=overlapZ/gap.z){
    const direction=dx===0?(a.id.localeCompare(b.id)<0?1:-1):Math.sign(dx),shift=overlapX/2+.01;
    a.x-=direction*shift;b.x+=direction*shift;
   }else{
    const direction=dz===0?(a.id.localeCompare(b.id)<0?1:-1):Math.sign(dz),shift=overlapZ/2+.01;
    a.z-=direction*shift;b.z+=direction*shift;
   }
  }
  for(const node of nodes){node.x=Math.max(-bounds.x,Math.min(bounds.x,node.x));node.z=Math.max(-bounds.z,Math.min(bounds.z,node.z));}
  if(!changed)break;
 }
 return {...graph,nodes,edges:graph.edges.map(edge=>({...edge,config:{...edge.config},policies:[...edge.policies]}))};
}
