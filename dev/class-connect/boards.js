import {getApps,initializeApp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js';
import {getFirestore,doc,onSnapshot} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {firebaseConfig} from '../firebase-config.js';
import {boardFrame} from './board-host.js?v=20261110-sessions';
const app=getApps().find(a=>a.name==='[DEFAULT]')||initializeApp(firebaseConfig),db=getFirestore(app),invoke=httpsCallable(getFunctions(app),'classConnectBoard',{timeout:20000});
const call=async data=>(await invoke(data)).data;
const make=(tag,cls='',text='')=>{const el=document.createElement(tag);el.className=cls;el.textContent=text;return el;};
const button=(text,action)=>{const b=make('button','cc-session-button',text);b.type='button';b.onclick=action;return b;};
export const active=s=>s?.active===true&&Number(s.until)>Date.now();
export function watchRoom(room,change){
 let off=null,expiry=0,closed=false;
 const stop=()=>{off?.();off=null;clearTimeout(expiry);};
 const start=()=>{stop();if(closed||document.hidden)return;off=onSnapshot(doc(db,'_classConnectRooms',room),{includeMetadataChanges:true},snap=>{if(snap.metadata?.fromCache)return;const s=snap.data()||null;change(s);clearTimeout(expiry);if(s?.active)expiry=setTimeout(()=>change({...s,active:false}),Math.max(0,Number(s.until)-Date.now())+50);},()=>change(null));};
 const visible=()=>document.hidden?stop():start();document.addEventListener('visibilitychange',visible);start();return ()=>{closed=true;stop();document.removeEventListener('visibilitychange',visible);};
}
function modal(title){const dialog=make('dialog','cc-session-dialog'),head=make('header'),heading=make('h2','',title),close=button('×',()=>dialog.close());close.setAttribute('aria-label','Close '+title);head.append(heading,close);dialog.setAttribute('aria-label',title);dialog.append(head);document.body.append(dialog);dialog.showModal();dialog.addEventListener('close',()=>dialog.remove(),{once:true});return dialog;}
async function launch({teacher,classId,token,student,roster,session,getProfile,result}){
 const dialog=modal(result.status.mode==='controlled'?'Controlled Session':'Free Session');dialog.classList.add('cc-session-board');
 const head=dialog.querySelector('header'),close=head.lastElementChild,status=make('p','cc-session-status','Opening board…'),holder=make('div','cc-session-stage is-loading');dialog.append(status,holder);status.setAttribute('role','status');
 const opening=new AbortController(),ownerUid=window.TeacherTilesAuth?.user?.uid;
 const accountChanged=()=>{if(teacher&&window.TeacherTilesAuth?.user?.uid!==ownerUid)dialog.close();};
 const linkChanged=()=>{if(!teacher)dialog.close();};
 window.addEventListener('teachertiles:authchange',accountChanged);window.addEventListener('hashchange',linkChanged);
 let model=result.status,frame=null,off=null,closed=false,pending=null,saving=null,saveTimer=0,inputTimer=0,lastInput=0,loading=false,loadedRevision=model.revision,failed=false,ended=false,lastQueued='';
 const credentials=teacher?{classId}:{token,studentId:student.id,session};
 const unavailable=message=>{if(!ended)frame?.stop();ended=true;status.textContent=message;holder.inert=true;holder.classList.add('is-ended');retry.hidden=true;};
 const send=async()=>{
  clearTimeout(saveTimer);if(saving)return saving;if(!pending||closed||ended||!active(model))return;
  saving=(async()=>{
   while(pending&&!closed&&!ended){
    const snapshot=pending;pending=null;failed=false;status.textContent='Updating student boards…';
    try{const data=await call({...credentials,action:'publish',sessionId:model.sessionId,expectedRevision:loadedRevision,snapshot});if(closed)return;
     model=data.status;loadedRevision=model.revision;status.textContent='Students have the latest tiles';retry.hidden=true;
    }catch(e){failed=true;pending=pending||snapshot;retry.hidden=false;status.textContent=e.message||'Could not share changes. Choose Retry.';
     if(e.code==='functions/aborted'||e.code==='functions/failed-precondition')unavailable(e.message);break;
    }
   }
  })();try{await saving;}finally{saving=null;}
 };
 const retry=button('Retry',()=>void send());retry.hidden=true;head.insertBefore(retry,close);
 const finish=async()=>{
  if(close.disabled)return;close.disabled=true;
  if(teacher&&!ended){if(frame&&model.mode==='controlled'){const snapshot=frame.snapshot(),signature=JSON.stringify(snapshot);if(signature!==lastQueued){lastQueued=signature;pending=snapshot;}}await send();if(pending||failed){close.disabled=false;status.textContent='Changes are not shared yet. Retry, or end the session to discard them.';return;}}
  dialog.close();
 };
 close.onclick=finish;close.textContent=teacher?'Back to Class':'Back to Profile';close.setAttribute('aria-label',close.textContent);
 dialog.addEventListener('cancel',e=>{e.preventDefault();void finish();});
 if(teacher){const end=button('End Session',async()=>{end.disabled=true;try{if(saving)await saving;await call({...credentials,action:'end',sessionId:model.sessionId});pending=null;unavailable('Session ended');end.remove();close.disabled=false;}catch(e){status.textContent=e.message;end.disabled=false;}});end.classList.add('cc-session-danger');head.insertBefore(end,close);}
 const scheduleInput=()=>{
  if(inputTimer||closed||teacher||ended||!active(model)||lastInput<=model.lastInput)return;
  const previousWrite=model.activityWrittenAt;
  inputTimer=setTimeout(async()=>{
   inputTimer=0;if(closed||document.hidden||ended||!active(model)||lastInput<=model.lastInput)return;
   // Another student already renewed the room. Wait for its next reporting window.
   if(model.activityWrittenAt!==previousWrite){scheduleInput();return;}
   try{const response=await call({...credentials,action:'activity',sessionId:model.sessionId,inputAgeMs:Math.max(0,Date.now()-lastInput)});if(!closed&&response.status.sessionId===model.sessionId)model=response.status;}
   catch(e){if(['functions/permission-denied','functions/failed-precondition','functions/not-found','functions/aborted'].includes(e.code))unavailable(e.message);}
   scheduleInput();
  },Math.max(1500,Number(model.activityWrittenAt)+30000-Date.now())+Math.random()*5000);
 };
 const activity=()=>{lastInput=Date.now();scheduleInput();};
 const beforeLeave=e=>{if(teacher&&(pending||saving)){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',beforeLeave);
 dialog.addEventListener('close',()=>{closed=true;opening.abort();clearTimeout(saveTimer);clearTimeout(inputTimer);off?.();window.removeEventListener('beforeunload',beforeLeave);window.removeEventListener('teachertiles:authchange',accountChanged);window.removeEventListener('hashchange',linkChanged);frame?.close();getProfile?.();},{once:true});
 const refresh=async()=>{
  if(loading||saving||closed||ended||model.mode!=='controlled'||model.revision<=loadedRevision)return;
  if(teacher&&pending){unavailable('This board changed in another teacher window. Reopen the session.');return;}
  loading=true;
  try{while(!closed&&!ended&&model.revision>loadedRevision){const data=await call({...credentials,action:teacher?'teacherGet':'join',sessionId:model.sessionId});
   if(closed)return;if(!active(data.status)||data.status.sessionId!==model.sessionId){unavailable('This board session has ended.');return;}
   frame.update(data.snapshot);loadedRevision=data.status.revision;status.textContent='Board updated';
  }}catch(e){unavailable(e.message);}finally{loading=false;}
 };
 try{
  frame=await boardFrame(holder,{teacher,roster,signal:opening.signal,mode:model.mode,allowedTypes:teacher&&model.mode==='controlled'?result.types:result.allowedTypes,student:teacher?null:student,onProfile:()=>void finish(),onInput:activity,onChange:snapshot=>{
   if(teacher&&model.mode==='controlled'&&!ended){const signature=JSON.stringify(snapshot);if(signature===lastQueued)return;lastQueued=signature;pending=snapshot;status.textContent='Changes waiting to share…';clearTimeout(saveTimer);saveTimer=setTimeout(send,1200);}
  }});
  if(closed){frame.close();return;}
  frame.update(result.snapshot);
  if(teacher)lastQueued=JSON.stringify(frame.snapshot());
  holder.classList.remove('is-loading');
  status.textContent=teacher?(model.mode==='controlled'?'Changes you make here appear on student boards.':'Students create their own boards using the tiles you selected.'):'Your work is temporary and is cleared when you leave this board.';
  if(!teacher)activity();
  off=watchRoom(result.room,next=>{
   if(closed)return;if(!active(next)||next.sessionId!==model.sessionId){unavailable('This board session has ended.');return;}
   model=next;scheduleInput();void refresh();
  });
 }catch(e){holder.classList.remove('is-loading');status.textContent=e.message||'Could not open the board. Close and try again.';}
}
export async function enterStudentBoard({token,student,roster,session,getProfile}){
 const result=await call({action:'join',token,studentId:student.id,session});await launch({teacher:false,token,student,roster,session,getProfile,result});
}
export async function teacherBoard({classId,name,roster}){
 const dialog=modal('Board Session'),body=make('div','cc-session-setup'),status=make('p','cc-session-status','Loading session…');dialog.append(body,status);
 let result;try{result=await call({action:'teacherGet',classId});}catch(e){status.textContent=e.message;return;}if(!dialog.isConnected)return;
 if(active(result.status)){
  body.append(make('h3','',name),make('p','',result.status.mode==='controlled'?'Controlled Session is active':'Free Session is active'));
  body.append(button('Open Session Board',()=>{dialog.close();void launch({teacher:true,classId,roster,result});}),button('End Session',async()=>{try{await call({action:'end',classId,sessionId:result.status.sessionId});dialog.close();}catch(e){status.textContent=e.message;}}));status.textContent='Sessions end after 10 minutes without student input.';return;
 }
 let mode='controlled';const choices=make('div','cc-session-modes'),selection=make('section','cc-session-selection'),search=make('input'),grid=make('div','cc-session-tiles');selection.hidden=true;search.type='search';search.placeholder='Search available tiles…';search.setAttribute('aria-label','Search available tiles');selection.append(search,grid);
 const selected=new Set(),catalog=result.types.map(type=>{const item=document.querySelector(`.context-menu__item[data-module="${CSS.escape(type)}"]`);return {type,name:item?.querySelector('strong')?.textContent||type,icon:item?.querySelector('.context-menu__icon')?.cloneNode(true)};}).sort((a,b)=>a.name.localeCompare(b.name));
 const list=()=>{grid.replaceChildren();for(const item of catalog.filter(x=>x.name.toLowerCase().includes(search.value.toLowerCase()))){const b=button('',()=>{if(selected.has(item.type))selected.delete(item.type);else selected.add(item.type);list();});b.classList.add('cc-session-tile');b.setAttribute('aria-pressed',String(selected.has(item.type)));if(item.icon)b.append(item.icon.cloneNode(true));b.append(make('span','',item.name));grid.append(b);}};search.oninput=list;list();
 for(const [key,title,description]of [['controlled','Controlled Session','You place the tiles. Each student uses their own copy.'],['free','Free Session','Choose which tiles students can add to their own boards.']]){const b=button('',()=>{mode=key;choices.querySelectorAll('button').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));selection.hidden=mode!=='free';});b.setAttribute('aria-pressed',String(key===mode));b.append(make('strong','',title),make('small','',description));choices.append(b);}
 const requestId=crypto.randomUUID(),start=button('Start Session',async()=>{start.disabled=true;status.textContent='Starting session…';try{const started=await call({action:'start',classId,requestId,mode,allowedTypes:mode==='free'?[...selected]:result.types});const ready=await call({action:'teacherGet',classId,sessionId:started.status.sessionId});if(dialog.isConnected){dialog.close();void launch({teacher:true,classId,roster,result:ready});}}catch(e){status.textContent=e.message;start.disabled=false;}});
 body.append(choices,selection,make('p','cc-session-status','Presentation and Lesson Planner library tiles are not available in sessions yet.'),start);status.textContent='Ends automatically after 10 minutes without student input.';
}
window.TeacherTilesBoardSessions={teacher:teacherBoard};
