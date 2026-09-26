const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--unsafely-treat-insecure-origin-as-secure=http://tiles.test']});try{
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('teacherTilesSandboxCoinsEnabled','true');window.Audio=class extends EventTarget{constructor(src){super();Object.assign(this,{src,paused:true,volume:1,currentTime:0,duration:20})}play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true}load(){}removeAttribute(){}cloneNode(){return new Audio(this.src)}};window.notices=[];window.Notification=class{static permission='granted';constructor(title,options){notices.push({title,...options})}}});
await page.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(process.cwd(),decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));return u.hostname==='tiles.test'&&fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.abort()});
await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1800);




await page.evaluate(()=>{document.getElementById('profile-modal').hidden=true});
for(const type of ['abc','numberflashcards','cvcword','highfrequency','customflashcards']){
const result=await page.evaluate(type=>{const m=createModule(type,300,240);if(type==='customflashcards')m._boardSetState({activeSetId:'set1',currentCardId:'c1',remainingCardIds:['c2','c3'],sets:[{id:'set1',name:'Test',cards:[{id:'c1',text:'First'},{id:'c2',text:'Second'},{id:'c3',text:'Third'}]}]});const initial=m._boardGetState(),total=initial.cardNavigation.items.length;const forward=m.querySelector('.flashcard-forward'),back=m.querySelector('.flashcard-back');forward.click();const next=m._boardGetState();back.click();const previous=m._boardGetState();forward.click();const saved=serializeBoardModule(m);const restored=restoreTeacherTilesBoardObject(saved);const loaded=restored._boardGetState();return{type,total,initial:initial.cardNavigation,next:next.cardNavigation,previous:previous.cardNavigation,loaded:loaded.cardNavigation,counter:restored.querySelector('.flashcard-counter').textContent}},type);
assert(result.total>1,type+' populated');assert.equal(result.next.index,1);assert.deepEqual(result.initial,result.previous);assert.deepEqual(result.next,result.loaded);assert.equal(result.counter,'2/'+result.total);
}
await page.emulateMedia({reducedMotion:'reduce'});
const coin=await page.evaluate(()=>{const m=createModule('coinflip',1050,260),button=m.querySelector('.coinflip-coin');let seen=new Set();for(let i=0;i<100;i++){button.click();seen.add(m._boardGetState().result)}const saved=serializeBoardModule(m),loaded=restoreTeacherTilesBoardObject(saved);return {seen:[...seen].sort(),saved:m._boardGetState(),loaded:loaded._boardGetState(),size:button.getBoundingClientRect().width}});assert.deepEqual(coin.seen,['heads','tails']);assert.deepEqual(coin.saved,coin.loaded);assert(coin.size>40);
assert.equal(await page.locator('[data-shop-product="cursor-pixel-pack"]').count(),1);assert.equal(await page.locator('[data-shop-product="cursor-soft-pack"]').count(),1);assert.equal(await page.locator('[data-shop-product="cursor-fluid-pack"]').count(),1);
const cursors=await page.evaluate(()=>{localStorage.setItem('teacherTilesOwnedShopPacks',JSON.stringify(TeacherTilesCursorPacks.map(p=>p.productId)));return TeacherTilesCursorPacks.flatMap(p=>p.cursors).map(c=>{applyAppCursor(c.id);return document.body.dataset.appCursor===c.id})});assert.equal(cursors.length,15);assert(cursors.every(Boolean));
await page.evaluate(()=>{for(const m of [...workspace.querySelectorAll('.module')]){m._cleanup?.();m.remove()}for(const [type,x] of [['abc',250],['coinflip',800]]){const m=createModule(type,x,240);const point=screenToBoard(x,240);Object.assign(m.style,{left:point.x+'px',top:point.y+'px'})}});await page.waitForTimeout(500);await page.screenshot({path:'C:/Users/Jack/.codex/visualizations/2026/09/21/01a0c154-6a92-74e3-80e0-b301d930cec6/flashcards-coinflip.png'});
const missing=[];page.on('requestfailed',r=>{if(r.url().includes('/assets/themes/'))missing.push(r.url())});
await page.evaluate(()=>{localStorage.setItem('teacherTilesOwnedShopPacks',JSON.stringify(['theme-cosmos','theme-corkboard','theme-cardboard','theme-metal']));});
for(const theme of ['cosmos-nebula','corkboard-red','cardboard-kraft','metal-copper']){await page.evaluate(t=>applyTeacherTheme(t),theme);await page.waitForTimeout(200);const bg=await page.evaluate(()=>getComputedStyle(workspace).backgroundImage);assert(bg.includes('/baked/'),theme+' '+bg)}
await page.waitForTimeout(300);assert.deepEqual(missing,[]);
assert.deepEqual(errors,[]);console.log('Flashcards: all five decks navigate, go back and restore position. Coin Flip: both outcomes and persistence. Cursors: all 15 variants selectable.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
