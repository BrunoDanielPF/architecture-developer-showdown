import type {Match} from '../packages/domain/types';
import {dispatch} from '../packages/session';

export type RoundClock={key:string;deadline:number;duration:number};
export const clockKey=(m:Match)=>`${m.round}:${m.phase}`;
export function startClock(m:Match,now:number):RoundClock|undefined{
 const duration=m.phase==='planning'||m.phase==='adjustment'?45000:m.phase==='telemetry'?8000:0;
 return duration?{key:clockKey(m),deadline:now+duration,duration}:undefined;
}
// The wall clock lives in the transport. Replay contains only deterministic game commands.
export function expirePhase(input:Match):Match{
 let m=input;const phase=m.phase;
 for(const player of [0,1]){
  if(m.phase!==phase)break;
  if(m.players[player].locked)continue;
  if(phase==='planning'||phase==='adjustment'){
   const research=m.players[player].research;
   if(research?.length)m=dispatch(m,{type:'stage',player,command:{type:'researchChoice',uid:research[0].uid}});
   m=dispatch(m,{type:'lock',player});
  }else if(phase==='telemetry')m=dispatch(m,{type:'advance',player});
 }
 return m;
}
