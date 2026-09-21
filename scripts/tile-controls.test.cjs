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
      const m=createModule('meditation',500,250,{record:false});m.id='test-tile';m.style.left='250px';m.style.top='150px';
    });
    const tile=page.locator('#test-tile');let box=await tile.boundingBox();
    const opacity=selector=>page.locator(selector).evaluate(el=>getComputedStyle(el).opacity);
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.clock.runFor(300);
    assert.equal(await opacity('.module-tab-add'),'0','center hover does not reveal add tab');
    await page.mouse.move(box.x+20,box.y+20);await page.clock.runFor(300);
    assert.equal(await opacity('.module-tab-add'),'1','corner hover reveals add tab');
    await page.mouse.move(1400,900);await page.clock.runFor(300);
    await page.evaluate(()=>document.body.classList.add('tile-options-always-visible'));await page.clock.runFor(300);
    assert.equal(await opacity('.module-tab-add'),'0','site preference still hides options off hover');
    await tile.hover();await page.clock.runFor(300);assert.equal(await opacity('.module-tab-add'),'1','site preference reveals options anywhere on tile hover');
    await page.evaluate(()=>document.body.classList.remove('tile-options-always-visible'));
    await tile.hover();await page.locator('.meditation-toggle').click();await page.mouse.move(1400,900);await page.clock.runFor(500);
    assert.equal(await opacity('.meditation-actions'),'0','mouse focus does not keep controls visible');
    assert.equal(await opacity('.meditation-heading'),'1');assert.equal(await opacity('.meditation-session'),'0');
    assert(await page.locator('.meditation-cue').isVisible());assert.equal(await page.locator('.meditation-detail').count(),0);
    await page.evaluate(()=>{const input=document.querySelector('.meditation-show-cues');input.checked=false;input.dispatchEvent(new Event('change',{bubbles:true}));const saved=TeacherTilesBoard.capture();TeacherTilesBoard.load(saved);});
    assert.equal(await page.locator('.meditation-cue').isVisible(),false,'cue option survives restore');
    await page.evaluate(()=>{let m=workspace.querySelector('.module');m.id='test-tile';m.style.width='600px';m.style.height='430px';});
    box=await tile.boundingBox();let handle=await page.locator('#test-tile [data-resize=br]').boundingBox();
    await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2-550,handle.y+handle.height/2-400,{steps:15});await page.mouse.up();
    const compact=await tile.evaluate(m=>[m.offsetWidth,m.offsetHeight,tileUniformScale(m)]);
    assert.equal(compact[0],300);assert.equal(compact[1],430);assert.equal(compact[2],.85);
    await tile.hover();await page.locator('.tile-settings-toggle').click();await page.locator('.tile-settings-floating .tile-reset-scale').click();
    assert.deepEqual(await tile.evaluate(m=>[m.offsetWidth,m.offsetHeight,tileUniformScale(m)]),[460,550,1]);
    assert.equal(await page.locator('.tile-settings-floating').isVisible(),false,'reset scale closes tile settings');
    assert.equal(await page.locator('.tile-settings-floating .tile-reset-scale svg').count(),1,'reset scale keeps a visual icon');
    await page.evaluate(()=>undoBoardAction());assert.equal(await tile.evaluate(m=>m.offsetWidth),300);
    await page.evaluate(()=>redoBoardAction());
    await page.evaluate(()=>TeacherTilesTabs.add(workspace.querySelector('.module')));await page.mouse.move(1400,900);await page.clock.runFor(500);
    assert.equal(await page.locator('.tile-tab-bookmark').first().evaluate(el=>getComputedStyle(el).transform),'matrix(1, 0, 0, 1, 31, 0)');
    await page.locator('.workspace .module').hover();await page.clock.runFor(500);
    assert.equal(await page.locator('.tile-tab-bookmark').first().evaluate(el=>getComputedStyle(el).transform),'matrix(1, 0, 0, 1, 0, 0)');
    await page.evaluate(()=>{TeacherTilesBoard.clear();for(const type of ['clock','youtube','progressbar','draw'])createModule(type,500,250,{record:false});});
    assert.equal(await page.locator('.workspace .module').count(),await page.locator('.workspace .module .tile-settings-floating .tile-reset-scale').count());
    assert.equal(await page.locator('.workspace .module>.tile-reset-scale').count(),0,'no standalone reset buttons');
    while(await page.locator('.workspace .module').count()){
      const module=page.locator('.workspace .module').first();
      await module.evaluate(m=>bringToFront(m));await module.hover();
      await module.locator('.tile-settings-beside-brush button').first().click();
      assert(await module.locator('.tile-settings-floating .tile-reset-scale').isVisible());
      await page.keyboard.press('Escape');assert.equal(await module.locator('.tile-settings-floating .tile-reset-scale').isVisible(),false);await module.evaluate(m=>{m._cleanup?.();m.remove();});
    }
    const sticker=await page.evaluate(()=>{
      const m=createStickerModule({emoji:'⭐',name:'Star'},500,250,{record:false,animate:false});
      const forbidden='.module-tab-add,.module-fullscreen,.module-pin,.tile-settings-toggle,.tile-reset-scale,.tile-appearance-toggle';
      const before=m.querySelectorAll(forbidden).length;
      const tile=createModule('clock',900,250,{record:false});const merge=TeacherTilesTabs.merge(tile,m);
      TeacherTilesTabs.add(m);const saved=serializeBoardModule(m);saved.dataset.tilePinned='true';
      m._cleanup?.();m.remove();const restored=restoreTeacherTilesBoardObject(saved);
      return{before,after:restored.querySelectorAll(forbidden).length,merge,pinned:isTilePinned(restored),delete:!!restored.querySelector('.module-delete'),handles:restored.querySelectorAll('[data-sticker-resize]').length};
    });assert.deepEqual(sticker,{before:0,after:0,merge:false,pinned:false,delete:true,handles:4});
    assert.deepEqual(errors,[]);console.log('Corner visibility, meditation quiet view/cue persistence, tucked tabs, minimum scaling and undoable reset passed.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

