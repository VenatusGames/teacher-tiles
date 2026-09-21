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


    await page.evaluate(()=>{document.getElementById('profile-modal').hidden=true;boardCamera.x=0;boardCamera.y=0;boardCamera.scale=1;applyBoardCamera();const m=createModule('meditation',500,250,{record:false});m.style.left='250px';m.style.top='150px';m.style.width='600px';m.style.height='400px';});
    const tile=page.locator('.workspace .module');
    const drag=async(direction,dx,dy)=>{const h=await tile.locator('[data-resize='+direction+']').boundingBox();await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2+dx,h.y+h.height/2+dy,{steps:8});await page.mouse.up();};
    const geometry=()=>tile.evaluate(m=>({width:m.getBoundingClientRect().width,height:m.getBoundingClientRect().height,scale:tileUniformScale(m),logicalWidth:m.offsetWidth,logicalHeight:m.offsetHeight}));
    await drag('b',0,-40);let g=await geometry();assert.equal(g.width,600);assert.equal(g.height,387);assert.equal(g.scale,1,'edge resizing never shrinks the other dimension');
    await drag('br',-2,-2);g=await geometry();assert(g.width>595&&g.width<600,'crossing boundary does not snap width');assert(g.scale<1);assert.equal(g.logicalWidth,600);assert.equal(g.logicalHeight,387);
    assert.match(await page.locator('.tile-scale-hint').textContent(),/Proportional scaling/);
    assert.equal(await page.locator('.tile-scale-hint').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
    await page.clock.runFor(1200);assert.equal(await page.locator('.tile-scale-hint').count(),0,'hint clears after resize');
    const ratio=g.width/g.height;await drag('br',-80,-60);g=await geometry();assert(Math.abs(g.width/g.height-ratio)<.01,'further corner drags preserve compact proportions');
    const snapshot=g;await page.evaluate(()=>{const saved=TeacherTilesBoard.capture();TeacherTilesBoard.load(saved);});g=await geometry();assert.equal(await page.locator('.tile-scale-hint').count(),0,'restoring a board removes transient hints');assert(Math.abs(g.width-snapshot.width)<1);assert(Math.abs(g.height-snapshot.height)<1);
    await drag('r',60,0);const reshaped=await geometry();assert(Math.abs(reshaped.height-g.height)<1,'compact edges still adjust one dimension');assert(reshaped.width>g.width+55);
    await page.evaluate(()=>undoBoardAction());assert(Math.abs((await geometry()).width-g.width)<1);
    await drag('br',500,400);assert.equal((await geometry()).scale,1,'enlarging returns to freeform');
    assert.equal(await page.locator('.tile-scale-hint').count(),0,'returning to freeform clears hint');
    assert.equal(await tile.evaluate(m=>getComputedStyle(m).outlineColor),'rgb(23, 25, 29)');
    assert.deepEqual(errors,[]);console.log('Smooth boundary transition, independent edges, compact aspect preservation, save/restore, undo and enlargement passed.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
