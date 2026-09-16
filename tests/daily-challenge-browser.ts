import assert from 'node:assert/strict';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {createApp} from '../server/app';

const dataDir=await mkdtemp(path.join(tmpdir(),'showdown-daily-ui-')),output=path.resolve('docs/evidence/daily-challenge');await mkdir(output,{recursive:true});
const app=await createApp({dataDir,serveDir:path.resolve('dist'),now:()=>Date.parse('2026-09-15T14:00:00Z'),dailyChallengeSecret:'segredo-browser-diario-com-32-caracteres'}),base=await app.listen({host:'127.0.0.1',port:0});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base);const option=page.locator('.daily-option');await option.waitFor();assert.ok(await option.isEnabled());await page.screenshot({path:path.join(output,'home.png'),fullPage:true});
 await option.click();await page.getByText('DESAFIO DIÁRIO',{exact:true}).waitFor();assert.equal(await page.locator('.daily-brief li').count(),3);assert.equal(await page.locator('.home-profile select').count(),0);
 await page.getByLabel('Seu nome').fill('Alex');await page.screenshot({path:path.join(output,'briefing.png'),fullPage:true});await page.getByRole('button',{name:'Iniciar desafio de hoje'}).click();
 await page.getByText('FLASHCART / DESAFIO DIÁRIO',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('showdown-session')!).mode),'daily');await page.screenshot({path:path.join(output,'table.png'),fullPage:true});
 const mobile=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await mobile.goto(base);await mobile.locator('.daily-option').waitFor();assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await mobile.screenshot({path:path.join(output,'mobile-home.png'),fullPage:true});await mobile.close();
 assert.deepEqual(errors,[]);console.log('Browser: home, briefing, início do desafio diário e layout 390 px passaram.');
}finally{await browser.close();await app.close();}
