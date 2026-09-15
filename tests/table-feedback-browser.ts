import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {createApp} from '../server/app';
import {CATALOG} from '../packages/content/catalog';
import {candidates} from '../packages/rules';

const output=path.resolve('docs/evidence/table-feedback');
await mkdir(output,{recursive:true});
const app=await createApp({dataDir:await mkdtemp(path.join(tmpdir(),'showdown-ui-')),serveDir:path.resolve('dist'),now:()=>100000});
const base=await app.listen({host:'127.0.0.1',port:0});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 page.setDefaultTimeout(15000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const session=await (await fetch(base+'/api/matches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seed:'flashcart-2026',names:['Alex','Sam']})})).json();
 const get=async(player=0)=> (await fetch(`${base}/api/matches/${session.id}`,{headers:{Authorization:`Bearer ${session.tokens[player]}`}})).json();
 const send=async(type:string,player:number)=>{
  const v=await get(player);
  const r=await fetch(`${base}/api/matches/${session.id}/command`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.tokens[player]}`},body:JSON.stringify({version:v.version,entry:{type}})});
  assert.equal(r.status,200);return r.json();
 };
 await page.goto(`${base}/?room=${session.id}&token=${session.tokens[0]}`);
 await page.locator('.hand-cards .game-card').first().waitFor();
 await page.locator('[data-node="api"]').waitFor();
 await page.waitForTimeout(1200);
 const cards=page.locator('.hand-cards .game-card'),before=await cards.first().boundingBox();
 assert.ok(before&&before.y>600);
 const node=page.locator('[data-node="api"]'),nodeBefore=await node.boundingBox();
 await page.mouse.move(790,590);for(let i=0;i<6;i++){await page.mouse.wheel(0,-140);await page.waitForTimeout(80);}await page.waitForTimeout(600);
 const zoomed=await cards.first().boundingBox(),nodeZoomed=await node.boundingBox();
 assert.deepEqual(zoomed,before,'A mão deve manter posição e tamanho durante o zoom');

 assert.ok(nodeZoomed!.width>nodeBefore!.width*1.1,'O zoom precisa aproximar a arquitetura');
 await page.screenshot({path:path.join(output,'desktop-zoom.png')});
 console.log('checking pan');await page.mouse.move(810,610);await page.mouse.down();await page.mouse.move(895,570,{steps:12});await page.mouse.up();await page.waitForTimeout(700);
 console.log('pan sent');const nodePanned=await node.boundingBox();
 assert.ok(Math.hypot(nodePanned!.x-nodeZoomed!.x,nodePanned!.y-nodeZoomed!.y)>30,'Arrastar vazio deve mover o tabuleiro');
 assert.deepEqual(await cards.first().boundingBox(),before,'Pan não deve mover a mão');
 console.log('checking recenter');await page.getByRole('button',{name:'Centralizar mesa'}).click();await page.waitForTimeout(600);
 const centered=await node.boundingBox();assert.ok(Math.abs(centered!.x-nodeBefore!.x)<2);
 console.log('checking protocol');const label=page.locator('[data-target="data"]');
 assert.equal(await label.locator('strong').innerText(),'SQL');
 assert.ok(await label.locator('strong').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=10));
 await label.hover();assert.ok(await label.locator('.edge-description').isVisible());
 await page.screenshot({path:path.join(output,'desktop-protocol.png')});
 console.log('checking planning');await send('ready',0);await send('ready',1);
 await page.waitForFunction(()=>document.querySelector('.scenario-current h2')?.textContent!=='Uma loja pronta para crescer');
 await page.waitForTimeout(1500);
 const briefing=page.getByRole('button',{name:'Entendi · ver tabuleiro'});if(await briefing.isVisible())await briefing.click();
 const v=await get(),card=v.player.hand.find((c:any)=>candidates(CATALOG[c.cardId],v.player.graph).some(t=>t.type==='node'));
 assert.ok(card);const target=candidates(CATALOG[card.cardId],v.player.graph).find(t=>t.type==='node')!;
 const dragCard=page.locator(`.hand-cards [data-card="${card.cardId}"]`);await dragCard.scrollIntoViewIfNeeded();
 const cb=(await dragCard.boundingBox())!,tb=(await page.locator(`[data-target="${target.id}"]`).boundingBox())!;
 await page.mouse.move(cb.x+cb.width/2,cb.y+cb.height/2);await page.mouse.down();await page.mouse.move(tb.x+tb.width/2,tb.y+tb.height/2,{steps:15});await page.mouse.up();
 console.log('checking drop');await page.getByRole('button',{name:'Preparar implantação'}).waitFor();
 assert.equal(await page.locator('.card-settings select').inputValue(),target.id);
 await page.getByRole('button',{name:'Preparar implantação'}).click();
 await page.waitForTimeout(700);
 await send('lock',0);await send('lock',1);
 await page.getByRole('region',{name:'Resultado da rodada 1'}).waitFor();
 await page.screenshot({path:path.join(output,'desktop-result.png')});
 await send('advance',0);await send('advance',1);await page.reload();
 await page.getByRole('region',{name:'Resultado da rodada 1'}).waitFor();
 assert.match(await page.locator('.measurement-caption').innerText(),/Resultado R1/);
 if(await briefing.isVisible())await briefing.click();
 for(const width of [766,390]){
  await page.setViewportSize({width,height:844});await page.waitForTimeout(1000);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Sem overflow horizontal');
  assert.equal(await cards.count(),(await get()).player.hand.length);
  if(width===766){const strip=page.locator('.hand-cards');const left=await strip.evaluate(e=>e.scrollLeft);await page.getByRole('button',{name:'Ver próximas cartas'}).click();await page.waitForTimeout(500);assert.ok(await strip.evaluate(e=>e.scrollLeft)>left);}
  await page.screenshot({path:path.join(output,`${width}-round2.png`),fullPage:true});
 }
 assert.deepEqual(errors,[]);
 await writeFile(path.join(output,'checks.json'),JSON.stringify({passed:['zoom moves board and preserves hand bounds','pan moves board and preserves hand bounds','recenter restores camera','protocol name and description visible','card drag and placement','round result survives advance and reload','766px and 390px without horizontal overflow'],browserErrors:errors},null,2));
 console.log('Browser: zoom, pan, fixed hand, protocols, drag/drop, persistent results and responsive layouts passed.');
}catch(error){console.error(error);throw error;}finally{await browser.close();await app.close();}
