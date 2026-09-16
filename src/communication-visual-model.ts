import type {Edge,Graph} from '../packages/domain/types';

export type CommunicationMode='request-response'|'multiplexed-request-response'|'query-result'|'persistent-duplex'|'enqueue'|'consume'|'replication';

export type CommunicationVisualModel={
 mode:CommunicationMode;
 label:string;
 synchronous:boolean;
 persistent:boolean;
 hasResponse:boolean;
 hasAcknowledgement:boolean;
 requestColor:string;
 responseColor:string;
 speed:number;
 density:number;
};

const models:Record<CommunicationMode,CommunicationVisualModel>={
 'request-response':{mode:'request-response',label:'SÍNCRONO',synchronous:true,persistent:false,hasResponse:true,hasAcknowledgement:false,requestColor:'#79eaf1',responseColor:'#91e5af',speed:.22,density:1},
 'multiplexed-request-response':{mode:'multiplexed-request-response',label:'HTTP/2 · MULTIPLEXADO',synchronous:true,persistent:false,hasResponse:true,hasAcknowledgement:false,requestColor:'#65dff0',responseColor:'#8eaaff',speed:.31,density:3},
 'query-result':{mode:'query-result',label:'CONSULTA · RESULTADO',synchronous:true,persistent:false,hasResponse:true,hasAcknowledgement:false,requestColor:'#c29cff',responseColor:'#f0c5ff',speed:.2,density:1},
 'persistent-duplex':{mode:'persistent-duplex',label:'CANAL DUPLEX',synchronous:false,persistent:true,hasResponse:true,hasAcknowledgement:false,requestColor:'#66e7f2',responseColor:'#a7a1ff',speed:.27,density:2},
 enqueue:{mode:'enqueue',label:'PUBLICAÇÃO · FILA',synchronous:false,persistent:false,hasResponse:false,hasAcknowledgement:true,requestColor:'#f2bd68',responseColor:'#a3d7ba',speed:.18,density:1},
 consume:{mode:'consume',label:'CONSUMO ASSÍNCRONO',synchronous:false,persistent:false,hasResponse:false,hasAcknowledgement:false,requestColor:'#f0ae62',responseColor:'#f0ae62',speed:.17,density:2},
 replication:{mode:'replication',label:'REPLICAÇÃO',synchronous:false,persistent:true,hasResponse:false,hasAcknowledgement:false,requestColor:'#bd93ff',responseColor:'#bd93ff',speed:.16,density:3}
};

export function communicationVisualModel(edge:Edge,graph:Graph):CommunicationVisualModel{
 const source=graph.nodes.find(node=>node.id===edge.from),target=graph.nodes.find(node=>node.id===edge.to);
 const protocol=edge.protocol.toLowerCase();
 let mode:CommunicationMode='request-response';
 if(protocol==='replication')mode='replication';
 else if(target?.kind==='queue')mode='enqueue';
 else if(source?.kind==='queue')mode='consume';
 else if(protocol==='grpc')mode='multiplexed-request-response';
 else if(protocol==='sql')mode='query-result';
 else if(protocol==='websocket')mode='persistent-duplex';
 else if(protocol==='async')mode='enqueue';
 return {...models[mode]};
}
