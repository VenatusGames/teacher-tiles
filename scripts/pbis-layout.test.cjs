const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(process.cwd(),decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(u.hostname!=='tiles.test'||!fs.existsSync(f)||!fs.statSync(f).isFile())return r.abort();return r.fulfill(f.endsWith('index.html')?{contentType:'text/html',body:fs.readFileSync(f,'utf8').replace(/<script[^>]+src="(?:firebase-auth|sandbox\/board-gate)[^"]*"[^>]*><\/script>/g,'')}:{path:f})});
 await page.goto('http://tiles.test/');await page.waitForTimeout(4500);
 await page.evaluate(()=>{document.querySelector('#profile-modal').hidden=true;localStorage.setItem(classRostersStorageKey(),JSON.stringify([{id:'pbis-test',name:'Maple Classroom',logo:'🍁',students:['Alex','Benjamin','Charlotte','Daniel','Elena','Francisco','Grace','Harper','Isabelle','Jackson','Kai','Luciana'],starChart:{studentStars:{'student:alex':123,'student:benjamin':5},wholeClassStars:35}}]));});
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
 const rows=await tile.locator('.racer-standee').evaluateAll(nodes=>nodes.map(n=>({top:n.offsetTop,height:n.offsetHeight})));
 assert(rows.every((r,i)=>!i||r.top>=rows[i-1].top+rows[i-1].height),'racer names never overlap');
 await tile.locator('.racer-move').click();assert.equal(await page.evaluate(()=>readClassRosters()[0].racer.positions['student:alex']),10);
 }
 if(type==='starchart'){
 await tile.locator('.starchart-search').fill('alex');assert.equal(await tile.locator('.starchart-student-row:visible').count(),1);
 await tile.locator('.starchart-student-name').first().click();assert.equal(await page.evaluate(()=>readClassRosters()[0].starChart.studentStars['student:alex']),124);
 await tile.locator('.starchart-subtract-toggle').first().click();await tile.locator('.starchart-subtract-form input').first().fill('4');await tile.locator('.starchart-subtract-form button[type=submit]').first().click();assert.equal(await page.evaluate(()=>readClassRosters()[0].starChart.studentStars['student:alex']),120);
 await tile.locator('.starchart-search').fill('');
 }
 const before=await page.evaluate(()=>({width:testTile.style.width,height:testTile.style.height}));
 await tile.locator('.module-fullscreen').evaluate(e=>e.click());await page.waitForTimeout(400);
 assert(await page.evaluate(()=>document.fullscreenElement===testTile),type+' actual fullscreen');
 await page.screenshot({path:path.join(process.env.TEMP,'pbis-'+type+'-full.png')});
 if(type==='prizeboard'){
 await tile.locator('.prize-card-open').first().click();assert(await tile.locator('.prize-modal-overlay').isVisible(),'prize detail opens above fullscreen');await tile.locator('.prize-modal-close').click();
 }
 const metric=await tile.evaluate(m=>{const r=m.getBoundingClientRect();return {w:r.width,h:r.height,scroll:m.scrollHeight,client:m.clientHeight}});assert.equal(metric.w,1440);assert.equal(metric.h,1000);console.log(type,metric);
 if(type==='starchart'){assert(parseFloat(await tile.locator('.starchart-student-name strong').first().evaluate(e=>getComputedStyle(e).fontSize))>=24);await tile.locator('[data-starchart-mode=whole]').click();await page.screenshot({path:path.join(process.env.TEMP,'pbis-starchart-whole-full.png')});}
 if(type==='pbisconsole'){await tile.locator('[data-pbisconsole-view=class]').click();await page.screenshot({path:path.join(process.env.TEMP,'pbis-console-class-full.png')});}
 await page.setViewportSize({width:1100,height:720});await page.waitForTimeout(150);
 assert(await tile.evaluate(m=>m.scrollWidth<=m.clientWidth+2),type+' smaller fullscreen has no horizontal overflow');
 await page.evaluate(()=>document.exitFullscreen());await page.waitForTimeout(200);assert.deepEqual(await page.evaluate(()=>({width:testTile.style.width,height:testTile.style.height})),before,type+' restores board size');await page.setViewportSize({width:1440,height:1000});
 }
 // Stress a large roster; readability takes priority over fitting microscopic cards.
 await page.evaluate(()=>{const classes=readClassRosters();classes[0].students=Array.from({length:30},(_,i)=>'Student '+i);localStorage.setItem(classRostersStorageKey(),JSON.stringify(classes));testTile._boardSetState({activeClassId:'pbis-test',showAll:true})});await page.waitForTimeout(200);
 assert(await tileFont());
 async function tileFont(){return page.locator('.flowerpots-module .growth-student strong').evaluateAll(ns=>ns.length===30&&ns.every(n=>parseFloat(getComputedStyle(n).fontSize)>=14))}
 // Shared picker also appears in non-PBIS roster tools.
 for(const type of ['attendance','groupmaker','spinner','popsiclesticks']){
  await page.evaluate(type=>{const p=screenToBoard(560,100);window.other=createModule(type,p.x,p.y,{record:false})},type);
  assert(await page.evaluate(()=>!!other),type+' exists');if(await page.evaluate(()=>!!other)){assert(await page.evaluate(()=>!!other.querySelector('.class-roster-picker')),type+' uses shared picker');await page.evaluate(()=>{other._cleanup?.();other.remove()});}
 }
 assert.deepEqual(errors,[]);console.log('PASS PBIS loaders, Star Chart awards/search/removal, nine actual fullscreen layouts and geometry restoration');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
