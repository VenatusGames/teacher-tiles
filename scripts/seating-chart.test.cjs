const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1400,height:1000}});
  await page.route('**/*',route=>{const url=new URL(route.request().url()),file=path.join(process.cwd(),decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(url.hostname!=='tiles.test'||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.abort();return route.fulfill(file.endsWith('index.html')?{contentType:'text/html',body:fs.readFileSync(file,'utf8').replace(/<script[^>]+src="(?:firebase-auth|sandbox\/board-gate)[^"]*"[^>]*><\/script>/g,'')}:{path:file})});
  await page.goto('http://tiles.test/');await page.waitForTimeout(4500);
  const initialize=()=>{
   document.getElementById('profile-modal').hidden=true;
   window.testChart=createModule('seatingchart',420,340,{record:false});
   const position=screenToBoard(100,80);Object.assign(testChart.style,{left:position.x+'px',top:position.y+'px'});
   window.loadSeatingClass=id=>{const select=testChart.querySelector('.tile-class-loader select');select.value=id;select.dispatchEvent(new Event('change'));testChart.querySelector('.tile-class-loader button').click()};
  };
  await page.evaluate(()=>{
   localStorage.setItem(classRostersStorageKey(),JSON.stringify([{id:'seating-a',name:'Class A',students:['Alex','Blair','Casey']},{id:'seating-b',name:'Class B',students:['Dee','Ellis']} ]));
   window.savedClasses=[];window.TeacherTilesEncryptedClasses={save:async classes=>savedClasses.push(classes)};
  });
  await page.evaluate(initialize);await page.evaluate(()=>loadSeatingClass('seating-a'));
  const clean=state=>({layout:state.layout,desks:state.desks.map(({id,...desk})=>desk)});
  const state=()=>page.evaluate(()=>testChart._boardGetState());
  const defaults=clean(await state());
  // Real keyboard movement, rotation, fixed assignment, and extra furniture.
  await page.locator('.seating-room .seating-desk').first().focus();await page.keyboard.press('Shift+ArrowRight');await page.keyboard.press('ArrowDown');
  await page.evaluate(()=>{testChart.querySelector('.seating-room .seating-desk').click();testChart.querySelector('.seating-rotate').click();testChart.querySelector('.seating-pin').click();testChart.querySelector('.seating-furniture-option[data-kind=teacher]').click()});
  const custom=clean(await state());assert.notDeepEqual(custom,defaults);
  assert.equal(custom.desks[0].angle,90);assert(custom.desks[0].pinned);assert.equal(custom.desks.length,4);
  await page.evaluate(()=>{testChart.querySelector('.seating-change-class').click();loadSeatingClass('seating-b');testChart.querySelector('.seating-clear').click();testChart.querySelector('.seating-change-class').click();loadSeatingClass('seating-a')});
  assert.deepEqual(clean(await state()),custom,'class switching restores the complete layout');
  assert.equal(await page.evaluate(()=>savedClasses.length),0,'movement uses batched cloud sync');
  await page.evaluate(async()=>{flushPbisCloudSave();await encryptedClassSaveQueue});
  assert.deepEqual(await page.evaluate(()=>savedClasses.at(-1).find(c=>c.id==='seating-a').seatingChart),custom,'layout included in encrypted class payload');
  await page.evaluate(()=>{window.savedBoardChart=serializeBoardModule(testChart);testChart._cleanup();testChart.remove();testChart=restoreTeacherTilesBoardObject(savedBoardChart)});
  assert.deepEqual(clean(await state()),custom,'board restore retains layout');
  await page.reload();await page.waitForTimeout(4500);await page.evaluate(initialize);await page.evaluate(()=>loadSeatingClass('seating-a'));
  assert.deepEqual(clean(await state()),custom,'reopening a fresh tile after reload restores class layout');
  await page.evaluate(()=>{testChart.querySelector('.seating-reset').click()});assert.deepEqual(clean(await state()),defaults,'reset restores rows and default student desks');
  await page.evaluate(()=>{testChart.querySelector('.seating-change-class').click();loadSeatingClass('seating-b')});assert.equal((await state()).desks.length,0,'an intentionally empty layout remains empty');
  await page.evaluate(()=>{testChart.querySelector('.seating-change-class').click();loadSeatingClass('seating-a')});assert.deepEqual(clean(await state()),defaults,'reset is persisted for only that class');
  // Roster edits do not erase positions, and removed students are unassigned.
  await page.evaluate(()=>{const classes=readClassRosters();classes[0].students=['Alex','Casey','New Student'];writeClassRosters(classes)});
  assert.equal((await state()).desks[1].name,'');assert.equal((await state()).desks[0].x,defaults.desks[0].x);
  await page.evaluate(()=>{window.oldScope=window.TeacherTilesClassScope;window.TeacherTilesClassScope='different-account';localStorage.setItem(classRostersStorageKey(),JSON.stringify([{id:'seating-a',name:'Other Account',students:['Other']} ]));testChart._cleanup();testChart.remove()});
  await page.evaluate(initialize);await page.evaluate(()=>loadSeatingClass('seating-a'));assert.deepEqual((await state()).names,['Other'],'layouts stay within their account');
  await page.evaluate(()=>{testChart._cleanup();testChart.remove();window.TeacherTilesClassScope=oldScope});await page.evaluate(initialize);await page.evaluate(()=>loadSeatingClass('seating-a'));
  const tile=page.locator('.seating-chart-module'),room=tile.locator('.seating-room'),footer=tile.locator('.pbis-footer-actions');
  await page.mouse.move(1300,900);await page.evaluate(()=>document.activeElement.blur());await page.waitForTimeout(300);
  const resting=await room.boundingBox(),bounds=await tile.boundingBox();
  assert(bounds.y+bounds.height-resting.y-resting.height<20,'room fills the bottom on unhover');
  assert.equal(await footer.evaluate(e=>getComputedStyle(e).visibility),'hidden');
  await tile.screenshot({path:path.join(process.env.TEMP,'seating-chart-rest.png')});
  await tile.hover();await page.waitForTimeout(300);assert((await room.boundingBox()).height<resting.height-35,'hover controls move room up');
  assert.equal(await tile.locator('.seating-header .seating-change-class').count(),0);
  assert(await footer.locator('.pbis-footer-change svg').isVisible(),'shared icon button in bottom footer');
  await page.evaluate(()=>testChart.querySelector('.seating-room .seating-desk').click());await page.waitForTimeout(300);
  assert(await tile.locator('.seating-editor').isVisible());
  await page.mouse.move(1300,900);await page.waitForTimeout(300);
  assert.equal(await tile.locator('.seating-hover-tools').evaluate(e=>getComputedStyle(e).visibility),'hidden','desk selection does not leave controls stuck');
  assert(Math.abs((await room.boundingBox()).height-resting.height)<2,'selected desk editor leaves no dead space');
  await tile.hover();await page.waitForTimeout(300);await tile.screenshot({path:path.join(process.env.TEMP,'seating-chart-updated.png')});
  await page.evaluate(()=>{testChart.style.width='430px';testChart.style.height='420px'});await page.waitForTimeout(300);
  assert(await tile.evaluate(m=>{const controls=[...m.querySelectorAll('.pbis-footer-actions button,.tile-appearance-toggle')].map(e=>e.getBoundingClientRect());return controls.every((a,i)=>controls.slice(i+1).every(b=>a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top))}),'footer controls do not overlap at minimum size');
  await tile.screenshot({path:path.join(process.env.TEMP,'seating-chart-small.png')});
  await tile.locator('.module-fullscreen').evaluate(e=>e.click());await page.waitForTimeout(300);
  assert(await page.evaluate(()=>document.fullscreenElement===testChart));
  assert(await room.evaluate(e=>{const a=e.getBoundingClientRect(),b=e.closest('.module').getBoundingClientRect();return a.height>500&&a.bottom<b.bottom&&a.right<b.right}),'room uses fullscreen space and remains contained');
  await page.evaluate(()=>document.exitFullscreen());await page.waitForTimeout(300);await tile.hover();
  await footer.locator('.seating-change-class').click();assert(await tile.locator('.seating-class-import').isVisible());assert(!(await footer.isVisible()),'footer hidden while picking class');

  console.log('PASS hover expansion, shared footer, minimum size, fullscreen, per-class persistence, furniture/rotation/assignment, reload, board restore, empty layouts, reset, roster edits, account isolation, and batched encrypted saves');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
