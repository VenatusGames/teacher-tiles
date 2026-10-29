const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(process.cwd(),decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(u.hostname!=='tiles.test'||!fs.existsSync(f)||!fs.statSync(f).isFile())return r.abort();return r.fulfill(f.endsWith('index.html')?{contentType:'text/html',body:fs.readFileSync(f,'utf8').replace(/<script[^>]+src="(?:firebase-auth|sandbox\/board-gate)[^"]*"[^>]*><\/script>/g,'')}:{path:f})});
 await page.goto('http://tiles.test/');await page.waitForTimeout(4500);
 await page.evaluate(()=>{document.querySelector('#profile-modal').hidden=true;localStorage.setItem(classRostersStorageKey(),JSON.stringify([{id:'pbis-test',name:'Maple Classroom',logo:'🍁',studentProfiles:{'student:alex':{image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII='},'student:benjamin':{emoji:'🐻'}},students:['Alex','Benjamin','Charlotte','Daniel','Elena','Francisco','Grace','Harper','Isabelle','Jackson','Kai','Luciana'],starChart:{studentStars:{'student:alex':123,'student:benjamin':5},wholeClassStars:35}}]));});
 const types=process.env.PBIS_TEST_TYPES?process.env.PBIS_TEST_TYPES.split(','):['starchart','classmeter','collections','prizeboard','pbisconsole','punchcards','racer','egghatching','flowerpots'];
 for(const type of types){
 await page.evaluate(type=>{document.querySelectorAll('#workspace .module').forEach(m=>{m._cleanup?.();m.remove()});const p=screenToBoard(560,100);window.testTile=createModule(type,p.x,p.y,{record:false});},type);
 await page.waitForTimeout(200);
 const tile=page.locator('.pbis-tile').last();
 assert(await tile.locator('.class-roster-intro').isVisible(),type+' loader');
 assert(!(await tile.locator('.pbis-footer-actions').isVisible()),type+' hides Change Class until loaded');
 assert.equal(await tile.locator('.class-roster-picker button').evaluate(e=>getComputedStyle(e).fontSize),'13px');
 await tile.screenshot({path:path.join(process.env.TEMP,'pbis-'+type+'-load.png')});
 await tile.locator('.class-roster-picker select').selectOption('pbis-test');await tile.locator('.class-roster-picker button').click();await page.waitForTimeout(300);
 if(type==='prizeboard')await page.evaluate(()=>testTile._boardSetState({...testTile._boardGetState(),prizes:[{id:'p1',scope:'student',title:'Choose a class game',description:'Pick the game for our next break',cost:5,costStat:'studentStars'},{id:'p2',scope:'student',title:'Reading buddy',description:'Choose a partner',cost:10,costStat:'studentStars'}]}));
 await tile.hover();await page.waitForTimeout(250);
 assert(await tile.locator('.pbis-footer-actions .pbis-change-class').evaluate(e=>{const m=e.closest('.module').getBoundingClientRect(),r=e.getBoundingClientRect();return r.top>m.top+m.height*.8&&r.left>m.left+m.width*.65&&r.right<m.right&&r.bottom<m.bottom}),type+' Change Class is bottom right');
 if(type==='egghatching'||type==='flowerpots')assert(await tile.locator('.pbis-footer-actions .growth-reset').evaluate(e=>{const m=e.closest('.module').getBoundingClientRect(),r=e.getBoundingClientRect();return r.top>m.top+m.height*.8&&r.left>m.left+m.width*.65}),'growth Reset is bottom right');
 await tile.screenshot({path:path.join(process.env.TEMP,'pbis-'+type+'-default.png')});
 if(['classmeter','collections','racer','punchcards'].includes(type)){
 assert(await tile.locator('.pbis-class-footer').isVisible(),'class footer visible');
 assert(await tile.locator('.pbis-class-footer').evaluate(e=>{const m=e.closest('.module').getBoundingClientRect(),r=e.getBoundingClientRect();return r.top>m.top+m.height*.8&&r.right<=m.right}),'class footer stays in bottom corner');
 assert.equal(await tile.locator('.pbis-class-footer .pbis-change-class').count(),0);
 }
 if(type==='classmeter'||type==='collections')assert((await tile.locator('.pbis-class-footer').textContent()).includes('Fills'),'Fills capitalization');
 if(type==='punchcards')assert(await tile.locator('.punchcard-card').evaluate(e=>e.scrollHeight<=e.clientHeight+2),'normal punchcard contents fit without scroll');
 if(type==='racer'){
 assert(await tile.locator('.racer-character').first().evaluate(e=>e.offsetWidth<88),'smaller standees');
 assert.equal(await tile.locator('.racer-student-avatar img').count(),1);
 assert.equal(await tile.locator('.racer-standee[data-student=Benjamin] .racer-student-avatar').textContent(),'🐻');
 assert.equal(await tile.locator('.racer-standee[data-student=Charlotte] .racer-student-avatar').textContent(),'C');
 assert(await tile.locator('.racer-student-avatar').first().evaluate(e=>Math.abs(e.offsetWidth-e.offsetHeight)<2),'square student portraits');
 await tile.hover();await page.waitForTimeout(300);const hoverHeight=await tile.locator('.racer-stage').evaluate(e=>e.clientHeight);
 await page.mouse.move(4,4);await page.waitForTimeout(350);
 assert(await tile.locator('.racer-controls').evaluate(e=>e.clientHeight===0),'racer controls collapse');
 assert(await tile.locator('.racer-stage').evaluate((e,h)=>e.clientHeight>h+30,hoverHeight),'course reclaims toolbar space');
 await tile.hover();await page.waitForTimeout(300);
 assert(await tile.locator('.racer-course-scroll').isVisible(),'shared hill race course is visible');
 assert.equal(await tile.locator('.racer-track').count(),4,'twelve students spread across four hill tracks');
 assert(await tile.locator('.racer-track').evaluateAll(ts=>ts.every(t=>{const ns=[...t.querySelectorAll('.racer-standee')];return ns.every(n=>n.style.left===ns[0].style.left)})),'racers overlap at a shared starting gate');
 assert(await tile.locator('.racer-track').evaluateAll(ts=>ts.every(t=>new Set([...t.querySelectorAll('.racer-standee')].map(n=>n.style.getPropertyValue('--racer-fan-angle'))).size>1)),'overlapping racers fan at distinct angles');
 assert.equal(await tile.locator('.racer-course-art').count(),1,'all hills share one landscape');
 assert.equal(await tile.locator('.racer-track svg').count(),0,'no separate hill panels');
 assert(await tile.locator('.racer-rider-name').evaluateAll(ns=>ns.every(n=>parseFloat(getComputedStyle(n).fontSize)>=12)),'racer names stay readable');
 assert.equal(await tile.locator('.racer-controls .racer-reset').count(),0,'Reset is outside distance controls');
 assert(await tile.locator('.pbis-footer-actions .racer-reset').isVisible(),'Reset sits in bottom-right controls');
 assert.equal(await tile.locator('.racer-move').textContent(),'Add Distance');
 assert.equal(await tile.locator('.racer-standees .racer-standee').count(),12,'whole class stays on one course');
 await tile.locator('.racer-move').click();assert.equal(await page.evaluate(()=>readClassRosters()[0].racer.positions['student:alex']),10);
 await page.evaluate(()=>{const r=readClassRosters()[0],p=normalizeRacerProgress(r.racer,r.students);r.students.forEach((n,i)=>p.positions[starChartStudentKey(n)]=i*8);localStorage.setItem(classRostersStorageKey(),JSON.stringify([{...r,racer:p}]));window.dispatchEvent(new Event('teachertiles:classeschange'))});
 await page.waitForTimeout(800);await tile.screenshot({path:path.join(process.env.TEMP,'pbis-racer-course.png')});
 await tile.locator('.racer-distance').fill('100');await tile.locator('.racer-move').click();await page.waitForTimeout(650);
 assert.equal(await page.evaluate(()=>readClassRosters()[0].racer.studentWins['student:alex']),1,'finish awards one Race Win');
 await tile.locator('.racer-win-done').click();assert(await tile.locator('.racer-move').isDisabled(),'finished racer cannot award twice');
 page.once('dialog',dialog=>dialog.accept());await tile.locator('.racer-reset').click();
 assert(await page.evaluate(()=>{const r=readClassRosters()[0].racer;return r.studentWins['student:alex']===1&&Object.values(r.positions).every(n=>n===0)}),'reset clears distance and retains Race Wins');
 await page.evaluate(async()=>{const {createMiniObject}=await import('/boards/preview.js?v=20261028-hill-race');const frame=document.createElement('div');frame.id='race-preview-test';frame.style.cssText='position:fixed;left:0;top:0;width:360px;height:310px;z-index:99999;background:white';const r=readClassRosters()[0];frame.append(createMiniObject({w:1,h:1,state:{type:'racer',special:{activeClassId:r.id,previewRoster:r},transform:{width:720,height:620}}}));document.body.append(frame)});
 await page.waitForTimeout(250);assert.equal(await page.locator('#race-preview-test .racer-track').count(),4,'saved preview uses the hill layout');
 assert.equal(await page.locator('#race-preview-test .racer-standee').count(),12,'preview retains every racer');
 await page.locator('#race-preview-test').screenshot({path:path.join(process.env.TEMP,'pbis-racer-preview.png')});await page.evaluate(()=>document.querySelector('#race-preview-test').remove());
 await page.evaluate(()=>{window.raceRosterBackup=readClassRosters();const r={...raceRosterBackup[0],students:Array.from({length:30},(_,i)=>'Student '+(i+1))};localStorage.setItem(classRostersStorageKey(),JSON.stringify([r]));window.dispatchEvent(new Event('teachertiles:classeschange'))});await page.waitForTimeout(750);
 assert.equal(await tile.locator('.racer-standee').count(),30);
 assert(await tile.locator('.racer-track').evaluateAll(ts=>ts.every(t=>{const ns=[...t.querySelectorAll('.racer-standee')];return ns.every(n=>n.style.left===ns[0].style.left)})),'thirty students use the shared starts');
 assert(await tile.locator('.racer-standees').evaluate(e=>{const b=e.getBoundingClientRect();return [...e.querySelectorAll('.racer-standee')].every(n=>{const r=n.getBoundingClientRect();return r.left>=b.left-1&&r.right<=b.right+1&&r.top>=b.top-1&&r.bottom<=b.bottom+1})}),'all thirty racers stay in the course bounds');
 await tile.screenshot({path:path.join(process.env.TEMP,'pbis-racer-thirty.png')});
 await page.evaluate(()=>{localStorage.setItem(classRostersStorageKey(),JSON.stringify(raceRosterBackup));window.dispatchEvent(new Event('teachertiles:classeschange'))});await page.waitForTimeout(750);

 }
 if(type==='punchcards'){
 await tile.locator('.punchcard-hole').first().click();await page.waitForTimeout(300);
 const hoveredCard=await tile.locator('.punchcard-card').evaluate(e=>e.clientHeight);
 await page.mouse.move(4,4);await page.waitForTimeout(350);
 assert(await tile.locator('.punchcard-reset').evaluate(e=>e.clientHeight===0),'punchcard reset collapses');
 assert(await tile.locator('.punchcard-card').evaluate((e,h)=>e.clientHeight>h+40,hoveredCard),'punchcard reclaims bottom controls space');
 assert(await tile.locator('.punchcard-card').evaluate(e=>e.scrollHeight<=e.clientHeight+2),'unhovered punchcard has no overflow');
 await tile.screenshot({path:path.join(process.env.TEMP,'pbis-punchcards-unhover.png')});
 await tile.hover();await page.waitForTimeout(300);
 await tile.screenshot({path:path.join(process.env.TEMP,'pbis-punchcards-hover.png')});
 const toggle=tile.locator('.pbis-scope-toggle');
 assert(await toggle.evaluate(e=>!!e.closest('.customization-bar')));
 await toggle.click();assert.equal(await page.evaluate(()=>testTile._boardGetState().scope),'class');
 await toggle.click();assert.equal(await page.evaluate(()=>testTile._boardGetState().scope),'student');
 }
 if(type==='starchart'){
 const searchHeight=await tile.locator('.starchart-student-grid').evaluate(e=>e.clientHeight);
 await page.mouse.move(4,4);await page.waitForTimeout(300);
 assert(await tile.locator('.starchart-student-toolbar').evaluate(e=>e.clientHeight===0),'search collapses on unhover');
 assert(await tile.locator('.starchart-student-grid').evaluate((e,h)=>e.clientHeight>h+20,searchHeight),'roster reclaims search space');
 await tile.hover();await page.waitForTimeout(300);
 assert.equal(await tile.evaluate(e=>parseFloat(getComputedStyle(e).paddingBottom)),52,'star chart reserves bottom controls space only on hover');
 assert(await tile.locator('.starchart-subtract-toggle').first().evaluate(e=>e.offsetWidth===e.offsetHeight),'square Remove button');
 assert.equal(await tile.locator('.starchart-student-name .starchart-student-total').count(),0);
 assert.equal(await tile.locator('.starchart-student-stars .starchart-student-total').count(),12);
 assert(await tile.locator('.starchart-student-name').first().evaluate(e=>e.offsetWidth===e.offsetHeight),'square award buttons');
 assert(await tile.locator('.pbis-scope-toggle').evaluate(e=>!!e.closest('.pbis-footer-actions')),'Star Chart mode is beside Change Class');
 assert.equal(await tile.locator('.starchart-subtract-toggle small').count(),0,'Remove has a single uncluttered icon');
 assert(await tile.locator('.starchart-student-name').first().evaluate(e=>getComputedStyle(e).backgroundColor==='rgba(0, 0, 0, 0)'),'no extra colored portrait holder');
 assert(await tile.locator('.starchart-student-avatar').last().evaluate(e=>e.style.getPropertyValue('--avatar-hue')===String(studentProfileVisual('Luciana','pbis-test').hue)),'initial palette matches Class View');
 await page.evaluate(()=>{window.starAwardSounds=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(this.src.includes('/star-award.mp3')){starAwardSounds.push(this.src);return Promise.resolve()}return play.call(this)}});
 await tile.locator('.starchart-search').fill('alex');assert.equal(await tile.locator('.starchart-student-row:visible').count(),1);
 await tile.locator('.starchart-student-name').first().click();assert.equal(await page.evaluate(()=>readClassRosters()[0].starChart.studentStars['student:alex']),124);
 assert.equal(await tile.locator('.starchart-star-stage').first().getAttribute('data-total'),'123','new star is hidden while flying');
 assert.equal(await tile.locator('.is-award-slot').first().evaluate(e=>getComputedStyle(e).visibility),'hidden','landing position reserves space without showing the star');
 assert.equal(await page.evaluate(()=>starAwardSounds.length),1,'one supplied sound per award');
 await page.mouse.move(4,4);await page.waitForTimeout(480);
 assert(await page.evaluate(()=>{const star=document.querySelector('.starchart-flying-star'),tokens=testTile.querySelector('.starchart-star-stage').querySelectorAll('.starchart-star-token'),target=tokens[tokens.length-1].getBoundingClientRect();return !star||Math.hypot((star.getBoundingClientRect().left+star.getBoundingClientRect().width/2)-(target.left+target.width/2),(star.getBoundingClientRect().top+star.getBoundingClientRect().height/2)-(target.top+target.height/2))<45}),'award flight follows destination after unhover');
 await page.waitForTimeout(250);assert.equal(await page.locator('.starchart-flying-star').count(),0,'award flight cleans up');
 assert.equal(await tile.locator('.starchart-star-stage').first().getAttribute('data-total'),'124','star becomes visible on landing');

 await tile.locator('.starchart-student-total').first().click();assert.equal(await page.evaluate(()=>readClassRosters()[0].starChart.studentStars['student:alex']),125,'non-star row content awards a star');
 await tile.locator('.starchart-star-token').first().click();assert.equal(await page.evaluate(()=>readClassRosters()[0].starChart.studentStars['student:alex']),125,'earned stars cannot remove points');
 await tile.locator('.starchart-subtract-toggle').first().click();await tile.locator('.starchart-subtract-form input').first().fill('5');await tile.locator('.starchart-subtract-form button[type=submit]').first().click();assert.equal(await page.evaluate(()=>readClassRosters()[0].starChart.studentStars['student:alex']),120);
 await tile.locator('.starchart-search').fill('');
 await page.mouse.move(4,4);await page.waitForTimeout(200);assert.equal(await tile.locator('.starchart-subtract-toggle').last().evaluate(e=>getComputedStyle(e).visibility),'hidden');
 const originalSize=await tile.evaluate(e=>({width:e.offsetWidth,height:e.offsetHeight}));
 await page.evaluate(()=>{const p=screenToBoard(120,100);testTile.style.left=p.x+'px'});
 await tile.hover();await page.waitForTimeout(250);await tile.locator('.starchart-show-all').click();await page.waitForTimeout(250);
 assert(await tile.locator('.starchart-student-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length===3),'exactly three columns');
 assert(await tile.evaluate(e=>e.offsetWidth>=1000),'overview expands to readable column widths');
 assert(await tile.locator('.starchart-class-name').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)===13),'class label stays subtle');
 assert.equal(await tile.locator('.starchart-student-avatar').count(),12);
 assert.equal(await tile.locator('.starchart-student-row').nth(1).locator('.starchart-star-token').count(),5,'five earned stars remain five visible stars');
 assert(await tile.locator('.starchart-star-stage').nth(1).evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length>=5),'at least five stars fit across');
 const compactHeight=await tile.locator('.starchart-student-row').first().evaluate(e=>e.offsetHeight);
 await page.evaluate(()=>{window.starCompactBackup=JSON.parse(JSON.stringify(readClassRosters()));const c=readClassRosters()[0];c.starChart.studentStars['student:alex']=9999;localStorage.setItem(classRostersStorageKey(),JSON.stringify([c]));window.dispatchEvent(new Event('teachertiles:classeschange'))});await page.waitForTimeout(350);
 assert.equal(await tile.locator('.starchart-student-row').first().evaluate(e=>e.offsetHeight),compactHeight,'large totals cannot grow overview rows');
 assert.equal(await tile.locator('.starchart-student-row').first().locator('.starchart-star-token').count(),36,'large totals keep all denomination stars without the three-star cap');
 assert(await tile.locator('.starchart-star-stage').first().evaluate(e=>{const r=e.getBoundingClientRect();return [...e.children].every(n=>{const b=n.getBoundingClientRect();return b.bottom<=r.bottom+1&&b.right<=r.right+1})}),'every scaled row stays inside its star area');
 assert.equal(await tile.locator('.starchart-student-row').first().locator('.starchart-star-token').evaluateAll(ns=>ns.reduce((sum,n)=>sum+Number(n.dataset.bundleValue),0)),9999,'bundles represent the exact total');
 await page.evaluate(()=>{localStorage.setItem(classRostersStorageKey(),JSON.stringify(starCompactBackup));window.dispatchEvent(new Event('teachertiles:classeschange'))});await page.waitForTimeout(350);

 assert(await tile.locator('.starchart-student-name>strong').evaluateAll(ns=>ns.every(n=>parseFloat(getComputedStyle(n).fontSize)>=14)),'overview names stay readable');
 assert.equal(await tile.locator('.starchart-student-avatar img').count(),1);
 assert.equal(await tile.locator('.starchart-student-avatar').nth(1).textContent(),'🐻');
 assert.equal(await tile.locator('.starchart-student-avatar').nth(2).textContent(),'C');
 assert(await tile.locator('.starchart-student-grid').evaluate(e=>e.scrollHeight<=e.clientHeight+2),'12 students fit in compact overview');
 await tile.locator('.starchart-student-row').first().hover();
 await tile.locator('.starchart-subtract-toggle').first().click();
 const removeInput=tile.locator('.starchart-subtract-form input').first();await removeInput.fill('9999');
 assert(await removeInput.evaluate(e=>{const c=getComputedStyle(e);return e.clientWidth>=96&&e.clientHeight-parseFloat(c.paddingTop)-parseFloat(c.paddingBottom)>=parseFloat(c.fontSize)}),'Remove Stars keeps typed numbers fully visible');
 assert.equal(await tile.locator('.starchart-subtract-form button[type=submit]').first().textContent(),'Take Away');
 await tile.screenshot({path:path.join(process.env.TEMP,'pbis-starchart-remove.png')});
 await tile.locator('.starchart-subtract-reset').first().click();
 assert.equal(await page.evaluate(()=>readClassRosters()[0].starChart.studentStars['student:alex']),0,'Reset removes every star');
 assert.equal(await tile.locator('.starchart-star-stage').first().getAttribute('data-total'),'0');
 await tile.locator('.starchart-student-name').first().click();
 assert.equal(await tile.locator('.starchart-star-stage').first().getAttribute('data-total'),'0','first-ever star waits for landing');
 await page.waitForTimeout(750);assert.equal(await tile.locator('.starchart-star-stage').first().getAttribute('data-total'),'1');
 await page.evaluate(()=>writeClassStarChart('pbis-test',starCompactBackup[0].starChart));

 await tile.screenshot({path:path.join(process.env.TEMP,'pbis-starchart-overview.png')});
 await page.mouse.move(4,4);await page.waitForTimeout(400);
 assert(await tile.evaluate(e=>{const rows=[...e.querySelectorAll('.starchart-student-row:not([hidden])')],bottom=Math.max(...rows.map(r=>r.getBoundingClientRect().bottom));return e.getBoundingClientRect().bottom-bottom>=0&&e.getBoundingClientRect().bottom-bottom<50}),'overview has no unused bottom viewport');
 await tile.hover();
 const hoverHeights=await tile.evaluate(e=>new Promise(resolve=>{const heights=[];let frame=0;const tick=()=>{heights.push(e.getBoundingClientRect().height);if(++frame<24)requestAnimationFrame(tick);else resolve(heights)};requestAnimationFrame(tick)}));
 assert(hoverHeights.every((height,i)=>!i||height>=hoverHeights[i-1]-.6),'overview hover grows smoothly without a second collapse/reflow');

 await page.evaluate(()=>{window.starRosterBackup=readClassRosters();const r={...starRosterBackup[0],students:Array.from({length:30},(_,i)=>'Student '+(i+1))};localStorage.setItem(classRostersStorageKey(),JSON.stringify([r]));window.dispatchEvent(new Event('teachertiles:classeschange'))});await page.waitForTimeout(400);

 assert(await tile.evaluate(e=>e.offsetHeight>1000),'thirty-student overview expands beyond the old height limit');
 assert(await tile.locator('.starchart-student-grid').evaluate(e=>e.scrollHeight<=e.clientHeight+2),'all thirty students fit without an internal scrollbar');
 assert.equal(await tile.locator('.starchart-student-row:visible').count(),30);
 await tile.screenshot({path:path.join(process.env.TEMP,'pbis-starchart-thirty.png')});
 await tile.locator('.starchart-show-all').evaluate(e=>e.click());await page.waitForTimeout(100);
 assert.deepEqual(await tile.evaluate(e=>({width:e.offsetWidth,height:e.offsetHeight})),originalSize,'turning overview off restores original size');
 await page.evaluate(()=>{localStorage.setItem(classRostersStorageKey(),JSON.stringify(starRosterBackup));window.dispatchEvent(new Event('teachertiles:classeschange'))});
 await tile.locator('.starchart-show-all').evaluate(e=>e.click());await page.waitForTimeout(250);

 }
 if(type==='egghatching'||type==='flowerpots'){
 assert(await tile.locator('.growth-show-all').isChecked(),'show all defaults on');
 assert.equal(await tile.locator('.growth-student small,.growth-restart').count(),0,'growth cards show only artwork and names');
 assert(await tile.locator('.growth-header').evaluate(e=>{const h=e.querySelector('.growth-heading').getBoundingClientRect(),c=e.querySelector('.growth-class').getBoundingClientRect();return Math.abs((h.top+h.bottom)/2-(c.top+c.bottom)/2)<3}),'heading and centered class share one line');
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
 if(type==='starchart'){assert(parseFloat(await tile.locator('.starchart-student-name strong').first().evaluate(e=>getComputedStyle(e).fontSize))>=16);await tile.hover();await tile.locator('.pbis-scope-toggle').click();
 await tile.locator('.starchart-whole-add').click();assert.equal(await tile.locator('.starchart-whole-count b').textContent(),'35','whole-class star waits for landing');await page.waitForTimeout(750);assert.equal(await tile.locator('.starchart-whole-count b').textContent(),'36','whole-class portrait awards a star');
 await tile.locator('.starchart-whole-bundles .starchart-star-token').last().click();assert.equal(await tile.locator('.starchart-whole-count b').textContent(),'36','whole-class earned stars cannot remove points');
 await tile.locator('.starchart-whole-card').hover();await tile.locator('.starchart-whole-remove').click();assert.equal(await tile.locator('.starchart-whole-count b').textContent(),'35','whole-class remove button removes one');
 await tile.locator('.starchart-whole-count').click();await page.waitForTimeout(750);assert.equal(await tile.locator('.starchart-whole-count b').textContent(),'36','whole-class card content awards one');
 const soundBefore=await page.evaluate(()=>starAwardSounds.length);
 await page.evaluate(()=>{window.starAwardBackup=JSON.parse(JSON.stringify(readClassRosters()[0].starChart));for(let i=0;i<3;i++)testTile.querySelector('.starchart-whole-add').click()});
 assert.equal(await tile.locator('.starchart-whole-count b').textContent(),'36','rapid awards remain hidden during flights');
 assert.equal(await page.evaluate(()=>readClassRosters()[0].starChart.wholeClassStars),39,'rapid awards save immediately');
 await page.waitForTimeout(800);
 assert.equal(await tile.locator('.starchart-whole-count b').textContent(),'39','all rapid awards land');
 assert.equal(await page.evaluate(()=>starAwardSounds.length),soundBefore+3,'rapid awards each play the supplied sound');
 await page.emulateMedia({reducedMotion:'reduce'});
 await tile.locator('.starchart-whole-add').click();assert.equal(await tile.locator('.starchart-whole-count b').textContent(),'40','reduced motion reveals immediately');
 await page.evaluate(()=>setTileAudioState(testTile,{enabled:false}));
 const mutedBefore=await page.evaluate(()=>starAwardSounds.length);
 await tile.locator('.starchart-whole-add').click();assert.equal(await page.evaluate(()=>starAwardSounds.length),mutedBefore,'star audio respects tile mute');
 await page.evaluate(()=>{setTileAudioState(testTile,{enabled:true});writeClassStarChart('pbis-test',starAwardBackup)});
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(()=>{testTile.querySelector('.starchart-whole-add').click();writeClassStarChart('pbis-test',starAwardBackup)});
 assert.equal(await page.locator('.starchart-flying-star').count(),0,'external score reduction cancels pending flights');
 assert.equal(await tile.locator('.starchart-whole-count b').textContent(),'36','external reset does not leave hidden points');

 await page.waitForTimeout(750);await page.screenshot({path:path.join(process.env.TEMP,'pbis-starchart-whole-full.png')});}
 if(type==='pbisconsole'){await tile.locator('[data-pbisconsole-view=class]').click();await page.screenshot({path:path.join(process.env.TEMP,'pbis-console-class-full.png')});}
 await page.setViewportSize({width:1100,height:720});await page.waitForTimeout(150);
 if(type==='punchcards')assert(await tile.locator('.punchcard-card').evaluate(e=>{const r=e.getBoundingClientRect();return Math.abs(r.width/r.height-1.75)<.05&&e.scrollHeight<=e.clientHeight+2}),'fullscreen card ratio and no scrollbar');
 if(type==='classmeter')assert(await tile.locator('.classmeter-meter').evaluate(e=>e.getBoundingClientRect().width<innerWidth*.7),'meter has side margins');

 assert(await tile.evaluate(m=>m.scrollWidth<=m.clientWidth+2),type+' smaller fullscreen has no horizontal overflow');
 await tile.hover();await page.waitForTimeout(250);
 await tile.locator('.pbis-footer-change').click();
 assert(await tile.locator('.class-roster-intro').isVisible(),type+' Change Class opens picker');
 assert(!(await tile.locator('.pbis-footer-actions').isVisible()),type+' hides footer actions after changing class');
 await tile.locator('.class-roster-picker select').selectOption('pbis-test');await tile.locator('.class-roster-picker button').click();
 await page.evaluate(()=>document.exitFullscreen());await page.waitForTimeout(200);const expectedSize=type==='starchart'?await page.evaluate(()=>{const s=testTile._boardGetState();return{width:s.collapsedWidth+'px',height:s.collapsedHeight+'px'}}):before;
 assert.deepEqual(await page.evaluate(()=>({width:testTile.style.width,height:testTile.style.height})),expectedSize,type+' restores the current mode board size');await page.setViewportSize({width:1440,height:1000});
 }
 if(types.includes('flowerpots')){
 // A standard 30-student class fits the growth tiles while keeping names readable.
 await page.evaluate(()=>{const classes=readClassRosters();classes[0].students=Array.from({length:30},(_,i)=>'Student '+i);localStorage.setItem(classRostersStorageKey(),JSON.stringify(classes));testTile._boardSetState({activeClassId:'pbis-test',showAll:true})});await page.waitForTimeout(200);
 assert(await tileFont());
 assert(await page.locator('.flowerpots-module .growth-grid').evaluate(e=>e.scrollHeight<=e.clientHeight+2),'30 growth students fit at default size');
 async function tileFont(){return page.locator('.flowerpots-module .growth-student strong').evaluateAll(ns=>ns.length===30&&ns.every(n=>parseFloat(getComputedStyle(n).fontSize)>=14))}
 }
 // Shared picker also appears in non-PBIS roster tools.
 for(const type of ['attendance','groupmaker','spinner','popsiclesticks']){
  await page.evaluate(type=>{const p=screenToBoard(560,100);window.other=createModule(type,p.x,p.y,{record:false})},type);
  assert(await page.evaluate(()=>!!other),type+' exists');if(await page.evaluate(()=>!!other)){assert(await page.evaluate(()=>!!other.querySelector('.class-roster-picker')),type+' uses shared picker');await page.evaluate(()=>{other._cleanup?.();other.remove()});}
 }
 assert.deepEqual(errors,[]);console.log('PASS PBIS loaders, Star Chart awards/search/removal, nine actual fullscreen layouts and geometry restoration');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
