import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {createMatch} from '../packages/session';
import {simulate} from '../packages/simulation';
import {createApp} from '../server/app';

const dataDir=await mkdtemp(path.join(tmpdir(),'showdown-incidents-ui-')),id='a11ce00000000001',token='incident-visual-token';
const match=createMatch('incident-visual-browser',['Alex','Sam'],['balanced','resilient']);match.id=id;match.phase='telemetry';match.round=1;match.revealed=[match.scenarios[0]];
const player=match.players[0],apiNode=player.graph.nodes.find(node=>node.id==='api')!;apiNode.upgrades.push('observe');
const simulation=simulate(player.graph,{...match.worldState.world,reads:6200,writes:620,paymentMs:4200,paymentError:.35},player.runtime,'incident-visual-browser:critical');
player.telemetry=simulation.telemetry;player.runtime=simulation.runtime;
assert.equal(player.telemetry.observed,true);assert.ok(player.telemetry.incidents.some(value=>value.severity==='critical'));
await writeFile(path.join(dataDir,`room-${id}.json`),JSON.stringify({match,tokens:[token,'other-token'],clock:{key:'1:telemetry',deadline:Date.now()+60000,duration:8000}}));

const app=await createApp({dataDir,serveDir:path.resolve('dist'),dailyChallengeSecret:'segredo-visual-diario-com-32-caracteres'}),base=await app.listen({host:'127.0.0.1',port:0});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'}),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`${base}/?room=${id}&token=${token}`);const reveal=page.getByRole('button',{name:'Entendi · ver tabuleiro'});await reveal.waitFor();await reveal.click();await page.locator('.incident-dock').waitFor();await page.waitForTimeout(900);
 assert.ok(await page.locator('.incident-dock article.critical').count(),'Um incidente crítico deve ser anunciado');
 assert.ok(await page.locator('[data-incident-kind]').count(),'O tipo observável deve estar presente no DOM');
 assert.ok(await page.locator('canvas').isVisible(),'A camada de incidentes deve compartilhar a mesa WebGL');
 const output=path.resolve('docs/evidence/incidents');await mkdir(output,{recursive:true});await page.screenshot({path:path.join(output,'visual-incidents.png'),fullPage:true});
 assert.deepEqual(errors,[]);console.log('Browser: incidentes observáveis, prioridade crítica e mesa WebGL passaram.');
}finally{await browser.close();await app.close();}
