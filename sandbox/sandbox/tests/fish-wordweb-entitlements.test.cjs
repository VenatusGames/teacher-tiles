const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--unsafely-treat-insecure-origin-as-secure=http://tiles.test']});try{
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('teacherTilesSandboxCoinsEnabled','true');window.Audio=class extends EventTarget{constructor(src){super();Object.assign(this,{src,paused:true,volume:1,currentTime:0,duration:20})}play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true}load(){}removeAttribute(){}cloneNode(){return new Audio(this.src)}};window.notices=[];window.Notification=class{static permission='granted';constructor(title,options){notices.push({title,...options})}}});
await page.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(process.cwd(),decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));return u.hostname==='tiles.test'&&fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.abort()});
await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1800);






await page.evaluate(async()=>{document.getElementById('profile-modal').hidden=true;window.TeacherTilesAdminAccess={required:true,allowed:true,developer:true};await import('/sandbox/dev-console.js');localStorage.setItem('teacherTilesOwnedShopPacks',JSON.stringify(Object.values(COLLECTION_PACK_PRODUCTS)));window.dispatchEvent(new CustomEvent('teachertiles:shopownershipchange'));document.querySelector('#sandbox-reset-owned-items').click()});
const retained=await page.evaluate(()=>[...document.querySelectorAll('[data-sticker-pack]')].filter(p=>COLLECTION_PACK_PRODUCTS[p.id]).filter(p=>{const d=document.getElementById(p.getAttribute('aria-controls'));return [...d.querySelectorAll('.sticker-shelf-item')].some(s=>ownsCosmetic(shelfEntitlement(s)))}).map(p=>p.id));assert.deepEqual(retained,[]);

await page.evaluate(()=>localStorage.setItem('teacherTilesOwnedShopPacks',JSON.stringify(['theme-outer-space','theme-frosted-window'])));
for(const theme of ['outer-space-light','outer-space','frosted-window-light','frosted-window']){
 await page.evaluate(t=>applyTeacherTheme(t),theme);assert.equal(await page.evaluate(()=>document.body.dataset.theme),theme);assert.equal(await page.evaluate(()=>document.body.classList.contains('dark')),!theme.endsWith('-light'));
 const before=await page.locator('.animated-board-backdrop').evaluate(c=>c.toDataURL());await page.waitForTimeout(150);assert.notEqual(await page.locator('.animated-board-backdrop').evaluate(c=>c.toDataURL()),before,'Backdrop should animate');
}
await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(50);const still=await page.locator('.animated-board-backdrop').evaluate(c=>c.toDataURL());await page.waitForTimeout(150);assert.equal(await page.locator('.animated-board-backdrop').evaluate(c=>c.toDataURL()),still);await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>applyTeacherTheme('light'));assert(await page.locator('.animated-board-backdrop').isHidden());
await page.evaluate(()=>{const p=screenToBoard(720,350);window.wordTile=createModule('wordweb',p.x,p.y)});
await page.locator('.wordweb-center').evaluate(el=>{el.textContent='Exploring wonderful ideas about our amazing natural world';el.dispatchEvent(new Event('input',{bubbles:true}))});await page.waitForTimeout(300);
const size=await page.locator('.wordweb-center').evaluate(el=>({w:el.offsetWidth,h:el.offsetHeight,scroll:el.scrollHeight,client:el.clientHeight}));assert.equal(size.w,size.h);assert(size.scroll<=size.client+1);
await page.screenshot({path:'C:/Users/Jack/.codex/visualizations/2026/09/21/01a0c154-6a92-74e3-80e0-b301d930cec6/word-web-fit.png'});
await page.evaluate(()=>{window.framesForFish=new Map();window.frameCounter=0;window.fakeNow=performance.now();window.requestAnimationFrame=fn=>{const id=++frameCounter;framesForFish.set(id,fn);return id};window.cancelAnimationFrame=id=>framesForFish.delete(id);window.stepFish=n=>{for(let i=0;i<n;i++){fakeNow+=100;const callbacks=[...framesForFish.values()];framesForFish.clear();callbacks.forEach(fn=>fn(fakeNow))}};window.fishLoud=true;const track={stop(){},addEventListener(){}};Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>({getTracks:()=>[track],getAudioTracks:()=>[track]})});window.AudioContext=class{state='running';resume(){return Promise.resolve()}close(){return Promise.resolve()}createAnalyser(){return{fftSize:1024,getByteTimeDomainData(a){a.fill(window.fishLoud?255:128)}}}createMediaStreamSource(){return{connect(){}}}};const p=screenToBoard(900,500);window.fishTile=createModule('fishtank',p.x,p.y);fishTile._boardSetState({mode:'microphone',fish:[0,1,2,3,7,8,9,10,11]});fishTile.querySelector('.fish-mic').click()});
await page.waitForTimeout(100);await page.evaluate(()=>stepFish(35));assert.equal(await page.evaluate(()=>fishTile._boardGetState().fish.length),0,'Scared fish are removed from the saved collection');
await page.evaluate(()=>{fishLoud=false;stepFish(65)});assert.equal(await page.evaluate(()=>fishTile._boardGetState().fish.length),0,'School does not return together');
await page.evaluate(()=>stepFish(35));assert.equal(await page.evaluate(()=>fishTile._boardGetState().fish.length),1,'One fish returns after calm');
await page.evaluate(()=>stepFish(80));assert.equal(await page.evaluate(()=>fishTile._boardGetState().fish.length),2,'Next arrival is a single fish');
await page.evaluate(()=>fishTile._boardSetState({mode:'ambient',fish:[]}));assert.equal(await page.evaluate(()=>fishTile._boardGetState().fish.length),0,'Empty recovery state survives restore');
assert.deepEqual(errors,[]);console.log('Dev reset locks every paid sticker pack; Word Web remains circular; fish recover one at a time and save the reduced collection');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});