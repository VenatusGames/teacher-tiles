const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(process.cwd(),decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(u.hostname!=='tiles.test'||!fs.existsSync(f)||!fs.statSync(f).isFile())return r.abort();return r.fulfill(f.endsWith('index.html')?{contentType:'text/html',body:fs.readFileSync(f,'utf8').replace(/<script[^>]+src="(?:firebase-auth|sandbox\/board-gate)[^"]*"[^>]*><\/script>/g,'')}:{path:f})});
 await page.goto('http://tiles.test/');await page.waitForTimeout(4500);
 await page.evaluate(()=>{document.querySelector('#profile-modal').hidden=true;localStorage.setItem(classRostersStorageKey(),JSON.stringify([{id:'pbis-test',name:'Maple Classroom',logo:'🍁',studentProfiles:{'student:alex':{image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII='},'student:benjamin':{emoji:'🐻'}},students:['Alex','Benjamin','Charlotte','Daniel','Elena','Francisco','Grace','Harper','Isabelle','Jackson','Kai','Luciana'],starChart:{studentStars:{'student:alex':123,'student:benjamin':5},wholeClassStars:35}}]));});
 const types=['starchart','classmeter','collections','prizeboard','pbisconsole','punchcards','racer','egghatching','flowerpots'];
 for(const type of types){
 await page.evaluate(type=>{document.querySelectorAll('#workspace .module').forEach(m=>{m._cleanup?.();m.remove()});const p=screenToBoard(560,100);window.testTile=createModule(type,p.x,p.y,{record:false});},type);
 await page.waitForTimeout(200);
 const tile=page.locator('.pbis-tile').last();
 assert(await tile.locator('.class-roster-intro').isVisible(),type+' loader');
 assert.equal(await tile.locator('.class-roster-picker button').evaluate(e=>getComputedStyle(e).fontSize),'13px');
 await tile.screenshot({path:path.join(process.env.TEMP,'pbis-'+type+'-load.png')});
 await tile.locator('.class-roster-picker select').selectOption('pbis-test');await tile.locator('.class-roster-picker button').click();await page.waitForTimeout(300);
 if(type==='prizeboard')await page.evaluate(()=>testTile._boardSetState({...testTile._boardGetState(),prizes:[{id:'p1',scope:'student',title:'Choose a class game',description:'Pick the game for our next break',cost:5,costStat:'studentStars'},{id:'p2',scope:'student',title:'Reading buddy',description:'Choose a partner',cost:10,costStat:'studentStars'}]}));
 await tile.screenshot({path:path.join(process.env.TEMP,'pbis-'+type+'-default.png')});
 if(type==='racer'){
 assert.equal(await tile.locator('.racer-student-avatar img').count(),1);
 assert.equal(await tile.locator('.racer-student-avatar').nth(1).textContent(),'🐻');
 assert.equal(await tile.locator('.racer-student-avatar').nth(2).textContent(),'C');
 assert(await tile.locator('.racer-character').first().evaluate(e=>Math.abs(e.offsetWidth-e.offsetHeight)<2),'square standees');
 await tile.hover();await page.waitForTimeout(300);const hoverHeight=await tile.locator('.racer-stage').evaluate(e=>e.clientHeight);
 await page.mouse.move(4,4);await page.waitForTimeout(350);
 assert(await tile.locator('.racer-controls').evaluate(e=>e.clientHeight===0),'racer controls collapse');
 assert(await tile.locator('.racer-stage').evaluate((e,h)=>e.clientHeight>h+30,hoverHeight),'course reclaims toolbar space');
 await tile.hover();await page.waitForTimeout(300);
 assert(await tile.locator('.racer-track-art').isVisible(),'shared race course is visible');
 assert.equal(await tile.locator('.racer-lane-track').count(),0,'no separate progress lanes');
 assert.equal(await tile.locator('.racer-standees .racer-standee').count(),12,'whole class stays on one course');
 await tile.locator('.racer-move').click();assert.equal(await page.evaluate(()=>readClassRosters()[0].racer.positions['student:alex']),10);
 }
 if(type==='punchcards'){
 await tile.hover();const toggle=tile.locator('.pbis-scope-toggle');
 assert(await toggle.evaluate(e=>!!e.closest('.customization-bar')));
 await toggle.click();assert.equal(await page.evaluate(()=>testTile._boardGetState().scope),'class');
 await toggle.click();assert.equal(await page.evaluate(()=>testTile._boardGetState().scope),'student');
 }
 if(type==='starchart'){
 assert.equal(await tile.locator('.starchart-student-name .starchart-student-total').count(),0);
 assert.equal(await tile.locator('.starchart-student-stars .starchart-student-total').count(),12);
 assert(await tile.locator('.starchart-student-name').first().evaluate(e=>e.offsetWidth===e.offsetHeight),'square award buttons');
 assert(await tile.locator('.pbis-scope-toggle').evaluate(e=>!!e.closest('.customization-bar')));
 await tile.locator('.starchart-search').fill('alex');assert.equal(await tile.locator('.starchart-student-row:visible').count(),1);
 await tile.locator('.starchart-student-name').first().click();assert.equal(await page.evaluate(()=>readClassRosters()[0].starChart.studentStars['student:alex']),124);
 await tile.locator('.starchart-subtract-toggle').first().click();await tile.locator('.starchart-subtract-form input').first().fill('4');await tile.locator('.starchart-subtract-form button[type=submit]').first().click();assert.equal(await page.evaluate(()=>readClassRosters()[0].starChart.studentStars['student:alex']),120);
 await tile.locator('.starchart-search').fill('');
 await page.mouse.move(4,4);await page.waitForTimeout(200);assert.equal(await tile.locator('.starchart-subtract-toggle').last().evaluate(e=>getComputedStyle(e).visibility),'hidden');
 await tile.locator('.starchart-show-all').click();await page.waitForTimeout(150);assert(await tile.evaluate(e=>e.offsetHeight<=740),'show all stays compact');
 assert.equal(await tile.locator('.starchart-student-avatar').count(),12);
 assert(await tile.locator('.starchart-student-name>strong').evaluateAll(ns=>ns.every(n=>parseFloat(getComputedStyle(n).fontSize)>=14)),'overview names stay readable');
 assert.equal(await tile.locator('.starchart-student-avatar img').count(),1);
 assert.equal(await tile.locator('.starchart-student-avatar').nth(1).textContent(),'🐻');
 assert.equal(await tile.locator('.starchart-student-avatar').nth(2).textContent(),'C');
 assert(await tile.locator('.starchart-student-grid').evaluate(e=>e.scrollHeight<=e.clientHeight+2),'12 students fit in compact overview');
 await tile.screenshot({path:path.join(process.env.TEMP,'pbis-starchart-overview.png')});

 }
 if(type==='egghatching'||type==='flowerpots'){
 assert(await tile.locator('.growth-show-all').isChecked(),'show all defaults on');
 assert(await tile.locator('.growth-grid').evaluate(e=>e.scrollHeight<=e.clientHeight+2),'12 students fit without scroll');
 await tile.locator('.growth-goal').evaluate(e=>{e.value='3';e.dispatchEvent(new Event('change',{bubbles:true}))});
 assert.equal(await page.evaluate(()=>testTile._boardGetState().goal),3);
 await tile.locator('.tile-settings-toggle').evaluate(e=>e.click());await page.waitForTimeout(100);
 assert(await tile.locator('.growth-goal').isVisible(),'goal field accessible in settings');
 assert.equal(await tile.locator('.growth-fit-setting span').textContent(),'Show All Students');
 assert.equal(await tile.locator('.tile-settings-panel>strong').textContent(),type==='egghatching'?'Egg Hatching Settings':'Flower Pots Settings');
 await tile.screenshot({path:path.join(process.env.TEMP,'pbis-'+type+'-settings.png')});
 await tile.locator('.tile-settings-toggle').evaluate(e=>e.click());
 for(let i=0;i<3;i++)await tile.locator('.growth-student').first().click();
 assert(await tile.locator('.growth-student').first().evaluate(e=>e.classList.contains('is-complete')),'custom goal awards point');
 }
 if(type==='pbisconsole')assert.equal(await tile.locator('.pbisconsole-stat-copy>span svg').count(),5);
 const before=await page.evaluate(()=>({width:testTile.style.width,height:testTile.style.height}));
 await tile.locator('.module-fullscreen').evaluate(e=>e.click());await page.waitForTimeout(400);
 assert(await page.evaluate(()=>document.fullscreenElement===testTile),type+' actual fullscreen');
 await page.screenshot({path:path.join(process.env.TEMP,'pbis-'+type+'-full.png')});
 if(type==='prizeboard'){
 await tile.locator('.prize-card-open').first().click();assert(await tile.locator('.prize-modal-overlay').isVisible(),'prize detail opens above fullscreen');await tile.locator('.prize-modal-close').click();
 }
 const metric=await tile.evaluate(m=>{const r=m.getBoundingClientRect();return {w:r.width,h:r.height,scroll:m.scrollHeight,client:m.clientHeight}});assert.equal(metric.w,1440);assert.equal(metric.h,1000);console.log(type,metric);
 if(type==='starchart'){assert(parseFloat(await tile.locator('.starchart-student-name strong').first().evaluate(e=>getComputedStyle(e).fontSize))>=16);await tile.hover();await tile.locator('.pbis-scope-toggle').click();await page.screenshot({path:path.join(process.env.TEMP,'pbis-starchart-whole-full.png')});}
 if(type==='pbisconsole'){await tile.locator('[data-pbisconsole-view=class]').click();await page.screenshot({path:path.join(process.env.TEMP,'pbis-console-class-full.png')});}
 await page.setViewportSize({width:1100,height:720});await page.waitForTimeout(150);
 if(type==='punchcards')assert(await tile.locator('.punchcard-card').evaluate(e=>{const r=e.getBoundingClientRect();return Math.abs(r.width/r.height-1.75)<.05&&e.scrollHeight<=e.clientHeight+2}),'fullscreen card ratio and no scrollbar');
 if(type==='classmeter')assert(await tile.locator('.classmeter-meter').evaluate(e=>e.getBoundingClientRect().width<innerWidth*.7),'meter has side margins');

 assert(await tile.evaluate(m=>m.scrollWidth<=m.clientWidth+2),type+' smaller fullscreen has no horizontal overflow');
 await page.evaluate(()=>document.exitFullscreen());await page.waitForTimeout(200);assert.deepEqual(await page.evaluate(()=>({width:testTile.style.width,height:testTile.style.height})),before,type+' restores board size');await page.setViewportSize({width:1440,height:1000});
 }
 // A standard 30-student class fits the growth tiles while keeping names readable.
 await page.evaluate(()=>{const classes=readClassRosters();classes[0].students=Array.from({length:30},(_,i)=>'Student '+i);localStorage.setItem(classRostersStorageKey(),JSON.stringify(classes));testTile._boardSetState({activeClassId:'pbis-test',showAll:true})});await page.waitForTimeout(200);
 assert(await tileFont());
 assert(await page.locator('.flowerpots-module .growth-grid').evaluate(e=>e.scrollHeight<=e.clientHeight+2),'30 growth students fit at default size');
 async function tileFont(){return page.locator('.flowerpots-module .growth-student strong').evaluateAll(ns=>ns.length===30&&ns.every(n=>parseFloat(getComputedStyle(n).fontSize)>=14))}
 // Shared picker also appears in non-PBIS roster tools.
 for(const type of ['attendance','groupmaker','spinner','popsiclesticks']){
  await page.evaluate(type=>{const p=screenToBoard(560,100);window.other=createModule(type,p.x,p.y,{record:false})},type);
  assert(await page.evaluate(()=>!!other),type+' exists');if(await page.evaluate(()=>!!other)){assert(await page.evaluate(()=>!!other.querySelector('.class-roster-picker')),type+' uses shared picker');await page.evaluate(()=>{other._cleanup?.();other.remove()});}
 }
 assert.deepEqual(errors,[]);console.log('PASS PBIS loaders, Star Chart awards/search/removal, nine actual fullscreen layouts and geometry restoration');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
