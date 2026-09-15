export type Session={id:string;tokens:string[];mode:'hotseat'|'remote'|'solo';actor:number;online?:boolean};
export type LobbyView={code:string;status:'waiting'|'playing'|'closed';player:number;seats:({name:string;specialty:string;ready:boolean}|null)[];online:boolean[];revision:number;expiresAt:number};
export function requestId(){
 const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export async function api(url:string,body?:unknown,token?:string){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
 try{
  const r=await fetch('/api'+url,{signal:controller.signal,method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const result=await r.json();if(!r.ok)throw Object.assign(new Error(result.error??'Não foi possível acessar a partida.'),{code:result.code});return result;
 }catch(e){if(e instanceof TypeError||(e as Error).name==='AbortError')throw new Error('Sem conexão com o servidor. Tentando reconectar…');throw e;}finally{clearTimeout(timeout);}
}
