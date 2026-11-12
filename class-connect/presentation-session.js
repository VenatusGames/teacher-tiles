import {createInteractionChannel} from './presentation-interactions.js?v=20261112-present-mode-connect';
import {openTileSession} from './tile-session-picker.js?v=20261112-present-mode-connect';
import {call,active,watchRoom,modal} from './boards.js?v=20261112-present-mode-connect';
const make=(tag,cls='',text='')=>{const el=document.createElement(tag);el.className=cls;el.textContent=text;return el;};
const button=(label,action)=>{const el=make('button','cc-session-button',label);el.type='button';el.onclick=action;return el;};
const root=new URL('../',import.meta.url),version='20261112-present-mode-connect';
const sourceKey=info=>JSON.stringify(info?.presentation);
function showStatus(tile,text){let message=tile.querySelector('.presentation-connection-status');if(!message){message=make('p','presentation-connection-status');message.setAttribute('role','status');(tile._classConnectStatusHost||tile.querySelector('.presentation-tile-viewport')).append(message);}message.textContent=text;message.hidden=!text;tile.dispatchEvent(new CustomEvent('teachertiles:presentation-connection'));}
// A single ordered publisher coalesces rapid navigation and sends only slide indices.
function controller(tile,classId,name,result,exit){
 let status=result.status,desired=status.slideIndex,sending=false,closed=false,ending=false,timer=0,off=null,problem='',retrying=false,endRequested=false;
 const owner=window.TeacherTilesAuth?.user?.uid,source=sourceKey(tile._classConnectPresentation());
 const connect=tile.querySelector('[data-player=classconnect]');
 const stage=tile._classConnectStage||tile.querySelector('.presentation-tile-stage'),channel=createInteractionChannel({room:result.room,sessionId:status.sessionId,deck:tile._classConnectPresentation().document});stage._presentationInteraction=channel;channel.setSlide(status.slideIndex);
 const notify=()=>tile.dispatchEvent(new CustomEvent('teachertiles:presentation-connection'));
 const dispose=()=>{if(closed)return;closed=true;clearTimeout(timer);off?.();channel.dispose();delete stage._presentationInteraction;removal.disconnect();exit.dispose();window.removeEventListener('pagehide',leave);window.removeEventListener('beforeunload',beforeLeave);tile.removeEventListener('teachertiles:presentation-slide',changed);window.removeEventListener('teachertiles:authchange',auth);window.removeEventListener('online',retry);window.removeEventListener('teachertiles:accountchange',access);tile.classList.remove('is-classconnect-live');connect?.setAttribute('aria-label','ClassConnect presentation');if(tile._classConnectSession===api)delete tile._classConnectSession;if(tile.isConnected)tile._classConnectRefresh?.();notify();};
 async function send(){
  clearTimeout(timer);if(sending||closed||ending||endRequested||desired===status.slideIndex)return;
  sending=true;
  try{while(!closed&&!ending&&!endRequested&&desired!==status.slideIndex){const index=desired,response=await call({action:'slide',classId,sessionId:status.sessionId,expectedRevision:status.revision,slideIndex:index});if(closed)return;status=response.status;problem='';showStatus(tile,'');notify();}}
  catch(error){if(closed)return;problem=error.message||'Could not sync slides. Open ClassConnect to retry.';showStatus(tile,problem);if(['functions/failed-precondition','functions/not-found','functions/permission-denied','functions/aborted'].includes(error.code))dispose();else notify();}
  finally{sending=false;}
 }
 function changed(){const info=tile._classConnectPresentation();if(!info||sourceKey(info)!==source){void end();return;}desired=info.slideIndex;channel.setSlide(desired);clearTimeout(timer);timer=setTimeout(send,100);}
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
 if(closed)off?.();else{changed();tile._classConnectRefresh?.();}notify();return api;
}
export async function openPresentation(tile){return openTileSession(tile,{getInfo:()=>tile._classConnectPresentation?.(),key:sourceKey,startData:info=>({mode:'presentation',presentation:info.presentation,slideIndex:info.slideIndex}),connect:controller});}

let resources;
async function renderer(){
 if(!resources)resources=(async()=>{
  for(const file of ['presentations/styles.css','presentations/transitions.css','tiles/word-cloud/styles.css']){if([...document.querySelectorAll('link[rel=stylesheet]')].some(l=>new URL(l.href).pathname.endsWith('/'+file)))continue;const link=make('link');link.rel='stylesheet';link.href=new URL(file+'?v='+version,root).href;await new Promise((resolve,reject)=>{link.onload=resolve;link.onerror=()=>{link.remove();reject(Error('Could not load presentation styles. Please try again.'));};document.head.append(link);});}
  for(const [key,file]of [['TeacherTilesWordCloud','tiles/word-cloud/index.js'],['TeacherTilesPresentationInteractive','presentations/interactive.js'],['TeacherTilesPresentationCatalog','presentations/catalog.js'],['TeacherTilesPresentationThemes','presentations/themes.js'],['TeacherTilesPresentationTransitions','presentations/transitions.js'],['TeacherTilesPresentationObjects','presentations/objects-contract.js'],['TeacherTilesPresentationModules','presentations/objects.js'],['TeacherTilesPresentationRenderer','presentations/readonly.js']])if(!window[key])await import(new URL(file+'?v='+version,root).href);
 })().catch(error=>{resources=null;throw error;});await resources;
}
export async function enterPresentation({token,student,session,getProfile,result}){
 const dialog=modal('Class Presentation');dialog.classList.add('cc-presentation-viewer');const header=dialog.querySelector('header');header.remove();
 const viewport=make('div','cc-presentation-viewport'),stage=make('div','pres-slide cc-presentation-slide'),controls=make('div','cc-presentation-corners'),status=make('p','cc-presentation-status','Loading presentation…');status.setAttribute('role','status');viewport.append(stage);dialog.append(viewport,controls,status);
 const back=button('‹ '+student.name,()=>dialog.close());back.setAttribute('aria-label','Back to Profile');
 const fullscreen=button('',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else{await document.documentElement.requestFullscreen();ownsFullscreen=true;}}catch{status.textContent='Fullscreen is unavailable in this browser.';}});fullscreen.setAttribute('aria-label','Enter Fullscreen');fullscreen.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 4H4v5M15 4h5v5M20 15v5h-5M4 15v5h5"/></svg>';controls.append(back,fullscreen);
 let closed=false,off=null,index=-1,revision=0,ownsFullscreen=false,quietTimer=0,ready=false;const deck=result.presentation,credentials={token,studentId:student.id,session,sessionId:result.status.sessionId},cache=new Map(),urls=new Set(),channel=createInteractionChannel({room:result.room,sessionId:result.status.sessionId,deck,credentials});
 const fit=()=>{const w=Math.min(viewport.clientWidth,viewport.clientHeight*16/9);stage.style.width=w+'px';stage.style.height=w*9/16+'px';};const resize=new ResizeObserver(fit);resize.observe(viewport);
 const reveal=()=>{dialog.classList.remove('is-quiet');clearTimeout(quietTimer);quietTimer=setTimeout(()=>{if(ready)dialog.classList.add('is-quiet');},2200);};dialog.addEventListener('pointermove',reveal);dialog.addEventListener('focusin',reveal);
 const fullChange=()=>{fullscreen.setAttribute('aria-label',document.fullscreenElement?'Exit Fullscreen':'Enter Fullscreen');fit();};document.addEventListener('fullscreenchange',fullChange);
 const leave=()=>dialog.close();window.addEventListener('hashchange',leave);
 // Native fullscreen is best-effort; the viewer always occupies the entire viewport.
 if(!document.fullscreenElement)document.documentElement.requestFullscreen?.().then(()=>{ownsFullscreen=true;if(closed)void document.exitFullscreen().catch(()=>{});}).catch(()=>{});
 dialog.addEventListener('close',()=>{closed=true;off?.();channel.dispose();resize.disconnect();clearTimeout(quietTimer);document.removeEventListener('fullscreenchange',fullChange);window.removeEventListener('hashchange',leave);window.TeacherTilesPresentationTransitions?.cancel(stage);window.TeacherTilesPresentationModules?.dispose(stage);for(const url of urls)URL.revokeObjectURL(url);cache.clear();if(ownsFullscreen&&document.fullscreenElement)void document.exitFullscreen().catch(()=>{});getProfile?.();},{once:true});
 const read=asset=>{if(closed)return Promise.reject(Error('Session closed.'));if(!cache.has(asset))cache.set(asset,call({...credentials,action:'presentationAsset',asset}).then(async data=>{if(closed)throw Error('Session closed.');const blob=await (await fetch(data.image)).blob();if(closed)throw Error('Session closed.');const url=URL.createObjectURL(blob);urls.add(url);return url;}).catch(error=>{cache.delete(asset);if(!closed){status.textContent=error.message;dialog.classList.remove('is-quiet');}throw error;}));return cache.get(asset);};
 const show=next=>{if(closed)return;if(!active(next)||next.mode!=='presentation'||next.sessionId!==credentials.sessionId){dialog.close();return;}if(next.revision<revision)return;revision=next.revision;
  const target=Math.max(0,Math.min(deck.slides.length-1,next.slideIndex));if(target===index)return;const old=index;index=target;channel.setSlide(index);const draw=()=>{window.TeacherTilesPresentationRenderer.paint(stage,deck.slides[index],deck.theme,{read,interaction:channel});fit();};
  if(old<0)draw();else{const direction=index>old?1:-1;window.TeacherTilesPresentationTransitions.animate(stage,window.TeacherTilesPresentationTransitions.between(deck.slides,old,index,direction),draw,direction);}
  status.textContent='Following your teacher · Slide '+(index+1)+' of '+deck.slides.length;ready=true;reveal();
 };
 try{await renderer();if(closed)return;off=watchRoom(result.room,next=>{if(!active(next)||next.sessionId!==credentials.sessionId){dialog.close();return;}if(ready)show(next);else result.status=next;});if(closed){off?.();return;}await window.TeacherTilesPresentationRenderer.loadFonts(deck,read);if(closed)return;show(result.status);}
 catch(error){if(!closed){status.textContent=error.message||'Could not load this presentation. Return to your profile and try again.';dialog.classList.remove('is-quiet');}}
}
