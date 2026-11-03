const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(process.cwd(),decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));return u.hostname==='tiles.test'&&fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.abort()});
 await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1800);
 await page.evaluate(()=>{document.getElementById('profile-modal').hidden=true;TeacherTilesBoard.load(TeacherTilesBoard.blank());Object.assign(boardCamera,{x:0,y:0,scale:1});applyBoardCamera();createModule('timestables',450,120,{record:false})});
 const tile=page.locator('#workspace .times-tables-module');
 await tile.hover();await tile.locator('.tile-settings-toggle').click();
 assert(!await tile.locator('.tile-settings-panel').innerText().then(s=>s.includes('Practice with hidden answers')));
 const toggle=tile.getByRole('switch',{name:'Chart Mode',exact:true});assert.equal(await toggle.getAttribute('aria-checked'),'false');
 await tile.evaluate(m=>m._boardSetState({families:[7],start:3,end:5,practice:true,revealed:['7:3']}));
 await toggle.click();assert.equal(await toggle.getAttribute('aria-checked'),'true');
 const check=async()=>{
  const result=await tile.evaluate(m=>{const table=m.querySelector('.times-chart'),grid=m.querySelector('.times-grid'),box=grid.getBoundingClientRect(),t=table.getBoundingClientRect();return {head:[...table.tHead.rows[0].cells].map(c=>c.textContent),rows:[...table.tBodies[0].rows].map(r=>[...r.cells].map(c=>c.textContent)),fit:t.right<=box.right+1&&t.bottom<=box.bottom+1&&grid.scrollWidth<=grid.clientWidth+1&&grid.scrollHeight<=grid.clientHeight+1,clipped:[...table.querySelectorAll('td,th')].filter(c=>c.scrollWidth>c.clientWidth+1||c.scrollHeight>c.clientHeight+1).slice(0,3).map(c=>({text:c.textContent,w:c.clientWidth,h:c.clientHeight,sw:c.scrollWidth,sh:c.scrollHeight,font:getComputedStyle(c).fontSize}))}});
  assert.deepEqual(result.head,['×',...Array.from({length:13},(_,i)=>String(i))]);
  assert.equal(result.rows.length,13);result.rows.forEach((r,y)=>assert.deepEqual(r,[String(y),...Array.from({length:13},(_,x)=>String(x*y))]));assert(result.fit,JSON.stringify(result));assert(!result.clipped.length,'Cells must fit their numbers: '+JSON.stringify(result.clipped));
 };
 await page.keyboard.press('Escape');await page.waitForTimeout(250);await check();
 for(const [w,h] of [[340,360],[690,590],[1000,800]]){
  await tile.evaluate((m,[w,h])=>{m.style.width=w+'px';m.style.height=h+'px'},[w,h]);await page.waitForTimeout(100);await check();
 }
 await tile.locator('.module-fullscreen').evaluate(b=>b.click());await page.waitForFunction(()=>document.fullscreenElement?.dataset.type==='timestables');await page.waitForTimeout(100);await check();
 await page.evaluate(()=>document.exitFullscreen());await page.waitForTimeout(150);
 await page.evaluate(()=>TeacherTilesBoard.load(TeacherTilesBoard.capture()));assert.equal(await tile.locator('.times-chart-toggle').getAttribute('aria-checked'),'true');await check();
 await tile.evaluate(async m=>{const {createBoardPreview}=await import('/boards/preview.js');const host=document.createElement('div');host.id='chart-preview';host.append(createBoardPreview({theme:'light',inlineObjects:[serializeBoardModule(m)]}));document.body.append(host)});await page.waitForTimeout(100);
 assert.equal(await page.locator('#chart-preview .times-chart tbody td').count(),169);assert.equal(await page.locator('#chart-preview .times-chart tbody tr:last-child td:last-child').textContent(),'144');await page.locator('#chart-preview').evaluate(e=>e.remove());
 await tile.locator('.times-chart-toggle').evaluate(b=>b.click());
 assert.equal(await tile.locator('.times-chart').count(),0);assert.equal(await tile.locator('.times-family-card').count(),1);assert.equal(await tile.locator('.times-fact').count(),3);
 assert.equal(await tile.locator('[data-fact="7:3"] strong').textContent(),'= 21');assert.equal(await tile.locator('[data-fact="7:4"] strong').textContent(),'= ?');
 await tile.locator('.times-reveal').evaluate(b=>b.click());assert.equal(await tile.locator('[data-fact="7:4"] strong').textContent(),'= 28');
 assert.deepEqual(errors,[]);console.log('Times Tables: Chart Mode switch, every 0–12 product, responsive cells/fullscreen, persistence/previews, and restored fact-family practice passed.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
