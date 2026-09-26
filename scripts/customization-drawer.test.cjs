const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--unsafely-treat-insecure-origin-as-secure=http://tiles.test']});try{
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('teacherTilesSandboxCoinsEnabled','true');window.Audio=class extends EventTarget{constructor(src){super();Object.assign(this,{src,paused:true,volume:1,currentTime:0,duration:20})}play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true}load(){}removeAttribute(){}cloneNode(){return new Audio(this.src)}};window.notices=[];window.Notification=class{static permission='granted';constructor(title,options){notices.push({title,...options})}}});
await page.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(process.cwd(),decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));return u.hostname==='tiles.test'&&fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.abort()});
await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1800);






await page.evaluate(()=>{document.getElementById('profile-modal').hidden=true;document.getElementById('customize-toggle').click()});
assert(await page.locator('#asset-shelf').evaluate(el=>el.classList.contains('is-open')));
for(const id of ['cursors-shelf-toggle','theme-shelf-toggle']){await page.locator('#'+id).click();assert(await page.locator('#asset-shelf').evaluate(el=>el.classList.contains('is-open')))}
await page.locator('#cursors-shelf-toggle').click();await page.waitForTimeout(500);
assert.equal(await page.locator('.cursor-picker-choice span').first().evaluate(el=>getComputedStyle(el).whiteSpace),'normal');
await page.screenshot({path:'C:/Users/Jack/.codex/visualizations/2026/09/21/01a0c154-6a92-74e3-80e0-b301d930cec6/unified-customize.png'});
await page.locator('#asset-shelf-close').click();
await page.evaluate(()=>{const p=screenToBoard(700,350);window.testModule=createModule('clock',p.x,p.y)});
await page.locator('.clock-module').hover();await page.evaluate(()=>testModule.querySelector('.module-fullscreen').click());
await page.waitForFunction(()=>document.fullscreenElement===testModule);
await page.locator('.tile-appearance-toggle').last().click({force:true});
assert(await page.locator('.tile-appearance-flyout').evaluate(el=>el.matches(':popover-open')));
await page.locator('.tile-appearance-tool').first().click();assert(await page.locator('.tile-appearance-picker').isVisible());
await page.screenshot({path:'C:/Users/Jack/.codex/visualizations/2026/09/21/01a0c154-6a92-74e3-80e0-b301d930cec6/fullscreen-appearance.png'});
const trigger=page.locator('.tile-appearance-toggle').last();
const railBounds=await page.locator('.tile-appearance-rail').boundingBox(),buttonBounds=await trigger.boundingBox();
assert(railBounds.y+railBounds.height<buttonBounds.y,'drawer clears the paintbrush button');
await trigger.click();assert(await page.locator('.tile-appearance-flyout').isHidden());
await trigger.click();assert(await page.locator('.tile-appearance-flyout').isVisible());
await page.mouse.click(750,350);assert(await page.locator('.tile-appearance-flyout').isHidden());
await page.evaluate(()=>document.exitFullscreen());assert.deepEqual(errors,[]);
console.log('Unified shelf navigation, wrapping cursor names and fullscreen appearance controls passed');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});