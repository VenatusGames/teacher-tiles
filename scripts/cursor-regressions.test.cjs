const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--unsafely-treat-insecure-origin-as-secure=http://tiles.test']});try{
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('teacherTilesSandboxCoinsEnabled','true');window.Audio=class extends EventTarget{constructor(src){super();Object.assign(this,{src,paused:true,volume:1,currentTime:0,duration:20})}play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true}load(){}removeAttribute(){}cloneNode(){return new Audio(this.src)}};window.notices=[];window.Notification=class{static permission='granted';constructor(title,options){notices.push({title,...options})}}});
await page.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(process.cwd(),decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));return u.hostname==='tiles.test'&&fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.abort()});
await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1800);





await page.evaluate(()=>{document.getElementById('profile-modal').hidden=true});
for(const type of ['abc','numberflashcards','cvcword','highfrequency','customflashcards']){
await page.evaluate(type=>{const m=createModule(type,300,240);m.dataset.testDeck='yes';if(type==='customflashcards')m._boardSetState({activeSetId:'s',currentCardId:'a',remainingCardIds:['b'],sets:[{id:'s',cards:[{id:'a',text:'One'},{id:'b',text:'Two'}]}]});const original=m._boardGetState(),items=original.cardNavigation.items;while(m._boardGetState().cardNavigation.index<items.length-1)m.querySelector('.flashcard-forward').click();m.querySelector('.flashcard-forward').click()},type);
assert(await page.locator('[data-test-deck] .flashcard-complete').evaluate(el=>!el.hidden),type+' Complete overlay');
await page.locator('[data-test-deck] .flashcard-shuffle').evaluate(el=>el.click());await page.waitForTimeout(500);
assert.equal(await page.locator('[data-test-deck]').evaluate(m=>m._boardGetState().cardNavigation.index),0,type+' shuffle index');
assert(await page.locator('[data-test-deck] header .flashcard-counter').count());
await page.locator('[data-test-deck]').evaluate(m=>{m._cleanup?.();m.remove()});
}
await page.evaluate(()=>document.getElementById('cursors-shelf-toggle').click());await page.waitForTimeout(450);
assert.equal(await page.locator('.cursor-picker-pack').count(),6);assert.equal(await page.locator('.cursor-picker-unlock').count(),5);
await page.screenshot({path:'C:/Users/Jack/.codex/visualizations/2026/09/21/01a0c154-6a92-74e3-80e0-b301d930cec6/cursor-drawer-revised.png'});
await page.getByRole('searchbox',{name:'Search cursors',exact:true}).fill('melon');assert.equal(await page.locator('.cursor-picker-choice').count(),1);await page.getByRole('searchbox',{name:'Search cursors',exact:true}).fill('');
await page.evaluate(()=>{localStorage.setItem('teacherTilesOwnedShopPacks',JSON.stringify(['cursor-pixel-pack','cursor-soft-pack','cursor-fluid-pack','cursor-color-pack']));window.dispatchEvent(new CustomEvent('teachertiles:shopownershipchange'))});
await page.locator('[data-cursor-choice="soft-lavender"]').click();assert.equal(await page.evaluate(()=>document.body.dataset.appCursor),'soft-lavender');assert(await page.locator('#asset-shelf.is-open').count());
await page.locator('.cursor-picker-pack-heading').filter({hasText:'Soft Cursors'}).click();assert(await page.locator('.cursor-picker-pack').filter({hasText:'Soft Cursors'}).locator('.cursor-picker-pack-body').evaluate(el=>el.hidden));
await page.evaluate(()=>document.getElementById('asset-shelf-close').click());
await page.evaluate(()=>{const p=screenToBoard(750,250);window.coin=createModule('coinflip',p.x,p.y)});await page.locator('.coinflip-coin').click();await page.waitForTimeout(220);
assert(await page.locator('.coinflip-body').evaluate(el=>el.getAnimations().length===1));assert.equal(await page.locator('.coinflip-face').count(),2);assert.equal(await page.locator('.coinflip-tails img').evaluate(el=>el.naturalWidth>0),true);await page.waitForTimeout(1000);
await page.screenshot({path:'C:/Users/Jack/.codex/visualizations/2026/09/21/01a0c154-6a92-74e3-80e0-b301d930cec6/coin-revised.png'});
assert.deepEqual(errors,[]);console.log('All five decks Complete/Shuffle, heading counters, cursor drawer search/unlocks/equipping/collapse, and two-sided coin animation passed');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
