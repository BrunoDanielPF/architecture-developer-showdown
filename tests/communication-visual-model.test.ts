import {describe,expect,it} from 'vitest';
import type {Edge,Graph,Node,NodeKind} from '../packages/domain/types';
import {communicationVisualModel} from '../src/communication-visual-model';

const node=(id:string,kind:NodeKind):Node=>({id,kind,name:id,x:0,z:0,config:{},upgrades:[]});
const edge=(protocol:string,from='source',to='target'):Edge=>({id:`${from}:${to}`,from,to,protocol,read:100,write:100,config:{},policies:[]});
const graph=(connection:Edge,sourceKind:NodeKind='api',targetKind:NodeKind='api'):Graph=>({nodes:[node(connection.from,sourceKind),node(connection.to,targetKind)],edges:[connection]});

describe('comunicação fiel à arquitetura',()=>{
 it.each([
  ['REST','request-response',true,true,false],
  ['gRPC','multiplexed-request-response',true,true,false],
  ['SQL','query-result',true,true,false],
  ['WebSocket','persistent-duplex',false,true,true],
  ['replication','replication',false,false,true]
 ] as const)('traduz %s para uma semântica visual própria',(...[protocol,mode,synchronous,hasResponse,persistent])=>{
  const connection=edge(protocol),model=communicationVisualModel(connection,graph(connection));
  expect(model).toMatchObject({mode,synchronous,hasResponse,persistent});
 });

 it('representa a publicação na fila mesmo quando a aresta de entrada preserva REST',()=>{
  const connection=edge('REST');
  expect(communicationVisualModel(connection,graph(connection,'api','queue'))).toMatchObject({mode:'enqueue',synchronous:false,hasResponse:false,hasAcknowledgement:true});
 });

 it('representa o consumo da fila como fluxo assíncrono unidirecional',()=>{
  const connection=edge('async');
  expect(communicationVisualModel(connection,graph(connection,'queue','worker'))).toMatchObject({mode:'consume',synchronous:false,hasResponse:false,hasAcknowledgement:false});
 });

 it('mantém eventos assíncronos genéricos como publicação sem resposta de negócio',()=>{
  const connection=edge('async');
  expect(communicationVisualModel(connection,graph(connection))).toMatchObject({mode:'enqueue',label:'PUBLICAÇÃO · FILA'});
 });
});
