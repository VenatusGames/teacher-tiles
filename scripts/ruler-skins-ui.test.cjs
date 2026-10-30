const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1400,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(process.cwd(),decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));return u.hostname==='tiles.test'&&fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.abort()});
 await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1400);
 await page.evaluate(()=>{document.getElementById('profile-modal').hidden=true;boardCamera.x=boardCamera.y=0;boardCamera.scale=1;applyBoardCamera();createModule('ruler',200,150)});
 const tile=page.locator('#workspace .ruler-module');const skins=await page.evaluate(()=>TILE_SKIN_CATALOG.filter(s=>s.tileType==='ruler'));assert.equal(skins.length,3);
 await tile.evaluate(m=>applyTileSkinToModule(m,'ruler-metal'));assert.equal(await tile.getAttribute('data-tile-skin'),null);
 await tile.hover();await tile.locator('.tile-skins-toggle').click();assert.equal(await page.locator('.tile-skins-choice.is-locked').count(),3);await page.keyboard.press('Escape');
 await page.evaluate(ids=>localStorage.setItem(SHOP_OWNED_PRODUCTS_KEY,JSON.stringify(ids)),skins.map(s=>s.productId));
 for(const skin of [...skins,{id:''}]){
  await tile.evaluate((m,id)=>applyTileSkinToModule(m,id),skin.id);assert.equal(await tile.getAttribute('data-tile-skin'),skin.id||null);
  for(const [w,h]of [[500,265],[820,315],[1100,450]]){
   await tile.evaluate((m,[w,h])=>{boardCamera.x=boardCamera.y=0;boardCamera.scale=1;applyBoardCamera();m.style.width=w+'px';m.style.height=h+'px';m.style.left='80px';m.style.top='150px'},[w,h]);
   await tile.hover();await page.waitForTimeout(350);const hoverFace=await tile.locator('.ruler-face').boundingBox();
   assert(await tile.evaluate(m=>{const r=m.getBoundingClientRect();return [...m.querySelectorAll('.ruler-toolbar button')].every(b=>{const x=b.getBoundingClientRect();return x.left>=r.left&&x.right<=r.right&&x.top>=r.top&&x.bottom<=r.bottom-40})}),'toolbar fits '+w+' '+skin.id);
   const rulerStage=await tile.locator('.ruler-stage').boundingBox();assert(hoverFace.y>=rulerStage.y&&hoverFace.y+hoverFace.height<=rulerStage.y+rulerStage.height+1,'ruler face within stage');
   await page.evaluate(()=>document.activeElement?.blur());await page.mouse.move(1350,1050);await page.waitForTimeout(350);
   assert.equal(await tile.locator('.ruler-tools').evaluate(e=>getComputedStyle(e).visibility),'hidden');const restingFace=await tile.locator('.ruler-face').boundingBox();assert(restingFace.height>hoverFace.height+30,'ruler fills released control space');
  }
  await tile.evaluate(m=>m._boardSetState({unit:'in',a:.25,b:.75,active:'a'}));await tile.hover();await page.waitForTimeout(300);assert.equal(await tile.locator('.ruler-measurement').textContent(),'6 in');
  await tile.locator('[data-ruler-unit-option="cm"]').click();assert.equal(await tile.locator('.ruler-measurement').textContent(),'15 cm');
  assert.equal(await tile.locator('[data-ruler-unit-option="cm"]').getAttribute('aria-pressed'),'true');
  const state=await tile.evaluate(m=>m._boardGetState());await page.evaluate(()=>TeacherTilesBoard.load(TeacherTilesBoard.capture()));assert.deepEqual(await tile.evaluate(m=>m._boardGetState()),state);
  await tile.evaluate(async m=>{const {createBoardPreview}=await import('/boards/preview.js');const host=document.createElement('div');host.id='ruler-preview-test';host.style.cssText='position:fixed;top:0;right:0;width:400px;height:200px';host.append(createBoardPreview({theme:'light',inlineObjects:[serializeBoardModule(m)]}));document.body.append(host)});await page.waitForTimeout(150);
  assert.equal(await page.locator('#ruler-preview-test .ruler-measurement').textContent(),'15 cm');assert.equal(await page.locator('#ruler-preview-test .ruler-tick').count(),301);await page.locator('#ruler-preview-test').evaluate(e=>e.remove());
  if(skin.id==='ruler-clear')assert.equal(await tile.evaluate(m=>getComputedStyle(m).backgroundColor),'rgba(0, 0, 0, 0)');
  await page.evaluate(()=>{boardCamera.x=boardCamera.y=0;boardCamera.scale=1;applyBoardCamera()});await tile.hover();await page.waitForTimeout(300);await tile.locator('.ruler-reset').click();assert.equal(await tile.locator('.ruler-measurement').textContent(),'30 cm');
 }
 // Dragging still changes the same measurement scale after the control/layout changes.
 await tile.hover();await tile.locator('[data-ruler-unit-option="in"]').click();const stage=await tile.locator('.ruler-stage').boundingBox(),handle=await tile.locator('[data-ruler-handle="b"]').boundingBox();
 await page.mouse.move(handle.x+handle.width/2,handle.y+12);await page.mouse.down();await page.mouse.move(stage.x+stage.width*.5,handle.y+12,{steps:6});await page.mouse.up();assert.equal(await tile.locator('.ruler-measurement').textContent(),'6 in');
 await page.evaluate(skins=>{for(const m of workspace.querySelectorAll('.module')){m._cleanup?.();m.remove()}boardCamera.x=boardCamera.y=0;boardCamera.scale=1;applyBoardCamera();[...skins,{id:''}].forEach((s,i)=>{const m=createModule('ruler',100,100,{tileSkin:s.id});Object.assign(m.style,{left:(30+i%2*680)+'px',top:(100+Math.floor(i/2)*420)+'px',width:'650px',height:'330px'});m._boardSetState({unit:'in',a:.125,b:.875,active:'a'})})},skins);await page.mouse.move(1370,1080);await page.waitForTimeout(400);
 if(process.env.RULER_SKINS_SCREENSHOT)await page.screenshot({path:process.env.RULER_SKINS_SCREENSHOT});
 assert.deepEqual(errors,[]);console.log('Ruler skins, ownership, hover expansion, responsive controls, measurement, dragging, save/restore, and previews passed.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
