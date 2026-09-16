import {describe,expect,it} from 'vitest';
import {incident,reconcileIncidents} from '../packages/simulation/incidents';
import {emptyRuntime,simulate} from '../packages/simulation';
import {BASE_WORLD,initialGraph} from '../packages/content/catalog';
import {prioritizeIncidents} from '../src/IncidentLayer';

describe('ciclo de vida dos incidentes',()=>{
 it('mantém identidade e primeira rodada enquanto a condição persiste, e registra recuperação uma vez',()=>{
  const draft=incident('queue_backlog','queue-1','A fila ultrapassou o SLO.','critical');
  const triggered=reconcileIncidents([draft],undefined,1);
  const ongoing=reconcileIncidents([draft],{incidents:triggered},2);
  const recovered=reconcileIncidents([],{incidents:ongoing},3);
  const quiet=reconcileIncidents([],{incidents:recovered},4);
  expect(triggered[0]).toMatchObject({id:'incident:queue_backlog:node:queue-1',phase:'triggered',firstSeenRound:1});
  expect(ongoing[0]).toMatchObject({id:triggered[0].id,phase:'ongoing',firstSeenRound:1});
  expect(recovered[0]).toMatchObject({id:triggered[0].id,phase:'recovered',severity:'warning',firstSeenRound:1});
  expect(quiet).toEqual([]);
 });

 it('é determinístico e emite o contrato visual completo',()=>{
  const graph=initialGraph(),world={...BASE_WORLD,reads:5200,writes:500,paymentMs:3600,paymentError:.3};
  const first=simulate(graph,world,emptyRuntime(),'incident-contract');
  const second=simulate(graph,world,emptyRuntime(),'incident-contract');
  expect(second).toEqual(first);
  expect(first.telemetry.incidents.length).toBeGreaterThan(0);
  for(const value of first.telemetry.incidents){
   expect(value.id).toMatch(/^incident:/);expect(value.kind).toBeTruthy();expect(value.locus.id).toBeTruthy();
   expect(['warning','critical']).toContain(value.severity);expect(value.phase).toBe('triggered');expect(value.firstSeenRound).toBe(0);
  }
 });

 it('prioriza incidentes críticos e limita a quantidade de efeitos simultâneos',()=>{
  const warning=reconcileIncidents([incident('cache_stampede','cache','Aviso')],undefined,1)[0];
  const critical=reconcileIncidents([incident('cascading_failure','api','Crítico','critical')],undefined,1)[0];
  const recovered={...warning,phase:'recovered' as const};
  expect(prioritizeIncidents([recovered,warning,critical],2).map(value=>value.id)).toEqual([critical.id,warning.id]);
 });
});
