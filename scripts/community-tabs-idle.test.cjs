const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(15000);await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(process.cwd(),decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(u.pathname.endsWith('/newsFeed'))return r.fulfill({json:{schemaVersion:2,posts:Array.from({length:20},(_,i)=>({id:'scroll-'+i,title:'News story '+i,published:true,publishedAt:'2026-11-05',blocks:[{id:'text',type:'text',content:['A classroom news update. '.repeat(30)]}]}))}});return u.hostname==='tiles.test'&&fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.abort();});
 await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.TeacherTilesTabs&&typeof createModule==='function');
 await page.clock.install();
 await page.evaluate(()=>{document.querySelector('#teachertiles-intro')?.remove();document.documentElement.classList.remove('sandbox-access-locked');document.getElementById('profile-modal').hidden=true;boardCamera.x=0;boardCamera.y=0;boardCamera.scale=1;applyBoardCamera();TeacherTilesBoard.clear();const m=createModule('clock',450,220,{record:false});TeacherTilesTabs.add(m);workspace.querySelector('.module').id='idle-tabs';});
 await page.clock.runFor(100);
 const tile=page.locator('#idle-tabs'),strip=page.locator('.tile-tab-strip');let bounds=await tile.boundingBox();
 await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.clock.runFor(300);
 assert(await strip.evaluate(el=>el.classList.contains('is-expanded')),'tile hover expands bookmarks');
 await page.clock.runFor(11000);
 assert(await page.evaluate(()=>document.body.classList.contains('is-board-idle')),'real inactivity timer fires');
 assert(!await strip.evaluate(el=>el.classList.contains('is-expanded')),'bookmarks retract on inactivity');
 assert(await strip.locator('.tile-tab-bookmark').first().evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).m41>30),'bookmarks visibly slide back');
 await page.mouse.move(bounds.x+bounds.width/2+5,bounds.y+bounds.height/2);await page.clock.runFor(300);
 assert(await strip.evaluate(el=>el.classList.contains('is-expanded')),'pointer activity restores bookmarks');
 await page.mouse.move(1000,800);await page.clock.runFor(300);assert(!await strip.evaluate(el=>el.classList.contains('is-expanded')),'normal unhover retracts');
 await tile.evaluate(el=>el.requestFullscreen());await page.clock.runFor(100);let bar=await strip.boundingBox();await page.mouse.move(bar.x+3,bar.y+15);await page.clock.runFor(300);
 assert(await strip.evaluate(el=>el.classList.contains('is-expanded')),'fullscreen bookmarks open');
 await page.clock.runFor(11000);assert(!await strip.evaluate(el=>el.classList.contains('is-expanded')),'fullscreen bookmarks retract on idle');
 assert(await strip.locator('.tile-tab-bookmark').first().evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).m41< -30));
 await page.evaluate(()=>document.exitFullscreen());await page.mouse.move(1100,800);await page.clock.runFor(100);
 // Use the real Community panel and feed renderer, with enough articles to overflow.
 await page.evaluate(()=>settingsToggle.click());await page.clock.runFor(200);
 await page.evaluate(async()=>{const {renderNews}=await import('/news/runtime/feed.js');await renderNews(document.getElementById('news-content'));});
 const feed=page.locator('#news-content');
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  await page.setViewportSize(viewport);await page.clock.runFor(100);
  const metrics=await feed.evaluate(el=>({height:el.clientHeight,total:el.scrollHeight,overflow:getComputedStyle(el).overflowY}));assert.equal(metrics.overflow,'auto');assert(metrics.height<viewport.height&&metrics.total>metrics.height*2,'long news stays within bounded holder');
  await feed.scrollIntoViewIfNeeded();await feed.hover();await page.mouse.wheel(0,500);await page.clock.runFor(300);assert(await feed.evaluate(el=>el.scrollTop>0),'wheel scrolls the articles');
  await feed.focus();await page.keyboard.press('Control+End');await page.clock.runFor(300);await page.waitForFunction(()=>{const el=document.getElementById('news-content');return el.scrollTop+el.clientHeight>=el.scrollHeight-2;},{},{timeout:3000});
  await feed.evaluate(el=>el.scrollTop=0);
 }
 console.log('News scrolling (desktop/mobile, wheel/keyboard) and tab idle/retraction/wake (board/fullscreen) passed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
