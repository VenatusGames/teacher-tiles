const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--unsafely-treat-insecure-origin-as-secure=http://tiles.test']});try{
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('teacherTilesSandboxCoinsEnabled','true');window.Audio=class extends EventTarget{constructor(src){super();Object.assign(this,{src,paused:true,volume:1,currentTime:0,duration:20})}play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true}load(){}removeAttribute(){}cloneNode(){return new Audio(this.src)}};window.notices=[];window.Notification=class{static permission='granted';constructor(title,options){notices.push({title,...options})}}});
await page.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(process.cwd(),decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));return u.hostname==='tiles.test'&&fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.abort()});
await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1800);

await page.evaluate(()=>{document.getElementById('profile-modal').hidden=true;document.getElementById('shop-toggle').click()});await page.waitForTimeout(600);

await page.locator('.shop-category-grid').scrollIntoViewIfNeeded();
await page.locator('.shop-category-grid').screenshot({path:'C:/Users/Jack/.codex/visualizations/2026/09/21/01a0c154-6a92-74e3-80e0-b301d930cec6/shop-collections.png'});
for(const card of await page.locator('.shop-category').all()){const b=await card.boundingBox();assert(b.height>=235);assert(b.width/b.height<1.2)}
await page.setViewportSize({width:390,height:844});await page.locator('.shop-category-grid').scrollIntoViewIfNeeded();await page.locator('.shop-category-grid').screenshot({path:'C:/Users/Jack/.codex/visualizations/2026/09/21/01a0c154-6a92-74e3-80e0-b301d930cec6/shop-collections-mobile.png'});
assert.equal(await page.evaluate(()=>document.querySelector('.shop-category-grid').scrollWidth>document.querySelector('.shop-category-grid').clientWidth),false);
assert.deepEqual(errors,[]);console.log('Collection layout passed on desktop and mobile');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});