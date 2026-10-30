const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(process.cwd(),decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));return u.hostname==='tiles.test'&&fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.abort()});
await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1600);
await page.evaluate(()=>{document.getElementById('profile-modal').hidden=true;boardCamera.x=boardCamera.y=0;boardCamera.scale=1;applyBoardCamera();createModule('date',350,200)});
const skins=await page.evaluate(()=>TILE_SKIN_CATALOG.filter(s=>s.tileType==='date'));assert.equal(skins.length,3);
let tile=page.locator('#workspace .date-module');
await tile.evaluate(m=>applyTileSkinToModule(m,'date-desk'));assert.equal(await tile.getAttribute('data-tile-skin'),null);
await page.evaluate(ids=>localStorage.setItem(SHOP_OWNED_PRODUCTS_KEY,JSON.stringify(ids)),skins.map(s=>s.productId));
for(const skin of skins){
 await tile.evaluate((m,id)=>applyTileSkinToModule(m,id),skin.id);await page.waitForTimeout(100);
 assert.equal(await tile.getAttribute('data-tile-skin'),skin.id);
 for(const [w,h] of [[260,170],[430,260],[800,450]]){
  await tile.evaluate((m,[w,h])=>{m.style.width=w+'px';m.style.height=h+'px'},[w,h]);await page.waitForTimeout(200);
  await page.mouse.move(1300,900);await page.waitForTimeout(200);
  const faceBefore=await tile.locator('.date-face').boundingBox();await tile.hover();await page.waitForTimeout(220);const faceAfter=await tile.locator('.date-face').boundingBox();assert.deepEqual(faceAfter,faceBefore,'Date artwork stays stable on hover');
  await tile.locator('.tile-display-toggle').click();assert(await tile.locator('.tile-display-menu').evaluate(e=>e.matches(':popover-open')));
  await tile.locator('.tile-display-toggle').click();assert.equal(await tile.locator('.tile-display-menu').evaluate(e=>e.matches(':popover-open')),false);await tile.locator('.tile-display-toggle').click();
  for(const cls of ['date-style','date-layout','date-weekday-toggle','date-year-toggle']){
   const b=tile.locator('.'+cls);if(await b.isVisible())await b.click();
  }
  await tile.locator('.tile-display-menu-close').click();await page.mouse.move(1300,900);await page.waitForTimeout(240);
  assert(await tile.locator('.date-display').evaluate(d=>{const box=d.getBoundingClientRect();return [...d.children].filter(e=>!e.hidden).every(el=>{const r=el.getBoundingClientRect();return r.left>=box.left-1&&r.right<=box.right+1&&r.top>=box.top-1&&r.bottom<=box.bottom+1})}),skin.id+' fits '+w+'x'+h);
 }
 await page.evaluate(()=>TeacherTilesBoard.load(TeacherTilesBoard.capture()));assert.equal(await tile.getAttribute('data-tile-skin'),skin.id);
 assert.equal(await page.locator(`[data-shop-product="${skin.productId}"]`).first().getAttribute('data-shop-price'),'250');
}
await tile.evaluate(async m=>{const {createBoardPreview}=await import('/boards/preview.js');const host=document.createElement('div');host.id='date-test-preview';host.style.cssText='position:fixed;right:0;top:0;width:400px;height:250px';host.append(createBoardPreview({theme:'light',inlineObjects:[serializeBoardModule(m)]}));document.body.append(host)});await page.waitForTimeout(200);
assert.equal(await page.locator('#date-test-preview .date-main').textContent(),await tile.locator('.date-main').textContent());await page.locator('#date-test-preview').evaluate(e=>e.remove());
await page.evaluate(()=>{for(const m of workspace.querySelectorAll('.module')){m._cleanup?.();m.remove()}});
for(const type of ['abc','numberflashcards','cvcword','highfrequency','customflashcards']){
 await page.evaluate(type=>{const m=createModule(type,350,150);m.style.width='400px';m.style.height='400px';if(type==='customflashcards')m._boardSetState({activeSetId:'first',sets:[{id:'first',name:'First set with a very long descriptive name to test wrapping',cards:[{id:'a',text:'One'}]},{id:'second',name:'Second set',cards:[{id:'b',text:'Two'}]}]})},type);
 const m=page.locator('#workspace .flashcard-module'),trigger=m.locator('.flashcard-select-trigger'),menu=m.locator('.flashcard-select-menu');
 await m.hover();await page.waitForTimeout(250);await trigger.click();assert(await menu.evaluate(e=>e.matches(':popover-open')));
 await trigger.click();assert.equal(await menu.evaluate(e=>e.matches(':popover-open')),false,type+' second click closes');assert.equal(await trigger.getAttribute('aria-expanded'),'false');await trigger.click();
 assert(await menu.evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight}));
 await menu.getByRole('option').nth(1).click();assert.equal(await trigger.locator('span').textContent(),await m.locator('select').first().evaluate(e=>e.selectedOptions[0].textContent));
 await trigger.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('End');await page.keyboard.press('Enter');
 assert.equal(await m.locator('select').first().evaluate(e=>e.value),await m.locator('select').first().evaluate(e=>e.options[e.options.length-1].value));
 await trigger.click();await page.mouse.click(1200,850);assert.equal(await trigger.getAttribute('aria-expanded'),'false');
 await page.waitForTimeout(300);assert.equal(await m.locator('.flashcard-tools').evaluate(e=>getComputedStyle(e).visibility),'hidden');
 // Closed select borders and text fit inside the shelf, including narrow tile sizes.
 await m.evaluate(m=>{m.style.width='300px'});await m.hover();await page.waitForTimeout(250);
 assert(await trigger.evaluate(e=>{const r=e.getBoundingClientRect(),s=e.closest('.flashcard-set-controls').getBoundingClientRect();return r.left>=s.left&&r.right<=s.right&&r.top>=s.top&&r.bottom<=s.bottom}),type+' selector not clipped');
 if(type==='customflashcards'){await m.evaluate(m=>m._boardSetState({activeSetId:'new',sets:[{id:'new',name:'Updated set',cards:[{id:'c',text:'New'}]}]}));assert.equal(await trigger.locator('span').textContent(),'Updated set');}
 await m.evaluate(m=>{m._cleanup?.();m.remove()});assert.equal(await page.locator('.flashcard-select-menu').count(),0);
}
// Clock controls use the same drawer, including analog/digital switching.
await page.evaluate(()=>createModule('clock',350,200));
const clock=page.locator('#workspace .clock-module'),clockTrigger=clock.locator('.tile-display-toggle'),clockMenu=clock.locator('.tile-display-menu');
await clock.hover();await clockTrigger.click();assert(await clockMenu.evaluate(e=>e.matches(':popover-open')));
await clockTrigger.click();assert.equal(await clockMenu.evaluate(e=>e.matches(':popover-open')),false);
await clockTrigger.click();await clockMenu.locator('[data-clock-choice="analog"]').click();assert.equal(await clock.getAttribute('data-clock-mode'),'analog');assert.equal(await clockMenu.locator('.clock-toggle-seconds').isVisible(),false);
await clockMenu.locator('[data-clock-choice="digital"]').click();await clockMenu.locator('.clock-toggle-seconds').click();assert((await clock.getAttribute('class')).includes('show-seconds'));
await clockMenu.locator('.clock-toggle-period').click();assert((await clock.getAttribute('class')).includes('hide-period'));
await page.keyboard.press('Escape');assert.equal(await clockMenu.evaluate(e=>e.matches(':popover-open')),false);
await clockTrigger.click();await page.mouse.click(1200,850);assert.equal(await clockMenu.evaluate(e=>e.matches(':popover-open')),false);
await page.evaluate(()=>TeacherTilesBoard.load(TeacherTilesBoard.capture()));assert((await clock.getAttribute('class')).includes('show-seconds'));assert((await clock.getAttribute('class')).includes('hide-period'));
await clock.evaluate(m=>{m._cleanup?.();m.remove()});
await page.evaluate(skins=>{boardCamera.x=boardCamera.y=0;boardCamera.scale=1;applyBoardCamera();skins.forEach((s,i)=>{const m=createModule('date',100,100,{tileSkin:s.id});Object.assign(m.style,{left:(40+i*450)+'px',top:'90px',width:'420px',height:'310px'})});const m=createModule('highfrequency',200,500);Object.assign(m.style,{left:'400px',top:'470px',width:'530px',height:'420px'});},skins);
await page.locator('#workspace .highfrequency-module').hover();await page.waitForTimeout(250);await page.locator('#workspace .flashcard-select-trigger').click();await page.waitForTimeout(200);
if(process.env.DATE_SKINS_SCREENSHOT)await page.screenshot({path:process.env.DATE_SKINS_SCREENSHOT});
assert.deepEqual(errors,[]);console.log('Date skins, resizing, Date/Clock drawer toggles, save/restore, preview, and all five flashcard dropdown toggles passed.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
