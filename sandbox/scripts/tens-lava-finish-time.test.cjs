const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
const page=await browser.newPage({viewport:{width:1550,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>{if(r.request().url().includes('sandbox/board-gate.js'))return r.abort();const u=new URL(r.request().url()),f=path.join(process.cwd(),decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));return u.hostname==='tiles.test'&&fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.abort()});
await page.goto('http://tiles.test/');await page.evaluate(()=>{document.querySelector('#teachertiles-intro')?.remove();document.documentElement.classList.remove('sandbox-access-locked');document.querySelector('#profile-modal').hidden=true;document.querySelector('#boards-view').hidden=true;clearTeacherTilesBoard();boardCamera.x=0;boardCamera.y=0;boardCamera.scale=1;applyBoardCamera();const m=createModule('tenssticks',500,150,{record:false});m.id='tens';m.style.left='180px';m.style.top='140px';const lava=createModule('lavalamp',1060,150,{record:false});lava.style.left='920px';lava.style.top='140px';updateWorkspaceEmptyState()});
for(const number of [0,1,10,100,237,499,999]){
 const state=await page.evaluate(n=>{const m=document.getElementById('tens');m.querySelector('.tens-number-form').elements.number.value=n;m.querySelector('.tens-number-form').requestSubmit();return m._boardGetState()},number);
 assert.equal(state.pieces.reduce((n,p)=>n+p.value,0),number);
 assert.equal(state.pieces.filter(p=>p.value===100).length,Math.floor(number/100));
 const bounds=await page.evaluate(()=>{const r=document.querySelector('.tens-workspace').getBoundingClientRect();return [...document.querySelectorAll('.tens-piece')].every(el=>{const b=el.getBoundingClientRect();return b.left>=r.left-.1&&b.top>=r.top-.1&&b.right<=r.right+.1&&b.bottom<=r.bottom+.1})});assert(bounds,'generated pieces fit');
}
await page.evaluate(()=>{const m=document.getElementById('tens');m.querySelector('.tens-number-form').elements.number.value=237;m.querySelector('.tens-number-form').requestSubmit()});
await page.waitForTimeout(250);
const piece=page.locator('.tens-piece').first(),before=await piece.boundingBox();await page.mouse.move(before.x+before.width/2,before.y+before.height/2);await page.mouse.down();await page.mouse.move(before.x+before.width/2+18,before.y+before.height/2+20,{steps:6});await page.mouse.up();const after=await piece.boundingBox();assert(after.x>before.x+10,'block dragged');
const next=await piece.boundingBox();await page.mouse.move(next.x+next.width/2,next.y+next.height/2);await page.mouse.down();await page.mouse.move(600,800,{steps:8});await page.mouse.up();assert.equal(await page.locator('.tensblock-module').count(),1,'drag exports a native board block');assert.equal(await page.locator('.tens-total').textContent(),'137');
await page.evaluate(()=>{const m=document.querySelector('.lavalamp-module');m.querySelector('.lava-colors-toggle').click();m.querySelector('[data-color="teal"]').click()});
const pixels=await page.locator('.lava-visual').evaluate(c=>c.toDataURL());await page.waitForTimeout(1600);assert.notEqual(await page.locator('.lava-visual').evaluate(c=>c.toDataURL()),pixels,'lava moves');
await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(200);const still=await page.locator('.lava-visual').evaluate(c=>c.toDataURL());await page.waitForTimeout(250);assert.equal(await page.locator('.lava-visual').evaluate(c=>c.toDataURL()),still,'reduced motion is still');await page.emulateMedia({reducedMotion:'no-preference'});

const saved=await page.evaluate(()=>{const objects=[...workspace.querySelectorAll('.module')].map(serializeBoardModule);clearTeacherTilesBoard();objects.forEach(restoreTeacherTilesBoardObject);return objects});
assert.equal(await page.locator('.tens-total').textContent(),'137');assert.equal(await page.locator('.lavalamp-module').getAttribute('data-lava-color'),'teal');assert.equal(await page.locator('.tensblock-module').getAttribute('data-block-value'),'100');

// Reclaim the footer space without letting an empty manipulation surface drag the tile.
const tens=page.locator('.tenssticks-module'),box=await tens.boundingBox();
await page.mouse.move(box.x+box.width/2,box.y+35);await page.waitForTimeout(300);
const hovered=await tens.locator('.tens-stage').boundingBox();
await page.mouse.move(hovered.x+hovered.width-20,hovered.y+hovered.height-20);await page.mouse.down();await page.mouse.move(hovered.x+hovered.width-55,hovered.y+hovered.height-40,{steps:5});await page.mouse.up();
assert(Math.abs((await tens.boundingBox()).x-box.x)<1,'empty workspace must not drag tile');
await page.mouse.move(40,850);await page.waitForTimeout(350);const rested=await tens.locator('.tens-stage').boundingBox();assert(rested.height>hovered.height+45,'workspace reclaims hidden controls');
await page.evaluate(()=>document.querySelector('.tenssticks-module [data-tens-add="10"]').click());
const vertical=await page.locator('.tens-piece').last().boundingBox();assert(vertical.height>vertical.width*5,'ten stick is vertical');
assert.equal(await page.locator('.lava-heading').evaluate(e=>e.classList.contains('tile-heading-hidden')),true);
assert.deepEqual(await page.locator('.lava-color-drawer button').evaluateAll(es=>es.map(e=>e.dataset.color)),['blue','green','amber','rose','purple','teal','midnight','creme']);
await page.evaluate(()=>document.querySelector('.lava-colors-toggle').click());assert(await page.locator('.lava-color-drawer').evaluate(e=>e.matches(':popover-open')),'color shelf opens above tile');
await page.locator('.lava-color-drawer [data-color="amber"]').click();assert.equal(await page.locator('.lavalamp-module').getAttribute('data-lava-color'),'amber');
await page.evaluate(()=>{window.TeacherTilesAccount={state:{subscriptionActive:true}};applyTileSkinToModule(document.querySelector('.lavalamp-module'),'lavalamp-clear')});
assert.equal(await page.locator('.lavalamp-module').getAttribute('data-tile-skin'),'lavalamp-clear');
assert.equal(await page.locator('.lavalamp-module').evaluate(m=>getComputedStyle(m).backgroundColor),'rgba(0, 0, 0, 0)');
assert.equal(await page.locator('.lavalamp-module .tile-settings-panel>strong').textContent(),'Tile Settings');
assert.equal(await page.locator('[data-shop-product="tile-skin-lavalamp-clear"]').count(),1);
await page.evaluate(()=>{renderMenuCategoryPins();document.querySelector('[data-category-pin="misc"]').click()});
assert(await page.evaluate(()=>menuPinnedCategories.has('misc')),'Misc can be pinned');
await page.evaluate(()=>document.querySelector('[data-category-pin="misc"]').click());

await page.evaluate(()=>clearTeacherTilesBoard());
await page.clock.install({time:new Date('2026-10-08T15:00:00Z')});
for(const type of ['timer','interactive']){
 const initial=await page.evaluate(type=>{const m=createModule(type,600,180,{record:false});m.id='timer-under-test';m._boardTimerSetState({total:300,left:300,running:false});return m.querySelector('.timer-finish-toggle').getAttribute('aria-checked')},type);assert.equal(initial,'false');
 const snapshot=()=>page.evaluate(()=>{const m=document.getElementById('timer-under-test');return {status:m.querySelector('.timer-status,.interactive-timer-status').textContent,state:m._boardTimerGetState()}});
 await page.evaluate(()=>{const m=document.getElementById('timer-under-test');m.querySelector('.timer-finish-toggle').click();m.querySelector('.timer-start').click()});
 let snap=await snapshot();assert(snap.status.includes('RUNNING \u00b7 '));const end=snap.state.endAt;const expected=await page.evaluate(end=>new Date(end).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}),end);assert(snap.status.endsWith(expected),'clock reflects actual deadline');
 await page.clock.runFor(2000);assert.equal((await snapshot()).state.endAt,end);
 await page.evaluate(()=>document.querySelector('#timer-under-test [data-add-seconds="60"]').click());assert.equal((await snapshot()).state.endAt,end+60000);
 await page.evaluate(()=>document.querySelector('#timer-under-test .timer-start').click());assert.equal((await snapshot()).status,'PAUSED');await page.clock.runFor(2000);
 await page.evaluate(()=>document.querySelector('#timer-under-test .timer-start').click());assert(Math.abs((await snapshot()).state.endAt-end-62000)<100);
 await page.evaluate(()=>{const m=document.getElementById('timer-under-test'),saved=serializeBoardModule(m);m._cleanup();m.remove();const restored=restoreTeacherTilesBoardObject(saved);restored.id='timer-under-test'});assert.equal(await page.locator('#timer-under-test .timer-finish-toggle').getAttribute('aria-checked'),'true');
 await page.evaluate(()=>document.querySelector('#timer-under-test .timer-reset').click());assert.equal((await snapshot()).status,'READY');
 await page.evaluate(()=>{const m=document.getElementById('timer-under-test');m._boardTimerSetState({total:1,left:1,running:true,endAt:Date.now()+1000})});await page.clock.runFor(1500);assert.equal((await snapshot()).status,'DONE');
 await page.evaluate(()=>clearTeacherTilesBoard());
}
assert.equal(await page.evaluate(()=>menuCategoryOrder.at(-1)),'misc');assert.equal(await page.evaluate(()=>{renderMenuCategoryPins();return [...document.querySelectorAll('.context-menu__category-row--nested [data-category-drawer-filter]')].at(-1).dataset.categoryDrawerFilter}),'misc');
assert.deepEqual(errors,[]);console.log('PASS: block generation, pointer dragging and board export, state restore, lava movement/reduced motion, both timer finish clocks through pause/add/reset/restore/completion, Misc last.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
