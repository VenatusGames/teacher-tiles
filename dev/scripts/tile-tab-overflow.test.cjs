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


    await page.evaluate(()=>{
      document.getElementById('profile-modal').hidden=true;boardCamera.x=0;boardCamera.y=0;boardCamera.scale=1;applyBoardCamera();
      const m=createModule('clock',500,250,{record:false});m.style.left='250px';m.style.top='150px';m.style.height='300px';
      const item=serializeBoardModule(m);
      TeacherTilesTabs.restore(m,{active:29,items:Array.from({length:30},()=>structuredClone(item)),minimum:{width:220,height:180},minimumVersion:2});
    });await page.clock.runFor(100);
    const bounds=()=>page.evaluate(()=>{const strip=document.querySelector('.tile-tab-strip'),m=workspace.querySelector('.module'),row=strip.querySelector('.tile-tab-bookmark'),a=strip.getBoundingClientRect(),b=m.getBoundingClientRect();return{bottom:a.bottom,tileBottom:b.bottom,top:a.top,tileTop:b.top,row:row.offsetHeight,scroll:strip.scrollTop,overflow:strip.scrollHeight>strip.clientHeight};});
    let result=await bounds();assert(result.bottom<=result.tileBottom);assert(result.top>=result.tileTop);assert.equal(result.row,24);assert(result.overflow);assert(result.scroll>0,'active last tab is revealed');
    await page.locator('.workspace .module').hover();await page.clock.runFor(100);
    const strip=page.locator('.tile-tab-strip'),box=await strip.boundingBox();await page.mouse.move(box.x+15,box.y+20);await page.mouse.wheel(0,-1500);await page.waitForTimeout(150);
    assert.equal(await strip.evaluate(el=>el.scrollTop),0,'wheel reaches earlier tabs');
    assert.equal(await page.evaluate(()=>boardCamera.scale),1,'scrolling tabs does not zoom board');
    await page.locator('.tile-tab').first().click();await page.clock.runFor(100);
    assert.equal(await page.locator('.tile-tab[aria-selected=true]').textContent(),'1');
    await page.locator('.tile-tab[aria-selected=true]').focus();await page.keyboard.press('End');await page.clock.runFor(100);
    assert.equal(await page.locator('.tile-tab[aria-selected=true]').textContent(),'30');assert((await bounds()).scroll>0);
    await page.evaluate(()=>{const m=workspace.querySelector('.module');m.style.height='200px';setTileUniformScale(m,.5);});await page.clock.runFor(100);
    result=await bounds();assert(result.bottom<=result.tileBottom+.5,'strip fits after compact resize');
    await page.evaluate(()=>{const saved=TeacherTilesBoard.capture();TeacherTilesBoard.load(saved);});await page.clock.runFor(100);
    assert.equal(await page.locator('.tile-tab').count(),30);result=await bounds();assert(result.bottom<=result.tileBottom+.5);
    assert.deepEqual(errors,[]);console.log('Thirty tabs fit, scroll without board zoom, reveal active tabs, support keyboard navigation, and survive compact resizing/restoring.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
