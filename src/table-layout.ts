import type {Graph} from '../packages/domain/types';

export const TABLE_NODE_GAP={x:3.55,z:3.15};
export const TABLE_LAYOUT_SCALE={x:1.18,z:1.16};
const TABLE_BOUNDS={x:8,z:5.8};

export function spreadTableGraph(graph:Graph):Graph{
 const center=graph.nodes.reduce((total,node)=>({x:total.x+node.x,z:total.z+node.z}),{x:0,z:0}),count=Math.max(1,graph.nodes.length);
 center.x/=count;center.z/=count;
 const nodes=graph.nodes.map(node=>({...node,x:center.x+(node.x-center.x)*TABLE_LAYOUT_SCALE.x,z:center.z+(node.z-center.z)*TABLE_LAYOUT_SCALE.z,config:{...node.config},upgrades:[...node.upgrades]}));
 for(let iteration=0;iteration<36;iteration++){
  let changed=false;
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
   const a=nodes[i],b=nodes[j],dx=b.x-a.x,dz=b.z-a.z;
   const overlapX=TABLE_NODE_GAP.x-Math.abs(dx),overlapZ=TABLE_NODE_GAP.z-Math.abs(dz);
   if(overlapX<=0||overlapZ<=0)continue;
   changed=true;
   if(overlapX/TABLE_NODE_GAP.x<=overlapZ/TABLE_NODE_GAP.z){
    const direction=dx===0?(a.id.localeCompare(b.id)<0?1:-1):Math.sign(dx),shift=overlapX/2+.01;
    a.x-=direction*shift;b.x+=direction*shift;
   }else{
    const direction=dz===0?(a.id.localeCompare(b.id)<0?1:-1):Math.sign(dz),shift=overlapZ/2+.01;
    a.z-=direction*shift;b.z+=direction*shift;
   }
  }
  for(const node of nodes){node.x=Math.max(-TABLE_BOUNDS.x,Math.min(TABLE_BOUNDS.x,node.x));node.z=Math.max(-TABLE_BOUNDS.z,Math.min(TABLE_BOUNDS.z,node.z));}
  if(!changed)break;
 }
 return {...graph,nodes,edges:graph.edges.map(edge=>({...edge,config:{...edge.config},policies:[...edge.policies]}))};
}
