const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  // Offline UI fixture: no auth/network requests or account mutations.
  await page.route('**/*',r=>{
   const u=new URL(r.request().url()),file=path.join(process.cwd(),decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
   if(u.hostname!=='tiles.test'||!fs.existsSync(file)||!fs.statSync(file).isFile())return r.abort();
   if(file.endsWith('index.html'))return r.fulfill({contentType:'text/html',body:fs.readFileSync(file,'utf8').replace(/<script[^>]+src="(?:firebase-auth|sandbox\/board-gate)[^"]*"[^>]*><\/script>/g,'')});
   return r.fulfill({path:file});
  });
  await page.goto('http://tiles.test/',{waitUntil:'load'});
  await page.evaluate(()=>document.getElementById('profile-modal').hidden=true);
  async function scrollCheck(selector){
   const list=page.locator(selector);await list.waitFor({state:'visible'});
   await list.evaluate(async el=>{for(let i=0;i<30;i++){el.scrollTop=i*400;await new Promise(requestAnimationFrame)}el.scrollTop=0});
   await page.waitForTimeout(250);
   const height=await list.evaluate(el=>el.scrollHeight);
   await list.evaluate(async el=>{for(let i=0;i<30;i++){el.scrollTop=i/30*(el.scrollHeight-el.clientHeight);await new Promise(requestAnimationFrame)}});
   assert(await list.evaluate(el=>el.classList.contains('is-browse-scrolling')),'scroll work is paused during a gesture');
   await page.waitForTimeout(220);
   assert.equal(await list.evaluate(el=>el.classList.contains('is-browse-scrolling')),false,'hover work resumes at rest');
   assert(Math.abs(await list.evaluate(el=>el.scrollHeight)-height)<=2,'scroll height stays stable');
   assert(await list.evaluate(el=>el.scrollWidth<=el.clientWidth),'no horizontal overflow');
   await list.evaluate(el=>el.scrollTop=0);await page.waitForTimeout(220);
  }
  await page.locator('#sticker-shelf-toggle').evaluate(e=>e.click());await page.waitForTimeout(400);
  await scrollCheck('.sticker-picker-results');
  const sticker=page.locator('.sticker-picker [data-sticker-src="assets/stickers/default/apple.png"]');
  assert.equal(await sticker.locator('img').getAttribute('src'),'assets/stickers/thumbnails/default/apple.webp');
  assert.equal(await sticker.getAttribute('data-sticker-src'),'assets/stickers/default/apple.png','full quality placement source is retained');
  await sticker.scrollIntoViewIfNeeded();await page.waitForTimeout(250);await sticker.hover();
  const favorite=sticker.locator('..').locator('.sticker-picker-favorite');await favorite.click();assert.equal(await favorite.getAttribute('aria-pressed'),'true');
  const toggle=page.locator('.sticker-picker-pack-toggle').nth(1);await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'false');await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');
  await page.locator('#theme-shelf-toggle').evaluate(e=>e.click());await page.waitForTimeout(400);
  await scrollCheck('.theme-picker-results');
  await page.locator('.theme-picker-pack-heading').first().click();assert(await page.locator('.theme-pack-fan').evaluate(el=>el.matches(':popover-open')));
  await page.locator('.theme-pack-fan [data-theme-choice]').first().click();
  assert.equal(await page.locator('.theme-pack-fan [data-theme-choice]').first().getAttribute('aria-pressed'),'true');
  await page.locator('.theme-pack-fan header button').click();
  await page.evaluate(()=>window.TeacherTilesShop.open());await page.waitForTimeout(400);await scrollCheck('.shop-content');
  assert.equal(await page.locator('.shop-content').evaluate(el=>getComputedStyle(el.querySelector('.shop-product__preview')).contain),'content');
  const visiblePreviews=await page.locator('.shop-content').evaluate(el=>{const viewport=el.getBoundingClientRect();return [...el.querySelectorAll('.shop-product__preview')].filter(p=>{const r=p.getBoundingClientRect();return r.height&&r.bottom>viewport.top&&r.top<viewport.bottom}).every(p=>getComputedStyle(p).contentVisibility!=='hidden')});assert(visiblePreviews,'visible shop artwork is restored');
  await page.screenshot({path:path.join(process.env.TEMP||'/tmp','browse-performance-shop.png')});
  await page.setViewportSize({width:375,height:800});await page.locator('.shop-close').click();
  await page.locator('#sticker-shelf-toggle').evaluate(e=>e.click());await page.waitForTimeout(450);await scrollCheck('.sticker-picker-results');
  await page.screenshot({path:path.join(process.env.TEMP||'/tmp','browse-performance-mobile.png')});
  assert.deepEqual(errors,[]);
  console.log('PASS: desktop/mobile scrolling, stable heights, scroll pause/resume, thumbnails with original placement sources, favorites, pack collapse, and theme selection');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
