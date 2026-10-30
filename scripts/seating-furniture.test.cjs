const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1400,height:1000}});
  await page.route('**/*',route=>{const url=new URL(route.request().url()),file=path.join(process.cwd(),decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(url.hostname!=='tiles.test'||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.abort();return route.fulfill(file.endsWith('index.html')?{contentType:'text/html',body:fs.readFileSync(file,'utf8').replace(/<script[^>]+src="(?:firebase-auth|sandbox\/board-gate)[^"]*"[^>]*><\/script>/g,'')}:{path:file})});
  await page.goto('http://tiles.test/');await page.waitForTimeout(4500);

  await page.evaluate(()=>{
    document.getElementById('profile-modal').hidden=true;
    localStorage.setItem(classRostersStorageKey(),JSON.stringify([{id:'furniture',name:'Room 12',students:['Alex','Blair']} ]));
    const p=screenToBoard(100,160);window.chart=createModule('seatingchart',p.x,p.y,{record:false});Object.assign(chart.style,{left:p.x+'px',top:p.y+'px'});
    const select=chart.querySelector('.tile-class-loader select');select.value='furniture';select.dispatchEvent(new Event('change'));chart.querySelector('.tile-class-loader button').click();
  });
  const tile=page.locator('.seating-chart-module'),room=tile.locator('.seating-room'),drawer=tile.locator('.seating-furniture-drawer'),toggle=tile.locator('.seating-furniture-toggle');
  const state=()=>page.evaluate(()=>chart._boardGetState());
  await tile.hover();await page.waitForTimeout(300);
  for(const kind of ['teacher','large','square','table','trapezoid']){
    await tile.hover();await toggle.click();await drawer.locator(`[data-kind="${kind}"]`).click();
    assert.equal((await state()).desks.at(-1).kind,kind);assert(!(await drawer.isVisible()));
  }
  await toggle.click();await page.waitForTimeout(250);await tile.screenshot({path:path.join(process.env.TEMP,'seating-furniture-drawer.png')});
  const option=drawer.locator('[data-kind="crescent"]');await option.scrollIntoViewIfNeeded();const start=await option.boundingBox(),r=await room.boundingBox();
  await page.mouse.move(start.x+start.width/2,start.y+start.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width*.25,r.y+r.height*.65,{steps:12});
  assert(await room.locator('.seating-placement-preview').isVisible(),'live furniture preview during drag');await page.mouse.up();
  assert.equal((await state()).desks.at(-1).kind,'crescent');assert.equal(await room.locator('.seating-placement-preview').count(),0);
  assert.equal(await tile.locator('.seating-assignment').isVisible(),false,'tables do not have student assignments');
  await tile.locator('.seating-randomize').click();assert((await state()).desks.filter(d=>d.kind!=='desk').every(d=>!d.name&&!d.pinned),'randomization only uses student desks');
  assert.equal(await tile.locator('.seating-header .seating-furniture-toggle').count(),0,'Furniture is in the bottom actions');
  assert.equal(await tile.locator('.tile-settings-panel .seating-kind,.tile-settings-panel .seating-add,.tile-settings-panel .seating-layout').count(),0,'obsolete furniture and layout controls removed from Settings');
  const furnitureBefore=(await state()).desks.filter(d=>d.kind!=='desk');
  await tile.locator('.seating-layout-toggle').click();await tile.locator('[data-layout="groups"]').click();
  assert.equal((await state()).layout,'groups');assert.deepEqual((await state()).desks.filter(d=>d.kind!=='desk'),furnitureBefore,'quick layouts preserve furniture positions');
  await tile.locator('.seating-layout-toggle').click();await tile.locator('[data-layout="horseshoe"]').click();assert.equal((await state()).layout,'horseshoe');
  await tile.locator('.seating-layout-toggle').click();await tile.locator('[data-layout="rows"]').click();assert.equal((await state()).layout,'rows');
  await tile.locator('.seating-layout-toggle').click();await room.click({position:{x:15,y:15}});assert(!(await tile.locator('.seating-layout-panel').isVisible()),'outside click closes Layout');
  const saved=(await state()).desks.map(({id,...d})=>d);
  await page.evaluate(()=>{chart.querySelector('.seating-change-class').click();const select=chart.querySelector('.tile-class-loader select');select.value='furniture';select.dispatchEvent(new Event('change'));chart.querySelector('.tile-class-loader button').click()});
  assert.deepEqual((await state()).desks.map(({id,...d})=>d),saved,'all furniture shapes survive class reload');
  await tile.hover();await page.waitForTimeout(300);await room.locator('button.seating-desk').first().click();await page.waitForTimeout(300);
  assert.equal(await room.locator('.is-selected').count(),1);
  await tile.locator('.seating-rotate').click();assert.equal(await room.locator('.is-selected').count(),1,'editing selected object keeps selection');
  await room.click({position:{x:15,y:15}});assert.equal(await room.locator('.is-selected').count(),0,'clicking empty room deselects');
  await room.locator('button.seating-desk').first().click();await page.mouse.click(1300,950);assert.equal(await room.locator('.is-selected').count(),0,'clicking outside tile deselects');
  await page.evaluate(()=>writeClassSeatingChart('furniture',{layout:'rows',desks:[{kind:'desk',name:'Alex',x:40,y:40,angle:0},{kind:'desk',name:'Blair',x:20,y:40,angle:0}]}));
  await tile.hover();await page.waitForTimeout(300);await room.locator('button.seating-desk').nth(1).click();await page.waitForTimeout(300);
  const target=await room.locator('button.seating-desk').first().boundingBox(),source=await room.locator('button.seating-desk').nth(1).boundingBox();
  await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();await page.mouse.move(target.x-source.width/2-3,source.y+source.height/2,{steps:10});
  assert(await room.locator('.seating-snap-guide').count(),'alignment guides appear');await page.mouse.up();await page.waitForTimeout(250);
  const placed=await room.locator('button.seating-desk').nth(1).boundingBox();assert(Math.abs(placed.x+placed.width-target.x)<1.5,'student desks snap flush together');
  assert.equal(await room.locator('.seating-snap-guide').count(),0,'guides clear after drop');
  await toggle.click();await drawer.locator('[data-kind="large"]').scrollIntoViewIfNeeded();const cancelStart=await drawer.locator('[data-kind="large"]').boundingBox();
  const count=(await state()).desks.length;await page.mouse.move(cancelStart.x+20,cancelStart.y+20);await page.mouse.down();await page.mouse.move(1300,950,{steps:10});await page.mouse.up();assert.equal((await state()).desks.length,count,'outside drop does not add furniture');
  await tile.hover();await toggle.click();await drawer.locator('[data-kind="teacher"]').focus();await page.keyboard.press('Enter');assert.equal((await state()).desks.at(-1).kind,'teacher','keyboard can add furniture');
  await page.evaluate(()=>{chart.style.width='430px';chart.style.height='420px'});await tile.hover();await toggle.click();await page.waitForTimeout(250);
  assert(await drawer.evaluate(e=>{const a=e.getBoundingClientRect(),b=e.closest('.module').getBoundingClientRect();return a.left>=b.left&&a.right<=b.right&&a.top>=b.top&&a.bottom<=b.bottom}),'drawer fits small tile');
  await page.keyboard.press('Escape');assert(!(await drawer.isVisible()));
  await tile.hover();await tile.locator('.seating-layout-toggle').click();await page.waitForTimeout(250);
  assert(await tile.locator('.seating-layout-panel').evaluate(e=>{const a=e.getBoundingClientRect(),b=e.closest('.module').getBoundingClientRect();return a.left>=b.left&&a.right<=b.right&&a.top>=b.top&&a.bottom<=b.bottom}),'Layout fits small tile');
  await tile.screenshot({path:path.join(process.env.TEMP,'seating-layout-small.png')});await page.keyboard.press('Escape');
  await tile.locator('.module-fullscreen').evaluate(e=>e.click());await page.waitForTimeout(300);await toggle.click();assert(await drawer.isVisible(),'furniture drawer works in fullscreen');await drawer.locator('[data-kind="teacher"]').click();
  assert.equal((await state()).desks.at(-1).kind,'teacher');await page.evaluate(()=>document.exitFullscreen());
  console.log('PASS quick layouts, bottom actions, furniture click/drag/keyboard, previews, outside-drop cancellation, deselection, snapping, class persistence, non-student tables, minimum size, fullscreen');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
