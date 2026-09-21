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


    await page.clock.install();
    await page.evaluate(()=>{document.getElementById('profile-modal').hidden=true;boardCamera.x=0;boardCamera.y=0;boardCamera.scale=1;applyBoardCamera();createModule('glitterjar',650,150)});
    const tile=page.locator('.glitterjar-module'),jar=tile.locator('.glitter-jar-button');assert.equal(await page.locator('[data-module="glitterjar"][data-category="sel"]').count(),1);
    await jar.click();await page.clock.runFor(5000);assert(await tile.evaluate(el=>el.classList.contains('is-swirling')));
    await page.screenshot({path:'C:/Users/Jack/.codex/visualizations/2026/09/21/01a0c154-6a92-74e3-80e0-b301d930cec6/glitter-jar.png'});
    await page.clock.runFor(24000);assert(await tile.evaluate(el=>el.classList.contains('is-swirling')));await page.clock.runFor(1200);assert.equal(await tile.evaluate(el=>el.classList.contains('is-swirling')),false);
    const settled=await jar.locator('canvas').evaluate(el=>el.toDataURL());await page.clock.runFor(1000);assert.equal(await jar.locator('canvas').evaluate(el=>el.toDataURL()),settled);
    await jar.evaluate(el=>el.click());await page.clock.runFor(15000);await jar.evaluate(el=>el.click());await page.clock.runFor(16000);assert(await tile.evaluate(el=>el.classList.contains('is-swirling')));
    await tile.evaluate(el=>el._deactivate());assert.equal(await tile.evaluate(el=>el.classList.contains('is-swirling')),false);
    await tile.evaluate(el=>{el.style.width='240px';el.style.height='300px'});await page.clock.runFor(200);const bounds=await tile.boundingBox(),button=await jar.boundingBox();assert(button.x>=bounds.x&&button.y>=bounds.y&&button.x+button.width<=bounds.x+bounds.width&&button.y+button.height<=bounds.y+bounds.height);
    await page.evaluate(()=>{const saved=TeacherTilesBoard.capture();TeacherTilesBoard.load(saved)});assert.equal(await page.locator('.glitterjar-module').count(),1);assert.equal(await page.locator('.glitterjar-module.is-swirling').count(),0);
    assert.deepEqual(errors,[]);console.log('Glitter Jar: 30-second settling, restart, deactivation, containment and save/restore passed');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
