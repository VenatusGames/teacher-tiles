const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const types=['tenframes','timestables','shapes','patternmaker','numberline','hundredschart','grapher'];
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1500,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(process.cwd(),decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(u.hostname!=='tiles.test'||!fs.existsSync(f)||!fs.statSync(f).isFile())return r.abort();return r.fulfill(f.endsWith('index.html')?{contentType:'text/html',body:fs.readFileSync(f,'utf8').replace(/<script[^>]+src="(?:firebase-auth|sandbox\/board-gate)[^"]*"[^>]*><\/script>/g,'')}:{path:f})});
 await page.goto('http://tiles.test/');await page.waitForTimeout(4500);await page.evaluate(()=>document.getElementById('profile-modal').hidden=true);
 for(const type of types){
  await page.mouse.move(1450,1000);
  await page.evaluate(type=>{document.querySelectorAll('#workspace .module').forEach(m=>{m._cleanup?.();m.remove()});const point=screenToBoard(100,100);window.mathTile=createModule(type,point.x,point.y,{record:false});mathTile.style.left=point.x+'px';mathTile.style.top=point.y+'px'},type);
  const tile=page.locator('.math-modern-tile'),visual=tile.locator('.math-tile-visual');await page.waitForTimeout(300);
  assert.equal(await tile.locator('.math-hover-group').first().evaluate(e=>getComputedStyle(e).visibility),'hidden',type+' controls hidden initially');
  const closed=await visual.boundingBox();await tile.hover();await page.waitForTimeout(300);const opened=await visual.boundingBox();
  assert(opened.height<closed.height-10,type+' content gains room on unhover');
  assert.equal(await tile.locator('.math-hover-group').first().evaluate(e=>getComputedStyle(e).visibility),'visible',type+' controls reveal');
  await tile.screenshot({path:path.join(process.env.TEMP,'math-'+type+'-hover.png')});
  if(type==='tenframes'){await tile.locator('[data-tenframes-add="1"]').click();assert.equal(await tile.locator('.tenframes-count').textContent(),'1')}
  if(type==='timestables'){await tile.locator('.times-hide').click();assert.equal(await tile.locator('.times-fact').first().getAttribute('aria-pressed'),'false');await tile.locator('.times-reveal').click();assert.equal(await tile.locator('.times-fact').first().getAttribute('aria-pressed'),'true')}
  if(type==='shapes'){const before=await tile.getAttribute('data-shape');await tile.locator('.shapes-choice').nth(1).click();assert.notEqual(await tile.getAttribute('data-shape'),before)}
  if(type==='patternmaker'){await tile.locator('.pattern-maker-type').selectOption('ab');await tile.locator('.pattern-maker-apply').click();assert(await tile.locator('.pattern-maker-cell:not([data-color=""])').count())}
  if(type==='numberline'){assert(!(await tile.locator('[data-numberline-point-select="b"]').isVisible()));await tile.locator('[data-numberline-step="1"]').click();assert.equal(await tile.locator('.numberline-value-a').textContent(),'1')}
  if(type==='hundredschart'){await tile.locator('.hundreds-toggle-all').click();assert.equal(await tile.locator('.hundreds-cell.is-hidden').count(),100)}
  if(type==='grapher'){
   await tile.locator('.grapher-point-x').fill('2');await tile.locator('.grapher-point-y').fill('3');await tile.locator('.grapher-add-point').click();assert.equal(await tile.locator('.grapher-point').count(),1);
   await tile.locator('.grapher-equation').fill('x^2');await page.mouse.move(1450,1000);await page.waitForTimeout(300);assert.equal(await tile.locator('.math-hover-group').first().evaluate(e=>getComputedStyle(e).visibility),'visible','typing keeps graph controls available');await page.keyboard.press('Enter');await tile.locator('.grapher-graph-equation').click();
   const point=await tile.locator('.grapher-svg').evaluate(svg=>{const p=new DOMPoint(192,137).matrixTransform(svg.getScreenCTM());return {x:p.x,y:p.y}});await page.mouse.click(point.x,point.y);const plotted=await page.evaluate(()=>mathTile._boardGetState().points.at(-1));assert(Math.abs(plotted.x+5)<.1&&Math.abs(plotted.y-5)<.1,'SVG point mapping remains correct with letterboxing');
  }
  const state=await page.evaluate(()=>mathTile._boardGetState?.());await page.mouse.move(1450,1000);await page.waitForTimeout(350);
  assert.equal(await tile.locator('.math-hover-group').first().evaluate(e=>getComputedStyle(e).visibility),'hidden',type+' controls do not get stuck after clicking');assert.deepEqual(await page.evaluate(()=>mathTile._boardGetState?.()),state,type+' hiding controls preserves content');
  await tile.screenshot({path:path.join(process.env.TEMP,'math-'+type+'-rest.png')});
  await tile.focus();await page.keyboard.press('Tab');await page.waitForTimeout(300);assert.equal(await tile.locator('.math-hover-group').first().evaluate(e=>getComputedStyle(e).visibility),'visible',type+' keyboard access');
  await page.evaluate(()=>document.activeElement.blur());await tile.hover();await page.evaluate(()=>{const s=getComputedStyle(mathTile);mathTile.style.width=s.minWidth;mathTile.style.height=s.minHeight});await page.waitForTimeout(300);
  assert(await tile.evaluate(m=>{const r=m.getBoundingClientRect();return [...m.querySelectorAll('.math-hover-group button,.math-hover-group input,.math-hover-group select')].filter(e=>e.getBoundingClientRect().width&&getComputedStyle(e).visibility!=='hidden').every(e=>{const b=e.getBoundingClientRect();return b.left>=r.left&&b.right<=r.right+1&&b.bottom<=r.bottom+1})}),type+' controls fit minimum size');
  await tile.screenshot({path:path.join(process.env.TEMP,'math-'+type+'-small.png')});
  await tile.evaluate(m=>m.requestFullscreen());await page.waitForTimeout(300);await tile.hover();assert((await visual.boundingBox()).height>100,type+' fullscreen visual');await page.evaluate(()=>document.exitFullscreen());
  console.log('PASS '+type+' hover, interactions, state, keyboard, minimum size, fullscreen');
 }
 assert.deepEqual(errors,[]);console.log('PASS all seven math controls');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
