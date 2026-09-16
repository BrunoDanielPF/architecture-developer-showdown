import {describe,expect,it} from 'vitest';
import {createMatch,dispatch,project} from '../packages/session';
import type {Match} from '../packages/domain/types';

function planning(seed:string){
 let match=createMatch(seed,['Alex','Sam']);
 match=dispatch(match,{type:'ready',player:0});
 return dispatch(match,{type:'ready',player:1});
}

describe('atividade pública da mão adversária',()=>{
 it('mostra somente quantidade e eventos anônimos, inclusive desfazer e comprar',()=>{
  let match=planning('opponent-hand-events');
  const initial=match.players[1].hand.length;
  const card=match.players[1].hand[0];
  match=dispatch(match,{type:'stage',player:1,command:{type:'reserve',uid:card.uid}});
  let opponent=project(match,0).opponent;
  expect(opponent.handCount).toBe(initial-1);
  expect(opponent.activity.at(-1)).toEqual({seq:match.version,round:1,count:initial-1,kind:'spend'});

  match=dispatch(match,{type:'undo',player:1});
  opponent=project(match,0).opponent;
  expect(opponent.handCount).toBe(initial);
  expect(opponent.activity.at(-1)?.kind).toBe('gain');

  match=dispatch(match,{type:'stage',player:1,command:{type:'buy',uid:match.market[0].uid}});
  opponent=project(match,0).opponent;
  expect(opponent.handCount).toBe(initial+1);
  expect(opponent.activity.at(-1)?.kind).toBe('gain');
  expect(opponent.activity.map(event=>event.seq)).toEqual([...opponent.activity.map(event=>event.seq)].sort((a,b)=>a-b));
  expect(Object.keys(opponent).sort()).toEqual(['activity','handCount','locked','name']);
  for(const event of opponent.activity)expect(Object.keys(event).sort()).toEqual(['count','kind','round','seq']);
  expect(JSON.stringify(opponent)).not.toContain(card.uid);
  expect(JSON.stringify(opponent)).not.toContain(match.market[0].uid);
 });

 it('reverte a carta de uma compra disputada e não revela o alvo do mercado',()=>{
  let match=planning('opponent-contested-buy');
  const initial=match.players[0].hand.length;
  const uid=match.market[0].uid;
  for(const player of [0,1])match=dispatch(match,{type:'stage',player,command:{type:'buy',uid}});
  expect(project(match,0).opponent.handCount).toBe(initial+1);
  expect(project(match,1).opponent.handCount).toBe(initial+1);
  for(const player of [0,1])match=dispatch(match,{type:'lock',player});
  expect(match.phase).toBe('adjustment');
  const loser=match.players.find(player=>!player.locked)!;
  const opponent=project(match,1-loser.id).opponent;
  expect(opponent.handCount).toBe(initial);
  expect(opponent.activity.at(-1)).toMatchObject({count:initial,kind:'spend'});
  expect(JSON.stringify(opponent)).not.toContain(uid);
 });

 it('mantém compatibilidade com snapshots antigos sem atividade',()=>{
  const match:Match=planning('opponent-legacy-snapshot');
  delete match.publicHandActivity;
  expect(project(match,0).opponent).toMatchObject({handCount:match.players[1].hand.length,activity:[]});
 });
});
