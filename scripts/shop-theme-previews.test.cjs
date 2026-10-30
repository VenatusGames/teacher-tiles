const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(process.cwd(),decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(u.hostname!=='tiles.test'||!fs.existsSync(f)||!fs.statSync(f).isFile())return r.abort();return r.fulfill(f.endsWith('index.html')?{contentType:'text/html',body:fs.readFileSync(f,'utf8').replace(/<script[^>]+src="(?:firebase-auth|sandbox\/board-gate)[^"]*"[^>]*><\/script>/g,'')}:{path:f})});
 await page.goto('http://tiles.test/');await page.evaluate(()=>{document.getElementById('profile-modal').hidden=true;window.TeacherTilesAccount={state:{ready:true,subscriptionActive:true,ownedProductIds:[]}};TeacherTilesShop.openPage('themes')});await page.waitForTimeout(400);
 const before=await page.evaluate(()=>document.body.dataset.theme);
 for(const name of ['autumn-forest','feast','underwater','rainy-window','outer-space','frosted-window','fireplace','campfire','fireflies','beach','christmas-tree','webbed','haunted-house']){
  const host=page.locator(`[data-shop-page="themes"] [data-shop-product="theme-${name}"] .shop-product__preview`);
  await host.hover();const canvas=host.locator('.shop-theme-preview-canvas');await canvas.waitFor();await page.waitForTimeout(400);
  const image=await canvas.evaluate(c=>c.toDataURL());await page.waitForTimeout(200);assert.notEqual(await canvas.evaluate(c=>c.toDataURL()),image,name+' plays the scene');
  assert.equal(await page.locator('.shop-theme-preview-canvas').count(),1,'only one shop scene runs');
  await page.mouse.move(2,2);await page.waitForTimeout(100);assert.equal(await page.locator('.shop-theme-preview-canvas').count(),0,'leaving stops preview');
 }
 assert.equal(await page.evaluate(()=>document.body.dataset.theme),before,'shop previews do not equip or alter board themes');
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('[data-shop-page="themes"] [data-shop-product="theme-feast"] .shop-product__preview').hover();await page.waitForTimeout(300);assert.equal(await page.locator('.shop-theme-preview-canvas').count(),0);await page.emulateMedia({reducedMotion:'no-preference'});
 await page.locator('.shop-close').click();await page.locator('#theme-shelf-toggle').evaluate(e=>e.click());await page.waitForTimeout(400);
 for(const name of ['Autumn Forest','Feast']){const heading=page.locator('.theme-picker-pack-heading').filter({hasText:name});await heading.hover();await page.waitForTimeout(200);await heading.click();await page.locator('.theme-pack-fan [data-autumn-scene]').first().hover();await page.waitForTimeout(350);assert.equal(await page.locator('.autumn-preview-canvas,.shop-theme-preview-canvas').count(),0,'fall drawer stays still');await page.locator('.theme-pack-fan header button').click();}
 await page.evaluate(()=>applyTeacherTheme('autumn-forest'));await page.waitForFunction(()=>TeacherTilesAutumnScenes.ready('autumn-forest'));await page.waitForTimeout(120);const board=await page.locator('.animated-board-backdrop').evaluate(c=>c.toDataURL());await page.waitForTimeout(160);assert.notEqual(await page.locator('.animated-board-backdrop').evaluate(c=>c.toDataURL()),board,'equipped board still animates');
 for(const f of ['tiles/shared/sticker-picker.js','tiles/shared/cursor-picker.js']){assert(fs.readFileSync(f,'utf8').includes('Unlock Pack'));assert(!fs.readFileSync(f,'utf8').includes('Unlock pack'))}
 assert.deepEqual(errors,[]);console.log('PASS: all 13 animated shop themes, hover cleanup, reduced motion, static fall drawer previews, unchanged board selection and live board animation, Unlock Pack labels');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
