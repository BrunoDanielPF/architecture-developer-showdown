import {describe,expect,it} from 'vitest';
import {architectureAttachmentRegistry,attachmentDefinition,edgeAttachmentProgress,nodeAttachmentSlots} from '../src/architecture-attachment-model';
import type {EdgeVisualEffect,NodeVisualEffect} from '../src/architecture-visual-model';

const nodeEffects:NodeVisualEffect[]=['replication','elasticity','zones','health','index','pool','observability','idempotency','dead-letter','locking','identity','tracing'];
const edgeEffects:EdgeVisualEffect[]=['timeout','retry','breaker','rate-limit','firewall','compression','bulkhead','backpressure','secure-transport'];

describe('módulos anexados à arquitetura',()=>{
 it('fornece identidade visual própria a todo efeito suportado',()=>{
  expect(Object.keys(architectureAttachmentRegistry)).toHaveLength(nodeEffects.length+edgeEffects.length);
  for(const effect of nodeEffects)expect(attachmentDefinition(effect)).toMatchObject({effect,scope:'node',placement:'node-rack'});
  for(const effect of edgeEffects){const definition=attachmentDefinition(effect);expect(definition).toMatchObject({effect,scope:'edge'});expect(definition.cardId).toBeTruthy();expect(definition.shortLabel).toBeTruthy();}
 });
 it('modela WAF e Rate Limit como gates inline e Timeout e Retry como sidecars',()=>{
  for(const effect of ['firewall','rate-limit'] as const)expect(attachmentDefinition(effect).placement).toBe('inline-gate');
  for(const effect of ['timeout','retry'] as const)expect(attachmentDefinition(effect).placement).toBe('sidecar');
 });
 it('organiza upgrades em trilho de três colunas e políticas antes do rótulo central',()=>{
  const nodeSlots=nodeAttachmentSlots(5);expect(nodeSlots).toHaveLength(5);expect(new Set(nodeSlots.map(slot=>slot.z)).size).toBe(2);
  expect(edgeAttachmentProgress(0)).toEqual([]);edgeAttachmentProgress(3).forEach((value,index)=>expect(value).toBeCloseTo([.22,.34,.46][index],6));
 });
});
