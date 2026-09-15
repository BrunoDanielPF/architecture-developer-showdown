import {CATALOG} from '../packages/content/catalog';
export function protocolInfo(protocol:string){
 const card=CATALOG[protocol.toLowerCase()];
 const descriptions:Record<string,string>={REST:'Requisição e resposta entre serviços.',SQL:'Consultas e gravações no banco de dados.',replication:'Replica as gravações do banco principal para uma réplica.',async:'Mensagens assíncronas: o trabalho é processado fora da resposta imediata.'};
 return {name:card?.name??(protocol==='async'?'Assíncrono':protocol==='replication'?'Replicação':protocol),description:card?`${card.mechanism} ${card.tradeoff}`:descriptions[protocol]??'Transporta tráfego entre os componentes conectados.'};
}
