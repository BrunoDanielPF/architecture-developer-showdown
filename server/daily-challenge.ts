import {createHmac,randomBytes} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import type {ChallengeObjective,ChallengeResult,DailyChallengeDefinition,Match} from '../packages/domain/types';
import {hash} from '../packages/domain/random';
import {CONTENT_VERSION,ENGINE_VERSION} from '../packages/session';

const ZONE='America/Sao_Paulo';
const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'});
const specialties=['balanced','resilient','distributed'] as const;
const themes=[
 {title:'Escala com disciplina',publicBrief:'A FlashCart cresce sob pressões combinadas. Sustente o serviço sem transformar custo e complexidade em novos riscos.'},
 {title:'Operação sob pressão',publicBrief:'A jornada de compra será testada por mudanças de carga e dependências. Construa uma arquitetura capaz de se adaptar.'},
 {title:'Confiança em movimento',publicBrief:'Desempenho, consistência e resiliência disputarão espaço. As condições exatas serão reveladas durante as cinco rodadas.'},
];
const objectives:ChallengeObjective[]=[
 {id:'showdown',label:'Competir no Showdown',description:'Vença pelo menos 3 das 6 categorias finais.'},
 {id:'budget',label:'Respeitar o orçamento',description:'Termine a quinta rodada dentro do orçamento vigente.'},
 {id:'stability',label:'Conter incidentes críticos',description:'Termine sem incidentes críticos ainda ativos.'},
];

export const dailyDate=(now:number)=>formatter.format(new Date(now));
function nextBoundary(now:number){
 const current=dailyDate(now);let low=now,high=now+36*60*60*1000;
 while(dailyDate(high)===current)high+=12*60*60*1000;
 while(high-low>1000){const middle=Math.floor((low+high)/2);if(dailyDate(middle)===current)low=middle;else high=middle;}
 return Math.ceil(high/1000)*1000;
}

export async function dailySecret(dataDir:string,provided?:string){
 if(provided){if(provided.length<24)throw new Error('DAILY_CHALLENGE_SECRET precisa ter ao menos 24 caracteres.');return provided;}
 const file=path.join(dataDir,'.daily-challenge-secret');
 const read=async()=>{const value=(await readFile(file,'utf8')).trim();if(value.length<24)throw new Error('O segredo persistido do desafio diário é inválido.');return value;};
 try{return await read();}catch(error){
  if(error instanceof Error&&error.message==='O segredo persistido do desafio diário é inválido.')throw error;
  const generated=randomBytes(32).toString('hex');
  try{await writeFile(file,generated,{flag:'wx',mode:0o600});return generated;}catch{return read();}
 }
}

export function buildDailyChallenge(now:number,secret:string):{definition:DailyChallengeDefinition;seed:string}{
 const date=dailyDate(now),seed=createHmac('sha256',secret).update(`${date}:${CONTENT_VERSION}:${ENGINE_VERSION}`).digest('hex');
 const index=parseInt(hash(seed),16);
 return {seed,definition:{id:`flashcart-${date}`,date,title:themes[index%themes.length].title,publicBrief:themes[index%themes.length].publicBrief,specialty:specialties[index%specialties.length],objectives:structuredClone(objectives),expiresAt:nextBoundary(now),contentVersion:CONTENT_VERSION,engineVersion:ENGINE_VERSION}};
}

export function evaluateDailyChallenge(match:Match,playerId:number):ChallengeResult|undefined{
 if(match.phase!=='showdown'||!match.showdown)return undefined;
 const player=match.players[playerId],categoriesWon=match.showdown.categories.filter(category=>category.winner===playerId).length;
 const activeCritical=player.telemetry.incidents.filter(value=>value.phase!=='recovered'&&value.severity==='critical').length;
 const results={
  showdown:{met:categoriesWon>=3,value:`${categoriesWon} de 6 categorias vencidas`},
  budget:{met:player.telemetry.cost<=match.worldState.world.budget,value:`$${Math.round(player.telemetry.cost)} de $${Math.round(match.worldState.world.budget)}/mês`},
  stability:{met:activeCritical===0,value:activeCritical?`${activeCritical} incidente(s) crítico(s) ativo(s)`:'Nenhum incidente crítico ativo'},
 };
 const evaluated=objectives.map(objective=>({...objective,...results[objective.id]})),score=evaluated.filter(objective=>objective.met).length;
 return {completed:true,score,medal:score===3?'gold':score===2?'silver':'bronze',categoriesWon,objectives:evaluated};
}
