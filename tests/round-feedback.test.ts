import {describe,it,expect} from 'vitest';
import {createMatch,dispatch,project} from '../packages/session';
import {initialWorld,reveal} from '../packages/world';
import {metricChange} from '../src/round-feedback';
import {incident,reconcileIncidents} from '../packages/simulation/incidents';

describe('contexto e resultados persistentes',()=>{
 it('compara medições reais, mantém o resultado na próxima rodada e após reprojetar a sessão',()=>{
  let m=createMatch('round-feedback');
  const baseline=project(m,0).player.telemetry;
  expect(project(m,0).measurements).toHaveLength(1);
  for(const player of [0,1])m=dispatch(m,{type:'ready',player});
  expect(project(m,0).measurements?.at(-1)?.round).toBe(0);
  expect(project(m,0).previousWorld).toEqual(initialWorld().world);
  for(const player of [0,1])m=dispatch(m,{type:'lock',player});
  const resolved=project(m,0);
  expect(resolved.measurements?.map(x=>x.round)).toEqual([0,1]);
  expect(resolved.measurements?.[0].telemetry).toEqual(baseline);
  expect(resolved.measurements?.[1].telemetry).toEqual(resolved.player.telemetry);
  const firstWorld=resolved.world;
  for(const player of [0,1])m=dispatch(m,{type:'advance',player});
  const reconnected=project(JSON.parse(JSON.stringify(m)),0);
  expect(reconnected.round).toBe(2);
  expect(reconnected.measurements).toEqual(resolved.measurements);
  expect(reconnected.previousWorld).toEqual(firstWorld);
  expect(reconnected.world).toEqual(reveal(reveal(initialWorld(),m.revealed[0],1),m.revealed[1],2).world);
 });
 it('filtra cada medição conforme a instrumentação daquela rodada e mantém o adversário privado',()=>{
  const m=createMatch('measurement-privacy'),p=m.players[0];
  const hidden={...p.telemetry,observed:false,diagnostic:false,traces:['private trace'],incidents:reconcileIncidents([incident('stale_data','db','internal')],undefined,1)};
  p.runtime.history=[hidden,{...hidden,observed:true,diagnostic:false},{...hidden,observed:true,diagnostic:true}];
  const v=project(m,0),history=v.measurements!;
  expect(history[0].telemetry).not.toHaveProperty('nodes');
  expect(history[0].telemetry).not.toHaveProperty('incidents');
  expect(history[0].telemetry).not.toHaveProperty('traces');
  expect(history[1].telemetry.incidents).toHaveLength(1);
  expect(history[1].telemetry).not.toHaveProperty('traces');
  expect(history[2].telemetry.traces).toEqual(['private trace']);
  expect(v.opponent).not.toHaveProperty('graph');
  expect(v).not.toHaveProperty('scenarios');
  expect(v.player).not.toHaveProperty('runtime');
 });
 it('distingue subida, descida, estabilidade, zero e ausência de comparação',()=>{
  expect(metricChange(25,20)).toMatchObject({delta:5,direction:'up',symbol:'↑'});
  expect(metricChange(0,20)).toMatchObject({delta:-20,direction:'down',symbol:'↓'});
  expect(metricChange(20,20)).toMatchObject({delta:0,direction:'same',symbol:'→'});
  expect(metricChange(20,undefined)).toBeNull();
  expect(metricChange(undefined,20)).toBeNull();
 });
});
