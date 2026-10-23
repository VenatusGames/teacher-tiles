// Announcements are shared; only viewed revisions are stored per account.
export function createAnnouncementNotifications(call,getUid,onChange,realtime=null){
 let viewed=new Map(),items=[],epoch=0,loadedAt=0,pending=null,offset=0,expiryTimer,dialog,unsubscribe=null,liveItems=null,liveRetryAt=0,receiptPending=null,receiptsReady=false,receiptRetryTimer;
 let countdownTimer;const countdowns=new Map(),readRequests=new Map();
 const now=()=>Date.now()+offset;
 const active=()=>items.filter(item=>item.expiresAt>now());
 function scheduleExpiry(){clearTimeout(expiryTimer);const next=Math.min(...active().map(i=>i.expiresAt));if(Number.isFinite(next))expiryTimer=setTimeout(()=>{items=active();if(dialog?.open&&!items.some(i=>i.id===dialog.dataset.id)){dialog.close();dialog.remove();dialog=null}onChange();scheduleExpiry()},Math.max(1,next-now()+20));}
 function publish(next){
  items=next.map(i=>({...i,read:Boolean(i.read)||(viewed.get(i.id)||0)>=i.revision}));
  for(const item of items)if(item.read)viewed.set(item.id,Math.max(viewed.get(item.id)||0,item.revision));
  viewed=new Map(items.filter(i=>viewed.has(i.id)&&i.expiresAt>now()).map(i=>[i.id,viewed.get(i.id)]));
  scheduleExpiry();onChange();
 }
 async function loadReceipts(){
  if(receiptsReady||!liveItems?.length)return;if(receiptPending)return receiptPending;
  const token=epoch,uid=getUid();
  receiptPending=(async()=>{try{
   const read=await realtime.readReceipts(uid);if(token!==epoch||uid!==getUid())return;
   for(const [id,revision] of Object.entries(read||{}))if(Number.isSafeInteger(revision)&&revision>0)viewed.set(id,Math.max(viewed.get(id)||0,revision));
   receiptsReady=true;clearTimeout(receiptRetryTimer);if(liveItems)publish(liveItems);
  }catch{
   if(token!==epoch||uid!==getUid())return;
   // Deliver the message even if read-status loading fails; retry without hiding new notices.
   if(liveItems)publish(liveItems);clearTimeout(receiptRetryTimer);
   receiptRetryTimer=setTimeout(()=>{if(token===epoch)void loadReceipts()},15000);
  }finally{if(token===epoch)receiptPending=null}})();return receiptPending;
 }
 function startRealtime(){
  if(unsubscribe)return true;if(!realtime||Date.now()<liveRetryAt)return false;
  const token=epoch,uid=getUid();
  try{
   unsubscribe=realtime.subscribe(config=>{
    if(token!==epoch||uid!==getUid())return;
    liveItems=Object.values(config?.items||{}).filter(i=>i&&typeof i.id==='string'&&Number.isSafeInteger(i.revision)&&i.expiresAt>now()).sort((a,b)=>b.createdAt-a.createdAt||a.id.localeCompare(b.id));
    if(receiptsReady||!liveItems.length)publish(liveItems);else void loadReceipts();
   },()=>{
    if(token!==epoch||uid!==getUid())return;
    unsubscribe?.();unsubscribe=null;liveItems=null;liveRetryAt=Date.now()+60000;
    // Keep the previous callable path available during rollout or permission failures.
    void refresh();
   });
   return Boolean(unsubscribe);
  }catch{liveRetryAt=Date.now()+60000;return false}
 }
 async function refresh(force=false){
  if(!getUid())return;
  if(startRealtime()){if(liveItems)await loadReceipts();return;}
  if(pending)return pending;if(!force&&Date.now()-loadedAt<60000)return;
  const token=epoch,uid=getUid();pending=(async()=>{try{
   const data=await call('myAnnouncements',{action:'list'});if(token!==epoch||uid!==getUid()||liveItems)return;
   if(Number.isFinite(data.serverTime))offset=data.serverTime-Date.now();loadedAt=Date.now();publish(data.items||[]);
  }catch{}finally{if(token===epoch)pending=null}})();return pending;
 }
 function node(tag,cls,text){const n=document.createElement(tag);n.className=cls||'';if(text)n.textContent=text;return n}
 function updateCountdowns(){
  clearTimeout(countdownTimer);let next=Infinity;
  for(const [badge,expiresAt] of countdowns){
   if(!badge.isConnected){countdowns.delete(badge);continue}
   const remaining=Math.max(0,expiresAt-now()),hours=Math.ceil(remaining/3600000);
   badge.querySelector('span').textContent=`${hours}h`;
   badge.setAttribute('aria-label',`Expires in ${hours} ${hours===1?'hour':'hours'}`);
   badge.title=`Available until ${new Date(expiresAt).toLocaleString()}`;
   if(remaining)next=Math.min(next,remaining-(hours-1)*3600000+20);
  }
  // The countdown uses the device clock, without fetching or writing anything.
  if(Number.isFinite(next))countdownTimer=setTimeout(updateCountdowns,next);
 }
 async function markRead(item){
  if(item.read||(viewed.get(item.id)||0)>=item.revision)return;
  if(item.expiresAt<=now())throw Error('This announcement has expired.');
  const token=epoch,uid=getUid(),key=`${uid}:${item.id}:${item.revision}`;
  if(readRequests.has(key))return readRequests.get(key);
  const request=(async()=>{
   let result;
   try{result=await call('myAnnouncements',{action:'read',id:item.id,revision:item.revision})}
   catch{if(token===epoch&&uid===getUid())throw Error('Could not save read status. Please try again.');return}
   if(token!==epoch||uid!==getUid())return;
   if(!result.read){void refresh(true);throw Error('This announcement changed or expired. Open the latest version.')}
   viewed.set(item.id,Math.max(viewed.get(item.id)||0,item.revision));channel?.postMessage({uid,id:item.id,revision:item.revision});
   items=items.map(i=>i.id===item.id&&i.revision===item.revision?{...i,read:true}:i);onChange();
  })();
  readRequests.set(key,request);
  try{return await request}finally{if(readRequests.get(key)===request)readRequests.delete(key)}
 }
 async function view(item){
  if(item.expiresAt<=now()){onChange();return}dialog?.close();dialog?.remove();
  const modal=node('dialog','announcement-reader'),head=node('header'),title=node('h2','',item.title),close=node('button','announcement-close','×');title.id='announcement-title';modal.setAttribute('aria-labelledby',title.id);modal.dataset.id=item.id;close.type='button';close.setAttribute('aria-label','Close announcement');close.onclick=()=>modal.close();
  const copy=node('p','announcement-message',item.message),meta=node('p','announcement-meta',`TeacherTiles · Available until ${new Date(item.expiresAt).toLocaleString()}`),status=node('p','announcement-meta');status.setAttribute('role','status');head.append(title,close);modal.append(head,copy,meta,status);document.body.append(modal);dialog=modal;modal.showModal();
  modal.addEventListener('close',()=>{modal.remove();if(dialog===modal)dialog=null});
  try{await markRead(item)}catch(error){if(modal.isConnected)status.textContent=error.message}
 }
 function render(container){
  clearTimeout(countdownTimer);countdowns.clear();
  for(const item of active()){
   const card=node('article','profile-notification-card announcement-card'),symbol=node('span','profile-notification-card__icon');symbol.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 10v5h4l12 5V4L8 10H4ZM8 15l2 6h4l-2-4"/></svg>';
   const timer=node('span','announcement-time');timer.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span></span>';countdowns.set(timer,item.expiresAt);
   card.classList.toggle('is-unread',!item.read);const copy=node('div','profile-notification-card__copy'),title=node('strong','',item.title),meta=node('small','',`TeacherTiles announcement${item.read?' · Read':' · New'}`),open=node('button','reminder-dismiss','View announcement');open.type='button';open.onclick=()=>view(item);
   const actions=node('div','announcement-actions'),mark=node('button','reminder-dismiss',item.read?'Read':'Mark as Read'),status=node('small','announcement-read-status');status.setAttribute('role','status');mark.type='button';mark.disabled=item.read;
   mark.onclick=async()=>{mark.disabled=true;mark.textContent='Saving…';status.textContent='';try{await markRead(item)}catch(error){status.textContent=error.message}finally{if(mark.isConnected){mark.disabled=item.read||(viewed.get(item.id)||0)>=item.revision;mark.textContent=mark.disabled?'Read':'Mark as Read'}}};
   const heading=node('div','announcement-heading');heading.append(title,timer);actions.append(open,mark);copy.append(heading,meta,actions,status);card.append(symbol,copy);container.append(card);
  }
  updateCountdowns();
 }
 function reset(){clearTimeout(countdownTimer);countdowns.clear();readRequests.clear();epoch++;unsubscribe?.();unsubscribe=null;liveItems=null;liveRetryAt=0;receiptPending=null;receiptsReady=false;clearTimeout(receiptRetryTimer);viewed.clear();items=[];loadedAt=0;pending=null;offset=0;clearTimeout(expiryTimer);dialog?.close();dialog?.remove();dialog=null;onChange()}
 // A live connection does not poll. The old interval is only a rollout/error fallback.
 const poll=()=>{if(!document.hidden&&!unsubscribe)void refresh()};setInterval(poll,300000);
 const resume=()=>{if(!document.hidden){updateCountdowns();void refresh()}};document.addEventListener('visibilitychange',resume);window.addEventListener('online',resume);window.addEventListener('focus',resume);
 // Acknowledgements in another tab need no extra receipt reads or writes.
 let channel=null;try{channel=new BroadcastChannel('tt-announcements:'+new URL('.',import.meta.url).pathname)}catch{}
 if(channel)channel.onmessage=({data})=>{if(!data||data.uid!==getUid()||!Number.isSafeInteger(data.revision)||!items.some(i=>i.id===data.id))return;viewed.set(data.id,Math.max(viewed.get(data.id)||0,data.revision));publish(liveItems||items)};
 return {refresh,render,reset,get count(){return active().filter(i=>!i.read).length},get size(){return active().length}};
}
