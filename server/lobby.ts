import {randomBytes, randomInt} from 'node:crypto';
import {SPECIALTIES} from '../packages/content/catalog';

export type Seat={name:string;specialty:string;ready:boolean};
export type Lobby={code:string;status:'waiting'|'playing'|'closed';seats:[Seat,Seat|null];expiresAt:number;revision:number};
export const privateToken=()=>randomBytes(24).toString('hex');
// A client-generated secret makes admission retries safe when the response is lost.
export function admissionKey(body:any){
 if(body?.requestId===undefined)return '';
 if(typeof body.requestId!=='string'||! /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.requestId))throw new Error('Identificador de solicitação inválido.');
 return body.requestId;
}
export function roomCode(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from({length:8},()=>alphabet[randomInt(alphabet.length)]).join('');}
export function profile(body:any):Seat{
 if(!body||typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>30)throw new Error('Informe um nome de 1 a 30 caracteres.');
 if(typeof body.specialty!=='string'||!Object.hasOwn(SPECIALTIES,body.specialty))throw new Error('Escolha uma especialização válida.');
 return {name:body.name.trim(),specialty:body.specialty,ready:false};
}
export function normalizeCode(value:unknown){
 const code=typeof value==='string'?value.replace(/[\s-]/g,'').toUpperCase():'';
 if(!/^[A-HJ-NP-Z2-9]{8}$/.test(code))throw new Error('O código da sala deve conter 8 letras ou números.');
 return code;
}
