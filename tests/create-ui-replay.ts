import {writeFileSync} from 'node:fs';
import {createMatch,dispatch,exportReplay} from '../packages/session';
import {defaults} from '../packages/content/catalog';
import {draft} from '../packages/rules';

// A legal, reproducible finished match for checking the Showdown presentation.
let match=createMatch('flashcart-2026',['Alex','Sam'],['balanced','resilient']);
for(const player of [0,1])match=dispatch(match,{type:'ready',player});
for(const [player,cardId,target] of [[0,'queue','pay'],[0,'worker','queue'],[1,'bulkhead','pay']] as const){
  const p=draft(match.players[player],match.market,match.seed);
  const card=p.hand.find(c=>c.cardId===cardId)!;
  const targetId=target==='queue'?p.graph.nodes.find(n=>n.kind==='queue')!.id:target;
  match=dispatch(match,{type:'stage',player,command:{type:'play',uid:card.uid,target:targetId,config:defaults(cardId)}});
}
for(let round=0;round<5;round++){
  for(const player of [0,1])match=dispatch(match,{type:'lock',player});
  for(const player of [0,1])match=dispatch(match,{type:'advance',player});
}
writeFileSync('docs/evidence/demo-replay.json',JSON.stringify(exportReplay(match),null,2));
console.log('Replay completo criado: docs/evidence/demo-replay.json');
