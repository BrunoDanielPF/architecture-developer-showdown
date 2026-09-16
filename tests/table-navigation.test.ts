import {describe,expect,it} from 'vitest';
import {TABLE_NAVIGATION} from '../src/table-navigation';

describe('navegação da mesa',()=>{
 it('mantém pan e zoom responsivos e uma faixa ampla de aproximação',()=>{
  expect(TABLE_NAVIGATION.panSpeed).toBeGreaterThanOrEqual(1.25);
  expect(TABLE_NAVIGATION.zoomSpeed).toBeGreaterThanOrEqual(1.3);
  expect(TABLE_NAVIGATION.minZoom).toBeLessThanOrEqual(10);
  expect(TABLE_NAVIGATION.maxZoom).toBeGreaterThanOrEqual(100);
 });
});
