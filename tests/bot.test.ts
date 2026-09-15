import {describe,expect,it} from 'vitest';
import {nextBotEntry,type BotObservation} from '../server/bot';
import {createMatch,dispatch,exportReplay,project,replay} from '../packages/session';
import type {Match} from '../packages/domain/types';
import {validateGraph} from '../packages/rules';

function observation(m:Match):BotObservation{
 const {phase,round,player,world,market}=project(m,1);
 return {phase,round,player,world,market};
}
function planning(seed='bot-test'){
 let m=createMatch(seed);
 for(const player of [0,1])m=dispatch(m,{type:'ready',player});
 return m;
}
describe('arquiteto automático',()=>{
 it('decide sem alterar a observação e sem consultar informações ocultas',()=>{
  const m=planning(),before=observation(m),copy=structuredClone(before);
  const entry=nextBotEntry(before);expect(before).toEqual(copy);
  const hidden=structuredClone(m);hidden.seed='another-secret';hidden.players[0].hand=[];
  hidden.players[0].pending=[{type:'pass'}];hidden.players[0].graph.nodes=[];
  hidden.scenarios.reverse();hidden.players[1].deck.reverse();hidden.players[1].runtime.warm={secret:999};
  expect(nextBotEntry(observation(hidden))).toEqual(entry);
 });
 it('escolhe uma carta de pesquisa e respeita ausência de ações ou lock',()=>{
  let m=planning();m.players[1].hand=[{uid:'test-research',cardId:'research'}];
  m=dispatch(m,{type:'stage',player:1,command:{type:'play',uid:'test-research',target:'self',config:{}}});
  const choice=nextBotEntry(observation(m))!;
  expect(choice.command?.type).toBe('researchChoice');
  m=dispatch(m,{...choice,player:1});expect(m.players[1].research).toBeUndefined();
  m.players[1].actions=0;expect(nextBotEntry(observation(m))?.type).toBe('lock');
  m.players[1].locked=true;expect(nextBotEntry(observation(m))).toBeNull();
 });
 it('replaneja após perder uma compra disputada sem inventar recursos',()=>{
  let m=planning('bot-market');const uid=m.market[0].uid;
  for(const player of [0,1])m=dispatch(m,{type:'stage',player,command:{type:'buy',uid}});
  for(const player of [0,1])m=dispatch(m,{type:'lock',player});
  expect(m.phase).toBe('adjustment');
  const loser=m.players.find(p=>!p.locked)!;
  // Run the same policy from whichever private seat lost the public purchase.
  for(let step=0;m.phase==='adjustment'&&step<8;step++){
   const {phase,round,player,world,market}=project(m,loser.id);
   const entry=nextBotEntry({phase,round,player,world,market});expect(entry).not.toBeNull();
   m=dispatch(m,{...entry!,player:loser.id});
  }
  expect(m.phase).toBe('telemetry');expect(m.players.every(p=>p.ec>=0&&p.actions>=0)).toBe(true);
 });
 it('joga 24 partidas completas com decisões legais e replay idêntico',()=>{
  let stages=0,deployments=0;
  for(let seed=0;seed<24;seed++){
   let m=createMatch(`ai-acceptance-${seed}`);
   for(let step=0;m.phase!=='showdown'&&step<140;step++){
    const h=m.players[0];
    if(!h.locked){m=dispatch(m,{player:0,type:m.phase==='setup'?'ready':m.phase==='telemetry'?'advance':'lock'});}
    if(m.phase==='showdown')break;
    const entry=nextBotEntry(observation(m));
    if(entry){
     if(entry.type==='stage')stages++;
     if(entry.command?.type==='play')deployments++;
     m=dispatch(m,{...entry,player:1});
    }
    const p=project(m,1).player;
    expect(p.ec).toBeGreaterThanOrEqual(0);expect(p.actions).toBeGreaterThanOrEqual(0);
    expect(p.actions).toBeLessThanOrEqual(2);expect(p.hand.length).toBeLessThanOrEqual(7);
    validateGraph(p.graph);
   }
   expect(m.phase).toBe('showdown');expect(m.players[1].graph).not.toEqual(createMatch(`ai-acceptance-${seed}`).players[1].graph);
   expect(replay(exportReplay(m)).showdown).toEqual(m.showdown);
  }
  expect(stages).toBeGreaterThan(120);expect(deployments).toBeGreaterThan(24);
 },30000);
});
