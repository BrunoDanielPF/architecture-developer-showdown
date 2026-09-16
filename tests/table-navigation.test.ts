import {describe,expect,it} from 'vitest';
import {TABLE_NAVIGATION} from '../src/table-navigation';
import {initialTableZoom} from '../src/table-camera';

describe('navegação da mesa',()=>{
 it('mantém pan e zoom responsivos e uma faixa ampla de aproximação',()=>{
  expect(TABLE_NAVIGATION.panSpeed).toBeGreaterThanOrEqual(1.25);
  expect(TABLE_NAVIGATION.zoomSpeed).toBeGreaterThanOrEqual(1.3);
  expect(TABLE_NAVIGATION.minZoom).toBeLessThanOrEqual(10);
  expect(TABLE_NAVIGATION.maxZoom).toBeGreaterThanOrEqual(100);
 });
 it('enquadra a mesa com mais presença no desktop sem perder o foco móvel',()=>{
  const wide=initialTableZoom(1904,902,false),desktop=initialTableZoom(1440,900,false);
  expect(wide).toBeGreaterThan(902/22.4*1.3);
  expect(28.4*wide/1904).toBeGreaterThan(.78);
  expect(desktop).toBeGreaterThan(900/22.4*1.3);
  expect(initialTableZoom(728,800,false)).toBeGreaterThan(728/29*1.1);
  expect(initialTableZoom(728,800,false)).toBeLessThan(728/23);
  expect(initialTableZoom(390,440,true)).toBeCloseTo(Math.min(390/14,440/11.5),5);
 });
});
