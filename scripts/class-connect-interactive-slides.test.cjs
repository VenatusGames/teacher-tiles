const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const logic=require('../../teachertiles-functions-dev/functions/firebase-service/class-connect-interactions');
const root=process.cwd(),base='https://tiles.test/',token='t'.repeat(43),room='a'.repeat(64);
const cloudElement=(id,prompt,x=90,w=360)=>({id,type:'tile',tileType:'wordcloud',x,y:95,w,h:210,tileState:{dataset:{font:'inter'},special:{prompt}}});
const title=(text)=>({id:'title',type:'text',x:50,y:25,w:850,h:80,text,fontSize:42,color:'#263249',align:'center'});
const deck={schemaVersion:1,title:'Interactive Lesson',theme:'none',slides:[{id:'one',background:'#fff',elements:[title('Our class ideas'),cloudElement('a','How are you feeling?'),cloudElement('b','What helps you learn?',510),{...cloudElement('response','Explain your reasoning',155,650),tileType:'respond',y:310,h:225}]},{id:'two',background:'#fff',elements:[title('Next question'),cloudElement('a','What did we learn?',200,560)]},{id:'three',background:'#fff',elements:[title('All done')]}]},entries=logic.manifest(deck);
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const context=await browser.newContext({viewport:{width:1400,height:900}}),pages=[],errors=[];let status=null,cloud=null,projection=null,now=Date.now(),saved=0;
 const push=async()=>{for(const p of pages)await p.evaluate(({status,projection,cloud})=>{window.__data={_classConnectClouds:cloud,_classConnectRooms:status,_classConnectPresentationWords:projection};for(const [key,value]of Object.entries(window.__data).reverse())window.__push?.(key,value);},{status,projection,cloud}).catch(()=>{});};
 await context.exposeBinding('__api',async(_,name,data)=>{
  if(name==='classConnectView')return {boardRoom:room,view:{name:'Owls',students:[{id:'alice',name:'Alice',initials:'A',hue:140,rewards:{}}]}};
  if(name==='presentations'){if(data.action==='load')return {title:deck.title,document:structuredClone(deck),revision:2};if(data.action==='list')return {items:[{id:'lesson',title:deck.title,slideCount:3,updatedAt:1}],cursor:null};if(data.action==='save'){saved++;return {revision:3};}throw Error('Unexpected presentation action '+data.action);}
  assert.equal(name,'classConnectBoard');
  if(data.action==='start'){status={active:true,mode:'presentation',hasInteractions:true,sessionId:'live',revision:1,slideCount:3,slideIndex:data.slideIndex,until:Date.now()+600000};cloud={entries,activities:{},receipts:[],lastByStudent:{},total:0,sessionId:'live',expiresAt:new Date(Date.now()+86400000)};projection=logic.projection(cloud,entries,status.slideIndex,status.until);await push();return {room,status};}
  if(data.action==='join')return {room,status,presentation:structuredClone(deck)};
  if(data.action==='teacherGet')return {room,status};
  if(data.action==='slide'){assert.equal(data.expectedRevision,status.revision);status={...status,revision:status.revision+1,slideIndex:data.slideIndex};projection=logic.projection(cloud,entries,status.slideIndex,status.until);await push();return {status};}
  if(data.action==='submitResponse'||data.action==='displayResults'){
   const entry=entries.find(e=>e.index===status.slideIndex&&e.elementId===data.elementId);assert(entry);
   const item=(cloud.activities[entry.key]||={});
   if(data.action==='submitResponse')item.answers=[...Array.from({length:14},(_,i)=>({name:'Classmate '+i,text:'Another observation '+(i+1)})),{name:'Alice',text:data.answer}];
   else if(data.control==='focus')cloud.focusKey=data.enabled?entry.key:'';
   else item.shared=data.enabled;
   projection=logic.projection(cloud,entries,status.slideIndex,status.until);await push();return {accepted:true};
  }
  if(data.action==='presentationWord'){now+=2100;cloud=logic.add(cloud,entries,status.slideIndex,data.studentId,logic.request(data),now)||cloud;projection=logic.projection(cloud,entries,status.slideIndex,status.until);await push();return {accepted:true,word:data.word.toLowerCase()};}
  if(data.action==='end'){status={...status,active:false};projection=null;await push();return {status};}throw Error('Unexpected action '+data.action);
 });
 await context.route('**/*',async route=>{const u=new URL(route.request().url());
  if(u.hostname==='www.gstatic.com'){const body=u.pathname.endsWith('firebase-app.js')?'const app={name:"[DEFAULT]"};export const getApps=()=>[app];export const initializeApp=()=>app;':u.pathname.endsWith('firebase-firestore.js')?'export const getFirestore=()=>({});export const doc=(_,collection)=>({collection});export function onSnapshot(ref,options,next){window.__streams??=new Map();if(!window.__streams.has(ref.collection))window.__streams.set(ref.collection,new Set());const set=window.__streams.get(ref.collection);set.add(next);window.__push=(key,value)=>{for(const f of window.__streams.get(key)||[])f({data:()=>value})};next({data:()=>window.__data?.[ref.collection]});return()=>set.delete(next)}':'export const getFunctions=()=>({});export const httpsCallable=(_,name)=>async data=>({data:await window.__api(name,data)});';return route.fulfill({contentType:'text/javascript',body});}
  if(u.pathname.endsWith('/shopManagement'))return route.fulfill({json:{revision:0,products:{},bundles:{},sales:{},banners:{hidden:[],removed:[],custom:[]},serverTime:Date.now()}});
  if(u.hostname!=='tiles.test')return route.abort();const file=path.join(root,decodeURIComponent(u.pathname));if(!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:''});
  if(u.pathname==='/index.html')return route.fulfill({contentType:'text/html',body:fs.readFileSync(file,'utf8').replace(/<script[^>]+src="(?:firebase-auth|sandbox\/board-gate)[^"]*"[^>]*><\/script>/g,'')});return route.fulfill({path:file});
 });
 const teacher=await context.newPage();pages.push(teacher);teacher.on('pageerror',e=>errors.push(e.message));await teacher.addInitScript(()=>{window.TeacherTilesAuth={user:{uid:'owner',getIdToken:async()=>'test-token'},call:async(name,data)=>({data:await window.__api(name,data)})};});await teacher.goto(base+'index.html');await teacher.waitForFunction(()=>window.TeacherTilesPresentations&&window.TeacherTilesBoardSessions);
 await teacher.addScriptTag({url:base+'presentations/files.js'});
 await teacher.addScriptTag({url:base+'presentations/vendor/jszip-3.10.1.min.js'});
 await teacher.addScriptTag({url:base+'presentations/vendor/pptxgen-4.0.1.min.js'});
 const imported=await teacher.evaluate(async()=>{
  const ppt=new PptxGenJS();ppt.layout='LAYOUT_WIDE';ppt.addSlide().addText('Our class ideas',{x:.5,y:.2,w:8,h:.5});
  const file=new File([await ppt.write({outputType:'arraybuffer'})],'Interactive Lesson.pptx');
  return (await TeacherTilesPresentationFiles.importFile(file)).document.slides[0];
 });
 assert(imported.elements.some(e=>e.text==='Our class ideas'));
 deck.slides[0].elements=[...imported.elements,...deck.slides[0].elements.filter(e=>e.type==='tile')];
 await teacher.evaluate(()=>{document.getElementById('teachertiles-intro')?.remove();document.getElementById('profile-modal').hidden=true;window.readClassRosters=()=>[{id:'class',name:'Owls',logo:'🦉',students:['Alice']}];TeacherTilesClassConnectUI.ensureLink=async()=>({active:true});TeacherTilesBoard.load(TeacherTilesBoard.blank());Object.assign(boardCamera,{x:0,y:0,scale:1});applyBoardCamera();createModule('presentation',500,150,{record:false})._boardSetState({presentationId:'lesson'});});
 const tile=teacher.locator('.presentation-module');await teacher.waitForFunction(()=>document.querySelector('.presentation-tile-count')?.textContent==='1 / 3');await tile.hover();await tile.getByRole('button',{name:'ClassConnect presentation',exact:true}).click();await teacher.getByRole('button',{name:/ClassConnect Start a class session/}).click();await teacher.getByRole('button',{name:/Owls.*1 students/}).click();await teacher.waitForFunction(()=>document.querySelector('.presentation-module')._classConnectSession?.active);
 const student=await context.newPage();pages.push(student);student.on('pageerror',e=>errors.push(e.message));await student.addInitScript(data=>window.__data=data,{_classConnectRooms:status,_classConnectPresentationWords:projection});await student.goto(base+'class-connect.html#'+token);await student.getByRole('button',{name:'Open Alice',exact:true}).click();await student.getByRole('button',{name:'Enter Board',exact:true}).click();
 const viewer=student.locator('.cc-presentation-viewer'),slide=viewer.locator('.cc-presentation-slide:not(.pres-transition-outgoing)'),a=slide.locator('[data-object=a]'),b=slide.locator('[data-object=b]');await a.getByRole('textbox',{name:'Your word',exact:true}).waitFor();
 async function send(object,word){await object.getByRole('textbox',{name:'Your word',exact:true}).fill(word);await object.getByRole('button',{name:'Send Word',exact:true}).click();}
 await send(a,'Happy');await a.locator('text[data-word=happy][data-count="1"]').waitFor();assert.equal(await b.locator('text[data-word=happy]').count(),0);assert.equal(status.slideIndex,0);
 await teacher.bringToFront();await tile.locator('text[data-word=happy][data-count="1"]').waitFor();await teacher.screenshot({path:path.join(process.env.TEMP,'interactive-presentation-teacher.png')});await student.bringToFront();await send(a,'HAPPY');await a.locator('text[data-word=happy][data-count="2"]').waitFor();await send(b,'Reading');await b.locator('text[data-word=reading]').waitFor();assert.equal(await a.locator('text[data-word=reading]').count(),0);await student.screenshot({path:path.join(process.env.TEMP,'interactive-presentation-student.png')});
 await teacher.bringToFront();await tile.locator('[data-object=a]').getByRole('button',{name:'Fullscreen Results'}).click();
 const cloudFocus=student.getByRole('dialog',{name:'ClassConnect results'});await student.bringToFront();await cloudFocus.locator('text[data-word=happy]').waitFor();
 await teacher.bringToFront();await teacher.getByRole('button',{name:'Return to Slide'}).click();await student.bringToFront();await cloudFocus.waitFor({state:'detached'});
 await tile.locator('[data-player=next]').evaluate(e=>e.click());await slide.getByText('What did we learn?',{exact:true}).waitFor();assert.equal(await slide.locator('text[data-word=happy]').count(),0);await send(a,'Fractions');await a.locator('text[data-word=fractions]').waitFor();await tile.locator('[data-player=previous]').evaluate(e=>e.click());await slide.getByText('How are you feeling?',{exact:true}).waitFor();await a.locator('text[data-word=happy][data-count="2"]').waitFor();assert.equal(await slide.locator('text[data-word=fractions]').count(),0);
 await tile.locator('[data-player=next]').evaluate(e=>e.click());await slide.getByText('What did we learn?',{exact:true}).waitFor();await tile.locator('[data-player=next]').evaluate(e=>e.click());await slide.getByText('All done',{exact:true}).waitFor();assert.equal(await student.evaluate(()=>window.__streams?.get('_classConnectPresentationWords')?.size||0),0);
 await teacher.evaluate(()=>document.querySelector('.presentation-module')._classConnectSession.end());await viewer.waitFor({state:'detached'});assert.equal(await student.evaluate(()=>window.__streams?.get('_classConnectPresentationWords')?.size||0),0);
 await teacher.bringToFront();await teacher.evaluate(()=>TeacherTilesPresentations.open());await teacher.getByRole('button',{name:'Open Interactive Lesson',exact:true}).click();const canvas=teacher.locator('.pres-canvas');await canvas.waitFor();await canvas.click({button:'right',position:{x:20,y:20}});const menu=teacher.locator('.pres-menu');assert(await menu.getByRole('menuitem',{name:'Tables & Charts Coming Soon',exact:true}).isDisabled());assert.equal(await menu.getByText('Charts',{exact:true}).count(),0);await menu.locator('[data-action=tile]').click();assert.equal(await menu.locator('[data-tile-choice]').count(),0);await menu.getByRole('menuitem',{name:'Basic',exact:true}).click();assert(await menu.locator('[data-tile-choice=clock]').count());assert.equal(await menu.locator('[data-tile-choice=wordcloud]').count(),0);await menu.getByRole('menuitem',{name:'Back to tile categories',exact:true}).click();await menu.getByRole('menuitem',{name:'Interactive',exact:true}).click();assert.equal(await menu.locator('[data-tile-choice]').count(),2);assert.equal(await menu.locator('[data-tile-choice=respond]').count(),1);await menu.locator('[data-tile-choice=wordcloud]').click();await canvas.locator('.wordcloud-module').last().waitFor();assert.equal(await canvas.locator('.wordcloud-connect:visible').count(),0);assert(await canvas.locator('.wordcloud-module').last().locator('.tile-appearance-toggle').count());await teacher.screenshot({path:path.join(process.env.TEMP,'interactive-presentation-editor.png')});assert.deepEqual(errors,[]);
 // Present directly from the editor, including saved edits and live interactive responses.
 await teacher.locator('[data-action=present]').click();
 const tool=teacher.locator('#presentations-tool'),connect=tool.locator('[data-action=classconnect]');
 await teacher.waitForFunction(()=>document.fullscreenElement?.id==='presentations-tool');await connect.focus();await teacher.keyboard.press('Space');await teacher.getByRole('dialog',{name:'ClassConnect',exact:true}).waitFor();assert(saved>0,'Starting from present mode saves pending edits');
 await teacher.getByRole('button',{name:/ClassConnect Start a class session/}).click();await teacher.getByRole('button',{name:/Owls.*1 students/}).click();
 await teacher.waitForFunction(()=>document.getElementById('presentations-tool')._classConnectSession?.active);
 assert.equal(await connect.textContent(),'');assert.match(await connect.getAttribute('aria-label'),/Live/);assert.equal(status.slideIndex,0);
 await student.bringToFront();await student.getByRole('button',{name:'Enter Board',exact:true}).click();await a.getByRole('textbox',{name:'Your word',exact:true}).waitFor();await send(a,'Together');await a.locator('text[data-word=together]').waitFor();
 await teacher.bringToFront();await canvas.locator('text[data-word=together]').waitFor();
 const response=slide.locator('[data-object=response]'),teacherResponse=canvas.locator('[data-object=response]');
 await student.bringToFront();await response.getByRole('textbox',{name:'Your response'}).fill('Evidence from the reading.');
 await response.getByRole('button',{name:'Send Response'}).click();await response.getByText('Response submitted').waitFor();
 assert.equal(await response.locator('.respond-answer').count(),0);
 await teacher.bringToFront();await teacherResponse.getByText('Evidence from the reading.',{exact:false}).waitFor();
 await teacherResponse.getByRole('button',{name:'Show Responses to Students'}).click();
 await student.bringToFront();await response.getByText('Evidence from the reading.',{exact:true}).waitFor();
 assert(await response.locator('.respond-results').evaluate(list=>{list.scrollTop=list.scrollHeight;return list.scrollTop>0;}),'Students can scroll through shared answers');
 await teacher.bringToFront();await teacherResponse.getByRole('button',{name:'Fullscreen Results'}).click();
 const focus=student.getByRole('dialog',{name:'ClassConnect results'});await student.bringToFront();await focus.getByText('Evidence from the reading.',{exact:true}).waitFor();
 assert.equal(await focus.getByText('Alice',{exact:true}).count(),0);
 await teacher.bringToFront();await teacher.getByRole('button',{name:'Return to Slide'}).click();await student.bringToFront();await focus.waitFor({state:'detached'});
 await teacher.bringToFront();await teacherResponse.getByRole('button',{name:'Hide Responses'}).click();
 await student.bringToFront();await response.locator('.respond-answer').waitFor({state:'detached'});
 await teacher.bringToFront();
 await connect.click();assert.equal(status.slideIndex,0,'Opening session controls must not advance the slide');await teacher.getByRole('button',{name:'Close ClassConnect',exact:true}).click();
 await tool.locator('[data-action=next]').click();await student.bringToFront();await slide.getByText('What did we learn?',{exact:true}).waitFor();
 await teacher.bringToFront();await teacher.screenshot({path:path.join(process.env.TEMP,'presentation-tool-classconnect.png')});await tool.locator('[data-action=stop-present]').click();await viewer.waitFor({state:'detached'});assert.equal(status.active,false);await teacher.waitForFunction(()=>!document.getElementById('presentations-tool')._classConnectSession);
 assert.deepEqual(errors,[]);
 console.log('PASS: PowerPoint import, interactive tile menu, Word Cloud, one-time Respond! form, private teacher results, anonymous sharing, audience fullscreen, slide navigation and session cleanup.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
