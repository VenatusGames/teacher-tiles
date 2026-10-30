const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1400,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(process.cwd(),decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));return u.hostname==='tiles.test'&&fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.abort()});
 await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1400);
 await page.evaluate(()=>{document.getElementById('profile-modal').hidden=true;boardCamera.x=boardCamera.y=0;boardCamera.scale=1;applyBoardCamera();createModule('writinglines',350,100)});
 const skins=await page.evaluate(()=>TILE_SKIN_CATALOG.filter(s=>s.tileType==='writinglines'));assert.equal(skins.length,5);
 const tile=page.locator('#workspace .writinglines-module');
 await tile.evaluate(m=>applyTileSkinToModule(m,'writinglines-arcade'));assert.equal(await tile.getAttribute('data-tile-skin'),null);
 await tile.hover();await tile.locator('.tile-skins-toggle').click();assert.equal(await page.locator('.tile-skins-choice.is-locked').count(),5);await page.keyboard.press('Escape');
 await page.evaluate(ids=>localStorage.setItem(SHOP_OWNED_PRODUCTS_KEY,JSON.stringify(ids)),skins.map(s=>s.productId));
 await tile.hover();await tile.locator('.writinglines-toggle-type').click();
 await tile.locator('.writinglines-entry').first().fill('Aa Bb Cc');await tile.locator('.writinglines-entry').nth(1).fill('Happy day');
 await tile.locator('.writinglines-toggle-type').evaluate(b=>b.click());assert.equal(await tile.getAttribute('data-writing-mode'),'practice');
 for(const skin of skins){
  await tile.evaluate((m,id)=>applyTileSkinToModule(m,id),skin.id);await page.waitForTimeout(150);
  assert.equal(await tile.getAttribute('data-tile-skin'),skin.id);
  assert.equal(await tile.locator('.writinglines-entry').first().textContent(),'Aa Bb Cc');
  assert.equal(await tile.locator('.writinglines-entry').nth(1).textContent(),'Happy day');
  assert((await tile.locator('.writinglines-paper').evaluate(e=>getComputedStyle(e).backgroundImage)).includes(skin.id.replace('writinglines-','')+'.svg'));
  for(const [w,h] of [[330,140],[560,350],[800,560]]){
   await tile.evaluate(async(m,[w,h])=>{const handle=m.querySelector('[data-resize=br]');handle.dispatchEvent(new Event('pointerdown'));m.style.width=w+'px';m.style.height=h+'px';await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));handle.dispatchEvent(new Event('pointerup'));},[w,h]);await page.waitForTimeout(180);
   assert(await tile.locator('.writinglines-paper').evaluate(p=>{const box=p.getBoundingClientRect();return [...p.querySelectorAll('.writinglines-row:not([hidden])')].every(row=>{const r=row.getBoundingClientRect();return r.left>=box.left&&r.right<=box.right+1&&r.top>=box.top&&r.bottom<=box.bottom+1;})}),skin.id+' rows fit at '+w+'x'+h);
  }
  for(let i=0;i<4;i++){
   await tile.locator('.writinglines-count').evaluate(b=>b.click());await page.waitForTimeout(80);
   assert.equal(await tile.locator('.writinglines-row:not([hidden])').count(),Number(await tile.getAttribute('data-line-count')));
  }
  const state=await tile.evaluate(m=>m._boardGetState());await page.evaluate(()=>TeacherTilesBoard.load(TeacherTilesBoard.capture()));assert.deepEqual(await tile.evaluate(m=>m._boardGetState()),state);
  assert.equal(await tile.getAttribute('data-tile-skin'),skin.id);
  const shop=page.locator(`[data-shop-product="${skin.productId}"]`).first();assert.equal(await shop.getAttribute('data-shop-price'),'250');
 }
 // A saved board preview retains the frame, writing guides, and noneditable text.
 await tile.evaluate(async m=>{const {createBoardPreview}=await import('/boards/preview.js?v=20261026-writing-skins');const host=document.createElement('div');host.id='test-preview';host.style.cssText='position:fixed;right:0;top:0;width:400px;height:250px';host.append(createBoardPreview({theme:'light',inlineObjects:[serializeBoardModule(m)]}));document.body.append(host)});await page.waitForTimeout(200);
 assert.equal(await page.locator('#test-preview .writinglines-entry').first().textContent(),'Aa Bb Cc');assert.equal(await page.locator('#test-preview [data-tile-skin]').getAttribute('data-tile-skin'),'writinglines-index');await page.locator('#test-preview').evaluate(e=>e.remove());
 await tile.evaluate(m=>applyTileSkinToModule(m,''));assert.equal(await tile.getAttribute('data-tile-skin'),null);assert.equal(await tile.locator('.writinglines-entry').first().textContent(),'Aa Bb Cc');
 const flashcardDescriptions=await page.locator('[data-shop-tile-type="flashcards"] p').allTextContents();assert.equal(flashcardDescriptions.length,10);assert(flashcardDescriptions.every(t=>t.includes('Works with all flashcard tiles.')&&!t.includes('all five')));
 await page.evaluate(skins=>{for(const m of workspace.querySelectorAll('.module')){m._cleanup?.();m.remove()}[...skins,null].forEach((s,i)=>{const m=createModule('writinglines',350,100,{tileSkin:s?.id||''});m.style.left=(40+i%2*660)+'px';m.style.top=(65+Math.floor(i/2)*340)+'px';m.style.width='620px';m._boardSetState({lines:['Aa Bb Cc','Happy day','Practice'],mode:'practice',lineCount:3,preferredHeight:310});})},skins);
 await page.mouse.move(1370,1080);await page.waitForTimeout(500);
 if(process.env.WRITING_SKINS_SCREENSHOT)await page.screenshot({path:process.env.WRITING_SKINS_SCREENSHOT});
 assert.deepEqual(errors,[]);console.log('Five Writing Lines skins: ownership, shop copy, typing-off preservation, 1–4 rows, three sizes, save/restore, and previews passed.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
