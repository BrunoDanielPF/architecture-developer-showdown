import assert from 'node:assert/strict';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {createApp} from '../server/app';

const output=path.resolve('docs/evidence/opponent-hand');
await mkdir(output,{recursive:true});
const app=await createApp({dataDir:await mkdtemp(path.join(tmpdir(),'showdown-opponent-hand-')),serveDir:path.resolve('dist'),now:()=>100000});
const base=await app.listen({host:'127.0.0.1',port:0});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl']});
try{
 const created=await (await fetch(base+'/api/matches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seed:'opponent-hand-browser',names:['Alex','Sam']})})).json();
 const get=async(player:number)=>(await fetch(`${base}/api/matches/${created.id}`,{headers:{Authorization:`Bearer ${created.tokens[player]}`}})).json();
 const send=async(player:number,entry:unknown)=>{
  const current=await get(player),response=await fetch(`${base}/api/matches/${created.id}/command`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${created.tokens[player]}`},body:JSON.stringify({version:current.version,entry})});
  if(response.status!==200)throw new Error(`Comando rejeitado (${response.status}): ${await response.text()}`);
  return response.json();
 };
 await send(0,{type:'ready'});await send(1,{type:'ready'});
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`${base}/?room=${created.id}&token=${created.tokens[0]}`);
 const briefing=page.getByRole('button',{name:'Entendi · ver tabuleiro'});if(await briefing.isVisible())await briefing.click();
 const hand=page.locator('[data-opponent-hand]');await hand.waitFor();
 await page.locator('[data-node="api"]').first().waitFor();
 const initial=(await get(0)).opponent.handCount;
 assert.equal(Number(await hand.getAttribute('data-opponent-count')),initial);
 assert.equal(await hand.locator('.opponent-card-back').count(),initial);
 assert.equal(await hand.locator('[data-card]').count(),0);
 const desktopSize=await page.evaluate(()=>({opponent:document.querySelector<HTMLElement>('.opponent-card-back')?.offsetWidth,own:document.querySelector<HTMLElement>('.hand-content .game-card')?.offsetWidth}));
 assert.equal(desktopSize.opponent,desktopSize.own);
 assert.ok((await hand.boundingBox())!.y<0);
 await page.waitForTimeout(250);
 await page.screenshot({path:path.join(output,'desktop-initial.png')});

 const opponent=(await get(1)).player;
 await send(1,{type:'stage',command:{type:'reserve',uid:opponent.hand[0].uid}});
 await page.waitForFunction(count=>document.querySelector('[data-opponent-hand]')?.getAttribute('data-opponent-count')===String(count),initial-1);
 assert.equal(await hand.getAttribute('data-opponent-motion'),'spend');
 await page.screenshot({path:path.join(output,'desktop-card-spent.png')});
 await send(1,{type:'undo'});
 await page.waitForFunction(count=>document.querySelector('[data-opponent-hand]')?.getAttribute('data-opponent-count')===String(count),initial);
 const market=(await get(1)).market;
 await send(1,{type:'stage',command:{type:'buy',uid:market[0].uid}});
 await page.waitForFunction(count=>document.querySelector('[data-opponent-hand]')?.getAttribute('data-opponent-count')===String(count),initial+1);
 await page.waitForTimeout(550);
 assert.equal(await hand.locator('.opponent-card-back').count(),initial+1);
 for(const width of [1024,800]){
  await page.setViewportSize({width,height:800});
  await page.waitForTimeout(420);
  const size=await page.evaluate(()=>({opponent:document.querySelector<HTMLElement>('.opponent-card-back')?.offsetWidth,own:document.querySelector<HTMLElement>('.hand-content .game-card')?.offsetWidth}));
  assert.ok(Math.abs((size.opponent??0)-(size.own??0))<=2,JSON.stringify({width,...size}));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(output,`desktop-${width}.png`)});
 }
 await page.setViewportSize({width:390,height:844});await hand.scrollIntoViewIfNeeded();await page.waitForTimeout(420);
 const box=await hand.boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=390);
 const mobileSize=await page.evaluate(()=>({opponent:document.querySelector<HTMLElement>('.opponent-card-back')?.offsetWidth,own:document.querySelector<HTMLElement>('.hand-content .game-card')?.offsetWidth}));
 assert.ok(Math.abs((mobileSize.opponent??0)-(mobileSize.own??0))<=5,JSON.stringify(mobileSize));
 assert.ok(box.y<(await page.locator('.sync-dock').boundingBox())!.y);
 await page.screenshot({path:path.join(output,'mobile-card-gained.png')});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),JSON.stringify(await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,innerWidth,hand:document.querySelector('[data-opponent-hand]')?.getBoundingClientRect().toJSON(),cards:[...document.querySelectorAll('.opponent-card-back')].map(card=>card.getBoundingClientRect().toJSON())}))));
 assert.ok(await page.evaluate(()=>[...document.querySelectorAll('.opponent-card-back')].every(card=>{const box=card.getBoundingClientRect();return box.left>=8&&box.right<=innerWidth-8;})));
 assert.deepEqual(errors,[]);
 console.log('Browser: mão adversária anônima animou gasto, desfazer e compra sem overflow em 390 px.');
}finally{await browser.close();await app.close();}
