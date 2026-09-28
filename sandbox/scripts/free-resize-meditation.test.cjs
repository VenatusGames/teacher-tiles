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
    const drag=async(d,dx,dy)=>{const h=await tile.locator('[data-resize='+d+']').boundingBox();await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2+dx,h.y+h.height/2+dy,{steps:8});await page.mouse.up();};
    await drag('br',-1000,-1000);
    assert.equal(await tile.evaluate(m=>tileUniformScale(m)),.85);
    assert.equal(await page.locator('.tile-scale-hint').count(),0);
    await tile.hover();await tile.locator('.meditation-palette-toggle').click();
    assert.equal(await tile.locator('.meditation-palette-drawer button').count(),4);
    await tile.locator('[data-palette=dusk]').click();assert.equal(await tile.getAttribute('data-med-palette'),'dusk');
    await page.evaluate(()=>{const saved=TeacherTilesBoard.capture();TeacherTilesBoard.load(saved);});assert.equal(await tile.getAttribute('data-med-palette'),'dusk');assert.equal(await tile.evaluate(m=>m.offsetWidth),300);
    await page.evaluate(()=>{const m=workspace.querySelector('.module'),saved=serializeBoardModule(m);saved.transform.width=600;saved.transform.height=400;saved.transform.uniformScale=.5;restoreTileEdit(m,saved);});
    assert(await tile.evaluate(m=>m.offsetWidth>=m._resizeMinimum.width&&m.offsetHeight>=m._resizeMinimum.height),'legacy undersized saves regain a safe layout');
    await page.evaluate(()=>{TeacherTilesBoard.clear();for(const [i,palette] of ['lagoon','ocean','dusk','sunrise'].entries()){const m=createModule('meditation',300,200,{record:false});m.style.left=(50+i*355)+'px';m.style.top='150px';m.style.width='330px';m.style.height='480px';m._boardSetState({palette});m.querySelector('.meditation-toggle').click();}});
    await page.mouse.move(1450,900);await page.clock.runFor(2500);
    if(process.env.TILE_SCREENSHOT)await page.screenshot({path:process.env.TILE_SCREENSHOT});
    assert.deepEqual(errors,[]);console.log('Independent resizing, skinny limits, undo, palette drawer, palette persistence and legacy-scale migration passed.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
