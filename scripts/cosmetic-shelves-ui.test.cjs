const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--unsafely-treat-insecure-origin-as-secure=http://tiles.test']});try{
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('teacherTilesSandboxCoinsEnabled','true');window.Audio=class extends EventTarget{constructor(src){super();Object.assign(this,{src,paused:true,volume:1,currentTime:0,duration:20})}play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true}load(){}removeAttribute(){}cloneNode(){return new Audio(this.src)}};window.notices=[];window.Notification=class{static permission='granted';constructor(title,options){notices.push({title,...options})}}});
await page.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(process.cwd(),decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));return u.hostname==='tiles.test'&&fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.abort()});
await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1800);





await page.evaluate(()=>{document.getElementById('profile-modal').hidden=true;document.getElementById('shop-toggle').click()});await page.waitForTimeout(600);
await page.locator('[data-shop-open-page="cursors"]').first().click();await page.locator('[data-shop-product="cursor-soft-pack"]').scrollIntoViewIfNeeded();await page.waitForTimeout(700);await page.screenshot({path:'C:/Users/Jack/.codex/visualizations/2026/09/21/01a0c154-6a92-74e3-80e0-b301d930cec6/new-cursor-shop.png'});
await page.evaluate(()=>document.querySelector('[data-shop-close]').click());await page.evaluate(()=>document.getElementById('theme-shelf-toggle').click());await page.waitForTimeout(400);await page.screenshot({path:'C:/Users/Jack/.codex/visualizations/2026/09/21/01a0c154-6a92-74e3-80e0-b301d930cec6/locked-theme-packs.png'});await page.evaluate(()=>document.getElementById('asset-shelf-close').click());
await page.evaluate(()=>document.getElementById('sticker-shelf-toggle').click());await page.waitForTimeout(400);const lock=page.locator('.sticker-picker-pack-lock').first();await lock.scrollIntoViewIfNeeded();assert(await lock.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0));await page.screenshot({path:'C:/Users/Jack/.codex/visualizations/2026/09/21/01a0c154-6a92-74e3-80e0-b301d930cec6/locked-sticker-packs.png'});await page.evaluate(()=>document.getElementById('asset-shelf-close').click());
await page.evaluate(()=>{const p=screenToBoard(700,300);window.testTab=createModule('clock',p.x,p.y);TeacherTilesTabs.add(testTab);testTab=workspace.querySelector('.clock-module')});await page.waitForTimeout(200);const tab=page.locator('.clock-module');await tab.hover();await page.waitForTimeout(100);assert(await page.locator('.tile-tab-strip.is-expanded').count());
const moved=await page.evaluate(async()=>{const strip=workspace.querySelector('.tile-tab-strip'),before=strip.style.left;testTab.style.left=(parseFloat(testTab.style.left)+100)+'px';await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return{before,after:strip.style.left}});assert.notEqual(moved.before,moved.after);
await page.mouse.move(1400,50);await page.waitForTimeout(100);assert.equal(await page.locator('.tile-tab-strip.is-expanded').count(),0);
assert.deepEqual(errors,[]);console.log('Shelf screenshots and event-driven tab hover/movement passed');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
