import {attachResponse,bindTile,routing,currentPresentationGroup,pendingAttachment,responseGroup} from './tile-group.js?v=20261119-attach';
import {call,active,modal} from './boards.js?v=20261119-attach';
import {preparePresentationExit} from './presentation-exit.js?v=20261110-presentation-lifecycle';
const make=(tag,cls='',text='')=>{const el=document.createElement(tag);el.className=cls;el.textContent=text;return el;};
const button=(label,action)=>{const el=make('button','cc-session-button',label);el.type='button';el.onclick=action;return el;};
const isNormal=tile=>tile?.isConnected&&!window.ClassConnectPolicy&&!tile.dataset.presentationEmbedded;
export async function openTileSession(tile,{getInfo,key,startData,connect}){
 if(!isNormal(tile))return;
 if(pendingAttachment(tile))await pendingAttachment(tile).catch(()=>{});
 if(!isNormal(tile))return;
 const presentation=!!tile._classConnectPresentation;
 if(tile._classConnectDialog?.open){tile._classConnectDialog.focus();return;}
 const info=getInfo();if(!info)throw Error('Choose the tile content first.');
 const dialog=modal('ClassConnect',document.fullscreenElement||document.body);dialog.classList.add('cc-presentation-dialog');const body=make('div','cc-presentation-options'),status=make('p','cc-session-status');dialog.append(body,status);tile._classConnectDialog=dialog;
 const refresh=()=>{if(dialog.open)liveView();};
 const account=window.TeacherTilesAuth?.user?.uid;
 const auth=()=>{if(account!==window.TeacherTilesAuth?.user?.uid)dialog.close();};window.addEventListener('teachertiles:authchange',auth);
 tile.addEventListener('teachertiles:presentation-connection',refresh);
 dialog.addEventListener('close',()=>{tile.removeEventListener('teachertiles:presentation-connection',refresh);window.removeEventListener('teachertiles:authchange',auth);delete tile._classConnectDialog;},{once:true});
 function liveView(){body.classList.remove('cc-tool-grid');body.replaceChildren();const connection=tile._classConnectSession;if(!connection){
   const group=!presentation&&responseGroup();
   if(!group){options();return;}
   body.append(make('strong','',group.name),button('Add Tile to Session',async event=>{
    event.currentTarget.disabled=true;
    try{await attachResponse(tile);liveView();}catch(error){liveView();status.textContent=error.message;}
   }));
   addEndButton(group);status.textContent='This class session is live.';return;
  }body.append(make('strong','',connection.name),make('p','','Your class can join from Enter Board.'),button(connection.grouped?'Remove Tile from Session':'End Session',async()=>{await connection.end();if(!tile._classConnectSession)dialog.close();else liveView();}));if(connection.endSession)addEndButton(connection);if(connection.problem)body.append(button('Retry Sync',()=>connection.retry()));status.textContent=connection.problem||'The session is live for this class.';}
 function addEndButton(connection){body.append(button('End Session',async event=>{
   event.currentTarget.disabled=true;try{await connection.endSession();dialog.close();}catch(error){liveView();status.textContent=error.message;}
  }));}
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
 function confirmSwitch(roster,groupId,panelId,title){
  body.classList.remove('cc-tool-grid');body.replaceChildren();status.textContent='';
  dialog.classList.add('cc-switch-dialog');
  dialog.querySelector('h2').textContent='Presentation Already Live';dialog.setAttribute('aria-label','Presentation Already Live');
  const copy=make('p','cc-switch-copy');
  copy.textContent=(title?'“'+title+'” is live':'A presentation is already live')+' for '+roster.name+'. Switch to “'+(info.title||'this presentation')+'” for everyone in the session?';
  const actions=make('div','cc-switch-actions'),cancel=button('Keep Current',()=>dialog.close());
  const swap=button('Switch Presentation',()=>start(roster,swap,groupId,panelId));
  swap.classList.add('cc-switch-confirm');actions.append(cancel,swap);body.append(copy,actions);cancel.focus();
 }
 async function start(roster,pick,groupId,replacePresentation){
  let exit;
  const close=dialog.querySelector('header button'),guard=event=>event.preventDefault();
  if(replacePresentation){close.disabled=true;dialog.addEventListener('cancel',guard);}
  body.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent='Starting class session…';
  try{
   if(!groupId)await window.TeacherTilesClassConnectUI.ensureLink(roster.id);
   if(!dialog.open||!isNormal(tile)||account!==window.TeacherTilesAuth?.user?.uid)return;
   const latest=getInfo();if(key(latest)!==key(info))throw Error('The tile changed. Reopen ClassConnect.');
   exit=await preparePresentationExit(window.TeacherTilesAuth?.user);
   if(!dialog.open||!isNormal(tile)||account!==window.TeacherTilesAuth?.user?.uid||key(getInfo())!==key(info))return;
   if(!presentation&&responseGroup()){liveView();return;}
   const result=await call({action:'start',grouped:true,...(groupId?{groupId}:{}),...(replacePresentation?{replacePresentation}:{}),classId:roster.id,...startData(latest),requestId:pick.dataset.requestId||(pick.dataset.requestId=crypto.randomUUID())});
   if(!dialog.open||!isNormal(tile)||account!==window.TeacherTilesAuth?.user?.uid||key(getInfo())!==key(info)){await call({action:'end',...routing(result),classId:roster.id,sessionId:result.status.sessionId});return;}
   bindTile(tile,roster.id,roster.name,result,exit,connect);exit=null;dialog.close();
  }catch(error){
   if(!dialog.open)return;
   if(presentation&&error.details?.reason==='presentation-live'){
    confirmSwitch(roster,error.details.groupId,error.details.panelId);return;
   }
   status.textContent=error.message||'Could not start the class session.';body.querySelectorAll('button').forEach(b=>b.disabled=false);
   if(error.code==='functions/already-exists'&&!body.querySelector('.cc-end-existing')){const end=button('End Current Session',async()=>{end.disabled=true;try{const current=await call({action:'teacherGet',classId:roster.id});if(active(current.status))await call({action:'end',classId:roster.id,sessionId:current.status.sessionId});end.remove();status.textContent='Current session ended. Select the class again to start the session.';}catch(e){status.textContent=e.message;end.disabled=false;}});end.classList.add('cc-end-existing');body.append(end);}
  }finally{close.disabled=false;dialog.removeEventListener('cancel',guard);exit?.dispose();}
 }
 const group=presentation&&currentPresentationGroup();
 if(tile._classConnectSession||!presentation&&responseGroup())liveView();
 else if(group?.panelId)confirmSwitch(group,group.groupId,group.panelId,group.title);
 else if(group){
  const join=button('Share Presentation',()=>start(group,join,group.groupId));
  body.append(make('strong','',group.name),join);addEndButton(responseGroup());
  status.textContent='Share this presentation with the current session.';
 }
 else options();
}
