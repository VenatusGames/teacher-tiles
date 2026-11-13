const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const deployed=process.env.TT_TEST_DEPLOYED==='1',base='https://tiles.test/'+(deployed?'dev/':''),root=process.cwd(),room='a'.repeat(64),token='t'.repeat(43),types=['wordcloud','sticky','timer','dice','timestables','highfrequency','progressbar','halloweentimer'];
const interactions=require('../../teachertiles-functions-dev/functions/firebase-service/class-connect-board-interactions');
let cloud=null,clock=Date.now();
let status=null,snapshot=null,allowedTypes=[],calls=[],revision=0,gateRequests=0,portalRequests=0;
let builtRoot;
if(deployed){
 builtRoot=fs.mkdtempSync(path.join(require('os').tmpdir(),'tt-session-built-'));
 fs.mkdirSync(path.join(builtRoot,'sandbox'));
 fs.copyFileSync(path.join(root,'index.html'),path.join(builtRoot,'index.html'));
 fs.copyFileSync(path.join(root,'sandbox/portal.html'),path.join(builtRoot,'sandbox/portal.html'));
 require(path.join(root,'sandbox/build.cjs')).buildSandbox(builtRoot);
 assert(fs.readFileSync(path.join(builtRoot,'index.html'),'utf8').includes('portal-access-screen'));
 assert(fs.readFileSync(path.join(builtRoot,'board.html'),'utf8').includes('sandbox/board-gate.js'));
}

(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const context=await browser.newContext({viewport:{width:1400,height:960}}),pages=[],errors=[];
 const broadcast=async()=>{for(const p of pages)await p.evaluate(({status,cloud})=>{window.__currentRoom=status;window.__cloud=cloud;window.__push?.('_classConnectClouds',cloud);window.__push?.('_classConnectRooms',status)},{status,cloud}).catch(()=>{});};
 await context.exposeBinding('__boardCall',async(_,name,data)=>{
  calls.push({name,...data});
  if(name==='classConnectView')return {boardRoom:room,view:{name:'Owls',students:[{id:'alice',name:'Alice',initials:'A',hue:140,rewards:{}}]}};
  assert.equal(name,'classConnectBoard');
  if(data.action==='teacherGet')return {room,status,snapshot,allowedTypes,types};
  if(data.action==='start'){status={active:true,mode:data.mode,sessionId:'session-'+(++revision),revision:1,lastInput:Date.now(),activityWrittenAt:Date.now(),until:Date.now()+600000};snapshot={schemaVersion:2,theme:'light',objects:[],frames:[]};allowedTypes=data.allowedTypes;await broadcast();return {room,status};}
  if(data.action==='join')return {room,status,snapshot,allowedTypes};
  if(data.action==='publish'){assert.equal(data.expectedRevision,status.revision);snapshot=structuredClone(data.snapshot);const entries=interactions.manifest(snapshot);cloud={...(cloud||{sessionId:status.sessionId,total:0,activities:{},receipts:[],lastByStudent:{}}),entries};status={...status,revision:status.revision+1,hasBoardInteractions:!!entries.length};await broadcast();return {status,warnings:[]};}
  if(data.action==='boardWord'){clock+=2100;cloud=interactions.add(cloud,interactions.manifest(snapshot),data.studentId,interactions.request(data),clock)||cloud;await broadcast();return {accepted:true,word:data.word.toLowerCase()};}
  if(data.action==='end'){status={...status,active:false};await broadcast();return {status};}
  if(data.action==='activity'){status={...status,lastInput:Date.now(),activityWrittenAt:Date.now(),until:Date.now()+600000};await broadcast();return {status};}
  throw Error('Unexpected action '+data.action);
 });
 await context.route('**/*',route=>{
  const url=new URL(route.request().url()),pathname=url.pathname.replace(/^\/dev(?=\/)/,'');
  if(url.hostname==='www.gstatic.com'){
   const body=url.pathname.endsWith('firebase-app.js')?'const app={name:"[DEFAULT]"};export const initializeApp=()=>app;export const getApps=()=>[app];':url.pathname.endsWith('firebase-firestore.js')?'export const getFirestore=()=>({});export const doc=(_,collection)=>({collection});export function onSnapshot(ref,options,next){window.__listeners??=new Map();if(!window.__listeners.has(ref.collection))window.__listeners.set(ref.collection,new Set());const set=window.__listeners.get(ref.collection);set.add(next);window.__push=(key,value)=>{for(const f of window.__listeners.get(key)||[])f({data:()=>value})};next({data:()=>ref.collection==="_classConnectRooms"?window.__currentRoom:window.__cloud});return()=>set.delete(next)}':'export const getFunctions=()=>({});export const httpsCallable=(_,name)=>async data=>({data:await window.__boardCall(name,data)});';
   return route.fulfill({contentType:'text/javascript',body});
  }
  if(pathname==='/host.html')return route.fulfill({contentType:'text/html',body:'<!doctype html><link rel="stylesheet" href="class-connect/boards.css"><script type="module" src="class-connect/boards.js"></script>'});
  if(url.pathname.endsWith('firebase-auth.js'))return route.fulfill({body:'',contentType:'text/javascript'});
  if(url.pathname.includes('board-gate')||url.pathname.includes('portal-access'))gateRequests++;
  if(url.pathname.endsWith('/shopManagement'))return route.fulfill({json:{revision:0,products:{},bundles:{},sales:{},banners:{hidden:[],removed:[],custom:[]},serverTime:Date.now()}});
  if(url.hostname!=='tiles.test')return route.abort();
  if(deployed&&pathname==='/index.html')portalRequests++;
  const file=path.join(deployed&&['/index.html','/board.html'].includes(pathname)?builtRoot:root,decodeURIComponent(pathname));return fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({path:file}):route.fulfill({status:404,body:''});
 });
 const teacher=await context.newPage();pages.push(teacher);teacher.on('pageerror',e=>errors.push('Teacher: '+e.message));
 await teacher.goto(base+'host.html');await teacher.waitForFunction(()=>window.TeacherTilesBoardSessions);await teacher.evaluate(()=>{localStorage.setItem('parent-sentinel','untouched');TeacherTilesBoardSessions.teacher({classId:'c',name:'Owls'})});
 await teacher.screenshot({path:path.join(process.env.TEMP,'classconnect-session-setup.png')});await teacher.getByRole('button',{name:'Start Session',exact:true}).click();
 const frame=teacher.frameLocator('iframe');await frame.locator('#workspace').waitFor();await teacher.waitForFunction(()=>document.querySelector('iframe')?.contentWindow.ClassConnectPolicy?.ready,{},{timeout:60000});
 const teacherFrame=teacher.frames()[1];await teacher.evaluate(()=>window.tileSkinIsOwned=()=>true);console.log('Teacher board loaded');
 async function checkViewport(page){assert(await page.locator('iframe').evaluate(frame=>{const r=frame.getBoundingClientRect();return Math.abs(r.left)<1&&Math.abs(r.top)<1&&Math.abs(r.width-innerWidth)<1&&Math.abs(r.height-innerHeight)<1&&getComputedStyle(frame).borderTopWidth==='0px';}));}
 await checkViewport(teacher);
 await teacher.getByRole('button',{name:'Enter Fullscreen',exact:true}).click();await teacher.waitForFunction(()=>!!document.fullscreenElement);await checkViewport(teacher);await teacher.getByRole('button',{name:'Exit Fullscreen',exact:true}).click();await teacher.waitForFunction(()=>!document.fullscreenElement);
 assert.equal(await teacherFrame.locator('#sandbox-access-gate,#portal-access-screen').count(),0);
 await teacher.screenshot({path:path.join(process.env.TEMP,'classconnect-teacher-corners.png')});

 await teacherFrame.evaluate(()=>{const b=TeacherTilesBoard.blank();const x=-b.camera.x/b.camera.scale+200,y=-b.camera.y/b.camera.scale+180;createModule('sticky',x,y);});
 await teacher.waitForFunction(()=>document.querySelector('.cc-session-status').textContent==='Students have the latest tiles',null,{timeout:15000}).catch(async e=>{console.log('Debug',errors,calls.map(x=>x.action),await teacher.locator('.cc-session-status').allTextContents());throw e});assert.equal(snapshot.objects.length,1);const sticky=snapshot.objects[0];
 const student=await context.newPage();pages.push(student);student.on('pageerror',e=>errors.push('Student: '+e.message));await student.addInitScript(s=>window.__currentRoom=s,status);
 await student.goto(base+'class-connect.html#'+token);await student.getByRole('button',{name:'Open Alice',exact:true}).click();assert(await student.getByRole('button',{name:'Enter Board',exact:true}).evaluate(el=>el.classList.contains('is-live')));await student.getByRole('button',{name:'Enter Board',exact:true}).click();
 await student.waitForFunction(()=>document.querySelector('iframe')?.contentWindow.ClassConnectPolicy?.ready,null,{timeout:60000});let studentFrame=student.frames()[1];
 assert.equal(await studentFrame.locator('.module[data-type="sticky"]').count(),1);console.log('Student board loaded');await checkViewport(student);assert.equal(await studentFrame.locator('#sandbox-access-gate,#portal-access-screen').count(),0);
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
 // Teachers can equip skins; students see the skin without customization controls.
 await teacherFrame.evaluate(()=>{const b=TeacherTilesBoard.capture();createModule('halloweentimer',-b.camera.x/b.camera.scale+700,-b.camera.y/b.camera.scale+220);});
 await studentFrame.locator('.module[data-type=halloweentimer]').waitFor({timeout:15000});
 const oldFace=await studentFrame.locator('.module[data-type=halloweentimer] .pumpkin-timer-face').innerHTML();
 const skin=await teacherFrame.evaluate(()=>{const skin=TILE_SKIN_CATALOG.find(s=>s.tileType==='halloweentimer');applyTileSkinToModule(document.querySelector('.module[data-type=halloweentimer]'),skin.id);return skin.id;});
 await studentFrame.locator('.module[data-tile-skin="'+skin+'"]').waitFor({timeout:15000});
 assert.notEqual(await studentFrame.locator('.module[data-type=halloweentimer] .pumpkin-timer-face').innerHTML(),oldFace);
 assert(await teacherFrame.locator('.module[data-type=halloweentimer] .tile-skins-toggle').evaluate(el=>getComputedStyle(el).display!=='none'));
 assert(await studentFrame.locator('.module[data-type=halloweentimer] .tile-skins-toggle').evaluate(el=>getComputedStyle(el).display==='none'));
 assert(await studentFrame.locator('.module[data-type=sticky] .tile-appearance-toggle').evaluate(el=>getComputedStyle(el).display==='none'));
 assert.equal(await studentFrame.evaluate(()=>{const m=document.querySelector('.module[data-type=halloweentimer]');applyTileSkinToModule(m,'');return m.dataset.tileSkin;}),skin);
 assert(await studentFrame.locator('.module[data-type=sticky]').evaluate(m=>{const a=m.getBoundingClientRect();return ['.module-fullscreen','.module-pin'].every(s=>{const r=m.querySelector(s).getBoundingClientRect();return r.right<=a.right&&r.left>a.left+a.width/2&&r.top<a.top+55;});}));
 assert(await studentFrame.locator('#cc-frame-profile').evaluate(el=>el.getBoundingClientRect().left===14));
 assert(await student.locator('.cc-session-fullscreen').evaluate(el=>innerWidth-el.getBoundingClientRect().right===14));
 const tileRect=await studentFrame.locator('.module[data-type=sticky]').boundingBox();await student.mouse.move(tileRect.x+tileRect.width-22,tileRect.y+22);await studentFrame.waitForTimeout(200);assert(await studentFrame.locator('.module[data-type=sticky] .module-pin').evaluate(el=>Number(getComputedStyle(el).opacity)>0));
 await student.screenshot({path:path.join(process.env.TEMP,'classconnect-controlled.png')});
 // Controlled interactive tiles become forms automatically; only the teacher listens to responses.
 await teacherFrame.evaluate(()=>{const b=TeacherTilesBoard.capture(),x=-b.camera.x/b.camera.scale+120,y=-b.camera.y/b.camera.scale+120;for(const [i,prompt]of ['Favorite subject?','How do you feel?'].entries()){const tile=createModule('wordcloud',x+i*660,y);tile.querySelector('.wordcloud-prompt').value=prompt;}notifyBoardChanged('questions');});
 await studentFrame.locator('.is-wordcloud-input').nth(1).waitFor({timeout:15000});const inputCloud=studentFrame.locator('.is-wordcloud-input').first();assert.equal(await inputCloud.locator('.wordcloud-connect:visible').count(),0);
 const beforeWords=calls.filter(c=>c.action==='publish').length;await inputCloud.getByRole('textbox',{name:'Your word',exact:true}).fill('Reading');await inputCloud.getByRole('button',{name:'Send Word',exact:true}).click();await inputCloud.getByText('Your word joined the cloud!',{exact:true}).waitFor();
 await teacher.bringToFront();await teacherFrame.locator('text[data-word=reading][data-count="1"]').waitFor();assert.equal(await teacherFrame.locator('.wordcloud-module').nth(1).locator('text[data-word=reading]').count(),0);
 assert.equal(await student.evaluate(()=>window.__listeners?.get('_classConnectClouds')?.size||0),0);assert.equal(await teacher.evaluate(()=>window.__listeners.get('_classConnectClouds').size),1);
 await new Promise(r=>setTimeout(r,1600));assert.equal(calls.filter(c=>c.action==='publish').length,beforeWords,'Responses must not republish the board');assert(snapshot.objects.filter(o=>o.type==='wordcloud').every(o=>o.special.words.length===0));
 await student.bringToFront();await studentFrame.locator('.is-wordcloud-input').nth(1).getByRole('textbox',{name:'Your word',exact:true}).fill('Happy');await studentFrame.locator('.is-wordcloud-input').nth(1).getByRole('button',{name:'Send Word',exact:true}).click();await teacher.bringToFront();await teacherFrame.locator('text[data-word=happy]').waitFor();
 await teacher.screenshot({path:path.join(process.env.TEMP,'controlled-wordcloud-teacher.png')});await student.bringToFront();await student.screenshot({path:path.join(process.env.TEMP,'controlled-wordcloud-student.png')});
 await teacherFrame.evaluate(()=>deleteModules([document.querySelector('.wordcloud-module')]));await studentFrame.waitForFunction(()=>document.querySelectorAll('.is-wordcloud-input').length===1,null,{timeout:15000});
 // A student leaving and reentering starts fresh, never restoring their work.
 await student.frames()[1].getByRole('button',{name:'Back to Profile',exact:true}).click();
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

 await teacher.getByRole('button',{name:'End Session',exact:true}).click();await student.locator('iframe').waitFor({state:'detached'});
 await teacher.getByRole('button',{name:'Back to Class',exact:true}).click();await student.getByRole('button',{name:'Enter Board',exact:true}).waitFor();
 await teacher.evaluate(()=>TeacherTilesBoardSessions.teacher({classId:'c',name:'Owls'}));await teacher.getByRole('button',{name:/Free Session Choose/}).click();await teacher.getByRole('button',{name:'dice',exact:true}).click();await teacher.getByRole('button',{name:'Start Session',exact:true}).click();
 await teacher.waitForFunction(()=>document.querySelector('iframe')?.contentWindow.ClassConnectPolicy?.ready,null,{timeout:60000});await student.getByRole('button',{name:'Enter Board',exact:true}).click();await student.waitForFunction(()=>document.querySelector('iframe')?.contentWindow.ClassConnectPolicy?.ready,null,{timeout:60000});
 const free=student.frames()[1];
 await student.mouse.click(300,250,{button:'right'});
 await free.locator('#context-menu.is-open').waitFor();
 assert.equal(await free.locator('#context-menu .context-menu__item:visible').count(),1);
 assert.equal(await free.locator('#context-menu .context-menu__item[data-coming-soon=true]:visible').count(),0);
 assert.equal(await free.locator('#context-menu .context-menu__section h3:visible,.context-menu__category-drawer:visible').count(),0);
 await free.locator('#context-menu input[type=search]').fill('nothing matches');
 assert.equal(await free.locator('#context-menu .context-menu__item:visible').count(),0);
 await free.locator('#context-menu input[type=search]').fill('dice');
 assert.equal(await free.locator('#context-menu .context-menu__item:visible').count(),1);
 await student.screenshot({path:path.join(process.env.TEMP,'classconnect-student-menu.png')});
 await free.locator('#context-menu .context-menu__close').click();
 await free.evaluate(()=>createModule('dice',500,500));assert.equal(await free.locator('.module[data-type="dice"]').count(),1);assert.equal(await free.evaluate(()=>createModule('sticky',500,500)),null);
 await free.evaluate(()=>deleteModules([...document.querySelectorAll('.module')]));assert.equal(await free.locator('.module').count(),0);
 assert.equal(await teacher.evaluate(()=>localStorage.getItem('parent-sentinel')),'untouched');
 assert.equal(await free.evaluate(()=>createStickerModule({emoji:'⭐'},200,200)),null);
 await student.setViewportSize({width:390,height:844});await checkViewport(student);await student.screenshot({path:path.join(process.env.TEMP,'classconnect-student-mobile-corners.png')});assert(await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 status={...status,until:Date.now()-1};await broadcast();await student.locator('iframe').waitFor({state:'detached'});
 assert(!await student.getByRole('button',{name:'Enter Board',exact:true}).evaluate(el=>el.classList.contains('is-live')));

 assert.equal(gateRequests,0);if(deployed)assert.equal(portalRequests,0);assert.deepEqual(errors,[]);console.log('Session browser checks passed: teacher editing, controlled restrictions, independent work, incremental updates, end session, free whitelist, isolated storage, automatic Word Cloud input tiles and isolated live responses.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
