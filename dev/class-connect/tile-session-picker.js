import {call,active,modal} from './boards.js?v=20261112-present-mode-connect';
import {preparePresentationExit} from './presentation-exit.js?v=20261110-presentation-lifecycle';
const make=(tag,cls='',text='')=>{const el=document.createElement(tag);el.className=cls;el.textContent=text;return el;};
const button=(label,action)=>{const el=make('button','cc-session-button',label);el.type='button';el.onclick=action;return el;};
const isNormal=tile=>tile?.isConnected&&!window.ClassConnectPolicy&&!tile.dataset.presentationEmbedded;
export async function openTileSession(tile,{getInfo,key,startData,connect}){
 if(!isNormal(tile))return;if(tile._classConnectDialog?.open){tile._classConnectDialog.focus();return;}
 const info=getInfo();if(!info)throw Error('Choose the tile content first.');
 const dialog=modal('ClassConnect');dialog.classList.add('cc-presentation-dialog');const body=make('div','cc-presentation-options'),status=make('p','cc-session-status');dialog.append(body,status);if(document.fullscreenElement)document.fullscreenElement.append(dialog);tile._classConnectDialog=dialog;
 const refresh=()=>{if(dialog.open)liveView();};
 const account=window.TeacherTilesAuth?.user?.uid;
 const auth=()=>{if(account!==window.TeacherTilesAuth?.user?.uid)dialog.close();};window.addEventListener('teachertiles:authchange',auth);
 tile.addEventListener('teachertiles:presentation-connection',refresh);
 dialog.addEventListener('close',()=>{tile.removeEventListener('teachertiles:presentation-connection',refresh);window.removeEventListener('teachertiles:authchange',auth);delete tile._classConnectDialog;},{once:true});
 function liveView(){body.classList.remove('cc-tool-grid');body.replaceChildren();const connection=tile._classConnectSession;if(!connection){options();return;}body.append(make('strong','',connection.name),make('p','','Your class can join from Enter Board.'),button('End Session',async()=>{await connection.end();if(!tile._classConnectSession)dialog.close();else liveView();}));if(connection.problem)body.append(button('Retry Sync',()=>connection.retry()));status.textContent=connection.problem||'The session is live for this class.';}
 function options(){
  body.replaceChildren();body.classList.add('cc-tool-grid');status.textContent='';
  const card=(label,description,path,action)=>{const b=button('',action);b.classList.add('cs-button','cc-tool-card');const icon=make('span','cs-icon');icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+path+'</svg>';const copy=make('span','cc-tool-copy');copy.append(make('strong','',label),make('small','',description));b.append(icon,copy);return b;};
  const join=card('Join Code','Coming Soon','<path d="M9 3 7 21M17 3l-2 18M4 9h17M3 15h17"/>',()=>{});join.disabled=true;
  const connect=card('ClassConnect','Start a class session','<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v4M8 21h8M10 7.5l6 3-6 3Z"/>',chooseClass);body.append(join,connect);
 }
 function chooseClass(){
  body.classList.remove('cc-tool-grid');body.replaceChildren();status.textContent='Choose a class for this session.';
  const classes=window.readClassRosters?.()||[],grid=make('div','cc-presentation-classes');
  for(const roster of classes){const pick=button('',()=>start(roster,pick)),avatar=make('span','cc-presentation-class-avatar');if(roster.logoImage){const img=make('img');img.src=roster.logoImage;img.alt='';avatar.append(img);}else avatar.textContent=roster.logo||'👥';pick.append(avatar,make('strong','',roster.name),make('small','',roster.students.length+' students'));grid.append(pick);}
  body.append(grid);if(!classes.length)body.append(make('p','','Create a class in Class View to start a session.'));
 }
 async function start(roster,pick){
  let exit;
  body.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent='Starting class session…';
  try{
   await window.TeacherTilesClassConnectUI.ensureLink(roster.id);
   if(!dialog.open||!isNormal(tile)||account!==window.TeacherTilesAuth?.user?.uid)return;
   const latest=getInfo();if(key(latest)!==key(info))throw Error('The tile changed. Reopen ClassConnect.');
   exit=await preparePresentationExit(window.TeacherTilesAuth?.user);
   const result=await call({action:'start',classId:roster.id,...startData(latest),requestId:pick.dataset.requestId||(pick.dataset.requestId=crypto.randomUUID())});
   if(!dialog.open||!isNormal(tile)||account!==window.TeacherTilesAuth?.user?.uid||key(getInfo())!==key(info)){await call({action:'end',classId:roster.id,sessionId:result.status.sessionId});return;}
   connect(tile,roster.id,roster.name,result,exit);exit=null;dialog.close();
  }catch(error){
   status.textContent=error.message||'Could not start the class session.';body.querySelectorAll('button').forEach(b=>b.disabled=false);
   if(error.code==='functions/already-exists'&&!body.querySelector('.cc-end-existing')){const end=button('End Current Session',async()=>{end.disabled=true;try{const current=await call({action:'teacherGet',classId:roster.id});if(active(current.status))await call({action:'end',classId:roster.id,sessionId:current.status.sessionId});end.remove();status.textContent='Current session ended. Select the class again to start the session.';}catch(e){status.textContent=e.message;end.disabled=false;}});end.classList.add('cc-end-existing');body.append(end);}
  }finally{exit?.dispose();}
 }
 if(tile._classConnectSession)liveView();else options();
}
