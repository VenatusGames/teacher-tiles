const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{if(route.request().url().includes('sandbox/board-gate.js'))return route.abort();const u=new URL(route.request().url()),file=path.join(root,decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));return u.hostname==='tiles.test'&&fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({path:file}):route.abort()});
  await page.goto('http://tiles.test/');
  await page.evaluate(()=>{document.documentElement.classList.remove('sandbox-access-locked');document.querySelector('#profile-modal').hidden=true;document.querySelector('#boards-view').hidden=true;clearTeacherTilesBoard();boardCamera.x=0;boardCamera.y=0;boardCamera.scale=1;applyBoardCamera()});
  for(const type of ['writinglines','hangman','wordypuzzle','spinner']){
   await page.evaluate(async type=>{clearTeacherTilesBoard();const m=createModule(type,350,150,{record:false});if(type==='writinglines')m.dataset.writingMode='type';await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));document.activeElement.blur();selectModules([m])},type);
   await page.keyboard.press('Control+c');
   for(let i=0;i<3;i++){
    await page.keyboard.press('Control+v');await page.waitForTimeout(100);
    assert.equal(await page.evaluate(()=>workspace.querySelectorAll('.module').length),i+2,`${type}: consecutive paste`);
    assert.equal(await page.evaluate(()=>isTypingTarget(document.activeElement)),false,`${type}: restored input must not steal focus`);
   }
   assert.equal(await page.evaluate(()=>new Set([...workspace.querySelectorAll('.module')].map(m=>serializeBoardModule(m).id)).size),4);
   await page.keyboard.press('Control+z');assert.equal(await page.evaluate(()=>workspace.querySelectorAll('.module').length),3);
   await page.keyboard.press('Control+y');assert.equal(await page.evaluate(()=>workspace.querySelectorAll('.module').length),4);
  }
  // Real pointer events retain both boxes, then a plain background click clears them.
  await page.evaluate(()=>{clearTeacherTilesBoard();createModule('spinner',250,160,{record:false});createModule('spinner',850,160,{record:false})});
  await page.keyboard.down('Shift');
  for(const [x1,x2] of [[25,470],[625,1070]]){await page.mouse.move(x1,130);await page.mouse.down();await page.mouse.move(x2,590,{steps:5});await page.mouse.up()}
  await page.keyboard.up('Shift');assert.equal(await page.evaluate(()=>selectedModules.size),2);
  await page.mouse.click(1300,800);assert.equal(await page.evaluate(()=>selectedModules.size),0);
  const click=async locator=>{await page.waitForTimeout(200);const rect=await locator.boundingBox();assert(rect,'Control must be visible');await page.mouse.click(rect.x+rect.width/2,rect.y+rect.height/2)};
  const spinner=page.locator('.spinner-module').first();
  await spinner.hover();await page.waitForTimeout(200);
  const namesRect=await spinner.locator('.spinner-names-toggle').boundingBox();await page.mouse.click(namesRect.x+namesRect.width/2,namesRect.y+namesRect.height/2);
  await spinner.locator('.spinner-name-input').fill('Samira');await click(spinner.locator('.spinner-add-name'));
  assert.equal(await spinner.locator('.spinner-name-chip').count(),5);
  const camera=await page.evaluate(()=>boardCamera.scale);await spinner.locator('.spinner-settings').dispatchEvent('wheel',{deltaY:100});assert.equal(await page.evaluate(()=>boardCamera.scale),camera);
  await page.mouse.move(1300,800);assert.equal(await spinner.locator('.spinner-settings').isVisible(),false);
  assert.equal(await spinner.locator('.spinner-names-toggle').getAttribute('aria-expanded'),'false');
  const skin=await page.evaluate(()=>{
   let m=workspace.querySelector('.spinner-module');const names=m._boardGetState().names;
   window.TeacherTilesAccount={state:{ready:true,subscriptionActive:false,ownedProductIds:[]}};
   applyTileSkinToModule(m,'spinner-clear',{record:false});const locked=!m.dataset.tileSkin;
   TeacherTilesAccount.state.ownedProductIds=['tile-skin-spinner-clear'];m=applyTileSkinToModule(m,'spinner-clear',{record:false});
   const clear=getComputedStyle(m).backgroundColor==='rgba(0, 0, 0, 0)'&&m.dataset.tileSkin==='spinner-clear';
   const preserved=JSON.stringify(names)===JSON.stringify(m._boardGetState().names);
   m.classList.add('is-pointer-over');const corner=getComputedStyle(m.querySelector('.resize-handle--tl'),'::before').borderLeftWidth;m.classList.remove('is-pointer-over');
   return {locked,clear,preserved,corner};
  });assert.deepEqual(skin,{locked:true,clear:true,preserved:true,corner:'3px'});
  const clearSpinner=page.locator('[data-tile-skin="spinner-clear"]');
  await clearSpinner.hover();await click(clearSpinner.locator('.tile-skins-toggle')); assert.equal(await page.locator('.tile-skins-choice strong').allTextContents().then(a=>a.includes('No Background')),true);await page.keyboard.press('Escape');
  await page.evaluate(()=>{const m=workspace.querySelector('[data-tile-skin="spinner-clear"]');Object.defineProperty(m.querySelector('audio'),'duration',{value:.1});m.querySelector('.spinner-spin-button').click()});
  await page.waitForFunction(()=>!workspace.querySelector('[data-tile-skin="spinner-clear"] .spinner-result-overlay').hidden);
  assert(await page.evaluate(()=>{const m=workspace.querySelector('[data-tile-skin="spinner-clear"]'),state=m._boardGetState(),tau=2*Math.PI,arc=tau/state.names.length,local=(((-Math.PI/2-state.rotation%tau)+tau)%tau),index=Math.floor(((local+Math.PI/2+tau)%tau)/arc)%state.names.length;return m.querySelector('.spinner-result-name').textContent===state.names[index]}));
  for(const [width,height] of [[240,240],[430,430],[760,760],[640,320]]){
   await page.evaluate(([w,h])=>{const m=workspace.querySelector('[data-tile-skin="spinner-clear"]');m.style.width=w+'px';m.style.height=h+'px'},[width,height]);await page.waitForTimeout(100);
   assert(await page.evaluate(()=>{const m=workspace.querySelector('[data-tile-skin="spinner-clear"]'),r=m.getBoundingClientRect(),c=m.querySelector('canvas').getBoundingClientRect();return c.width>Math.min(r.width,r.height)*.85&&c.width<=r.width&&c.height<=r.height}));
  }
  await page.evaluate(async()=>{clearTeacherTilesBoard();const m=createModule('writinglines',400,150,{record:false});m.querySelectorAll('.writinglines-entry').forEach(e=>e.textContent='gyjpq');await document.fonts.ready});
  for(const [width,height] of [[330,140],[560,350],[800,560]]){
   await page.evaluate(async([w,h])=>{const m=workspace.querySelector('.writinglines-module'),handle=m.querySelector('[data-resize=br]');handle.dispatchEvent(new Event('pointerdown'));m.style.width=w+'px';m.style.height=h+'px';m.querySelector('.writinglines-entry').dispatchEvent(new Event('input'));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));handle.dispatchEvent(new Event('pointerup'))},[width,height]);await page.waitForTimeout(150);
   assert(await page.evaluate(()=>[...workspace.querySelectorAll('.writinglines-row:not([hidden])')].every(row=>{const e=row.querySelector('.writinglines-entry'),s=getComputedStyle(e),ctx=document.createElement('canvas').getContext('2d');ctx.font=s.font;const a=ctx.measureText('Hgypqj'),baseline=(parseFloat(s.lineHeight)-a.fontBoundingBoxAscent-a.fontBoundingBoxDescent)/2+a.fontBoundingBoxAscent;return baseline+a.actualBoundingBoxDescent<=row.clientHeight+1&&baseline-a.actualBoundingBoxAscent>=-1})),`Descenders must fit at ${width} × ${height}`);
  }
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'boards/cosmetics-catalog.json')));assert.equal(catalog.skins['spinner-clear'],'tile-skin-spinner-clear');
  assert.deepEqual(errors,[]);
  console.log('Passed: repeated keyboard paste/undo/redo for four tile types, additive Shift marquees, spinner name editing/hover/scroll, skin ownership and drawer, actual winner matching, four wheel sizes, and Writing Lines descenders at three sizes.');
 }finally{await browser.close()}
})().then(()=>process.exit(0)).catch(error=>{console.error(error);process.exit(1)});

