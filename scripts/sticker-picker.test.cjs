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
    await page.locator('[data-category="food"]').click();assert(await page.locator('.sticker-picker-cell').count()>0);
    await page.locator('[data-category="all"]').click();
    await page.screenshot({path:'C:/Users/Jack/.codex/visualizations/2026/09/21/01a0c154-6a92-74e3-80e0-b301d930cec6/sticker-picker.png'});
    const item=page.locator('.sticker-picker .sticker-shelf-item').first(),b=await item.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(850,450,{steps:12});await page.mouse.up();assert.equal(await page.locator('.workspace .sticker-module').count(),2);
    await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(1000);await page.evaluate(()=>document.getElementById('profile-modal').hidden=true);await page.locator('#sticker-shelf-toggle').evaluate(el=>el.click());await page.locator('[data-view="favorites"]').click();assert.equal(await page.locator('.sticker-picker-cell').count(),1);
    await page.locator('#theme-shelf-toggle').evaluate(el=>el.click());assert.equal(await page.locator('#theme-shelf-content').isVisible(),true);assert.equal(await page.locator('#asset-shelf').evaluate(el=>el.inert),false);
    await page.locator('#cursors-shelf-toggle').evaluate(el=>el.click());assert.equal(await page.locator('#cursors-shelf-content').isVisible(),true);
    await page.locator('#sticker-shelf-toggle').evaluate(el=>el.click());
    await page.setViewportSize({width:375,height:700});await page.waitForTimeout(400);const bounds=await page.locator('.asset-shelf__shell').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=375);assert.equal(await page.locator('.sticker-picker-results').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
    assert.deepEqual(errors,[]);console.log('Sticker picker checks passed');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
