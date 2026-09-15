import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp} from '../server/app';

const app=await createApp({dataDir:await mkdtemp(path.join(tmpdir(),'showdown-production-')),serveDir:path.resolve('dist')});
try{
 const base=await app.listen({host:'127.0.0.1',port:0});
 const page=await fetch(base),html=await page.text();
 assert.equal(page.status,200);assert.match(html,/<title>Architecture Developer Showdown<\/title>/);
 for(const asset of html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)){
   const response=await fetch(base+asset[1]);assert.equal(response.status,200);
   assert.match(response.headers.get('content-type')??'',asset[1].endsWith('.js')?/javascript/:/css/);
   assert.ok((await response.arrayBuffer()).byteLength>0);
 }
 assert.deepEqual(await (await fetch(base+'/api/health')).json(),{ok:true});
 console.log('Produção local: HTML, bundles e API responderam corretamente.');
}finally{await app.close();}
