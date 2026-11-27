const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('C:/Users/Jack/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
   const url=new URL(route.request().url()),file=path.join(root,decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
   if(url.hostname!=='tiles.test'||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.abort();
   if(/\.(mp3|ogg)$/.test(file)){
    const bytes=fs.readFileSync(file),range=route.request().headers().range?.match(/bytes=(\d+)-(\d*)/),contentType=file.endsWith('.ogg')?'audio/ogg':'audio/mpeg';
    if(range){const start=Number(range[1]),end=Math.min(bytes.length-1,range[2]?Number(range[2]):bytes.length-1);return route.fulfill({status:206,contentType,headers:{'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${bytes.length}`},body:bytes.subarray(start,end+1)})}
    return route.fulfill({contentType,body:bytes});
   }
   return route.fulfill({path:file});
  });
  await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1300);
  await page.evaluate(()=>{
   document.getElementById('profile-modal').hidden=true;window.TeacherTilesAccount={state:{subscriptionActive:true}};
   boardCamera.x=0;boardCamera.y=0;boardCamera.scale=1;applyBoardCamera();
   window.playUiSfx=()=>{};window.launchConfetti=()=>{window.celebrations=(window.celebrations||0)+1};
   window.readClassRosters=()=>[{id:'test-class',name:'Winter Class',students:['Avery','Jordan','Sam','Morgan','Riley','Taylor']}];
   window.tree=createModule('christmastree',0,0);tree.style.left='40px';tree.style.top='40px';
   window.santa=createModule('santaslist',0,0);santa.style.left='570px';santa.style.top='40px';
  });
  const tree=page.locator('.christmas-tree-module'),santa=page.locator('.santas-list-module');
  assert.equal(await tree.count(),1);assert.equal(await santa.count(),1);
  assert.equal(await tree.locator('.ct-decoration.is-visible').count(),0);
  await page.evaluate(()=>tree._boardSetState({duration:10,elapsed:9.7,seed:52}));
  await tree.hover();await tree.locator('.ct-start').click();
  await page.waitForFunction(()=>tree._boardGetState().elapsed===10);
  assert.equal(await page.evaluate(()=>celebrations),1);
  assert.equal(await tree.locator('.ct-decoration:not(.is-visible)').count(),0);
  assert(await tree.locator('.ct-decoration').last().locator('image').getAttribute('href').then(src=>src.endsWith('star.png')));
  await page.waitForTimeout(700);
  if(process.env.HOLIDAY_SCREENSHOT)await tree.screenshot({path:process.env.HOLIDAY_SCREENSHOT+'-tree.png'});
  const seed=await tree.evaluate(el=>el._boardGetState().seed);await tree.locator('.ct-reset').click();assert.notEqual(await tree.evaluate(el=>el._boardGetState().seed),seed);
  assert.equal(await tree.locator('.ct-decoration.is-visible').count(),0);
  await page.evaluate(()=>{
   window.sample=255;window.stops=0;
   Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>({getTracks:()=>[{stop:()=>window.stops++}]})}});
   window.AudioContext=class{resume(){return Promise.resolve()}close(){return Promise.resolve()}createAnalyser(){return{fftSize:2048,getByteTimeDomainData:buffer=>buffer.fill(window.sample)}}createMediaStreamSource(){return{connect(){}}}};
   tree._boardSetState({mode:'noise',duration:10,threshold:45,seed:1});
  });
  await tree.locator('.ct-start').click();await page.waitForTimeout(800);
  assert.equal(await tree.evaluate(el=>el._boardGetState().elapsed),0,'Loud input pauses growth');
  await page.evaluate(()=>sample=128);await page.waitForTimeout(900);
  assert(await tree.evaluate(el=>el._boardGetState().elapsed)>.2,'Quiet input grows the tree');
  await tree.locator('.ct-start').click();assert.equal(await page.evaluate(()=>stops),1);
  const paused=await tree.evaluate(el=>el._boardGetState().elapsed);await page.waitForTimeout(200);assert.equal(await tree.evaluate(el=>el._boardGetState().elapsed),paused);
  await tree.locator('.ct-start').click();await page.waitForTimeout(100);await page.evaluate(()=>tree._deactivate());assert.equal(await page.evaluate(()=>stops),2);
  await page.evaluate(()=>{const saved=serializeBoardModule(tree);tree._cleanup();tree.remove();tree=createModule('christmastree',0,0,{record:false,boardState:saved})});
  assert.equal(await tree.evaluate(el=>el._boardGetState().mode),'noise');assert.equal(await tree.locator('.ct-start').textContent(),'Start');
  // The shared class picker and pointer drag work at actual board coordinates.
  assert(await santa.locator('.class-roster-intro').isVisible());
  await santa.locator('.sl-class-import select').selectOption('test-class');await santa.locator('.tile-class-loader button').click();
  assert.equal(await santa.locator('.sl-student').count(),6);await page.waitForTimeout(300);
  const chip=await santa.locator('.sl-student').first().boundingBox(),paper=await santa.locator('.sl-paper').boundingBox();
  await page.mouse.move(chip.x+chip.width/2,chip.y+chip.height/2);await page.mouse.down();await page.mouse.move(paper.x+paper.width/2,paper.y+paper.height/2,{steps:15});await page.mouse.up();
  assert.equal(await santa.locator('.sl-entry').count(),1);assert.equal(await santa.locator('.sl-entry span').textContent(),'Avery');
  assert.equal(await santa.locator('.sl-writing').count(),1);
  const openWidth=(await santa.locator('.sl-paper').boundingBox()).width;
  await santa.locator('.sl-drawer-close').click();await page.waitForTimeout(300);
  assert.equal(await santa.locator('.sl-students-toggle').getAttribute('aria-expanded'),'false');
  assert((await santa.locator('.sl-paper').boundingBox()).width>openWidth+80,'Closing names drawer expands the list');
  assert.equal(await santa.locator('.sl-paper-empty svg').count(),0);
  await santa.locator('.sl-title').fill('Our Holiday Helpers');
  await santa.hover();await santa.locator('.sl-students-toggle').click();
  await santa.locator('.sl-student').first().focus();await page.keyboard.press('Enter');
  assert.equal(await santa.locator('.sl-entry').count(),2);
  await santa.locator('.sl-add-name').fill('Extra Student');await santa.locator('.sl-add-form button').click();
  assert((await santa.evaluate(el=>el._boardGetState().students)).includes('Extra Student'));
  await page.waitForTimeout(1000);
  if(process.env.HOLIDAY_SCREENSHOT)await santa.screenshot({path:process.env.HOLIDAY_SCREENSHOT+'-list.png'});
  await page.evaluate(()=>{const saved=serializeBoardModule(santa);santa._cleanup();santa.remove();santa=createModule('santaslist',0,0,{record:false,boardState:saved})});
  assert.equal(await santa.locator('.sl-title').inputValue(),'Our Holiday Helpers');assert.equal(await santa.locator('.sl-entry').count(),2);
  await santa.locator('.sl-entry').first().hover();await santa.locator('.sl-remove').first().click();assert.equal(await santa.locator('.sl-entry').count(),1);
  await page.evaluate(()=>santa.requestFullscreen());await santa.locator('.sl-load-class').click();assert(await santa.locator('.class-roster-intro').isVisible());await santa.locator('.sl-back').click();assert.equal(await santa.locator('.sl-entry').count(),1);await page.evaluate(()=>document.exitFullscreen());
  await santa.hover();await santa.locator('.sl-reset').click();assert.equal(await santa.locator('.sl-entry').count(),0);
  for(const [target,width,height] of [[tree,310,390],[santa,440,370]]){
   await target.evaluate((el,{width,height})=>{el.style.width=width+'px';el.style.height=height+'px'},{width,height});
   await target.hover();await page.waitForTimeout(250);
   assert(await target.evaluate(el=>el.scrollWidth<=el.clientWidth+2),'Minimum tile size does not overflow horizontally');
  }
  await page.evaluate(()=>tree.requestFullscreen());await tree.locator('.tile-settings-toggle').click();
  assert(await tree.locator('.ct-settings').isVisible());await page.keyboard.press('Escape');await page.evaluate(()=>document.fullscreenElement&&document.exitFullscreen());
  // Both players seek by dragging, preserve paused state, and support keyboard seeking.
  await page.evaluate(()=>{tree._cleanup();tree.remove();santa._cleanup();santa.remove()});
  for(const [type,skin] of [['boombox',''],['boombox','soundscapes-music-player'],['boombox','soundscapes-ipod'],['boombox','soundscapes-vinyl'],['christmascarols','']]){
   await page.evaluate(({type,skin})=>{window.player=createModule(type,0,0,{tileSkin:skin});player.style.left='80px';player.style.top='80px'}, {type,skin});
   const tile=page.locator('.soundscapes-module'),bar=tile.locator('.boombox-view:not([hidden]) .boombox-progress');
   await tile.locator('.boombox-view:not([hidden]) .boombox-play').click();await page.waitForFunction(()=>player.querySelector('audio').duration>0&&!player.querySelector('audio').paused);
   const bounds=await bar.boundingBox(),tileBefore=await tile.boundingBox();
   await page.mouse.move(bounds.x+bounds.width*.2,bounds.y+2);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.65,bounds.y+2,{steps:10});await page.mouse.up();
   assert(await tile.evaluate(el=>{const a=el.querySelector('audio');return a.currentTime/a.duration>.6&&a.currentTime/a.duration<.7&&!a.paused}));
   assert.equal((await tile.boundingBox()).x,tileBefore.x,'Seeking does not drag tile');
   await tile.locator('.boombox-view:not([hidden]) .boombox-play').click();await bar.focus();await page.keyboard.press('Home');assert(await tile.evaluate(el=>el.querySelector('audio').currentTime<1&&el.querySelector('audio').paused));
   await page.keyboard.press('ArrowRight');assert(await tile.evaluate(el=>Math.abs(el.querySelector('audio').currentTime-5)<1));
   await page.evaluate(()=>{player._cleanup();player.remove()});
  }
  assert.equal(await page.locator('#context-menu button').filter({hasText:'Christmas Presents'}).count(),0);
  assert.deepEqual(errors,[]);
  console.log('Christmas activities passed: decoration order/reset, timer completion, quiet/loud microphone gating and cleanup, saved state, class loading, pointer/keyboard placement, name removal, fullscreen, and both audio seek bars.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
