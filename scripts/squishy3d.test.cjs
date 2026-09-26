const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--unsafely-treat-insecure-origin-as-secure=http://tiles.test']});try{
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('teacherTilesSandboxCoinsEnabled','true');window.Audio=class extends EventTarget{constructor(src){super();Object.assign(this,{src,paused:true,volume:1,currentTime:0,duration:20})}play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true}load(){}removeAttribute(){}cloneNode(){return new Audio(this.src)}};window.notices=[];window.Notification=class{static permission='granted';constructor(title,options){notices.push({title,...options})}}});
await page.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(process.cwd(),decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));return u.hostname==='tiles.test'&&fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.abort()});
await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1800);







await page.evaluate(()=>{document.getElementById('profile-modal').hidden=true;window.TeacherTilesAccount={state:{subscriptionActive:true}};const p=screenToBoard(650,170);window.cube=createModule('squishy',p.x,p.y,{tileSkin:'squishy-gel-cube'});cube.style.width='500px';cube.style.height='520px';});await page.waitForTimeout(1000);
assert.equal(await page.locator('.squishy-canvas').evaluate(c=>!!c.getContext('webgl')),true);
const canvas=page.locator('.squishy-canvas'),box=await canvas.boundingBox();const before=await canvas.evaluate(c=>c.toDataURL());
await page.mouse.move(box.x+box.width*.52,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.73,box.y+box.height*.25,{steps:20});await page.waitForTimeout(350);
assert.notEqual(await canvas.evaluate(c=>c.toDataURL()),before);
await page.screenshot({path:'C:/Users/Jack/.codex/visualizations/2026/09/21/01a0c154-6a92-74e3-80e0-b301d930cec6/squishy3d-stretch.png'});
await page.mouse.up();await page.waitForTimeout(2000);await page.screenshot({path:'C:/Users/Jack/.codex/visualizations/2026/09/21/01a0c154-6a92-74e3-80e0-b301d930cec6/squishy3d-rest.png'});
await canvas.focus();await page.keyboard.press('ArrowRight');assert(await page.evaluate(()=>cube._boardGetState().yaw>.65));
await page.evaluate(()=>cube.querySelector('.tile-skins-toggle').click());assert.equal(await page.locator('.tile-skins-drawer img[src="assets/tile-skins/gel-cube.svg"]').count(),1);
assert.equal(await page.locator('[data-shop-product="tile-skin-meditation-rainbow"]').count(),1);assert.equal(await page.locator('[data-shop-product="tile-skin-squishy-gel-cube"]').count(),1);
assert.deepEqual(errors,[]);console.log('3D WebGL rendering, manipulation, rotation, shop entries and skin art passed');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});