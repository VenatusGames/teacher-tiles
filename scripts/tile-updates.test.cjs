const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--unsafely-treat-insecure-origin-as-secure=http://tiles.test']});try{
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('teacherTilesSandboxCoinsEnabled','true');window.Audio=class extends EventTarget{constructor(src){super();Object.assign(this,{src,paused:true,volume:1,currentTime:0,duration:20})}play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true}load(){}removeAttribute(){}cloneNode(){return new Audio(this.src)}};window.notices=[];window.Notification=class{static permission='granted';constructor(title,options){notices.push({title,...options})}}});
await page.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(process.cwd(),decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));return u.hostname==='tiles.test'&&fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.abort()});
await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1800);







await page.evaluate(()=>{document.getElementById('profile-modal').hidden=true;window.TeacherTilesSandbox={subscriptionEnabled:true};const p=screenToBoard(730,130);window.us=createModule('usstates',p.x,p.y);});
await page.waitForFunction(()=>document.querySelectorAll('.usstates-module [data-country-id]').length===50);
await page.locator('.usstates-module .worldmap-legend select').selectOption({label:'California'});
assert.equal(await page.locator('.usstates-module .worldmap-name').innerText(),'California');
assert.equal(await page.evaluate(()=>us._boardGetState().selectedCountry),'06');
await page.screenshot({path:'C:/Users/Jack/.codex/visualizations/2026/09/21/01a0c154-6a92-74e3-80e0-b301d930cec6/us-states.png'});
await page.evaluate(()=>{us._cleanup();us.remove();const p=screenToBoard(450,140);window.book=createModule('visualschedule',p.x,p.y,{tileSkin:'visualschedule-planner'});const q=screenToBoard(1050,140);window.rainbow=createModule('meditation',q.x,q.y,{tileSkin:'meditation-rainbow'});});
await page.waitForTimeout(350);
assert(await page.evaluate(()=>rainbow.offsetWidth>=600));
for(const [w,h] of [[640,440],[380,320],[850,480]]){await page.evaluate(([w,h])=>{rainbow.style.width=w+'px';rainbow.style.height=h+'px'},[w,h]);await page.waitForTimeout(150);assert(await page.locator('.rainbow-breath-art').evaluate(el=>{const r=el.getBoundingClientRect(),tile=el.closest('.module').getBoundingClientRect();return r.width>200&&r.height>30&&r.right<=tile.right+1&&r.bottom<=tile.bottom+1}));}
await page.evaluate(()=>{rainbow.style.width='380px';rainbow.style.height='320px'});await page.locator('.rainbowbreath-module').hover();await page.waitForTimeout(250);
assert(await page.locator('.rainbow-breath-art').evaluate(el=>el.getBoundingClientRect().height>20));
await page.evaluate(()=>{rainbow.style.width='640px';rainbow.style.height='440px'});
await page.screenshot({path:'C:/Users/Jack/.codex/visualizations/2026/09/21/01a0c154-6a92-74e3-80e0-b301d930cec6/book-rainbow.png'});
await page.evaluate(()=>{book._cleanup?.();book.remove();rainbow._cleanup?.();rainbow.remove();const p=screenToBoard(650,170);window.cube=createModule('squishy',p.x,p.y,{tileSkin:'squishy-gel-cube'});});
await page.waitForTimeout(300);await page.evaluate(()=>{cube.querySelector('.squishy-color-toggle').click();cube.querySelector('[data-color="rose"]').click()});
assert.equal(await page.evaluate(()=>cube._boardGetState().color),'rose');
await page.locator('.squishy-canvas').focus();await page.keyboard.press('ArrowRight');await page.evaluate(()=>cube.querySelector('.squishy-reset').click());assert.equal(await page.evaluate(()=>cube._boardGetState().yaw),.65);
await page.evaluate(()=>{cube=applyTileSkinToModule(cube,'');});assert.equal(await page.evaluate(()=>cube._boardGetState().color),'rose');
assert.equal(await page.locator('.squishy-color-toggle').count(),1);
assert(await page.locator('.shop-product[data-shop-product^="cursor-"]').evaluateAll(cards=>cards.every(card=>Number(card.dataset.shopPrice)===(/pickaxe|gauntlet/.test(card.dataset.shopProduct)?350:250))));
assert.equal(await page.locator('[data-shop-product="tile-skin-visualschedule-planner"]').count(),1);
assert.equal(await page.locator('#classmeter-template').evaluate(t=>t.content.querySelectorAll('.classmeter-remove-progress').length),0);
await page.evaluate(()=>{const p=screenToBoard(1100,180);window.mag=createModule('magnifier',p.x,p.y);});await page.locator('.magnifier-module').hover();await page.waitForTimeout(200);
assert(await page.locator('.magnifier-module').evaluate(m=>{const zoom=m.querySelector('.magnifier-zoom-controls').getBoundingClientRect(),skin=m.querySelector('.tile-skins-toggle').getBoundingClientRect();return zoom.bottom<=skin.top+1}));
assert.deepEqual(errors,[]);console.log('50 states, map selection, rainbow resizing, book skin, squishy reset/colors and cursor pricing passed');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});