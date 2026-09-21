const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      window.testSounds=[];
      window.Audio=class extends EventTarget{
        constructor(src){super();this.src=src;this.paused=true;this.volume=1;this.currentTime=0;window.testSounds.push(this)}
        play(){this.paused=false;return Promise.resolve()}
        pause(){this.paused=true}
        removeAttribute(){}load(){}
        cloneNode(){return new Audio(this.src)}
      };
    });
    await page.route('**/*',route=>{
      const url=new URL(route.request().url());
      const file=path.join(process.cwd(),decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
      return url.hostname==='tiles.test'&&fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({path:file}):route.abort();
    });
    await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(250);
    const packs=await page.evaluate(()=>{
      document.getElementById('profile-modal').hidden=true;
      boardCamera.x=0;boardCamera.y=0;boardCamera.scale=1;applyBoardCamera();
      const robot=createModule('robothfw',420,80,{record:false});robot.id='test-robot';robot.style.left='40px';robot.style.top='70px';
      const meditation=createModule('meditation',1080,80,{record:false});meditation.id='test-meditation';meditation.style.left='890px';meditation.style.top='70px';
      const select=robot.querySelector('.robothfw-grade');
      const labels=[];
      for(const grade of ['k','1','2','3plus']){select.value=grade;select.dispatchEvent(new Event('change'));labels.push(robot.querySelector('.robothfw-endcard-copy').textContent)}
      return{labels,edit:robot.querySelector('.robothfw-settings-button').textContent,sel:document.querySelector('[data-module="meditation"]').dataset.category};
    });
    assert.deepEqual(packs.labels,['Kindergarten','Grade 1','Grade 2','Grade 3+'].map(name=>`Press Start to battle the ${name} Pack.`));
    assert.equal(packs.edit,'Edit Words');assert.equal(packs.sel,'sel');
    await page.locator('#test-robot .robothfw-controls .robothfw-start').click();
    await page.waitForTimeout(850);
    await page.locator('#test-meditation .meditation-toggle').click();
    await page.waitForTimeout(1500);
    if(process.env.TILE_SCREENSHOT)await page.screenshot({path:process.env.TILE_SCREENSHOT});
    assert.equal(await page.locator('.meditation-cue').textContent(),'Breathe in');
    await page.waitForTimeout(2700);
    assert.equal(await page.locator('.meditation-cue').textContent(),'Breathe out');
    await page.locator('#test-meditation .meditation-toggle').click();
    assert.equal(await page.locator('.meditation-cue').textContent(),'Paused');
    await page.evaluate(()=>{
      const robot=document.getElementById('test-robot');
      robot.querySelector('.robothfw-controls .robothfw-reset').click();
      boardCamera.scale=.6;applyBoardCamera();
      robot.querySelector('.robothfw-controls .robothfw-start').click();
    });
    await page.waitForTimeout(850);
    const burst=await page.evaluate(()=>{
      const m=document.getElementById('test-robot'),stage=m.querySelector('.robothfw-stage'),robot=m.querySelector('.robothfw-robot');
      const a=stage.getBoundingClientRect(),b=robot.getBoundingClientRect();
      const expected=(b.left-a.left+b.width/2)/(a.width/stage.offsetWidth)-stage.clientLeft;
      robot.click();
      const particle=stage.querySelector('.robothfw-comic-burst');
      return{expected,actual:parseFloat(particle.style.left),volume:testSounds.filter(s=>s.src.includes('/explode.mp3')).at(-1).volume};
    });
    assert(Math.abs(burst.expected-burst.actual)<1);assert.equal(burst.volume,.52);
    if(process.env.TILE_SCREENSHOT){await page.waitForTimeout(170);await page.screenshot({path:process.env.TILE_SCREENSHOT.replace('.png','-explosion.png')});}
    await page.evaluate(()=>deleteModules([document.getElementById('test-robot')]));
    await page.waitForTimeout(1300);
    assert(await page.evaluate(()=>testSounds.filter(s=>s.src?.includes('/robot-hfw/')).every(s=>s.paused)));
    await page.evaluate(()=>{window.dispatchEvent(new Event('teachertiles:audiopreferenceschange'));undoBoardAction()});
    assert.equal(await page.evaluate(()=>document.getElementById('test-robot')._boardGetState().started),false);
    await page.evaluate(()=>{
      const m=document.getElementById('test-meditation');m.querySelector('.meditation-toggle').click();deleteModules([m]);undoBoardAction();
    });
    assert.equal(await page.locator('#test-meditation').getAttribute('data-breathing'),'false');
    const state=await page.evaluate(()=>{const m=document.getElementById('test-meditation');const saved=m._boardGetState();m._boardSetState(saved);return{cue:m.querySelector('.meditation-cue').textContent,overflow:m.scrollHeight>m.clientHeight}});
    assert.equal(state.cue,'Find your calm');assert.equal(state.overflow,false);
    const restored=await page.evaluate(()=>{
      const m=document.getElementById('test-meditation');
      const saved=serializeBoardModule(m);m._cleanup();m.remove();
      const copy=restoreTeacherTilesBoardObject(saved);copy.style.width='300px';copy.style.height='360px';
      return{type:copy.dataset.type,overflow:copy.scrollHeight>copy.clientHeight,cue:copy.querySelector('.meditation-cue').textContent};
    });
    assert.equal(restored.type,'meditation');assert.equal(restored.overflow,false);assert.equal(restored.cue,'Find your calm');
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('.meditation-bloom').evaluate(el=>getComputedStyle(el).transform),'none');
    assert.deepEqual(errors,[]);
    console.log('Robot labels, quieter explosion, zoom alignment, delete/undo audio shutdown; Meditation breathing phases, pause, restore, sizing, and reduced motion passed.');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
