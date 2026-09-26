const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--unsafely-treat-insecure-origin-as-secure=http://tiles.test']});try{
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('teacherTilesSandboxCoinsEnabled','true');window.Audio=class extends EventTarget{constructor(src){super();Object.assign(this,{src,paused:true,volume:1,currentTime:0,duration:20})}play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true}load(){}removeAttribute(){}cloneNode(){return new Audio(this.src)}};window.notices=[];window.Notification=class{static permission='granted';constructor(title,options){notices.push({title,...options})}}});
await page.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(process.cwd(),decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));return u.hostname==='tiles.test'&&fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.abort()});
await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1800);






await page.evaluate(()=>{
 document.getElementById('profile-modal').hidden=true;
 localStorage.setItem(classRostersStorageKey(),JSON.stringify([{id:'test-growth',name:'Garden Class',students:['Alex','Sam']} ]));
 for(const [type,x] of [['egghatching',80],['flowerpots',750]]){const p=screenToBoard(x,180);const m=createModule(type,p.x,p.y);m._boardSetState({activeClassId:'test-growth',goal:3});}
});
assert.equal(await page.locator('.growth-student').count(),4);
assert(await page.locator('.growth-show-all').evaluateAll(inputs=>inputs.every(input=>input.checked)));
await page.evaluate(()=>document.querySelector('.flowerpots-module .tile-settings-toggle').click());
assert.equal(await page.locator('.flowerpots-module .tile-settings-panel').evaluate(el=>el.hidden),false);
await page.evaluate(()=>document.querySelector('.flowerpots-module .tile-settings-toggle').click());
await page.evaluate(()=>window.samCard=document.querySelectorAll('.egghatching-module .growth-student')[1]);
await page.evaluate(()=>{for(let i=0;i<4;i++)document.querySelector('.egghatching-module .growth-student').click()});
assert.equal(await page.evaluate(()=>readClassRosters()[0].eggHatching.studentPoints['student:alex']),0);
assert(await page.evaluate(()=>samCard===document.querySelectorAll('.egghatching-module .growth-student')[1]));
assert(await page.locator('.egghatching-module .growth-particle.shell').count()>0);
await page.evaluate(()=>document.querySelector('.egghatching-module .growth-student').click());
assert.equal(await page.evaluate(()=>readClassRosters()[0].eggHatching.studentPoints['student:alex']),1);
await page.evaluate(()=>{for(let i=0;i<3;i++)document.querySelector('.flowerpots-module .growth-student').click()});
assert.equal(await page.evaluate(()=>readClassRosters()[0].flowerPots.studentPoints['student:alex']),1);
assert.equal(await page.evaluate(()=>readClassRosters()[0].flowerPots.studentPoints['student:sam']),0);
assert.equal(await page.evaluate(()=>pbisBalance(readClassRosters()[0],'studentEggPoints','Alex')),1);
assert.equal(await page.locator('.growth-restart').count(),2);
await page.evaluate(()=>document.querySelector('.egghatching-module .growth-student').click());
assert.equal(await page.evaluate(()=>readClassRosters()[0].eggHatching.studentProgress['student:alex']),0);
await page.evaluate(()=>{window.wheelEscaped=false;window.addEventListener('wheel',()=>window.wheelEscaped=true,{once:true});document.querySelector('.growth-grid').dispatchEvent(new WheelEvent('wheel',{bubbles:true,deltaY:100}))});
assert.equal(await page.evaluate(()=>window.wheelEscaped),false);
await page.evaluate(()=>{const m=document.querySelector('.flowerpots-module');m._boardSetState({activeClassId:'test-growth',goal:10});for(let i=0;i<9;i++)m.querySelector('.growth-student').click()});
assert.equal(await page.evaluate(()=>readClassRosters()[0].flowerPots.studentPoints['student:alex']),1);
await page.evaluate(()=>document.querySelector('.flowerpots-module .growth-student').click());
assert.equal(await page.evaluate(()=>readClassRosters()[0].flowerPots.studentPoints['student:alex']),2);
await page.evaluate(()=>{const m=document.querySelector('.flowerpots-module');m._boardSetState({activeClassId:'test-growth',goal:1});m.querySelector('.growth-student').click()});
assert.equal(await page.evaluate(()=>readClassRosters()[0].flowerPots.studentPoints['student:alex']),3);
await page.evaluate(()=>{const classes=readClassRosters();classes[0].students=Array.from({length:30},(_,i)=>'Student '+i);localStorage.setItem(classRostersStorageKey(),JSON.stringify(classes));document.querySelector('.flowerpots-module')._boardSetState({activeClassId:'test-growth',goal:5,showAll:true})});await page.waitForTimeout(300);
assert(await page.locator('.flowerpots-module .growth-grid').evaluate(el=>el.scrollHeight<=el.clientHeight+1&&el.scrollWidth<=el.clientWidth+1));
assert.equal(await page.locator('.flowerpots-module .growth-student').count(),30);
assert(await page.locator('.flowerpots-module .growth-student').evaluateAll(cards=>cards.every(card=>{const art=card.querySelector('svg').getBoundingClientRect(),label=card.querySelector('strong').getBoundingClientRect();return art.height>15&&art.bottom<=label.top+1})));
for(const showAll of [false,true]){
 await page.evaluate(showAll=>{const classes=JSON.parse(localStorage.getItem(classRostersStorageKey()));classes[0].students=Array.from({length:16},(_,i)=>'Student '+i);localStorage.setItem(classRostersStorageKey(),JSON.stringify(classes));document.querySelectorAll('.growth-module').forEach(m=>m._boardSetState({activeClassId:'test-growth',showAll}));},showAll);await page.waitForTimeout(150);
 assert(await page.locator('.growth-student').evaluateAll(cards=>cards.every(card=>{const art=card.querySelector('svg').getBoundingClientRect(),label=card.querySelector('strong').getBoundingClientRect();return art.height>20&&art.bottom<=label.top+1})));
}

await page.screenshot({path:'C:/Users/Jack/.codex/visualizations/2026/09/21/01a0c154-6a92-74e3-80e0-b301d930cec6/growth-fit.png'});
await page.evaluate(()=>{const classes=JSON.parse(localStorage.getItem(classRostersStorageKey()));classes[0].students=['Alex','Sam'];localStorage.setItem(classRostersStorageKey(),JSON.stringify(classes));});
await page.evaluate(()=>{document.querySelectorAll('.growth-module').forEach(m=>{m._cleanup?.();m.remove()});const p=screenToBoard(350,180);window.med=createModule('meditation',p.x,p.y)});
assert.equal(await page.locator('.meditation-count svg').count(),1);
await page.screenshot({path:'C:/Users/Jack/.codex/visualizations/2026/09/21/01a0c154-6a92-74e3-80e0-b301d930cec6/meditation-lotus.png'});
await page.evaluate(()=>med.querySelector('.meditation-toggle').click());
await page.mouse.move(1400,50);await page.waitForTimeout(450);
assert.equal(await page.locator('.meditation-count').evaluate(el=>getComputedStyle(el).opacity),'1');
assert.match(await page.locator('.meditation-count').innerText(),/\d/);
await page.evaluate(()=>document.getElementById('profile-student-view-button').click());
assert.equal(await page.locator('.student-view-person').first().locator('.student-view-reward-total').innerText(),'4 PBIS Rewards');
await page.evaluate(()=>document.getElementById('student-view-stat-menu-toggle').click());await page.waitForTimeout(200);
await page.screenshot({path:'C:/Users/Jack/.codex/visualizations/2026/09/21/01a0c154-6a92-74e3-80e0-b301d930cec6/pbis-settings.png'});
await page.evaluate(()=>document.getElementById('student-view-settings-close').click());
await page.evaluate(()=>document.querySelector('.student-view-person').click());
assert.equal(await page.locator('.student-profile-stat').count(),5);assert.equal(await page.locator('.student-profile-rewards-heading').innerText(),'PBIS Rewards');await page.waitForTimeout(300);
await page.screenshot({path:'C:/Users/Jack/.codex/visualizations/2026/09/21/01a0c154-6a92-74e3-80e0-b301d930cec6/student-view-growth.png'});
await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(600);
assert.equal(await page.evaluate(()=>readClassRosters()[0].flowerPots.studentPoints['student:alex']),3);
assert.equal(await page.evaluate(()=>readClassRosters()[0].eggHatching.studentPoints['student:alex']),1);
assert.deepEqual(errors,[]);console.log('PBIS thresholds, independent students, balances, and meditation hover passed');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
