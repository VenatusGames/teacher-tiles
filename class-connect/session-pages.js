import {active,call,modal,watchRoom} from './boards.js?v=20261119-live-switch';
import {panelStatus} from './tile-group.js?v=20261119-live-switch';
import {responsePanel} from './word-cloud-session.js?v=20261119-live-switch';
import {enterPresentation} from './presentation-session.js?v=20261119-live-switch';

function pagesFor(panels){
 const presentation=panels.find(p=>p.mode==='presentation');
 const decks=presentation?[[presentation]]:[];
 const questions=panels.filter(p=>p.mode!=='presentation');
 for(let i=0;i<questions.length;i+=4)decks.push(questions.slice(i,i+4));
 return decks;
}
function button(text,action){
 const b=document.createElement('button');b.type='button';b.className='tt-board-action';b.textContent=text;b.onclick=action;return b;
}
export function enterPages(options){
 const {result,student,token,session,getProfile}=options,groupId=result.status.sessionId;
 const dialog=modal('ClassConnect');dialog.classList.add('cc-wordcloud-student','cc-session-pages');dialog.querySelector('header').remove();
 const back=button('‹ Back to Profile',()=>dialog.close());back.classList.add('cc-wordcloud-back');
 const page=document.createElement('main'),nav=document.createElement('nav'),label=document.createElement('span');
 page.className='cc-panel-page';nav.className='cc-page-nav';nav.setAttribute('aria-label','Session pages');label.setAttribute('aria-live','polite');
 const prev=button('‹',()=>go(-1)),next=button('›',()=>go(1));prev.setAttribute('aria-label','Previous page');next.setAttribute('aria-label','Next page');
 nav.append(prev,label,next);dialog.append(back,page,nav);
 let status=result.status,groups=pagesFor(status.panels),index=0,closed=false,off;
 const entries=new Map(),subscriptions=new Set();
 function go(delta){index=Math.max(0,Math.min(groups.length-1,index+delta));render();}
 function detachDeck(entry){
  const viewer=entry.host.querySelector('.cc-presentation-viewer');
  if(viewer){viewer.close();viewer.remove();}
  entry.presenting=false;
 }
 function dispose(entry){
  detachDeck(entry);entry.response?.dispose();entry.host.remove();
  if(entry.media){entry.media.disposed=true;for(const url of entry.media.urls)URL.revokeObjectURL(url);entry.media.cache.clear();entry.media.urls.clear();}
 }
 function mount(entry){
  if(closed||!entry.host.isConnected||entry.host.hidden||!entry.data)return;
  const p=panelStatus(status,entry.id);if(!p)return;
  if(p.mode==='presentation'){
   if(entry.presenting)return;
   entry.presenting=true;back.hidden=true;
   entry.media??={cache:new Map(),urls:new Set(),disposed:false};
   const subscribe=fn=>{const notify=()=>fn(panelStatus(status,entry.id));subscriptions.add(notify);notify();return()=>subscriptions.delete(notify);};
   void enterPresentation({...options,result:{...entry.data,status:p,subscribe},host:entry.host,media:entry.media,onBack:()=>dialog.close(),getProfile:undefined});
  }else if(!entry.response){
   entry.response=responsePanel({...options,result:entry.data});
   entry.host.replaceChildren(entry.response.card);
  }else entry.response.prompt(entry.data.prompt);
 }
 async function load(entry,p){
  const revision=p.promptRevision||0;
  if(entry.loading||entry.failed||entry.data&&entry.version===revision){mount(entry);return;}
  entry.loading=true;
  try{
   const data=await call({action:'join',token,studentId:student.id,session,groupId,panelId:p.id,sessionId:p.sessionId});
   if(closed||entries.get(p.id)!==entry)return;
   if(p.mode==='presentation')data.answered=new Set(data.answered||[]);
   entry.data=data;entry.version=data.status.promptRevision||0;
   if(!entry.response&&!entry.presenting)entry.host.replaceChildren();
  }catch(error){
   if(!closed&&entries.get(p.id)===entry){entry.failed=true;
    const message=document.createElement('p');message.textContent=error.message||'Could not load this tile.';
    const retry=button('Try Again',()=>{entry.failed=false;render();});entry.host.replaceChildren(message,retry);
   }
  }finally{entry.loading=false;}
  if(!closed&&entries.get(p.id)===entry){mount(entry);const latest=status.panels.find(v=>v.id===p.id);if(latest&&!entry.failed&&entry.version!==(latest.promptRevision||0))void load(entry,latest);}
 }
 function render(){
  const shown=groups[index]||[],ids=new Set(shown.map(p=>p.id)),deck=shown[0]?.mode==='presentation';
  dialog.classList.toggle('is-deck-page',deck);back.hidden=deck&&!!entries.get(shown[0].id)?.presenting;
  page.dataset.count=String(shown.length);nav.hidden=groups.length<=1;prev.disabled=index===0;next.disabled=index>=groups.length-1;
  label.textContent='Page '+(index+1)+' of '+groups.length;
  for(const [id,entry] of entries){
   if(!ids.has(id)){entry.host.hidden=true;if(entry.presenting)detachDeck(entry);}
  }
  for(const p of shown){
   let entry=entries.get(p.id);
   if(!entry){const host=document.createElement('section');host.className='cc-panel-cell';host.textContent='Loading…';entry={id:p.id,host};entries.set(p.id,entry);page.append(host);}
   entry.host.style.order=shown.indexOf(p);entry.host.hidden=false;void load(entry,p);
  }
 }
 function update(value){
  if(!active(value)||value.sessionId!==groupId||!value.panels?.length){dialog.close();return;}
  const old=groups[index]||[],hadDeck=groups.some(g=>g[0].mode==='presentation');
  status=value;groups=pagesFor(value.panels);
  for(const [id,entry] of entries)if(!value.panels.some(p=>p.id===id)){dispose(entry);entries.delete(id);}
  const surviving=groups.findIndex(g=>g.some(p=>old.some(o=>o.id===p.id)));
  index=!hadDeck&&groups[0][0].mode==='presentation'?0:surviving>=0?surviving:Math.min(index,groups.length-1);
  for(const fn of [...subscriptions])fn();render();
 }
 const leave=()=>dialog.close();window.addEventListener('hashchange',leave);
 dialog.addEventListener('close',()=>{closed=true;off?.();window.removeEventListener('hashchange',leave);
  for(const entry of entries.values())dispose(entry);entries.clear();getProfile?.();},{once:true});
 render();off=watchRoom(result.room,update);
}
