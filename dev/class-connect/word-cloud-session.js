import {routing,watchPanel} from './tile-group.js?v=20261119-attach';
import {call,active,watchRoom,watchCloud,modal} from './boards.js?v=20261119-attach';
import {openTileSession} from './tile-session-picker.js?v=20261119-attach';
const make=(tag,cls='',text='')=>{const el=document.createElement(tag);el.className=cls;el.textContent=text;return el;};
function connect(tile,classId,name,result,exit){
 let closed=false,ending=false,endRequested=false,off=null,offCloud=null;
 const sessionId=result.status.sessionId,owner=window.TeacherTilesAuth?.user?.uid;
 const notify=()=>tile.dispatchEvent(new CustomEvent('teachertiles:presentation-connection'));
 let promptQueue=Promise.resolve();
 const updatePrompt=event=>{
  if(!result.groupId||closed||!event.target.matches('.wordcloud-prompt'))return;
  const config=tile._wordCloudInfo();
  promptQueue=promptQueue.then(()=>closed?undefined:call({action:'panelPrompt',classId,sessionId,...routing(result),...config})).catch(error=>{if(!closed)tile._wordCloudStatus(error.message,true);});
 };
 tile.addEventListener('change',updatePrompt);
 const api={classId,name,end,retry,grouped:!!result.groupId,endSession:exit.endSession,get active(){return !closed},problem:''};tile._classConnectSession=api;
 function dispose(){if(closed)return;closed=true;tile.removeEventListener('change',updatePrompt);off?.();offCloud?.();observer.disconnect();exit.dispose();window.removeEventListener('pagehide',leave);window.removeEventListener('beforeunload',beforeLeave);window.removeEventListener('teachertiles:authchange',auth);window.removeEventListener('online',retry);if(tile._classConnectSession===api)delete tile._classConnectSession;tile._wordCloudStatus(api.problem||'Session ended',false);if(tile.dataset.type!=='wordcloud')tile._wordCloudUpdate([]);window.notifyBoardChanged?.('wordcloud-finished');notify();}
 function leave(){if(closed)return;exit.send({classId,sessionId});dispose();}
 function beforeLeave(e){if(!e.defaultPrevented&&!e.returnValue)leave();}
 function auth(){if(window.TeacherTilesAuth?.user?.uid!==owner)leave();}
 async function end(){if(closed||ending)return;endRequested=true;ending=true;try{await exit.beforeRemoval?.();await call({action:'end',...routing(result),classId,sessionId});exit.removed?.();dispose();}catch(e){if(['functions/failed-precondition','functions/not-found','functions/aborted'].includes(e.code)){dispose();return;}api.problem=e.message;tile._wordCloudStatus(api.problem,true);notify();}finally{ending=false;}}
 function retry(){if(closed)return;if(endRequested){void end();return;}offCloud?.();offCloud=watchCloud(result.room,(cloud,error)=>{if(closed)return;if(error){api.problem='Could not update the cloud. Reopen ClassConnect to retry.';tile._wordCloudStatus(api.problem,true);notify();return;}if(cloud?.sessionId===sessionId){api.problem='';tile._wordCloudUpdate(TeacherTilesChoice.isChoice(tile.dataset.type)?cloud.activities?.standalone?.counts:tile.dataset.type==='respond'?cloud.activities?.standalone?.answers:cloud.words);tile._wordCloudStatus('Live · '+name,true);notify();}});}
 const observer=new MutationObserver(()=>{if(!tile.isConnected)void end();});observer.observe(document.body,{childList:true,subtree:true});exit.start();window.addEventListener('pagehide',leave);window.addEventListener('beforeunload',beforeLeave);window.addEventListener('teachertiles:authchange',auth);window.addEventListener('online',retry);
 tile._wordCloudUpdate([]);tile._wordCloudStatus('Live · '+name,true);
 off=watchPanel(result,status=>{if(!active(status)||status.sessionId!==sessionId)dispose();});if(closed)off?.();else retry();notify();
}
export function responseOptions(tile){return {getInfo:()=>tile._wordCloudInfo(),key:info=>JSON.stringify(info),startData:info=>({mode:tile.dataset.type,...info}),connect};}
export function openWordCloud(tile){return openTileSession(tile,responseOptions(tile));}
export function responsePanel({token,student,session,result},onEnded){
 if(TeacherTilesChoice.isChoice(result.status.mode)){
  const card=make('section','cc-wordcloud-form-card'),title=make('h1');card.append(title);
  let previous;
  const update=data=>{const config=data.ballot;if(previous===JSON.stringify(config))return;previous=JSON.stringify(config);title.textContent=config.prompt;
   const form=TeacherTilesChoice.form(config,input=>call({...routing(data),token,studentId:student.id,session,sessionId:data.status.sessionId,action:'submitVote',...input}),data.ownVotes?.standalone);
   card.replaceChildren(title,form);
  };update(result);
  return {card,focus:()=>card.querySelector('button:not(:disabled)')?.focus(),prompt:(_,data)=>update(data),dispose(){}};
 }
 const respond=result.status.mode==='respond';
 const card=make('section','cc-wordcloud-form-card'),icon=make('div','cc-wordcloud-symbol');icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M6 18a4 4 0 0 1-1-8 6 6 0 0 1 11-3 5 5 0 1 1 2 11zM8 12h8m-6 3h4"/></svg>';
 const title=make('h1','',(result.prompt&&result.prompt!=='Share a word with your class')?result.prompt:'Send a word to the Word Cloud'),form=make('form'),label=make('label','','Your word'),input=make('input'),submit=make('button','tt-board-action','Send Word'),message=make('p','cc-wordcloud-feedback'),last=make('span','cc-wordcloud-last');
 input.type='text';input.maxLength=40;input.autocomplete='off';input.required=true;input.placeholder='Type a word…';input.setAttribute('aria-label','Your word');label.append(input);submit.type='submit';message.setAttribute('role','status');form.append(label,submit);card.append(icon,title,form,message,last);
 let closed=false,busy=false,pending=null,cooldownUntil=0,cooldownTimer=null;
 function updateSubmit(){const remaining=Math.max(0,Math.ceil((cooldownUntil-performance.now())/1000));submit.disabled=busy||remaining>0;submit.textContent=remaining?'Send in '+remaining+'s':'Send Word';if(!remaining&&cooldownTimer){clearInterval(cooldownTimer);cooldownTimer=null;}}
 function startCooldown(){cooldownUntil=performance.now()+2000;if(!cooldownTimer)cooldownTimer=setInterval(updateSubmit,100);updateSubmit();}const credentials={...routing(result),token,studentId:student.id,session,sessionId:result.status.sessionId};
 form.onsubmit=async e=>{e.preventDefault();if(busy||closed||performance.now()<cooldownUntil)return;const word=input.value.trim();if(!word)return;if(!pending||pending.word!==word)pending={word,requestId:crypto.randomUUID()};busy=true;submit.disabled=true;input.disabled=true;message.textContent='Adding your word…';
  try{const response=await call({action:'submitWord',...credentials,...pending});if(closed)return;pending=null;input.value='';startCooldown();last.textContent=response.word;last.getAnimations().forEach(a=>a.cancel());if(!matchMedia('(prefers-reduced-motion: reduce)').matches)last.animate([{opacity:0,transform:'translateY(10px) scale(.85)'},{opacity:1,transform:'none'}],{duration:400,easing:'cubic-bezier(.2,.8,.2,1)'});message.textContent='Your word joined the cloud!';}
  catch(error){if(closed)return;if(error.code==='functions/resource-exhausted'&&/Give your word a moment|Please wait a moment/.test(error.message||'')){startCooldown();message.textContent='';return;}message.textContent=String(error.message||'Could not send your word. Try again.').replace(/\s*\[400\]\s*$/,'');if(['functions/failed-precondition','functions/not-found','functions/permission-denied','functions/aborted'].includes(error.code))onEnded?.();}
  finally{busy=false;if(!closed){updateSubmit();input.disabled=false;if(card.contains(document.activeElement))input.focus();}}
 };
 if(respond){
  title.textContent=result.prompt||'What do you think?';
  icon.textContent='?';
  form.replaceWith(TeacherTilesRespond.form(data=>call({...credentials,action:'submitResponse',...data}),result.answered?.includes('standalone')));
  message.remove();last.remove();
 }
 return {card,focus:()=>(respond?card.querySelector('textarea'):input)?.focus(),
  prompt(value){title.textContent=value&&value!=='Share a word with your class'?value:respond?'What do you think?':'Send a word to the Word Cloud';},
  dispose(){closed=true;clearInterval(cooldownTimer);pending=null;}};
}
export function enterWordCloud(options){
 const {result,getProfile}=options;
 const dialog=modal(result.status.mode==='respond'?'Respond!':'Word Cloud');
 dialog.classList.add('cc-wordcloud-student');dialog.querySelector('header').remove();
 const back=make('button','tt-board-action cc-wordcloud-back','‹ Back to Profile');back.type='button';back.onclick=()=>dialog.close();
 const panel=responsePanel(options,()=>dialog.close());dialog.append(back,panel.card);
 const leave=()=>dialog.close();window.addEventListener('hashchange',leave);
 let off=watchRoom(result.room,status=>{if(!active(status)||status.sessionId!==result.status.sessionId)dialog.close();});
 dialog.addEventListener('close',()=>{off?.();panel.dispose();window.removeEventListener('hashchange',leave);getProfile?.();},{once:true});
 panel.focus();
}
