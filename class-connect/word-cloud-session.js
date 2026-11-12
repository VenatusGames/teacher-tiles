import {call,active,watchRoom,watchCloud,modal} from './boards.js?v=20261112-present-mode-connect';
import {openTileSession} from './tile-session-picker.js?v=20261112-present-mode-connect';
const make=(tag,cls='',text='')=>{const el=document.createElement(tag);el.className=cls;el.textContent=text;return el;};
function connect(tile,classId,name,result,exit){
 let closed=false,ending=false,endRequested=false,off=null,offCloud=null;
 const sessionId=result.status.sessionId,owner=window.TeacherTilesAuth?.user?.uid;
 const notify=()=>tile.dispatchEvent(new CustomEvent('teachertiles:presentation-connection'));
 const api={classId,name,end,retry,get active(){return !closed},problem:''};tile._classConnectSession=api;
 function dispose(){if(closed)return;closed=true;off?.();offCloud?.();observer.disconnect();exit.dispose();window.removeEventListener('pagehide',leave);window.removeEventListener('beforeunload',beforeLeave);window.removeEventListener('teachertiles:authchange',auth);window.removeEventListener('online',retry);if(tile._classConnectSession===api)delete tile._classConnectSession;tile._wordCloudStatus(api.problem||'Session ended',false);window.notifyBoardChanged?.('wordcloud-finished');notify();}
 function leave(){if(closed)return;exit.send({classId,sessionId});dispose();}
 function beforeLeave(e){if(!e.defaultPrevented&&!e.returnValue)leave();}
 function auth(){if(window.TeacherTilesAuth?.user?.uid!==owner)leave();}
 async function end(){if(closed||ending)return;endRequested=true;ending=true;try{await call({action:'end',classId,sessionId});dispose();}catch(e){if(['functions/failed-precondition','functions/not-found','functions/aborted'].includes(e.code)){dispose();return;}api.problem=e.message;tile._wordCloudStatus(api.problem,true);notify();}finally{ending=false;}}
 function retry(){if(closed)return;if(endRequested){void end();return;}offCloud?.();offCloud=watchCloud(result.room,(cloud,error)=>{if(closed)return;if(error){api.problem='Could not update the cloud. Reopen ClassConnect to retry.';tile._wordCloudStatus(api.problem,true);notify();return;}if(cloud?.sessionId===sessionId){api.problem='';tile._wordCloudUpdate(cloud.words);tile._wordCloudStatus('Live · '+name,true);notify();}});}
 const observer=new MutationObserver(()=>{if(!tile.isConnected)void end();});observer.observe(document.body,{childList:true,subtree:true});exit.start();window.addEventListener('pagehide',leave);window.addEventListener('beforeunload',beforeLeave);window.addEventListener('teachertiles:authchange',auth);window.addEventListener('online',retry);
 tile._wordCloudUpdate([]);tile._wordCloudStatus('Live · '+name,true);
 off=watchRoom(result.room,status=>{if(!active(status)||status.sessionId!==sessionId)dispose();});if(closed)off?.();else retry();notify();
}
export function openWordCloud(tile){return openTileSession(tile,{getInfo:()=>tile._wordCloudInfo(),key:info=>JSON.stringify(info),startData:info=>({mode:'wordcloud',prompt:info.prompt}),connect});}
export function enterWordCloud({token,student,session,getProfile,result}){
 const dialog=modal('Word Cloud');dialog.classList.add('cc-wordcloud-student');dialog.querySelector('header').remove();
 const back=make('button','cc-session-button cc-wordcloud-back','‹ Back to Profile');back.type='button';back.onclick=()=>dialog.close();
 const card=make('section','cc-wordcloud-form-card'),icon=make('div','cc-wordcloud-symbol');icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M6 18a4 4 0 0 1-1-8 6 6 0 0 1 11-3 5 5 0 1 1 2 11zM8 12h8m-6 3h4"/></svg>';
 const title=make('h1','',(result.prompt&&result.prompt!=='Share a word with your class')?result.prompt:'Send a word to the Word Cloud'),form=make('form'),label=make('label','','Your word'),input=make('input'),submit=make('button','cc-session-button','Send Word'),message=make('p','cc-wordcloud-feedback'),last=make('span','cc-wordcloud-last');
 input.type='text';input.maxLength=40;input.autocomplete='off';input.required=true;input.placeholder='Type a word…';input.setAttribute('aria-label','Your word');label.append(input);submit.type='submit';message.setAttribute('role','status');form.append(label,submit);card.append(icon,title,form,message,last);dialog.append(back,card);
 let off=null,closed=false,busy=false,pending=null,cooldownUntil=0,cooldownTimer=null;
 function updateSubmit(){const remaining=Math.max(0,Math.ceil((cooldownUntil-performance.now())/1000));submit.disabled=busy||remaining>0;submit.textContent=remaining?'Send in '+remaining+'s':'Send Word';if(!remaining&&cooldownTimer){clearInterval(cooldownTimer);cooldownTimer=null;}}
 function startCooldown(){cooldownUntil=performance.now()+2000;if(!cooldownTimer)cooldownTimer=setInterval(updateSubmit,100);updateSubmit();}const credentials={token,studentId:student.id,session,sessionId:result.status.sessionId};
 form.onsubmit=async e=>{e.preventDefault();if(busy||closed||performance.now()<cooldownUntil)return;const word=input.value.trim();if(!word)return;if(!pending||pending.word!==word)pending={word,requestId:crypto.randomUUID()};busy=true;submit.disabled=true;input.disabled=true;message.textContent='Adding your word…';
  try{const response=await call({action:'submitWord',...credentials,...pending});if(closed)return;pending=null;input.value='';startCooldown();last.textContent=response.word;last.getAnimations().forEach(a=>a.cancel());if(!matchMedia('(prefers-reduced-motion: reduce)').matches)last.animate([{opacity:0,transform:'translateY(10px) scale(.85)'},{opacity:1,transform:'none'}],{duration:400,easing:'cubic-bezier(.2,.8,.2,1)'});message.textContent='Your word joined the cloud!';}
  catch(error){if(closed)return;if(error.code==='functions/resource-exhausted'&&/Give your word a moment|Please wait a moment/.test(error.message||'')){startCooldown();message.textContent='';return;}message.textContent=String(error.message||'Could not send your word. Try again.').replace(/\s*\[400\]\s*$/,'');if(['functions/failed-precondition','functions/not-found','functions/permission-denied','functions/aborted'].includes(error.code))dialog.close();}
  finally{busy=false;if(!closed){updateSubmit();input.disabled=false;input.focus();}}
 };
 const leave=()=>dialog.close();window.addEventListener('hashchange',leave);
 dialog.addEventListener('close',()=>{closed=true;off?.();clearInterval(cooldownTimer);pending=null;window.removeEventListener('hashchange',leave);getProfile?.();},{once:true});
 off=watchRoom(result.room,status=>{if(!active(status)||status.sessionId!==credentials.sessionId)dialog.close();});if(closed)off?.();else input.focus();
}
