const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1500,height:1000}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      localStorage.setItem('teacherTilesSandboxCoinsEnabled','true');
      window.testSounds=[];
      window.Audio=class extends EventTarget{
        constructor(src){super();Object.assign(this,{src,paused:true,volume:1,currentTime:0,duration:20});testSounds.push(this)}
        play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true}load(){}removeAttribute(){}cloneNode(){return new Audio(this.src)}
      };
    });
    await page.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(process.cwd(),decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));return u.hostname==='tiles.test'&&fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.abort()});
    await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1800);

    await page.evaluate(()=>document.getElementById('profile-modal').hidden=true);
    await page.locator('#sticker-shelf-toggle').evaluate(el=>el.click());
    await page.waitForTimeout(450);
    const box=await page.locator('.asset-shelf__shell').boundingBox();assert(box.x<20&&box.width<=421&&box.height>700);
    assert(await page.locator('.sticker-picker-grid').count()>5);
    await page.locator('#sticker-shelf-search').fill('zzzznotfound');assert(await page.locator('.sticker-picker-empty').isVisible());
    await page.locator('#sticker-shelf-search').fill('');
    const cell=page.locator('.sticker-picker-cell').first();await cell.hover();await cell.locator('.sticker-picker-favorite').click();
    assert.equal(await page.locator('.workspace .sticker-module').count(),0);
    await page.locator('[data-view="favorites"]').click();assert.equal(await page.locator('.sticker-picker-cell').count(),1);
    await page.locator('.sticker-picker .sticker-shelf-item').click();assert.equal(await page.locator('.workspace .sticker-module').count(),1);
    await page.keyboard.press('Escape');assert.equal(await page.locator('#asset-shelf').getAttribute('aria-hidden'),'true');
    await page.locator('#sticker-shelf-toggle').evaluate(el=>el.click());assert.equal(await page.locator('.sticker-picker-cell').count(),1);
    await page.locator('[data-view="all"]').click();
    assert.equal(await page.locator('.sticker-picker-categories,.sticker-picker select').count(),0);
    const pack=page.locator('.sticker-picker-pack:not(.sticker-picker-most-used)').first(),toggle=pack.locator('.sticker-picker-pack-toggle');
    const expanded=await pack.boundingBox();await toggle.click();await page.waitForTimeout(300);assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert((await pack.boundingBox()).height<expanded.height);assert.equal(await pack.locator('.sticker-picker-pack-body').evaluate(el=>el.inert),true);await toggle.click();
    await page.locator('.sticker-picker-owned input').check();assert.equal(await page.locator('.sticker-picker .is-cosmetic-locked').count(),0);await page.locator('.sticker-picker-owned input').uncheck();
    assert.equal(await page.locator('#sticker-shelf-search-status').evaluate(el=>Boolean(el.closest('.sticker-shelf-search'))),false);
    await page.mouse.click(1350,650);assert.equal(await page.locator('#asset-shelf').getAttribute('aria-hidden'),'false');
    const sticker=page.locator('.workspace .sticker-module').first();await sticker.hover();const sb=await sticker.boundingBox(),db=await sticker.locator('.module-delete').boundingBox();
    await page.mouse.move(sb.x+sb.width-8,sb.y+8);await page.mouse.move(db.x+db.width/2,db.y+db.height/2,{steps:20});await page.waitForTimeout(250);assert.equal(await sticker.locator('.module-delete').evaluate(el=>getComputedStyle(el).opacity),'1');await page.mouse.click(db.x+db.width/2,db.y+db.height/2);assert.equal(await page.locator('.workspace .sticker-module').count(),0);
    await page.locator('.sticker-picker .sticker-shelf-item').first().click();
    await page.waitForTimeout(100);
    assert.equal(await page.locator('.sticker-picker-most-used .sticker-shelf-item').count(),1);
    assert(await page.locator('.sticker-picker-pack-lock').count()>0);
    assert.equal(await page.locator('.sticker-picker .is-cosmetic-locked').count(),0);
    const viewsBox=await page.locator('.sticker-picker-views').boundingBox(),searchBox=await page.locator('#sticker-shelf-search').boundingBox();assert(viewsBox.y<searchBox.y);
    const countBox=await page.locator('#sticker-shelf-search-status').boundingBox(),switchBox=await page.locator('.sticker-picker-owned').boundingBox();assert(Math.abs(countBox.y+countBox.height/2-switchBox.y-switchBox.height/2)<3);
    await page.mouse.move(1400,900);await page.waitForTimeout(200);assert.equal(await page.locator('.workspace .sticker-module>.module-delete').first().evaluate(el=>getComputedStyle(el).opacity),'1');
    await page.screenshot({path:'C:/Users/Jack/.codex/visualizations/2026/09/21/01a0c154-6a92-74e3-80e0-b301d930cec6/sticker-picker.png'});
    const item=page.locator('.sticker-picker .sticker-shelf-item').first(),b=await item.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(850,450,{steps:12});await page.mouse.up();assert.equal(await page.locator('.workspace .sticker-module').count(),2);
    await page.waitForTimeout(700);const placed=await page.locator('.workspace .sticker-module').last().boundingBox();assert(Math.abs(Math.max(placed.width,placed.height)-146)<2,'drop matches preview size');
    await page.evaluate(()=>{boardCamera.scale=1.5;applyBoardCamera()});await page.locator('.sticker-picker .sticker-shelf-item').first().click();await page.waitForTimeout(700);const zoomed=await page.locator('.workspace .sticker-module').last().boundingBox();assert(Math.abs(Math.max(zoomed.width,zoomed.height)-146)<2,'placement stays preview sized when zoomed');
    const resized=page.locator('.workspace .sticker-module').last();await resized.hover();const handle=resized.locator('.sticker-resize-handle--tr'),hb=await handle.boundingBox();assert.equal(await handle.evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el}),true,'delete does not cover resize');const beforeResize=await resized.boundingBox();await page.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);await page.mouse.down();await page.mouse.move(hb.x+60,hb.y-40,{steps:8});await page.mouse.up();assert((await resized.boundingBox()).width>beforeResize.width);
    await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(1000);await page.evaluate(()=>document.getElementById('profile-modal').hidden=true);await page.locator('#sticker-shelf-toggle').evaluate(el=>el.click());await page.locator('[data-view="favorites"]').click();assert.equal(await page.locator('.sticker-picker-cell').count(),1);
    await page.locator('#theme-shelf-toggle').evaluate(el=>el.click());assert.equal(await page.locator('#theme-shelf-content').isVisible(),true);assert.equal(await page.locator('#asset-shelf').evaluate(el=>el.inert),false);
    await page.locator('#cursors-shelf-toggle').evaluate(el=>el.click());assert.equal(await page.locator('#cursors-shelf-content').isVisible(),true);
    await page.locator('#sticker-shelf-toggle').evaluate(el=>el.click());
    await page.setViewportSize({width:375,height:700});await page.waitForTimeout(400);const bounds=await page.locator('.asset-shelf__shell').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=375);assert.equal(await page.locator('.sticker-picker-results').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
    await page.evaluate(()=>{
      localStorage.setItem('teacherTilesSandboxSubscriptionEnabled','true');
      const items=[...document.querySelectorAll('.sticker-pack-drawer .sticker-shelf-item')].slice(0,12),usage={};items.forEach((el,i)=>usage[el.dataset.stickerSrc||el.dataset.stickerEmoji]=i+1);localStorage.setItem('teachertiles.sticker-usage.v1',JSON.stringify(usage));window.dispatchEvent(new StorageEvent('storage',{key:'teachertiles.sticker-usage.v1'}));
    });await page.locator('[data-view="all"]').click();assert.equal(await page.locator('.sticker-picker-most-used .sticker-shelf-item').count(),10);
    await page.evaluate(()=>{createStickerModule({emoji:'⭐'},900,400);document.body.classList.add('is-board-idle');document.querySelectorAll('.sticker-module').forEach(el=>el.classList.add('is-idle-unhovered'))});assert.equal(await page.locator('.sticker-module>.module-delete').last().evaluate(el=>getComputedStyle(el).opacity),'1');assert.equal(await page.locator('.sticker-module>.module-delete').last().evaluate(el=>getComputedStyle(el).visibility),'visible');
    assert.deepEqual(errors,[]);console.log('Sticker picker checks passed');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
