import {CATALOG} from '../packages/content/catalog';
export function protocolInfo(protocol:string){
 const card=CATALOG[protocol.toLowerCase()];
 const descriptions:Record<string,string>={REST:'A origem aguarda a resposta antes de continuar.',SQL:'Envia uma consulta e recebe o conjunto de resultados.',gRPC:'Chamadas síncronas multiplexadas sobre um canal HTTP/2.',WebSocket:'Canal persistente com mensagens simultâneas nos dois sentidos.',replication:'Propaga gravações ordenadas do banco principal para a réplica.',async:'Publica eventos para processamento sem aguardar o resultado do trabalho.'};
 return {name:card?.name??(protocol==='async'?'Assíncrono':protocol==='replication'?'Replicação':protocol),description:descriptions[protocol]??(card?`${card.mechanism} ${card.tradeoff}`:'Transporta tráfego entre os componentes conectados.')};
}
