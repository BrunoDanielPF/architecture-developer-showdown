import { SCENARIOS, BASE_WORLD } from '../content/catalog';
import { clone, shuffle } from '../domain/random';
import type { Scenario, WorldState } from '../domain/types';
export function scenarioRun(seed:string):Scenario[] {
 const bands=[[1],[2],[3],[4],[5]];
 for(let attempt=0;attempt<100;attempt++){
   const run=bands.map((heats,i)=>shuffle(SCENARIOS.filter(s=>heats.includes(s.heat)),`${seed}:scenario:${attempt}:${i}`)[0]);
   if(new Set(run.map(s=>s.axis)).size>=3 && !run.some((s,i)=>i>1&&run[i-1].axis===s.axis&&run[i-2].axis===s.axis))return clone(run);
 }
 throw new Error('Nenhuma sequência válida para esta seed.');
}
export function initialWorld():WorldState{return {baseline:clone(BASE_WORLD),active:[],world:clone(BASE_WORLD)};}
export function reveal(state:WorldState,card:Scenario,round:number):WorldState{
 const next=clone(state);next.active=next.active.filter(s=>s.expires>=round);
 if(card.duration===0)Object.assign(next.baseline,card.mutation);else next.active.push({card:clone(card),expires:round+card.duration-1});
 next.world=clone(next.baseline);for(const item of next.active)Object.assign(next.world,item.card.mutation);return next;
}
