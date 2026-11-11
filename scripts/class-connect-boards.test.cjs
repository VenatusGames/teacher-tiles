const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const root=process.cwd(),room='a'.repeat(64),token='t'.repeat(43),types=['sticky','timer','dice','timestables','highfrequency','progressbar','halloweentimer'];
let status=null,snapshot=null,allowedTypes=[],calls=[],revision=0;
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const context=await browser.newContext({viewport:{width:1400,height:960}}),pages=[],errors=[];
 const broadcast=async()=>{for(const p of pages)await p.evaluate(s=>{window.__currentRoom=s;window.__pushRoom?.(s)},status).catch(()=>{});};
 await context.exposeBinding('__boardCall',async(_,name,data)=>{
  calls.push({name,...data});
  if(name==='classConnectView')return {boardRoom:room,view:{name:'Owls',students:[{id:'alice',name:'Alice',initials:'A',hue:140,rewards:{}}]}};
  assert.equal(name,'classConnectBoard');
  if(data.action==='teacherGet')return {room,status,snapshot,allowedTypes,types};
  if(data.action==='start'){status={active:true,mode:data.mode,sessionId:'session-'+(++revision),revision:1,lastInput:Date.now(),activityWrittenAt:Date.now(),until:Date.now()+600000};snapshot={schemaVersion:2,theme:'light',objects:[],frames:[]};allowedTypes=data.allowedTypes;await broadcast();return {room,status};}
  if(data.action==='join')return {room,status,snapshot,allowedTypes};
  if(data.action==='publish'){assert.equal(data.expectedRevision,status.revision);snapshot=structuredClone(data.snapshot);status={...status,revision:status.revision+1};await broadcast();return {status,warnings:[]};}
  if(data.action==='end'){status={...status,active:false};await broadcast();return {status};}
  if(data.action==='activity'){status={...status,lastInput:Date.now(),activityWrittenAt:Date.now(),until:Date.now()+600000};await broadcast();return {status};}
  throw Error('Unexpected action '+data.action);
 });
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='www.gstatic.com'){
   const body=url.pathname.endsWith('firebase-app.js')?'const app={name:"[DEFAULT]"};export const initializeApp=()=>app;export const getApps=()=>[app];':url.pathname.endsWith('firebase-firestore.js')?'export const getFirestore=()=>({});export const doc=()=>({});export function onSnapshot(_,options,next){window.__roomListeners??=new Set();window.__roomListeners.add(next);window.__pushRoom=s=>{window.__currentRoom=s;for(const f of window.__roomListeners)f({data:()=>s})};next({data:()=>window.__currentRoom});return()=>window.__roomListeners.delete(next)}':'export const getFunctions=()=>({});export const httpsCallable=(_,name)=>async data=>({data:await window.__boardCall(name,data)});';
   return route.fulfill({contentType:'text/javascript',body});
  }
  if(url.pathname==='/host.html')return route.fulfill({contentType:'text/html',body:'<!doctype html><link rel="stylesheet" href="/class-connect/boards.css"><script type="module" src="/class-connect/boards.js"></script>'});
  if(url.pathname.endsWith('firebase-auth.js'))return route.fulfill({body:'',contentType:'text/javascript'});
  if(url.pathname.includes('board-gate'))return route.abort();
  if(url.pathname.endsWith('/shopManagement'))return route.fulfill({json:{revision:0,products:{},bundles:{},sales:{},banners:{hidden:[],removed:[],custom:[]},serverTime:Date.now()}});
  if(url.hostname!=='tiles.test')return route.abort();
  const file=path.join(root,decodeURIComponent(url.pathname));return fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({path:file}):route.fulfill({status:404,body:''});
 });
 const teacher=await context.newPage();pages.push(teacher);teacher.on('pageerror',e=>errors.push('Teacher: '+e.message));
 await teacher.goto('https://tiles.test/host.html');await teacher.waitForFunction(()=>window.TeacherTilesBoardSessions);await teacher.evaluate(()=>{localStorage.setItem('parent-sentinel','untouched');TeacherTilesBoardSessions.teacher({classId:'c',name:'Owls'})});
 await teacher.screenshot({path:path.join(process.env.TEMP,'classconnect-session-setup.png')});await teacher.getByRole('button',{name:'Start Session',exact:true}).click();
 const frame=teacher.frameLocator('iframe');await frame.locator('#workspace').waitFor();await teacher.waitForFunction(()=>document.querySelector('iframe')?.contentWindow.ClassConnectPolicy?.ready,{},{timeout:60000});
 const teacherFrame=teacher.frames()[1];console.log('Teacher board loaded');
 await teacherFrame.evaluate(()=>{const b=TeacherTilesBoard.blank();const x=-b.camera.x/b.camera.scale+200,y=-b.camera.y/b.camera.scale+180;createModule('sticky',x,y);});
 await teacher.waitForFunction(()=>document.querySelector('.cc-session-status').textContent==='Students have the latest tiles',null,{timeout:15000}).catch(async e=>{console.log('Debug',errors,calls.map(x=>x.action),await teacher.locator('.cc-session-status').allTextContents());throw e});assert.equal(snapshot.objects.length,1);const sticky=snapshot.objects[0];
 const student=await context.newPage();pages.push(student);student.on('pageerror',e=>errors.push('Student: '+e.message));await student.addInitScript(s=>window.__currentRoom=s,status);
 await student.goto('https://tiles.test/class-connect.html#'+token);await student.getByRole('button',{name:'Open Alice',exact:true}).click();assert(await student.getByRole('button',{name:'Enter Board',exact:true}).evaluate(el=>el.classList.contains('is-live')));await student.getByRole('button',{name:'Enter Board',exact:true}).click();
 await student.waitForFunction(()=>document.querySelector('iframe')?.contentWindow.ClassConnectPolicy?.ready,null,{timeout:60000});let studentFrame=student.frames()[1];
 assert.equal(await studentFrame.locator('.module[data-type="sticky"]').count(),1);console.log('Student board loaded');
 assert.equal(await studentFrame.evaluate(()=>localStorage.getItem('parent-sentinel')),null);
 assert.equal(await studentFrame.evaluate(()=>typeof TeacherTilesEncryptedClasses),'undefined');
 assert.equal(await studentFrame.evaluate(()=>readClassRosters()[0].students[0]),'Alice');
 assert.equal(await student.evaluate(()=>localStorage.getItem('teachertiles-class-rosters-v1:local')),null);

 assert.equal(await studentFrame.evaluate(()=>createModule('dice',100,100)),null);
 await studentFrame.evaluate(()=>deleteModules([...document.querySelectorAll('.module')]));assert.equal(await studentFrame.locator('.module[data-type="sticky"]').count(),1);
 await studentFrame.evaluate(()=>{const m=document.querySelector('.module[data-type="sticky"]');m.querySelector('[contenteditable]').textContent='Student work';m.querySelector('[contenteditable]').dispatchEvent(new Event('input',{bubbles:true}));});
 const published=calls.filter(c=>c.action==='publish').length;await new Promise(r=>setTimeout(r,1800));assert.equal(calls.filter(c=>c.action==='publish').length,published);
 await teacherFrame.evaluate(()=>createModule('dice',500,500));await studentFrame.locator('.module[data-type="dice"]').waitFor({timeout:15000});assert(await studentFrame.locator('.module[data-type="sticky"]').innerText().then(t=>t.includes('Student work')));
 await teacherFrame.evaluate(()=>deleteModules([...document.querySelectorAll('.module[data-type="dice"]')]));await studentFrame.locator('.module[data-type="dice"]').waitFor({state:'detached',timeout:15000});
 await student.screenshot({path:path.join(process.env.TEMP,'classconnect-controlled.png')});
 // A student leaving and reentering starts fresh, never restoring their work.
 await student.getByRole('button',{name:'Back to Profile',exact:true}).click();
 await student.getByRole('button',{name:'Enter Board',exact:true}).click();
 await student.waitForFunction(()=>document.querySelector('iframe')?.contentWindow.ClassConnectPolicy?.ready,null,{timeout:60000});
 studentFrame=student.frames()[1];assert(!await studentFrame.locator('.module[data-type=sticky]').innerText().then(t=>t.includes('Student work')));

 // Close immediately after an edit: the close action must flush the debounce.
 await teacherFrame.evaluate(()=>{const edit=document.querySelector('.module[data-type=sticky] [contenteditable]');edit.textContent='Teacher revision';edit.dispatchEvent(new Event('input',{bubbles:true}));});
 await teacher.getByRole('button',{name:'Back to Class',exact:true}).click();await teacher.locator('iframe').waitFor({state:'detached'});
 assert(snapshot.objects[0].editables.some(e=>e.html.includes('Teacher revision')));
 await studentFrame.locator('.module[data-type=sticky]').filter({hasText:'Teacher revision'}).waitFor();
 await teacher.evaluate(()=>TeacherTilesBoardSessions.teacher({classId:'c',name:'Owls'}));await teacher.getByRole('button',{name:'Open Session Board',exact:true}).click();
 await teacher.waitForFunction(()=>document.querySelector('iframe')?.contentWindow.ClassConnectPolicy?.ready,null,{timeout:60000});

 await teacher.getByRole('button',{name:'End Session',exact:true}).click();await student.locator('.cc-session-stage.is-ended').waitFor();
 await teacher.getByRole('button',{name:'Back to Class',exact:true}).click();await student.getByRole('button',{name:'Back to Profile',exact:true}).click();
 await teacher.evaluate(()=>TeacherTilesBoardSessions.teacher({classId:'c',name:'Owls'}));await teacher.getByRole('button',{name:/Free Session Choose/}).click();await teacher.getByRole('button',{name:'dice',exact:true}).click();await teacher.getByRole('button',{name:'Start Session',exact:true}).click();
 await teacher.waitForFunction(()=>document.querySelector('iframe')?.contentWindow.ClassConnectPolicy?.ready,null,{timeout:60000});await student.getByRole('button',{name:'Enter Board',exact:true}).click();await student.waitForFunction(()=>document.querySelector('iframe')?.contentWindow.ClassConnectPolicy?.ready,null,{timeout:60000});
 const free=student.frames()[1];await free.evaluate(()=>createModule('dice',500,500));assert.equal(await free.locator('.module[data-type="dice"]').count(),1);assert.equal(await free.evaluate(()=>createModule('sticky',500,500)),null);
 await free.evaluate(()=>deleteModules([...document.querySelectorAll('.module')]));assert.equal(await free.locator('.module').count(),0);
 assert.equal(await teacher.evaluate(()=>localStorage.getItem('parent-sentinel')),'untouched');
 assert.equal(await free.evaluate(()=>createStickerModule({emoji:'⭐'},200,200)),null);
 await student.setViewportSize({width:390,height:844});assert(await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 status={...status,until:Date.now()-1};await broadcast();await student.locator('.cc-session-stage.is-ended').waitFor();assert(await free.evaluate(()=>document.body.inert));
 await student.getByRole('button',{name:'Back to Profile',exact:true}).click();assert(!await student.getByRole('button',{name:'Enter Board',exact:true}).evaluate(el=>el.classList.contains('is-live')));

 assert.deepEqual(errors,[]);console.log('Session browser checks passed: teacher editing, controlled restrictions, independent work, incremental updates, end session, free whitelist, isolated storage.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
