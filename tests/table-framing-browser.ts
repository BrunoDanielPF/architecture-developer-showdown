import assert from 'node:assert/strict';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {createApp} from '../server/app';

const output=path.resolve('docs/evidence/table-framing');
await mkdir(output,{recursive:true});
const app=await createApp({dataDir:await mkdtemp(path.join(tmpdir(),'showdown-table-framing-')),serveDir:path.resolve('dist'),now:()=>100000});
const base=await app.listen({host:'127.0.0.1',port:0});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl']});
try{
 const match=await (await fetch(`${base}/api/matches`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seed:'table-framing-browser',names:['Alex','Sam']})})).json();
 const get=async(player:number)=>(await fetch(`${base}/api/matches/${match.id}`,{headers:{Authorization:`Bearer ${match.tokens[player]}`}})).json();
 for(const player of [0,1]){
  const view=await get(player);
  const response=await fetch(`${base}/api/matches/${match.id}/command`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${match.tokens[player]}`},body:JSON.stringify({version:view.version,entry:{type:'ready',player}})});
  assert.equal(response.status,200);
 }
 const page=await browser.newPage({viewport:{width:1904,height:902},reducedMotion:'no-preference'});
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`${base}/?room=${match.id}&token=${match.tokens[0]}`);
 const briefing=page.getByRole('button',{name:'Entendi · ver tabuleiro'});if(await briefing.isVisible())await briefing.click();
 const api=page.locator('[data-node="api"]');await api.waitFor();
 for(const [width,height] of [[1904,902],[1440,900],[800,800]] as const){
  await page.setViewportSize({width,height});await page.waitForTimeout(450);
  const viewport=await page.locator('.table-viewport').boundingBox(),node=await api.boundingBox();
  await page.screenshot({path:path.join(output,`desktop-${width}.png`)});
  assert.ok(viewport&&node&&viewport.width>=width-100,JSON.stringify({width,viewport,node}));
  assert.ok(node.x>0&&node.x+node.width<width);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 await page.setViewportSize({width:390,height:844});await page.locator('.table-viewport').scrollIntoViewIfNeeded();await page.waitForTimeout(450);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:path.join(output,'mobile-390.png')});
 assert.deepEqual(errors,[]);
 console.log('Browser: mesa ampliada e navegável em 1904, 1440, 800 e 390 px, sem overflow.');
}finally{await browser.close();await app.close();}
