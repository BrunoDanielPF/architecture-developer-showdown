export function hash(input: unknown): string { const s = typeof input === 'string' ? input : JSON.stringify(input); let h = 2166136261; for (let i=0;i<s.length;i++) h = Math.imul(h ^ s.charCodeAt(i),16777619); return (h>>>0).toString(16).padStart(8,'0'); }
export function random(seed: string) { let a=parseInt(hash(seed),16); return () => { a |= 0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
export function shuffle<T>(items: T[], seed: string): T[] { const result=[...items], r=random(seed); for(let i=result.length-1;i>0;i--){const j=Math.floor(r()*(i+1)); [result[i],result[j]]=[result[j],result[i]];} return result; }
export function clone<T>(value: T): T { return structuredClone(value); }
