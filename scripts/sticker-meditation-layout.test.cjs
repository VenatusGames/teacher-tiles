const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1500,height:1000}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      window.testSounds=[];
      window.Audio=class extends EventTarget{
        constructor(src){super();Object.assign(this,{src,paused:true,volume:1,currentTime:0,duration:20});testSounds.push(this)}
        play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true}load(){}removeAttribute(){}cloneNode(){return new Audio(this.src)}
      };
    });
    await page.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(process.cwd(),decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));return u.hostname==='tiles.test'&&fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.abort()});
    await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1800);
    await page.clock.install();
    await page.addStyleTag({content:"*,*::before,*::after{transition:none!important}"});


    await page.evaluate(()=>{document.getElementById('profile-modal').hidden=true;boardCamera.x=0;boardCamera.y=0;boardCamera.scale=1;applyBoardCamera();const m=createStickerModule({emoji:'⭐'},500,350,{record:false,animate:false});m.id='sticker';});
    const sticker=page.locator('#sticker');await sticker.hover();
    assert.equal(await sticker.locator('.module-delete').count(),1);
    const del=await sticker.locator('.module-delete').boundingBox(),handle=await sticker.locator('[data-sticker-resize=tr]').boundingBox();assert(del.y+del.height<handle.y,'delete and resize are separated');
    const box=await sticker.boundingBox(),rotate=await sticker.locator('.sticker-rotate-handle').boundingBox();
    await page.mouse.move(rotate.x+rotate.width/2,rotate.y+rotate.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width+60,box.y+box.height/2,{steps:12});await page.mouse.up();
    const rotation=await sticker.evaluate(m=>({angle:Number(m.dataset.stickerRotation),outer:getComputedStyle(m).rotate,inner:getComputedStyle(m.querySelector('.sticker-visual')).transform}));assert(Math.abs(rotation.angle-90)<2);assert.notEqual(rotation.outer,'none');assert.equal(rotation.inner,'none');
    const opposite=await sticker.locator('[data-sticker-resize=tl]').boundingBox(),br=await sticker.locator('[data-sticker-resize=br]').boundingBox();
    await page.mouse.move(br.x+br.width/2,br.y+br.height/2);await page.mouse.down();await page.mouse.move(br.x+br.width/2-40,br.y+br.height/2+40,{steps:8});await page.mouse.up();
    const fixed=await sticker.locator('[data-sticker-resize=tl]').boundingBox();assert(Math.abs(opposite.x-fixed.x)<2&&Math.abs(opposite.y-fixed.y)<2,'rotated resizing anchors the opposite corner');
    await page.evaluate(()=>{const saved=TeacherTilesBoard.capture();TeacherTilesBoard.load(saved);});assert.notEqual(await page.locator('.sticker-module').evaluate(m=>getComputedStyle(m).rotate),'none');
    await page.evaluate(()=>{TeacherTilesBoard.clear();const m=createModule('meditation',600,250,{record:false});m.style.top='150px';});
    const tile=page.locator('.meditation-module');await tile.hover();await page.clock.runFor(100);
    const hovered=await page.locator('.meditation-bloom').evaluate(el=>el.offsetWidth);
    await page.mouse.move(1400,900);await page.clock.runFor(100);
    const quiet=await page.locator('.meditation-bloom').evaluate(el=>el.offsetWidth);assert(quiet>hovered+15,'quiet visual expands');assert(await page.locator('.meditation-heading').isVisible());assert.equal(await page.locator('.meditation-actions').isVisible(),false);
    await page.evaluate(()=>document.body.classList.add('tile-options-always-visible'));assert.equal(await tile.locator('.module-delete').evaluate(el=>getComputedStyle(el).opacity),'0');
    await tile.hover();assert.equal(await tile.locator('.module-delete').evaluate(el=>getComputedStyle(el).opacity),'1');assert.equal(await tile.locator('.module-tab-add').evaluate(el=>getComputedStyle(el).opacity),'1');
    assert.deepEqual(errors,[]);console.log('Sticker control separation, outer rotation, anchored rotated resizing, restore, hover preference, and expanded quiet Meditation passed.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
