import assert from 'node:assert/strict';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {createApp} from '../server/app';
import {createMatch,dispatch} from '../packages/session';
import {applyCommand} from '../packages/rules';

const dataDir=await mkdtemp(path.join(tmpdir(),'showdown-layout-')),denseId='cacecacecacecace',denseTokens:[string,string]=['dense-layout-player','dense-layout-opponent'];
let dense=createMatch('dense-cache-layout',['Bruno','Arquiteto IA']);dense=dispatch(dense,{type:'ready',player:0});dense=dispatch(dense,{type:'ready',player:1});dense.id=denseId;
let densePlayer=dense.players[0];densePlayer.ec=100;densePlayer.actions=100;
for(const [index,target] of ['data','next-cache-edge'].entries()){
 const uid=`dense-cache-${index}`;densePlayer.hand.push({uid,cardId:'cache'});
 const resolvedTarget=target==='data'?'data':densePlayer.graph.edges.find(edge=>edge.from==='dense-cache-0'&&edge.to==='db')!.id;
 densePlayer=applyCommand(densePlayer,{type:'play',uid,target:resolvedTarget,config:{}},[],'dense-cache-layout');
}
dense.players[0]=densePlayer;
await writeFile(path.join(dataDir,`room-${denseId}.json`),JSON.stringify({match:dense,tokens:denseTokens}));
const app=await createApp({dataDir,serveDir:path.resolve('dist'),now:()=>100000});
const base=await app.listen({host:'127.0.0.1',port:0});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl']});
try{
 const expectMargin=(boxes:{kind:string;box:{x:number;y:number;width:number;height:number}}[],minimum=12)=>{
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
   const a=boxes[i],b=boxes[j],gapX=Math.max(b.box.x-(a.box.x+a.box.width),a.box.x-(b.box.x+b.box.width)),gapY=Math.max(b.box.y-(a.box.y+a.box.height),a.box.y-(b.box.y+b.box.height));
   assert.ok(Math.max(gapX,gapY)>=minimum,`${a.kind} e ${b.kind} precisam de pelo menos ${minimum}px de respiro visual.`);
  }
 };
 const created=await (await fetch(base+'/api/matches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seed:'layout-39',names:['Bruno','Arquiteto IA']})})).json() as {id:string;tokens:[string,string]};
 const get=async(player=0)=>await (await fetch(`${base}/api/matches/${created.id}`,{headers:{Authorization:`Bearer ${created.tokens[player]}`}})).json() as any;
 const send=async(player:number,entry:any)=>{
  const view=await get(player),response=await fetch(`${base}/api/matches/${created.id}/command`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${created.tokens[player]}`},body:JSON.stringify({version:view.version,entry})});
  assert.equal(response.status,200,await response.text());
 };
 await send(0,{type:'ready'});await send(1,{type:'ready'});
 let view=await get(),cdn=view.player.hand.find((card:any)=>card.cardId==='cdn'),balancer=view.player.hand.find((card:any)=>card.cardId==='balancer');
 assert.ok(cdn&&balancer,'A seed de regressão deve conter CDN e Load Balancer na mão inicial.');
 await send(0,{type:'stage',command:{type:'play',uid:cdn.uid,target:'entry',config:{}}});
 view=await get();const cdnNode=view.player.graph.nodes.find((node:any)=>node.kind==='cdn'),edgeToApi=view.player.graph.edges.find((edge:any)=>edge.from===cdnNode.id&&edge.to==='api');
 await send(0,{type:'stage',command:{type:'play',uid:balancer.uid,target:edgeToApi.id,config:{}}});

 const page=await browser.newPage({viewport:{width:1207,height:900},reducedMotion:'reduce'});
 await page.goto(`${base}/?room=${created.id}&token=${created.tokens[0]}`);
 const dismissBriefing=async()=>{const button=page.getByRole('button',{name:'Entendi · ver tabuleiro'});if(await button.isVisible())await button.click();};
 await dismissBriefing();
 const kinds=['client','api','cdn','balancer'];
 await Promise.all(kinds.map(kind=>page.locator(`[data-node="${kind}"]`).waitFor()));
 await page.waitForTimeout(800);
 const boxes=await Promise.all(kinds.map(async kind=>({kind,box:(await page.locator(`[data-node="${kind}"]`).boundingBox())!})));
 expectMargin(boxes);
 await page.screenshot({path:path.resolve('docs/evidence/layout-spacing-horizontal.png')});

 await page.setViewportSize({width:1464,height:774});await page.goto(`${base}/?room=${denseId}&token=${denseTokens[0]}`);await dismissBriefing();
 await page.locator('[data-node="cache"]').nth(1).waitFor();await page.waitForTimeout(800);
 const denseLabels=page.locator('.node-label'),denseBoxes=[];
 for(let index=0;index<await denseLabels.count();index++)denseBoxes.push({kind:await denseLabels.nth(index).getAttribute('aria-label')??`nó ${index}`,box:(await denseLabels.nth(index).boundingBox())!});
 expectMargin(denseBoxes);
 await page.screenshot({path:path.resolve('docs/evidence/layout-spacing-diagonal.png')});
 console.log('Browser: cadeias horizontais e diagonais mantêm margem visual entre todos os componentes.');
}finally{await browser.close();await app.close();}
