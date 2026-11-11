import {preparePresentationExit} from './presentation-exit.js?v=20261110-presentation-lifecycle';
import {call,active,watchRoom,modal} from './boards.js?v=20261110-presentation-lifecycle';
const make=(tag,cls='',text='')=>{const el=document.createElement(tag);el.className=cls;el.textContent=text;return el;};
const button=(label,action)=>{const el=make('button','cc-session-button',label);el.type='button';el.onclick=action;return el;};
const root=new URL('../',import.meta.url),version='20261110-classconnect-presentations';
const isNormal=tile=>tile?.isConnected&&!window.ClassConnectPolicy&&!tile.dataset.presentationEmbedded;
const sourceKey=info=>JSON.stringify(info?.presentation);
function showStatus(tile,text){let message=tile.querySelector('.presentation-connection-status');if(!message){message=make('p','presentation-connection-status');message.setAttribute('role','status');tile.querySelector('.presentation-tile-viewport').append(message);}message.textContent=text;message.hidden=!text;tile.dispatchEvent(new CustomEvent('teachertiles:presentation-connection'));}
// A single ordered publisher coalesces rapid navigation and sends only slide indices.
function controller(tile,classId,name,result,exit){
 let status=result.status,desired=status.slideIndex,sending=false,closed=false,ending=false,timer=0,off=null,problem='',retrying=false,endRequested=false;
 const owner=window.TeacherTilesAuth?.user?.uid,source=sourceKey(tile._classConnectPresentation());
 const connect=tile.querySelector('[data-player=classconnect]');
 const notify=()=>tile.dispatchEvent(new CustomEvent('teachertiles:presentation-connection'));
 const dispose=()=>{if(closed)return;closed=true;clearTimeout(timer);off?.();removal.disconnect();exit.dispose();window.removeEventListener('pagehide',leave);window.removeEventListener('beforeunload',beforeLeave);tile.removeEventListener('teachertiles:presentation-slide',changed);window.removeEventListener('teachertiles:authchange',auth);window.removeEventListener('online',retry);window.removeEventListener('teachertiles:accountchange',access);tile.classList.remove('is-classconnect-live');connect?.setAttribute('aria-label','ClassConnect presentation');if(tile._classConnectSession===api)delete tile._classConnectSession;notify();};
 async function send(){
  clearTimeout(timer);if(sending||closed||ending||endRequested||desired===status.slideIndex)return;
  sending=true;
  try{while(!closed&&!ending&&!endRequested&&desired!==status.slideIndex){const index=desired,response=await call({action:'slide',classId,sessionId:status.sessionId,expectedRevision:status.revision,slideIndex:index});if(closed)return;status=response.status;problem='';showStatus(tile,'');notify();}}
  catch(error){if(closed)return;problem=error.message||'Could not sync slides. Open ClassConnect to retry.';showStatus(tile,problem);if(['functions/failed-precondition','functions/not-found','functions/permission-denied','functions/aborted'].includes(error.code))dispose();else notify();}
  finally{sending=false;}
 }
 function changed(){const info=tile._classConnectPresentation();if(!info||sourceKey(info)!==source){void end();return;}desired=info.slideIndex;clearTimeout(timer);timer=setTimeout(send,100);}
 async function end(){if(closed||ending)return;endRequested=true;ending=true;clearTimeout(timer);try{await call({action:'end',classId,sessionId:status.sessionId});dispose();}catch(error){if(['functions/failed-precondition','functions/not-found','functions/aborted'].includes(error.code)){dispose();return;}problem=error.message||'Could not end session. Try again.';showStatus(tile,problem);notify();}finally{ending=false;}}
 async function retry(){if(closed||retrying)return;if(endRequested){await end();return;}retrying=true;try{const latest=await call({action:'teacherGet',classId,sessionId:status.sessionId});if(!active(latest.status)||latest.status.sessionId!==status.sessionId){dispose();return;}status=latest.status;problem='';showStatus(tile,'');await send();notify();}catch(error){problem=error.message;notify();}finally{retrying=false;}}
 function leave(){if(closed)return;exit.send({classId,sessionId:status.sessionId});dispose();}
 function beforeLeave(event){if(!event.defaultPrevented&&!event.returnValue)leave();}
 function auth(){if(window.TeacherTilesAuth?.user?.uid!==owner)leave();}
 function access(){const info=tile._classConnectPresentation();if(info&&!window.TeacherTilesPresentations.checkAccess(info.document,false))void end();}
 const removal=new MutationObserver(()=>{if(!tile.isConnected)void end();});removal.observe(document.body,{childList:true,subtree:true});exit.start();window.addEventListener('pagehide',leave);window.addEventListener('beforeunload',beforeLeave);
 const api={classId,name,end,retry,get problem(){return problem},get active(){return !closed}};tile._classConnectSession=api;
 tile.classList.add('is-classconnect-live');connect?.setAttribute('aria-label','ClassConnect presentation · Live');
 tile.addEventListener('teachertiles:presentation-slide',changed);window.addEventListener('teachertiles:authchange',auth);window.addEventListener('online',retry);window.addEventListener('teachertiles:accountchange',access);
 off=watchRoom(result.room,next=>{if(!active(next)||next.sessionId!==status.sessionId){dispose();return;}
  // While publishing, the listener may arrive before the callable response. Keep
  // the acknowledged revision until that response so queued updates remain ordered.
  if(!sending&&next.revision>status.revision){if(next.slideIndex!==desired){problem='Slides changed in another teacher window. Reopen ClassConnect.';showStatus(tile,problem);dispose();return;}status=next;}
 });
 if(closed)off?.();else changed();notify();return api;
}
export async function openPresentation(tile){
 if(!isNormal(tile))return;if(tile._classConnectDialog?.open){tile._classConnectDialog.focus();return;}
 const info=tile._classConnectPresentation?.();if(!info)throw Error('Choose a presentation first.');
 const dialog=modal('ClassConnect');dialog.classList.add('cc-presentation-dialog');const body=make('div','cc-presentation-options'),status=make('p','cc-session-status');dialog.append(body,status);if(document.fullscreenElement)document.fullscreenElement.append(dialog);tile._classConnectDialog=dialog;
 const refresh=()=>{if(dialog.open)liveView();};
 const account=window.TeacherTilesAuth?.user?.uid;
 const auth=()=>{if(account!==window.TeacherTilesAuth?.user?.uid)dialog.close();};window.addEventListener('teachertiles:authchange',auth);
 tile.addEventListener('teachertiles:presentation-connection',refresh);
 dialog.addEventListener('close',()=>{tile.removeEventListener('teachertiles:presentation-connection',refresh);window.removeEventListener('teachertiles:authchange',auth);delete tile._classConnectDialog;},{once:true});
 function liveView(){body.classList.remove('cc-tool-grid');body.replaceChildren();const connection=tile._classConnectSession;if(!connection){options();return;}body.append(make('strong','',connection.name),make('p','','Students are following your presentation.'),button('End Session',async()=>{await connection.end();if(!tile._classConnectSession)dialog.close();else liveView();}));if(connection.problem)body.append(button('Retry Sync',()=>connection.retry()));status.textContent=connection.problem||'Change slides on this tile to update the class.';}
 function options(){
  body.replaceChildren();body.classList.add('cc-tool-grid');status.textContent='';
  const card=(label,description,path,action)=>{const b=button('',action);b.classList.add('cs-button','cc-tool-card');const icon=make('span','cs-icon');icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+path+'</svg>';const copy=make('span','cc-tool-copy');copy.append(make('strong','',label),make('small','',description));b.append(icon,copy);return b;};
  const join=card('Join Code','Coming Soon','<path d="M9 3 7 21M17 3l-2 18M4 9h17M3 15h17"/>',()=>{});join.disabled=true;
  const connect=card('ClassConnect','Present live to a class','<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v4M8 21h8M10 7.5l6 3-6 3Z"/>',chooseClass);body.append(join,connect);
 }
 function chooseClass(){
  body.classList.remove('cc-tool-grid');body.replaceChildren();status.textContent='Choose a class to follow this presentation.';
  const classes=window.readClassRosters?.()||[],grid=make('div','cc-presentation-classes');
  for(const roster of classes){const pick=button('',()=>start(roster,pick)),avatar=make('span','cc-presentation-class-avatar');if(roster.logoImage){const img=make('img');img.src=roster.logoImage;img.alt='';avatar.append(img);}else avatar.textContent=roster.logo||'👥';pick.append(avatar,make('strong','',roster.name),make('small','',roster.students.length+' students'));grid.append(pick);}
  body.append(grid);if(!classes.length)body.append(make('p','','Create a class in Class View to start a presentation session.'));
 }
 async function start(roster,pick){
  let exit;
  body.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent='Starting presentation session…';
  try{
   await window.TeacherTilesClassConnectUI.ensureLink(roster.id);
   if(!dialog.open||!isNormal(tile)||account!==window.TeacherTilesAuth?.user?.uid)return;
   const latest=tile._classConnectPresentation();if(sourceKey(latest)!==sourceKey(info))throw Error('The tile changed presentations. Reopen ClassConnect.');
   exit=await preparePresentationExit(window.TeacherTilesAuth?.user);
   const result=await call({action:'start',classId:roster.id,mode:'presentation',presentation:latest.presentation,slideIndex:latest.slideIndex,requestId:pick.dataset.requestId||(pick.dataset.requestId=crypto.randomUUID())});
   if(!dialog.open||!isNormal(tile)||account!==window.TeacherTilesAuth?.user?.uid||sourceKey(tile._classConnectPresentation())!==sourceKey(info)){await call({action:'end',classId:roster.id,sessionId:result.status.sessionId});return;}
   controller(tile,roster.id,roster.name,result,exit);exit=null;dialog.close();
  }catch(error){
   status.textContent=error.message||'Could not start the presentation session.';body.querySelectorAll('button').forEach(b=>b.disabled=false);
   if(error.code==='functions/already-exists'&&!body.querySelector('.cc-end-existing')){const end=button('End Current Session',async()=>{end.disabled=true;try{const current=await call({action:'teacherGet',classId:roster.id});if(active(current.status))await call({action:'end',classId:roster.id,sessionId:current.status.sessionId});end.remove();status.textContent='Current session ended. Select the class again to start presenting.';}catch(e){status.textContent=e.message;end.disabled=false;}});end.classList.add('cc-end-existing');body.append(end);}
  }finally{exit?.dispose();}
 }
 if(tile._classConnectSession)liveView();else options();
}
let resources;
async function renderer(){
 if(!resources)resources=(async()=>{
  for(const file of ['presentations/styles.css','presentations/transitions.css']){if([...document.querySelectorAll('link[rel=stylesheet]')].some(l=>new URL(l.href).pathname.endsWith('/'+file)))continue;const link=make('link');link.rel='stylesheet';link.href=new URL(file+'?v='+version,root).href;await new Promise((resolve,reject)=>{link.onload=resolve;link.onerror=()=>{link.remove();reject(Error('Could not load presentation styles. Please try again.'));};document.head.append(link);});}
  for(const [key,file]of [['TeacherTilesPresentationCatalog','presentations/catalog.js'],['TeacherTilesPresentationThemes','presentations/themes.js'],['TeacherTilesPresentationTransitions','presentations/transitions.js'],['TeacherTilesPresentationObjects','presentations/objects-contract.js'],['TeacherTilesPresentationModules','presentations/objects.js'],['TeacherTilesPresentationRenderer','presentations/readonly.js']])if(!window[key])await import(new URL(file+'?v='+version,root).href);
 })().catch(error=>{resources=null;throw error;});await resources;
}
export async function enterPresentation({token,student,session,getProfile,result}){
 const dialog=modal('Class Presentation');dialog.classList.add('cc-presentation-viewer');const header=dialog.querySelector('header');header.remove();
 const viewport=make('div','cc-presentation-viewport'),stage=make('div','pres-slide cc-presentation-slide'),controls=make('div','cc-presentation-corners'),status=make('p','cc-presentation-status','Loading presentation…');status.setAttribute('role','status');viewport.append(stage);dialog.append(viewport,controls,status);
 const back=button('‹ '+student.name,()=>dialog.close());back.setAttribute('aria-label','Back to Profile');
 const fullscreen=button('',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else{await document.documentElement.requestFullscreen();ownsFullscreen=true;}}catch{status.textContent='Fullscreen is unavailable in this browser.';}});fullscreen.setAttribute('aria-label','Enter Fullscreen');fullscreen.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 4H4v5M15 4h5v5M20 15v5h-5M4 15v5h5"/></svg>';controls.append(back,fullscreen);
 let closed=false,off=null,index=-1,revision=0,ownsFullscreen=false,quietTimer=0,ready=false;const deck=result.presentation,credentials={token,studentId:student.id,session,sessionId:result.status.sessionId},cache=new Map(),urls=new Set();
 const fit=()=>{const w=Math.min(viewport.clientWidth,viewport.clientHeight*16/9);stage.style.width=w+'px';stage.style.height=w*9/16+'px';};const resize=new ResizeObserver(fit);resize.observe(viewport);
 const reveal=()=>{dialog.classList.remove('is-quiet');clearTimeout(quietTimer);quietTimer=setTimeout(()=>{if(ready)dialog.classList.add('is-quiet');},2200);};dialog.addEventListener('pointermove',reveal);dialog.addEventListener('focusin',reveal);
 const fullChange=()=>{fullscreen.setAttribute('aria-label',document.fullscreenElement?'Exit Fullscreen':'Enter Fullscreen');fit();};document.addEventListener('fullscreenchange',fullChange);
 const leave=()=>dialog.close();window.addEventListener('hashchange',leave);
 // Native fullscreen is best-effort; the viewer always occupies the entire viewport.
 if(!document.fullscreenElement)document.documentElement.requestFullscreen?.().then(()=>{ownsFullscreen=true;if(closed)void document.exitFullscreen().catch(()=>{});}).catch(()=>{});
 dialog.addEventListener('close',()=>{closed=true;off?.();resize.disconnect();clearTimeout(quietTimer);document.removeEventListener('fullscreenchange',fullChange);window.removeEventListener('hashchange',leave);window.TeacherTilesPresentationTransitions?.cancel(stage);window.TeacherTilesPresentationModules?.dispose(stage);for(const url of urls)URL.revokeObjectURL(url);cache.clear();if(ownsFullscreen&&document.fullscreenElement)void document.exitFullscreen().catch(()=>{});getProfile?.();},{once:true});
 const read=asset=>{if(closed)return Promise.reject(Error('Session closed.'));if(!cache.has(asset))cache.set(asset,call({...credentials,action:'presentationAsset',asset}).then(async data=>{if(closed)throw Error('Session closed.');const blob=await (await fetch(data.image)).blob();if(closed)throw Error('Session closed.');const url=URL.createObjectURL(blob);urls.add(url);return url;}).catch(error=>{cache.delete(asset);if(!closed){status.textContent=error.message;dialog.classList.remove('is-quiet');}throw error;}));return cache.get(asset);};
 const show=next=>{if(closed)return;if(!active(next)||next.mode!=='presentation'||next.sessionId!==credentials.sessionId){dialog.close();return;}if(next.revision<revision)return;revision=next.revision;
  const target=Math.max(0,Math.min(deck.slides.length-1,next.slideIndex));if(target===index)return;const old=index;index=target;const draw=()=>{window.TeacherTilesPresentationRenderer.paint(stage,deck.slides[index],deck.theme,{read});fit();};
  if(old<0)draw();else{const direction=index>old?1:-1;window.TeacherTilesPresentationTransitions.animate(stage,window.TeacherTilesPresentationTransitions.between(deck.slides,old,index,direction),draw,direction);}
  status.textContent='Following your teacher · Slide '+(index+1)+' of '+deck.slides.length;ready=true;reveal();
 };
 try{await renderer();if(closed)return;off=watchRoom(result.room,next=>{if(!active(next)||next.sessionId!==credentials.sessionId){dialog.close();return;}if(ready)show(next);else result.status=next;});if(closed){off?.();return;}await window.TeacherTilesPresentationRenderer.loadFonts(deck,read);if(closed)return;show(result.status);}
 catch(error){if(!closed){status.textContent=error.message||'Could not load this presentation. Return to your profile and try again.';dialog.classList.remove('is-quiet');}}
}
