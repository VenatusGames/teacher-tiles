const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd(),outputs=process.env.TT_TEST_OUTPUT||process.env.TEMP;let entry=null,shared=null,nextToken=0,loseResponse=false,reads=0;
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
const context=await browser.newContext({viewport:{width:1400,height:960},permissions:['clipboard-read','clipboard-write']});
await context.exposeBinding('__ccCall',async(_,name,data)=>{
 assert.equal(name,'classConnect');assert.equal(data.ownerUid,'teacher');
 if(data.action==='list')return {links:entry?[entry]:[]};
 if(data.action==='sync'){if(entry?.active){const item=data.classes.find(c=>c.classId===entry.classId);if(item)shared=item.view;else entry={...entry,active:false,token:''};}return {changed:0};}
 if(data.action==='disable'){entry={...entry,active:false,token:'',revision:entry.revision+1};return {link:entry};}
 if(data.action==='create'&&entry?.active)return {link:entry};
 assert.equal(data.expectedRevision,entry?.revision||0);entry={classId:data.classId,token:String.fromCharCode(97+nextToken++).repeat(43),revision:(entry?.revision||0)+1,active:true};shared=data.view;
 if(loseResponse){loseResponse=false;throw Error('Connection interrupted');}return {link:entry};
});
await context.exposeBinding('__ccView',(_,data)=>{reads++;return entry?.active&&data.token===entry.token?{view:shared,updatedAt:Date.now()}:{missing:true};});
await context.route('**/*',route=>{
 const url=new URL(route.request().url());
 if(url.hostname==='www.gstatic.com')return route.fulfill({contentType:'text/javascript',body:url.pathname.endsWith('firebase-app.js')?'export const initializeApp=x=>x;':`export const getFunctions=x=>x;export const httpsCallable=()=>async(data)=>{const result=await window.__ccView(data);if(result.missing)throw Object.assign(new Error('Not found'),{code:'functions/not-found'});return {data:result};};`});
 if(url.pathname.endsWith('firebase-auth.js'))return route.fulfill({body:'',contentType:'text/javascript'});
 if(url.pathname.includes('board-gate'))return route.abort();
 if(url.pathname.endsWith('/shopManagement'))return route.fulfill({json:{revision:0,products:{},bundles:{},sales:{},banners:{hidden:[],removed:[],custom:[]},serverTime:Date.now()}});
 if(url.hostname!=='tiles.test')return route.abort();
 let local=decodeURIComponent(url.pathname.replace(/^\/dev/,'')||'/');if(local==='/board.html')local='/index.html';const file=path.join(root,local);
 return fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({path:file}):route.fulfill({status:404,body:''});
});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
async function ready(){await page.waitForFunction(()=>window.TeacherTilesPresentations);await page.evaluate(async()=>{
 document.querySelector('#teachertiles-intro')?.remove();document.documentElement.classList.remove('sandbox-access-locked');window.TeacherTilesAuth={user:{uid:'teacher'}};window.TeacherTilesSandbox={subscriptionEnabled:true};
 const {createClassConnectClient}=await import('/dev/class-connect/client.js');window.TeacherTilesClassConnect=createClassConnectClient({getUid:()=>window.TeacherTilesAuth.user?.uid||'',call:window.__ccCall});
 window.TeacherTilesEncryptedClasses={save:classes=>window.TeacherTilesClassConnect.sync(classes,'teacher','11111111-1111-4111-8111-111111111111')};
});}
await page.goto('https://tiles.test/dev/board.html');await ready();
await page.evaluate(()=>{localStorage.setItem(classRostersStorageKey(),JSON.stringify([{id:'owls',name:'The Owl Classroom',logo:'🦉',gradeLevel:'3',students:['Amy Lee','Ben','Chloe','Daniel','Emma','Finn','Grace','Harper','Isla','James','Kai','Luna'],studentProfiles:{'student:ben':{emoji:'🐸'},'student:chloe':{emoji:'🌻'}},starChart:{wholeClassStars:999}}]));document.querySelector('#profile-classes-button').click();});
await page.getByRole('button',{name:'Open The Owl Classroom',exact:true}).click();await page.getByRole('button',{name:'ClassConnect',exact:true}).click();
const panel=page.getByRole('dialog',{name:'ClassConnect',exact:true});await panel.getByRole('button',{name:'Create Student Link',exact:true}).click();
const linkInput=panel.getByRole('textbox',{name:'Student link'});await linkInput.waitFor();const initial=await linkInput.inputValue();assert.match(initial,/^https:\/\/tiles.test\/dev\/class-connect.html#[a-z]{43}$/);
await panel.getByRole('button',{name:'Copy Link',exact:true}).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),initial);
await panel.screenshot({path:path.join(outputs,'class-connect-teacher.png')});
const student=await context.newPage();student.on('pageerror',e=>errors.push(e.message));await student.goto(initial);await student.getByRole('heading',{name:'The Owl Classroom'}).waitFor();assert.equal(await student.locator('.cc-student-card').count(),12);assert(!await student.locator('body').innerText().then(t=>/PBIS|999|Edit|Delete/.test(t)));assert.equal(await student.locator('.cc-student-avatar.has-emoji').count(),2);
await student.evaluate(()=>Promise.all(document.getAnimations().map(animation=>animation.finished.catch(()=>{}))));await student.screenshot({path:path.join(outputs,'class-connect-students.png')});await student.setViewportSize({width:390,height:844});await student.screenshot({path:path.join(outputs,'class-connect-students-mobile.png')});assert(await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await panel.getByRole('button',{name:'Close ClassConnect',exact:true}).click();await page.getByRole('button',{name:'ClassConnect',exact:true}).click();assert.equal(await linkInput.inputValue(),initial);
await panel.getByRole('button',{name:'Reset Link',exact:true}).click();await panel.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await linkInput.inputValue(),initial);
await panel.getByRole('button',{name:'Reset Link',exact:true}).click();loseResponse=true;await panel.getByRole('button',{name:'Reset Link Now',exact:true}).click();await panel.getByRole('alert').filter({hasText:'Connection interrupted'}).waitFor();const reset=await linkInput.inputValue();assert.notEqual(reset,initial);
await student.reload();await student.getByRole('heading',{name:'This class link is unavailable'}).waitFor();await student.goto(reset);await student.getByRole('heading',{name:'The Owl Classroom'}).waitFor();
await panel.getByRole('button',{name:'Disable Link',exact:true}).click();await panel.getByRole('button',{name:'Disable Link Now',exact:true}).click();await panel.getByRole('button',{name:'Create Student Link',exact:true}).waitFor();await student.getByRole('button',{name:'Refresh',exact:true}).click();await student.getByRole('heading',{name:'This class link is unavailable'}).waitFor();
await panel.getByRole('button',{name:'Create Student Link',exact:true}).click();await linkInput.waitFor();const enabled=await linkInput.inputValue();assert.notEqual(enabled,reset);
await page.evaluate(async()=>{const classes=readClassRosters();classes[0].name='Robins';classes[0].students.push('Mia');writeClassRosters(classes);await queueEncryptedClassSave(classes);});await student.goto(enabled);await student.getByRole('heading',{name:'Robins'}).waitFor();assert.equal(await student.locator('.cc-student-card').count(),13);
await page.setViewportSize({width:390,height:844});assert(await panel.evaluate(el=>el.getBoundingClientRect().right<=innerWidth&&el.getBoundingClientRect().left>=0));await panel.screenshot({path:path.join(outputs,'class-connect-teacher-mobile.png')});
await page.evaluate(()=>{window.TeacherTilesAuth.user=null;window.dispatchEvent(new CustomEvent('teachertiles:authchange'));});assert.equal(await panel.isVisible(),false);
const before=reads;await student.goto('https://tiles.test/dev/class-connect.html#invalid');await student.getByRole('heading',{name:'This class link is unavailable'}).waitFor();assert.equal(reads,before);
assert.deepEqual(errors,[]);console.log('ClassConnect browser checks passed: create/copy/reopen, lost reset response, revoke/re-enable, roster sync, read-only student view, mobile layout, account switch.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
