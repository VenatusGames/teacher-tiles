const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({channel:'msedge', headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1400,height:900},deviceScaleFactor:1.25});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const baseline=process.env.GEOMETRY_BASELINE==='1';
    const old=baseline?Object.fromEntries(['styles.css','tiles/text-bubble/setup.js','boards/navigation.js'].map(file=>[file,require('node:child_process').execFileSync('git',['show','HEAD:'+file],{encoding:'utf8',maxBuffer:10*1024*1024})])):{};
    await page.route('**/*',r=>{
      const u=new URL(r.request().url()),relative=decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname).slice(1),file=path.join(process.cwd(),relative);
      if(old[relative])return r.fulfill({body:old[relative],contentType:relative.endsWith('.css')?'text/css':'text/javascript'});
      return u.hostname==='tiles.test'&&fs.existsSync(file)&&fs.statSync(file).isFile()?r.fulfill({path:file}):r.abort();
    });
    await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1800);
    await page.evaluate(()=>{
      TeacherTilesBoard.load(TeacherTilesBoard.blank());document.getElementById('profile-modal').hidden=true;
      Object.assign(boardCamera,{x:-4000,y:-3000,scale:1});applyBoardCamera();
      const m=createModule('textbubble',4500,3200,{record:false});
      m.querySelector('.textbubble-text').textContent='Hello class!';
      window.geometryId=ensureBoardObjectId(m);window.geometrySaved=TeacherTilesBoard.capture();
      // The board library hides the workspace using visibility, not display.
      document.body.classList.add('boards-screen-open');TeacherTilesBoard.load(geometrySaved);
    });
    await page.waitForTimeout(250);
    await page.evaluate(()=>document.body.classList.remove('boards-screen-open'));
    await page.waitForTimeout(150);
    const fitted=()=>page.evaluate(()=>{
      const t=workspace.querySelector(`[data-board-object-id="${geometryId}"] .textbubble-text`);
      return {font:parseFloat(getComputedStyle(t).fontSize),width:t.clientWidth,height:t.clientHeight,scrollWidth:t.scrollWidth,scrollHeight:t.scrollHeight};
    });
    const assertFit=async label=>{const v=await fitted();assert(v.scrollWidth<=v.width+1&&v.scrollHeight<=v.height+1,`${label}: ${JSON.stringify(v)}`);};
    await assertFit('Plain text after opening a saved board from the library');
    for(let i=0;i<3;i++){
      await page.evaluate(()=>{
        const m=workspace.querySelector(`[data-board-object-id="${geometryId}"]`);
        if(!m._tileTabs)TeacherTilesTabs.add(m);
        let active=workspace.querySelector(`[data-board-object-id="${geometryId}"]`);
        TeacherTilesTabs.switchTo(active,1);active=workspace.querySelector(`[data-board-object-id="${geometryId}"]`);
        TeacherTilesTabs.switchTo(active,0);
        const saved=TeacherTilesBoard.capture();document.body.classList.add('boards-screen-open');TeacherTilesBoard.load(saved);
      });
      await page.waitForTimeout(100);
      await page.evaluate(()=>document.body.classList.remove('boards-screen-open'));
      await page.waitForTimeout(100);await assertFit('Repeated tile tab switches and board restores');
    }
    await page.evaluate(()=>{
      const m=createModule('textbubble',10500,6500,{record:false});window.farBubble=m;
      m.querySelector('.textbubble-text').focus();window.scrollTo(500,400);document.body.scrollTo(200,150);
    });
    const assertCamera=async()=>{
      const v=await page.evaluate(()=>{const r=workspace.getBoundingClientRect(),offset=renderedBoardCameraOffset();return{scroll:[scrollX,scrollY,document.body.scrollLeft,document.body.scrollTop],dx:r.x-offset.x,dy:r.y-offset.y}});
      assert.deepEqual(v.scroll,[0,0,0,0]);assert(Math.abs(v.dx)<.1&&Math.abs(v.dy)<.1,JSON.stringify(v));
    };
    await assertCamera();
    await page.evaluate(()=>{openBoardFrameMenu();document.getElementById('board-frame-capture').click();window.geometryFrame=TeacherTilesBoard.capture().frames[0];closeBoardFrameMenu({force:true})});
    for(const viewport of [{width:900,height:650},{width:1500,height:1000}]){
      await page.setViewportSize(viewport);
      await page.evaluate(()=>{farBubble.querySelector('.textbubble-text').focus();jumpToBoardFrame(geometryFrame)});
      await page.waitForTimeout(200);await assertCamera();
      const v=await page.evaluate(()=>({actual:screenToBoard(innerWidth/2,innerHeight/2),frame:geometryFrame}));
      assert(Math.abs(v.actual.x-v.frame.centerX)<1&&Math.abs(v.actual.y-v.frame.centerY)<1,JSON.stringify(v));
      await assertFit('Viewport resize and saved-frame jump');
    }
    for(const scale of [.4,1.8,1]){
      await page.evaluate(scale=>{boardCamera.scale=scale;applyBoardCamera()},scale);await page.waitForTimeout(80);await assertFit('Zoom');await assertCamera();
    }
    await page.evaluate(()=>{
      const m=workspace.querySelector(`[data-board-object-id="${geometryId}"]`);
      Object.assign(boardCamera,{x:0,y:0,scale:1});Object.assign(m.style,{left:'250px',top:'150px',width:'500px',height:'300px'});applyBoardCamera();
      m.querySelector('.textbubble-text').innerHTML='<span style="font-size:200px">A restored message with its own font size</span>';
    });
    await page.waitForTimeout(150);await assertFit('Restored markup without input event');
    const tile=page.locator('.workspace [data-type="textbubble"]').filter({has:page.locator('span[style*="200px"]')});
    await tile.evaluate(m=>m.requestFullscreen());await page.waitForTimeout(150);await assertFit('Tile fullscreen');
    await page.evaluate(()=>document.exitFullscreen());await page.waitForTimeout(150);await assertFit('Exit tile fullscreen');
    const pinned=await tile.evaluate(m=>{setTilePinned(m,true);const r=m.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}});
    await page.evaluate(()=>{boardCamera.scale=.7;boardCamera.x=-200;applyBoardCamera()});
    const after=await tile.boundingBox();for(const key of ['x','y','width','height'])assert(Math.abs(after[key]-pinned[key])<1,`Pinned ${key}`);
    await tile.evaluate(m=>{setTilePinned(m,false);Object.assign(boardCamera,{x:0,y:0,scale:1});Object.assign(m.style,{left:'250px',top:'150px',width:'500px',height:'300px'});applyBoardCamera()});
    await page.evaluate(()=>document.getElementById('profile-modal').hidden=true);
    const h=await tile.locator('[data-resize=br]').boundingBox(),x=h.x+h.width/2,y=h.y+h.height/2;
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-20,y-20);
    assert.equal(await tile.evaluate(m=>m.classList.contains('is-resize-threshold')),false,'Ordinary shrinking is not a limit');
    const markedEdges=()=>tile.locator('.tile-resize-limit').evaluate(el=>{const s=getComputedStyle(el);return [s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth]});
    await page.mouse.move(x-1000,y-20,{steps:4});
    assert.deepEqual(await markedEdges(),['0px','0px','0px','3px'],'A width limit while dragging right marks the left edge');
    await page.mouse.move(x-20,y-1000,{steps:4});
    assert.deepEqual(await markedEdges(),['3px','0px','0px','0px'],'A height limit while dragging bottom marks the top edge');
    await page.mouse.move(x-1000,y-1000,{steps:4});
    assert.deepEqual(await markedEdges(),['3px','0px','0px','3px'],'Both limits mark the opposing corner edges');
    assert.equal(await tile.evaluate(m=>m.classList.contains('is-resize-threshold')),true,'Minimum size highlights red: '+JSON.stringify(await tile.evaluate(m=>({classes:m.className,style:m.getAttribute('style'),min:m._resizeMinimum,w:tileDisplayWidth(m),h:tileDisplayHeight(m)}))));
    assert.equal(await tile.locator('.tile-resize-limit').evaluate(el=>getComputedStyle(el).borderRightColor),'rgba(229, 72, 77, 0.4)');
    assert.equal(await page.evaluate(()=>JSON.stringify(TeacherTilesBoard.capture()).includes('is-resize-threshold')),false,'Transient warning is not saved');
    await page.mouse.move(x-10,y-10);assert.equal(await tile.evaluate(m=>m.classList.contains('is-resize-threshold')),false);
    await page.mouse.move(x-1000,y-1000);await page.mouse.up();await page.waitForTimeout(350);
    assert.equal(await tile.evaluate(m=>m.classList.contains('is-resize-threshold')),false);await assertFit('Minimum size');
    assert.equal(await tile.locator('.tile-resize-limit').count(),0,'Feedback is removed after release');
    assert.deepEqual(errors,[]);
    console.log('Board reopen, tile tabs, camera offsets, frame jumps, viewport resize, zoom, fullscreen, pinning, text fitting and minimum-size feedback passed.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
