const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--unsafely-treat-insecure-origin-as-secure=http://tiles.test']});try{
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('teacherTilesSandboxCoinsEnabled','true');window.Audio=class extends EventTarget{constructor(src){super();Object.assign(this,{src,paused:true,volume:1,currentTime:0,duration:20})}play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true}load(){}removeAttribute(){}cloneNode(){return new Audio(this.src)}};window.notices=[];window.Notification=class{static permission='granted';constructor(title,options){notices.push({title,...options})}}});
await page.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(process.cwd(),decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));return u.hostname==='tiles.test'&&fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.abort()});

await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1800);
await page.evaluate(()=>{document.getElementById('profile-modal').hidden=true;localStorage.setItem('teacherTilesOwnedShopPacks',JSON.stringify(TeacherTilesCursorPacks.map(p=>p.productId)));window.dispatchEvent(new CustomEvent('teachertiles:shopownershipchange'))});
await page.evaluate(()=>document.getElementById('cursors-shelf-toggle').click());
await page.waitForTimeout(450);
const favorite=page.locator('.cursor-picker-cell').first().locator('.cursor-picker-favorite');
await page.mouse.move(1400,100);await page.waitForTimeout(200);
assert.equal(await favorite.evaluate(el=>getComputedStyle(el).opacity),'0');
await page.locator('.cursor-picker-cell').first().hover();await page.waitForTimeout(200);
assert.equal(await favorite.evaluate(el=>getComputedStyle(el).opacity),'1');
assert.equal(await favorite.evaluate(el=>getComputedStyle(el).borderRadius),'50%');
await favorite.click();await page.mouse.move(1400,100);await page.waitForTimeout(200);
assert.equal(await page.locator('.cursor-picker-favorite').first().getAttribute('aria-pressed'),'true');
assert.equal(await page.locator('.cursor-picker-choice').first().innerText(),'Default');
assert((await page.locator('.cursor-picker-choice').first().boundingBox()).height<=90);
assert((await page.locator('.cursor-picker-choice img').first().boundingBox()).width<=26);
await page.screenshot({path:'C:/Users/Jack/.codex/visualizations/2026/09/21/01a0c154-6a92-74e3-80e0-b301d930cec6/compact-cursor-shelf.png'});
await page.evaluate(()=>document.getElementById('asset-shelf-close').click());
// Slow the first grab image deliberately: a pack must not activate partially loaded.
let releaseGrab;const grabRequested=new Promise(resolve=>{releaseGrab={requested:resolve}});
await page.route('**/gauntlet-copper-grab.png*',async route=>{releaseGrab.requested();await new Promise(resolve=>{releaseGrab.resolve=resolve});await route.fulfill({path:path.join(process.cwd(),'assets/cursors/gauntlet-copper-grab.png')})});
await page.evaluate(()=>applyAppCursor('gauntlet-copper'));
await grabRequested;
assert.equal(await page.evaluate(()=>document.body.classList.contains('has-custom-cursor')),false,'do not activate until every sprite is decoded');
releaseGrab.resolve();
await page.waitForFunction(()=>document.documentElement.style.getPropertyValue('--teacher-cursor-grab').includes('gauntlet-copper-grab'));
assert.equal(await page.evaluate(()=>document.body.classList.contains('has-custom-cursor')),true);
await page.evaluate(()=>{applyAppCursor('gauntlet-gold');applyAppCursor('default')});await page.waitForTimeout(100);
assert.equal(await page.evaluate(()=>document.body.classList.contains('has-custom-cursor')),false,'a completed preload must not override a newer selection');
await page.evaluate(()=>applyAppCursor('pickaxe-diamond'));
await page.waitForFunction(()=>document.documentElement.style.getPropertyValue('--teacher-cursor-grab').includes('pickaxe-diamond-grab'));
for(const [button,kind] of [[0,'left'],[2,'right'],[1,'middle']]){
 await page.evaluate(button=>document.dispatchEvent(new PointerEvent('pointerdown',{button,clientX:700,clientY:200,pointerType:'mouse'})),button);
 assert(await page.locator('.cursor-particle--'+kind).count());
 assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).cursor),'none');
 assert(await page.locator('.pickaxe-click-swing').count());
}
await page.evaluate(()=>document.dispatchEvent(new MouseEvent('dblclick',{clientX:700,clientY:200})));
assert(await page.locator('.cursor-particle--double').count());
await page.evaluate(()=>{for(let i=0;i<30;i++)document.dispatchEvent(new PointerEvent('pointerdown',{button:0,clientX:700,clientY:200}))});
assert(await page.locator('.cursor-particle').count()<=72);
await page.waitForTimeout(650);assert.equal(await page.locator('.cursor-particle').count(),0);
await page.emulateMedia({reducedMotion:'reduce'});
await page.evaluate(()=>document.dispatchEvent(new PointerEvent('pointerdown',{button:0,clientX:700,clientY:200})));
assert.equal(await page.locator('.cursor-particle').count(),0);
await page.emulateMedia({reducedMotion:'no-preference'});
await page.evaluate(()=>applyAppCursor('default'));
for(const type of ['abc','numberflashcards','cvcword','highfrequency','customflashcards']){
 const aligned=await page.evaluate(type=>{const m=createModule(type,300,240),h=m.querySelector('header'),title=h.querySelector('div'),counter=h.querySelector('.flashcard-counter');const aligned=Math.abs(title.getBoundingClientRect().left-h.getBoundingClientRect().left)<2&&getComputedStyle(h).flexDirection==='row'&&counter.getBoundingClientRect().left>title.getBoundingClientRect().left;m._cleanup?.();m.remove();return aligned},type);
 assert(aligned,type+' heading remains on the left at its default size');
}
await page.evaluate(()=>{const p=screenToBoard(750,250);createModule('coinflip',p.x,p.y)});
assert((await page.locator('.coinflip-heads use').getAttribute('href')).includes('subscriber-crown.svg'));
await page.screenshot({path:'C:/Users/Jack/.codex/visualizations/2026/09/21/01a0c154-6a92-74e3-80e0-b301d930cec6/crown-coin.png'});
await page.evaluate(()=>document.getElementById('theme-shelf-toggle').click());await page.waitForTimeout(400);
const centered=await page.locator('.theme-picker-pack-locked .theme-pack-stack').first().evaluate(el=>{const s=getComputedStyle(el,'::after');return {left:parseFloat(s.left),top:parseFloat(s.top),width:el.offsetWidth,height:el.offsetHeight,background:s.backgroundImage}});
assert(Math.abs(centered.left-centered.width/2)<1&&Math.abs(centered.top-centered.height/2)<1);
assert(centered.background.includes('20260927-gold'));
assert.deepEqual(errors,[]);
console.log('Compact favorites, all-state preload/race safety, four bounded particle effects, reduced motion, left headings, crown coin and centered gold locks passed.');
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
