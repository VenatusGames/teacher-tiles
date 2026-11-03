const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(process.cwd(),decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));return u.hostname==='tiles.test'&&fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.abort()});
 await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1800);
 await page.evaluate(()=>{document.getElementById('profile-modal').hidden=true;TeacherTilesBoard.load(TeacherTilesBoard.blank());Object.assign(boardCamera,{x:0,y:0,scale:1});applyBoardCamera();createModule('writinglines',450,150,{record:false});for(const type of ['magnifier','draw']){const m=createModule(type,900,150,{record:false});if(m.querySelector('.module-fullscreen')||ensureTileFullscreenControl(m)!==null)throw Error(type+' must not offer fullscreen')}});
 const tile=page.locator('#workspace .writinglines-module');await page.waitForTimeout(150);
 const before=await tile.evaluate(m=>({width:m.offsetWidth,height:m.offsetHeight,preferredHeight:m._boardGetState().preferredHeight}));
 await tile.locator('.module-fullscreen').evaluate(b=>b.click());await page.waitForFunction(()=>document.fullscreenElement?.dataset.type==='writinglines');await page.waitForTimeout(150);
 const sheet=()=>tile.evaluate(m=>{const p=m.querySelector('.writinglines-paper'),s=getComputedStyle(p),rows=[...p.querySelectorAll('.writinglines-row:not([hidden])')],b=p.getBoundingClientRect();return {rows:rows.length,available:p.clientHeight-parseFloat(s.paddingTop)-parseFloat(s.paddingBottom),used:rows.reduce((n,r)=>n+r.getBoundingClientRect().height,0),width:p.clientWidth,viewport:innerHeight,bounds:rows.every(r=>{const a=r.getBoundingClientRect();return a.top>=b.top-1&&a.bottom<=b.bottom+1&&a.left>=b.left-1&&a.right<=b.right+1}),preferred:m._boardGetState().preferredHeight}});
 const checkFill=async()=>{const s=await sheet();assert(s.bounds,JSON.stringify(s));assert(Math.abs(s.used-s.available)<2,JSON.stringify(s));assert(s.used>s.viewport*.65,'Rows should use the screen height');assert.equal(s.preferred,before.preferredHeight);return s};
 await checkFill();
 for(let n=4;n<=12;n++){await tile.locator('.writinglines-count').evaluate(b=>b.click());await page.waitForTimeout(40);assert.equal((await checkFill()).rows,n)}
 await tile.locator('.writinglines-toggle-type').evaluate(b=>b.click());
 await tile.locator('.writinglines-entry').nth(11).fill('Line twelve stays saved');
 await page.setViewportSize({width:1000,height:700});await page.waitForTimeout(150);await checkFill();
 await tile.locator('.writinglines-entry').first().fill('A longer handwriting example should not shrink the fullscreen sheet.');await page.waitForTimeout(100);await checkFill();
 await tile.locator('.writinglines-entry').first().fill('Aa Bb Cc');
 const saved=await page.evaluate(()=>TeacherTilesBoard.capture());
 assert.equal(saved.objects.find(o=>o.type==='writinglines').special.lineCount,12);
 await tile.locator('.module-fullscreen').evaluate(b=>b.click());await page.waitForFunction(()=>!document.fullscreenElement);await page.waitForTimeout(200);
 assert.equal(await tile.evaluate(m=>m.offsetWidth),before.width);assert.equal(await tile.evaluate(m=>m._boardGetState().preferredHeight),before.preferredHeight);
 await page.evaluate(saved=>TeacherTilesBoard.load(saved),saved);await page.waitForTimeout(150);
 assert.equal(await tile.locator('.writinglines-row:not([hidden])').count(),12);assert.equal(await tile.locator('.writinglines-entry').nth(11).textContent(),'Line twelve stays saved');
 for(const type of ['magnifier','draw'])assert.equal(await page.locator('#workspace [data-type="'+type+'"] .module-fullscreen').count(),0);
 await tile.evaluate(async m=>{const {createBoardPreview}=await import('/boards/preview.js');const host=document.createElement('div');host.id='preview-check';host.append(createBoardPreview({theme:'light',inlineObjects:[serializeBoardModule(m)]}));document.body.append(host)});await page.waitForTimeout(100);
 assert.equal(await page.locator('#preview-check .writinglines-row:not([hidden])').count(),12);assert.equal(await page.locator('#preview-check .writinglines-entry').nth(11).textContent(),'Line twelve stays saved');
 await page.locator('#preview-check').evaluate(e=>e.remove());
 for(const skin of ['writinglines-blocks','writinglines-storybook','writinglines-notebook','writinglines-arcade','writinglines-index']){
  await tile.evaluate((m,skin)=>{const state=serializeBoardModule(m);state.dataset.tileSkin=skin;restoreTileEdit(m,state)},skin);
  await tile.locator('.module-fullscreen').evaluate(b=>b.click());await page.waitForFunction(()=>document.fullscreenElement?.dataset.type==='writinglines');await page.waitForTimeout(100);await checkFill();
  await page.evaluate(()=>document.exitFullscreen());await page.waitForTimeout(100);
 }
 assert.deepEqual(errors,[]);console.log('Writing Lines fullscreen fill, 12 scalable lines, viewport changes, all skins, save/restore and preview preservation; Draw/Magnifier fullscreen exclusions passed.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
