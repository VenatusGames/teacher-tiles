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
    const meditation=await page.evaluate(()=>{
      document.getElementById('profile-modal').hidden=true;boardCamera.x=0;boardCamera.y=0;boardCamera.scale=1;applyBoardCamera();
      const m=createModule('meditation',400,150,{record:false});m.id='med';m.style.left='80px';m.style.top='100px';
      const set=(selector,value)=>{const field=m.querySelector(selector);field.value=value;field.dispatchEvent(new Event('change',{bubbles:true}))};
      set('.meditation-inhale','2');set('.meditation-exhale','3');set('.meditation-duration','0:10');
      m.querySelector('.tile-settings-toggle').click();
      const settingsOpen=!m.querySelector('.tile-settings-panel').hidden;
      m.querySelector('.tile-settings-toggle').click();
      const result={settingsOpen,state:m._boardGetState(),background:getComputedStyle(m).backgroundColor,appearance:!!m.querySelector('.tile-appearance-toggle'),sound:!!m.querySelector('.tile-audio-volume')};
      m.querySelector('.meditation-toggle').click();return result;
    });
    assert.equal(meditation.state.inhaleSeconds,2);assert.equal(meditation.state.exhaleSeconds,3);assert.equal(meditation.state.durationSeconds,10);assert(meditation.appearance);assert(meditation.sound);assert(meditation.settingsOpen);assert.notEqual(meditation.background,'rgb(23, 30, 50)');
    await page.clock.runFor(2200);
    assert.equal(await page.locator('.meditation-cue').textContent(),'Breathe out');
    await page.evaluate(()=>testSounds.filter(s=>s.src.includes('ambient-meditation'))[0].currentTime=19);
    await page.clock.runFor(100);
    assert.equal(await page.evaluate(()=>testSounds.filter(s=>s.src.includes('ambient-meditation')&&!s.paused).length),2,'loop crossfade starts second deck');
    await page.clock.runFor(1700);
    assert.equal(await page.evaluate(()=>testSounds.filter(s=>s.src.includes('ambient-meditation')&&!s.paused).length),1);
    await page.clock.runFor(6200);
    assert.equal(await page.locator('.meditation-cue').textContent(),'Well done');
    assert(await page.evaluate(()=>testSounds.filter(s=>s.src.includes('ambient-meditation')).every(s=>s.paused)));
    const tabs=await page.evaluate(()=>{
      const med=document.getElementById('med');const id=ensureBoardObjectId(med);
      med.dataset.bg='lavender';med.querySelector('.module-tab-add').click();
      let active=workspace.querySelector(`[data-board-object-id="${id}"]`);
      const blank=active._boardGetState().durationSeconds;
      active.dataset.bg='blue';TeacherTilesTabs.switchTo(active,0);
      active=workspace.querySelector(`[data-board-object-id="${id}"]`);
      const original={bg:active.dataset.bg,duration:active._boardGetState().durationSeconds};
      const youtube=createModule('youtube',1000,200,{record:false});youtube.dataset.bg='pink';
      const merged=TeacherTilesTabs.merge(active,youtube);
      active=workspace.querySelector(`[data-board-object-id="${id}"]`);
      const types=active._tileTabs.items.map(x=>x.type);
      const rect={width:active.offsetWidth,height:active.offsetHeight};
      const saved=TeacherTilesBoard.capture();TeacherTilesBoard.load(saved);
      active=workspace.querySelector(`[data-board-object-id="${id}"]`);
      const persisted={type:active.dataset.type,count:active._tileTabs.items.length,bg:active.dataset.bg};
      TeacherTilesTabs.switchTo(active,0);active=workspace.querySelector(`[data-board-object-id="${id}"]`);
      return{blank,original,merged,types,rect,persisted,restored:active._boardGetState(),groupId:id};
    });
    assert.equal(tabs.blank,180);assert.deepEqual(tabs.original,{bg:'lavender',duration:10});assert(tabs.merged);assert.deepEqual(tabs.types,['meditation','meditation','youtube']);assert.equal(tabs.persisted.count,3);assert.equal(tabs.persisted.bg,'pink');assert.equal(tabs.restored.durationSeconds,10);assert.equal(tabs.rect.width,460);assert.equal(tabs.rect.height,550);
    const videos=await page.evaluate(()=>{
      TeacherTilesBoard.clear();let m=createModule('youtube',500,200,{record:false});const id=ensureBoardObjectId(m);
      m._boardSetState({url:'https://youtu.be/abcdefghijk',loaded:false});TeacherTilesTabs.add(m);
      m=workspace.querySelector(`[data-board-object-id="${id}"]`);m._boardSetState({url:'https://youtu.be/lmnopqrstuv',loaded:false});
      const saved=TeacherTilesBoard.capture();TeacherTilesBoard.load(saved);m=workspace.querySelector(`[data-board-object-id="${id}"]`);
      const second=m._boardGetState().url;TeacherTilesTabs.switchTo(m,0);m=workspace.querySelector(`[data-board-object-id="${id}"]`);
      return{first:m._boardGetState().url,second};
    });
    assert.deepEqual(videos,{first:'https://youtu.be/abcdefghijk',second:'https://youtu.be/lmnopqrstuv'});
    const undo=await page.evaluate(()=>{
      TeacherTilesBoard.clear();const a=createModule('clock',300,150,{record:false}),b=createModule('progressbar',900,150,{record:false});
      const id=ensureBoardObjectId(a);TeacherTilesTabs.merge(a,b);undoBoardAction();
      const restored=[...workspace.querySelectorAll('.module')].map(x=>x.dataset.type).sort();redoBoardAction();
      const grouped=workspace.querySelector(`[data-board-object-id="${id}"]`);
      grouped._tileTabs.items[0].tabLabel='First';TeacherTilesTabs.render(grouped);
      return{restored,count:workspace.querySelectorAll('.module').length,tabs:grouped._tileTabs.items.length};
    });
    assert.deepEqual(undo.restored,['clock','progressbar']);assert.equal(undo.count,1);assert.equal(undo.tabs,2);
    await page.evaluate(()=>{
      TeacherTilesBoard.clear();const m=createModule('meditation',500,200,{record:false});m.id='resize-test';m.style.left='350px';m.style.top='160px';m.style.width='300px';m.style.height='430px';
    });
    await page.clock.runFor(50);
    let box=await page.locator('#resize-test').boundingBox();
    let handle=await page.locator('#resize-test [data-resize=br]').boundingBox();await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2-box.width*.45,handle.y+handle.height/2-box.height*.45,{steps:10});await page.mouse.up();
    const small=await page.evaluate(()=>{const m=document.getElementById('resize-test'),s=serializeBoardModule(m);return{scale:tileUniformScale(m),width:m.offsetWidth,height:m.offsetHeight,saved:s.transform.uniformScale}});
    assert.equal(small.scale,1);assert.equal(small.width,165);assert.equal(small.height,237);assert.equal(small.scale,small.saved);
    await page.evaluate(()=>undoBoardAction());assert.equal(await page.evaluate(()=>tileUniformScale(document.getElementById('resize-test'))),1);
    await page.evaluate(()=>redoBoardAction());assert(await page.evaluate(()=>document.getElementById('resize-test').offsetWidth<300));
    const pinned=await page.evaluate(()=>{
      const m=document.getElementById('resize-test');setTilePinned(m,true);const before=m.getBoundingClientRect();boardCamera.scale=.7;applyBoardCamera();const after=m.getBoundingClientRect();
      setTilePinned(m,false);boardCamera.scale=1;applyBoardCamera();return{before:[before.x,before.y,before.width,before.height],after:[after.x,after.y,after.width,after.height]};
    });
    pinned.before.forEach((value,index)=>assert(Math.abs(value-pinned.after[index])<1,'pinned compact tiles keep their screen geometry'));
    box=await page.locator('#resize-test').boundingBox();
    handle=await page.locator('#resize-test [data-resize=br]').boundingBox();await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2+380-box.width,handle.y+handle.height/2+510-box.height,{steps:10});await page.mouse.up();
    assert.equal(await page.evaluate(()=>tileUniformScale(document.getElementById('resize-test'))),1,'expanding restores freeform resize');
    await page.evaluate(()=>{const saved=TeacherTilesBoard.capture();TeacherTilesBoard.load(saved)});
    await page.evaluate(()=>{
      TeacherTilesBoard.clear();
      const a=createModule('meditation',400,180,{record:false}),b=createModule('progressbar',1000,180,{record:false});
      a.id='drop-target';b.id='drop-source';
      for(const [m,x] of [[a,140],[b,830]]){const rect=m.getBoundingClientRect();m.style.left=(m.offsetLeft+x-rect.left)+'px';m.style.top=(m.offsetTop+140-rect.top)+'px';}
    });
    const sourceHandle=await page.locator('#drop-source .module-drag-handle').boundingBox();
    const targetButton=await page.locator('#drop-target .module-tab-add').boundingBox();
    await page.mouse.move(sourceHandle.x+sourceHandle.width/2,sourceHandle.y+sourceHandle.height/2);await page.mouse.down();
    await page.mouse.move(targetButton.x+targetButton.width/2,targetButton.y+targetButton.height/2,{steps:20});
    assert.equal(await page.locator('.is-tab-drop-target').count(),1,'drag highlights tab drop zone');
    await page.mouse.up();
    assert.equal(await page.locator('.workspace .module').count(),1,'drop merges tiles');
    assert.equal(await page.locator('.tile-tab').count(),2);
    await page.locator('.tile-tab').first().click();
    assert.equal(await page.locator('.workspace .module').getAttribute('data-type'),'meditation');
    await page.evaluate(()=>{const m=workspace.querySelector('.module');m.querySelector('.meditation-toggle').click();});
    await page.clock.runFor(1000);
    if(process.env.TILE_SCREENSHOT)await page.screenshot({path:process.env.TILE_SCREENSHOT});
    await page.locator('.tile-tab').nth(1).click();
    assert(await page.evaluate(()=>testSounds.filter(s=>s.src.includes('ambient-meditation')).every(s=>s.paused)),'switching tabs stops hidden music');
    assert.deepEqual(errors,[]);
    console.log('Meditation styling/timing/music completion/crossfade, tab customization/persistence/merge undo, and independent resize passed.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
