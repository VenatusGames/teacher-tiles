const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/Jack/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.Audio=class extends EventTarget{constructor(src){super();Object.assign(this,{src,paused:true,volume:1,currentTime:0,duration:20})}play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true}load(){}removeAttribute(){}cloneNode(){return new Audio(this.src)}}});
  await page.route('**/*',route=>{const u=new URL(route.request().url()),file=path.join(root,decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));return u.hostname==='tiles.test'&&fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({path:file}):route.abort()});
  await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1200);
  await page.clock.install();
  await page.evaluate(()=>{
   document.getElementById('profile-modal').hidden=true;window.TeacherTilesAccount={state:{subscriptionActive:true}};
   let p=screenToBoard(460,150);window.ornament=createModule('christmastimer',p.x,p.y);
   p=screenToBoard(1000,150);window.normal=createModule('timer',p.x,p.y);
  });
  assert.equal(await page.locator('.ornament-timer-art').count(),1);
  const tile=page.locator('.christmastimer-module');
  const wake=async()=>{await page.mouse.move(5,5);await page.mouse.move(10,10);};
  assert.equal(await tile.getAttribute('data-shape-color'),'red');
  await tile.hover();
  await tile.locator('[data-add-seconds="30"]').click();
  assert.equal(await page.evaluate(()=>ornament._boardTimerGetState().left),30);
  await tile.locator('.timer-start').click();
  await page.clock.runFor(10000);
  let progress=await tile.evaluate(el=>Number(el.style.getPropertyValue('--timer-progress-ratio')));
  assert(progress>.32&&progress<.35);
  await wake();await tile.hover();await tile.locator('.timer-start').click();
  const paused=await page.evaluate(()=>ornament._boardTimerGetState().left);
  await page.clock.runFor(2000);
  assert.equal(await page.evaluate(()=>ornament._boardTimerGetState().left),paused);
  await wake();await tile.hover();await tile.locator('.timer-shape-color').click();
  assert.equal(await page.locator('.ornament-color-shelf:visible button').count(),8);
  await page.locator('[data-ornament-color="green"]').click();
  assert.equal(await tile.getAttribute('data-shape-color'),'green');
  await page.evaluate(()=>{const state=serializeBoardModule(ornament);ornament._cleanup();ornament.remove();ornament=createModule('christmastimer',0,0,{record:false,boardState:state});});
  assert.equal(await tile.getAttribute('data-shape-color'),'green');
  assert(Math.abs(await page.evaluate(()=>ornament._boardTimerGetState().left)-paused)<.1);
  await tile.hover();await tile.locator('.timer-sync-toggle').click();
  assert.equal(await page.evaluate(()=>normal._boardTimerGetState().total),30);
  assert.equal(await page.evaluate(()=>normal._boardTimerGetState().left),paused);
  await tile.locator('.timer-reset').click();
  assert.equal(await page.evaluate(()=>ornament._boardTimerGetState().left),30);
  await tile.locator('.timer-clear').click();
  assert.equal(await page.evaluate(()=>ornament._boardTimerGetState().total),0);
  // Fullscreen color shelf is in the top layer, with all eight options reachable.
  await page.evaluate(()=>ornament.requestFullscreen());await page.clock.runFor(300);
  await tile.hover();await tile.locator('.timer-shape-color').click();
  assert.equal(await page.locator('.ornament-color-shelf:popover-open').count(),1);
  await page.locator('[data-ornament-color="blue"]').click();
  assert.equal(await tile.getAttribute('data-shape-color'),'blue');
  await page.evaluate(()=>document.exitFullscreen());await page.clock.runFor(300);
  await page.evaluate(()=>{ornament._boardTimerSetState({total:1,left:1,running:true});});
  await page.clock.runFor(1300);
  assert.equal(await page.evaluate(()=>ornament._boardTimerGetState().finished),true);
  assert.equal(await tile.locator('.timer-remaining').textContent(),'00:00');
  await page.evaluate(async()=>{
   const {createBoardPreview}=await import('/boards/preview.js');
   window.christmasPreview=createBoardPreview({inlineObjects:[serializeBoardModule(ornament)]});document.body.append(christmasPreview);
  });
  assert.equal(await page.locator('.board-card__preview .ornament-timer-art').count(),1);
  assert.equal(await page.locator('.board-card__preview .christmastimer-module').getAttribute('data-shape-color'),'blue');
  await page.evaluate(()=>{christmasPreview.remove();normal._cleanup();normal.remove();ornament._boardTimerSetState({total:300,left:150,running:false});});
  for(const size of [[320,470],[650,720]]){
   await page.evaluate(([w,h])=>{ornament.style.width=w+'px';ornament.style.height=h+'px'},size);await page.clock.runFor(400);
   assert(await tile.locator('.ornament-cap').evaluate(cap=>{const c=cap.getBoundingClientRect(),s=cap.closest('.timer-stage').getBoundingClientRect();return c.top>=s.top-1&&c.left>=s.left-1&&c.right<=s.right+1}));
  }
  await page.evaluate(()=>{
   ornament.style.width='370px';ornament.style.height='500px';
   const p=screenToBoard(1000,150);window.second=createModule('christmastimer',p.x,p.y);
   second.dataset.shapeColor='red';TeacherTilesChristmasTimer.render(second);second._boardTimerSetState({total:300,left:40,running:false});
  });
  await page.clock.runFor(500);
  if(process.env.CHRISTMAS_SCREENSHOT)await page.screenshot({path:process.env.CHRISTMAS_SCREENSHOT});
  assert.deepEqual(errors,[]);
  console.log('Christmas Timer controls, progress, colors, save/restore, sync, completion, fullscreen, sizing and preview passed');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
