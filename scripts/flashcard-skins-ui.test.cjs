const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const types=['abc','numberflashcards','cvcword','highfrequency','customflashcards'];
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
const page=await browser.newPage({viewport:{width:1200,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(process.cwd(),decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));return u.hostname==='tiles.test'&&fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.abort()});
await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1600);
await page.evaluate(()=>{document.getElementById('profile-modal').hidden=true;boardCamera.x=boardCamera.y=0;boardCamera.scale=1;applyBoardCamera();});
const skins=await page.evaluate(types=>TILE_SKIN_CATALOG.filter(s=>s.tileType==='flashcards'),types);
assert.equal(skins.length,10);
// Unowned skins cannot be applied; the drawer exposes ten locked choices.
await page.evaluate(()=>createModule('abc',60,70));
let tile=page.locator('#workspace .flashcard-module').first();
await tile.evaluate(m=>applyTileSkinToModule(m,'flashcard-blocks'));
assert.equal(await tile.getAttribute('data-tile-skin'),null);
await tile.hover();await tile.locator('.tile-skins-toggle').click();
assert.equal(await page.locator('.tile-skins-choice.is-locked').count(),10);
await page.getByRole('button',{name:'Close Skins',exact:true}).click();
await page.evaluate(ids=>localStorage.setItem(SHOP_OWNED_PRODUCTS_KEY,JSON.stringify(ids)),skins.map(s=>s.productId));
await page.evaluate(()=>{for(const m of workspace.querySelectorAll('.module')){m._cleanup?.();m.remove();}});
for(const type of types){
 await page.evaluate(type=>{
  const m=createModule(type,60,70);Object.assign(m.style,{width:'530px',height:'490px'});
  if(type==='customflashcards')m._boardSetState({activeSetId:'test',currentCardId:'one',remainingCardIds:['two','three'],sets:[{id:'test',name:'Nature',cards:[{id:'one',text:'First card'},{id:'two',text:'Second card'},{id:'three',text:'Third card'}]}]});
 },type);
 tile=page.locator('#workspace .flashcard-module');
 await tile.hover();await page.waitForTimeout(350);
 const hoverH=(await tile.locator('.flashcard-surface').boundingBox()).height;
 assert.equal(await tile.locator('.flashcard-tools').evaluate(e=>getComputedStyle(e).visibility),'visible');
 const before=await tile.evaluate(m=>m._boardGetState().cardNavigation.index);
 await tile.locator('.flashcard-forward').click();await page.waitForTimeout(240);
 assert.equal(await tile.evaluate(m=>m._boardGetState().cardNavigation.index),before+1);
 await tile.locator('.flashcard-back').click();await page.waitForTimeout(240);
 assert.equal(await tile.evaluate(m=>m._boardGetState().cardNavigation.index),before);
 await page.mouse.move(1100,900);await page.waitForTimeout(400);
 const restH=(await tile.locator('.flashcard-surface').boundingBox()).height;
 assert(restH>hoverH+50,`${type} should expand on unhover: ${hoverH} -> ${restH}`);
 assert.equal(await tile.locator('.flashcard-tools').evaluate(e=>getComputedStyle(e).visibility),'hidden');
 // Mouse-click focus must not leave the controls stuck visible.
 await tile.hover();await tile.locator('select').first().focus();await page.mouse.move(1100,900);await page.waitForTimeout(350);
 await page.evaluate(()=>document.activeElement.blur());
 await tile.hover();await tile.locator('.tile-skins-toggle').click();
 assert.equal(await page.locator('.tile-skins-choice').count(),11);
 assert.equal(await page.locator('.tile-skins-choice.is-locked').count(),0);
 await page.getByRole('button',{name:'Close Skins',exact:true}).click();
 for(const skin of skins){
  const state=await tile.evaluate(m=>m._boardGetState());
  await tile.evaluate((m,id)=>applyTileSkinToModule(m,id),skin.id);await page.waitForTimeout(200);
  assert.equal(await tile.getAttribute('data-tile-skin'),skin.id);
  assert.deepEqual(await tile.evaluate(m=>m._boardGetState()),state);
  assert((await tile.locator('.flashcard-surface').evaluate(e=>getComputedStyle(e).backgroundImage)).includes(skin.id+'.svg'));
  const shop=page.locator(`[data-shop-product="${skin.productId}"]`).first();assert.equal(await shop.getAttribute('data-shop-price'),'250');
 }
 await tile.locator('.module-fullscreen').evaluate(e=>e.click());await page.waitForFunction(()=>!!document.fullscreenElement);assert(await tile.evaluate(m=>document.activeElement===m));
 await page.keyboard.press('Space');await page.waitForTimeout(220);assert.equal(await tile.evaluate(m=>m._boardGetState().cardNavigation.index),1,`${type} fullscreen Space`);
 await page.keyboard.press('ArrowRight');await page.waitForTimeout(220);assert.equal(await tile.evaluate(m=>m._boardGetState().cardNavigation.index),2);
 await page.keyboard.press('ArrowLeft');await page.waitForTimeout(220);assert.equal(await tile.evaluate(m=>m._boardGetState().cardNavigation.index),1);
 // Dropdown keyboard input must not change the card.
 await tile.hover();await tile.locator('select').first().focus();await page.keyboard.press('ArrowLeft');assert.equal(await tile.evaluate(m=>m._boardGetState().cardNavigation.index),1);
 await page.evaluate(()=>document.activeElement.blur());
 if(type==='customflashcards'){
  await page.keyboard.press('Space');await page.keyboard.press('Space');await page.waitForTimeout(250);
  assert(await tile.evaluate(m=>m._boardGetState().completed),'Space completes the set');
  await page.keyboard.press('Space');await page.waitForTimeout(520);
  assert.equal(await tile.evaluate(m=>m._boardGetState().completed),false,'Space shuffles a completed set');
 }
 await page.evaluate(()=>document.exitFullscreen());await page.waitForTimeout(200);
 const state=await tile.evaluate(m=>m._boardGetState());
 await page.keyboard.press('ArrowRight');assert.deepEqual(await tile.evaluate(m=>m._boardGetState()),state);
 await page.evaluate(()=>TeacherTilesBoard.load(TeacherTilesBoard.capture()));assert.deepEqual(await tile.evaluate(m=>m._boardGetState()),state);
 assert.equal(await tile.getAttribute('data-tile-skin'),skins.at(-1).id);
 await tile.evaluate(async m=>{
  const {createBoardPreview}=await import('/boards/preview.js?v=20261026-flashcards');
  const host=document.createElement('div');host.id='test-flashcard-preview';host.style.cssText='position:fixed;right:0;top:0;width:350px;height:240px;z-index:99999';
  host.append(createBoardPreview({theme:'light',inlineObjects:[serializeBoardModule(m)]}));document.body.append(host);
 });
 await page.waitForTimeout(250);
 const preview=page.locator('#test-flashcard-preview .flashcard-preview');
 assert.equal(await preview.getAttribute('data-tile-skin'),skins.at(-1).id);
 assert(await preview.locator('.flashcard-surface').evaluate(e=>getComputedStyle(e).backgroundImage.includes('flashcard-index.svg')));
 assert(await preview.locator('.abc-letter,.cvcword-word,.highfrequency-word,.customflashcards-text').first().evaluate(e=>e.textContent.length>0&&getComputedStyle(e).visibility!=='hidden'),type+' preview displays its card');
 await page.locator('#test-flashcard-preview').evaluate(e=>e.remove());
 await tile.evaluate(m=>applyTileSkinToModule(m,''));assert.equal(await tile.getAttribute('data-tile-skin'),null);
 await page.evaluate(()=>{for(const m of workspace.querySelectorAll('.module')){m._cleanup?.();m.remove();}});
 console.log(type+': collapse, controls, skins, save/restore and fullscreen keyboard passed');
}
await page.setViewportSize({width:1200,height:2650});
await page.evaluate(skins=>{boardCamera.x=boardCamera.y=0;boardCamera.scale=1;applyBoardCamera();skins.forEach((s,i)=>{const m=createModule(['abc','numberflashcards','cvcword','highfrequency','customflashcards'][Math.floor(i/2)],40+(i%2)*560,80+Math.floor(i/2)*505,{tileSkin:s.id});Object.assign(m.style,{left:(40+(i%2)*560)+'px',top:(80+Math.floor(i/2)*505)+'px',width:'530px',height:'470px'});if(i>=8)m._boardSetState({activeSetId:'a',currentCardId:'one',remainingCardIds:[],sets:[{id:'a',name:s.name,cards:[{id:'one',text:'Explore'}]}]});});},skins);
await page.mouse.move(1190,2640);await page.waitForTimeout(800);
if(process.env.FLASHCARD_SCREENSHOT)await page.screenshot({path:process.env.FLASHCARD_SCREENSHOT});
// A single shared purchase is sufficient on every type, but never on unrelated tiles.
await page.evaluate(types=>{
 localStorage.setItem(SHOP_OWNED_PRODUCTS_KEY,JSON.stringify(['tile-skin-flashcard-arcade']));
 for(const type of types){const m=createModule(type,100,100,{tileSkin:'flashcard-arcade'});if(m.dataset.tileSkin!=='flashcard-arcade')throw Error('Shared ownership failed: '+type);m._cleanup?.();m.remove();}
 const clock=createModule('clock',100,100,{tileSkin:'flashcard-arcade'});if(clock.dataset.tileSkin)throw Error('Flashcard skin applied to a clock');clock._cleanup?.();clock.remove();
},types);
// Custom images remain within the new frame, including with captions.
await page.setViewportSize({width:1200,height:1000});
await page.evaluate(()=>{
 for(const m of workspace.querySelectorAll('.module')){m._cleanup?.();m.remove();}
 const m=createModule('customflashcards',350,100,{tileSkin:'flashcard-arcade'});
 const canvas=document.createElement('canvas');canvas.width=480;canvas.height=240;const c=canvas.getContext('2d');c.fillStyle='#9ebeb2';c.fillRect(0,0,480,240);c.fillStyle='#ffe0a1';c.beginPath();c.arc(350,70,35,0,7);c.fill();
 m._boardSetState({activeSetId:'a',currentCardId:'image',remainingCardIds:[],sets:[{id:'a',name:'Image Test',cards:[{id:'image',text:'A sunny day',imageSrc:canvas.toDataURL()}]}]});
});await page.waitForTimeout(300);
assert(await page.locator('#workspace .customflashcards-image').evaluate(img=>{const r=img.getBoundingClientRect(),c=img.closest('.flashcard-surface').getBoundingClientRect();return img.complete&&img.naturalWidth>0&&r.top>=c.top&&r.bottom<=c.bottom&&r.left>=c.left&&r.right<=c.right;}));
await page.evaluate(()=>TeacherTilesShop.openProduct('tile-skin-flashcard-arcade'));await page.waitForTimeout(400);
assert.equal(await page.locator('.shop-product-popup .shop-product__type').textContent(),'FLASHCARD TILE SKIN');
assert(await page.locator('.shop-product-popup .tile-skin-art img').evaluate(img=>img.complete&&img.naturalWidth>0));
if(process.env.FLASHCARD_SCREENSHOT)await page.screenshot({path:process.env.FLASHCARD_SCREENSHOT.replace('.png','-shop.png')});
assert.deepEqual(errors,[]);console.log('Ten shared skins: all 50 combinations, previews, ownership, image fit and keyboard checks passed');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
