// Announcements are shared; only viewed revisions are stored per account.
export function createAnnouncementNotifications(call,getUid,onChange){
 let viewed=new Map(),items=[],epoch=0,loadedAt=0,pending=null,offset=0,expiryTimer,dialog;
 const now=()=>Date.now()+offset;
 const active=()=>items.filter(item=>item.expiresAt>now());
 function scheduleExpiry(){clearTimeout(expiryTimer);const next=Math.min(...active().map(i=>i.expiresAt));if(Number.isFinite(next))expiryTimer=setTimeout(()=>{items=active();if(dialog?.open&&!items.some(i=>i.id===dialog.dataset.id)){dialog.close();dialog.remove();dialog=null}onChange();scheduleExpiry()},Math.max(1,next-now()+20));}
 async function refresh(force=false){if(!getUid())return;if(pending)return pending;if(!force&&Date.now()-loadedAt<60000)return;const token=epoch,uid=getUid();pending=(async()=>{try{const data=await call('myAnnouncements',{action:'list'});if(token!==epoch||uid!==getUid())return;offset=data.serverTime-Date.now();items=(data.items||[]).map(i=>({...i,read:i.read||(viewed.get(i.id)||0)>=i.revision}));viewed=new Map(items.filter(i=>viewed.has(i.id)&&i.expiresAt>now()).map(i=>[i.id,viewed.get(i.id)]));loadedAt=Date.now();scheduleExpiry();onChange()}catch{}finally{if(token===epoch)pending=null}})();return pending}
 function node(tag,cls,text){const n=document.createElement(tag);n.className=cls||'';if(text)n.textContent=text;return n}
 async function view(item){
  if(item.expiresAt<=now()){onChange();return}dialog?.close();dialog?.remove();
  const modal=node('dialog','announcement-reader'),head=node('header'),title=node('h2','',item.title),close=node('button','announcement-close','×');title.id='announcement-title';modal.setAttribute('aria-labelledby',title.id);modal.dataset.id=item.id;close.type='button';close.setAttribute('aria-label','Close announcement');close.onclick=()=>modal.close();
  const copy=node('p','announcement-message',item.message),meta=node('p','announcement-meta',`TeacherTiles · Available until ${new Date(item.expiresAt).toLocaleString()}`),status=node('p','announcement-meta');status.setAttribute('role','status');head.append(title,close);modal.append(head,copy,meta,status);document.body.append(modal);dialog=modal;modal.showModal();
  modal.addEventListener('close',()=>{modal.remove();if(dialog===modal)dialog=null});
  if(item.read)return;const token=epoch,uid=getUid();
  try{const result=await call('myAnnouncements',{action:'read',id:item.id,revision:item.revision});if(token!==epoch||uid!==getUid())return;if(result.read){viewed.set(item.id,item.revision);items=items.map(i=>i.id===item.id&&i.revision===item.revision?{...i,read:true}:i);onChange()}else{status.textContent='This announcement changed or expired. Close it and open the latest version.';void refresh(true)}}catch{if(token===epoch)status.textContent='Could not save read status. Close and reopen to retry.'}
 }
 function render(container){for(const item of active()){
  const card=node('article','profile-notification-card announcement-card'),symbol=node('span','profile-notification-card__icon');symbol.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 10v5h4l12 5V4L8 10H4ZM8 15l2 6h4l-2-4"/></svg>';
  card.classList.toggle('is-unread',!item.read);const copy=node('div','profile-notification-card__copy'),title=node('strong','',item.title),meta=node('small','',`TeacherTiles announcement${item.read?' · Read':' · New'}`),open=node('button','reminder-dismiss','View announcement');open.type='button';open.onclick=()=>view(item);copy.append(title,meta,open);card.append(symbol,copy);container.append(card)
 }}
 function reset(){epoch++;viewed.clear();items=[];loadedAt=0;pending=null;offset=0;clearTimeout(expiryTimer);dialog?.close();dialog?.remove();dialog=null;onChange()}
 // Refresh only while the app is visible; no per-user snapshot listener or writes on polling.
 const poll=()=>{if(!document.hidden)void refresh()};setInterval(poll,300000);document.addEventListener('visibilitychange',poll);
 return {refresh,render,reset,get count(){return active().filter(i=>!i.read).length},get size(){return active().length}};
}
