(() => {
  'use strict';
  const key=()=>`teachertiles-reminders-v1:${window.TeacherTilesAccount?.state?.userId||'guest'}`;
  const read=()=>{try{const value=JSON.parse(localStorage.getItem(key())||'{}');return {items:value.items||{},inbox:Array.isArray(value.inbox)?value.inbox:[]}}catch{return {items:{},inbox:[]}}};
  const emit=()=>window.dispatchEvent(new CustomEvent('teachertiles:reminderschange'));
  const write=data=>{localStorage.setItem(key(),JSON.stringify(data));emit()};
  function register(item,boardId){const data=read(),old=data.items[item.id];data.items[item.id]={...item,boardId:boardId||old?.boardId||'',firedAt:old?.dueAt===item.dueAt?old.firedAt||0:0,deleted:false};write(data)}
  function cancel(id){const data=read();if(data.items[id]){data.items[id].deleted=true;write(data)}}
  function cancelBoard(boardId){const data=read();for(const item of Object.values(data.items))if(item.boardId===boardId)item.deleted=true;write(data)}
  function dismiss(id){const data=read();data.inbox=data.inbox.filter(item=>item.id!==id);write(data)}
  function popup(item){
    let stack=document.querySelector('.reminder-toasts');if(!stack){stack=document.createElement('div');stack.className='reminder-toasts';stack.setAttribute('aria-label','Reminder alerts');document.body.append(stack)}
    if(stack.querySelector(`[data-reminder-id="${CSS.escape(item.id)}"]`))return;
    const card=document.createElement('section');card.className='reminder-toast';card.dataset.reminderId=item.id;card.setAttribute('role','alert');const tag=document.createElement('small');tag.textContent='REMINDER';const title=document.createElement('strong');title.textContent=item.text;const time=document.createElement('span');time.textContent=new Date(item.dueAt).toLocaleString();const close=document.createElement('button');close.type='button';close.className='reminder-dismiss';close.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m5 10 3 3 7-7"/></svg><span>Dismiss</span>';close.onclick=()=>card.remove();card.append(tag,title,time,close);stack.append(card);
  }
  let checking=false;
  async function tick(){
    if(checking)return;checking=true;const scope=key();
    try{
      const work=()=>{
        if(key()!==scope)return;
        const data=read(),due=Object.values(data.items).filter(item=>!item.deleted&&!item.firedAt&&Number.isFinite(item.dueAt)&&item.dueAt<=Date.now());if(!due.length)return;
        for(const item of due){item.firedAt=Date.now();if(item.inbox)data.inbox.unshift({...item})}
        data.inbox=data.inbox.slice(0,100);write(data);
        for(const item of due){
          if(item.popup)popup(item);
          if(item.desktop&&'Notification' in window&&Notification.permission==='granted'){
            try{const notice=new Notification('TeacherTiles reminder',{body:item.text,tag:'teachertiles-reminder-'+item.id});notice.onclick=()=>{window.focus();notice.close()}}catch{}
          }
        }
      };
      if(navigator.locks)await navigator.locks.request(scope,work);else work();
    }catch(error){console.warn('Could not deliver reminders',error)}finally{checking=false}
  }
  // Only the currently loaded board is reconciled; other boards keep their schedules.
  function reconcile(){
    const api=window.TeacherTilesBoard;if(!api)return;
    const boardId=api.activeBoardId||'',data=read(),found=new Map();
    const hasTile=[...document.querySelectorAll('.workspace .module')].some(m=>m.dataset.type==='reminders'||m._tileTabs?.items?.some(item=>item.type==='reminders'));
    if(!hasTile&&!Object.values(data.items).some(item=>item.boardId===boardId&&!item.deleted))return;
    const before=JSON.stringify(data);
    const visit=object=>{if(object.tabs){object.tabs.items.forEach(visit);return}if(object.type==='reminders')for(const item of object.special?.items||[])found.set(item.id,item)};
    for(const object of api.capture().objects||[])visit(object);
    for(const [id,item] of Object.entries(data.items))if(item.boardId===boardId&&!found.has(id))item.deleted=true;
    for(const item of found.values()){const old=data.items[item.id];data.items[item.id]={...item,boardId,firedAt:old?.dueAt===item.dueAt?old.firedAt||0:0,deleted:false}}
    if(JSON.stringify(data)!==before)write(data);tick();
  }
  let syncTimer;
  const scheduleSync=()=>{clearTimeout(syncTimer);syncTimer=setTimeout(reconcile,150)};
  window.addEventListener('teachertiles:boardchange',scheduleSync);window.addEventListener('teachertiles:boardloaded',scheduleSync);
  let lastScope=key();
  window.addEventListener('teachertiles:accountchange',()=>{if(lastScope!==key()){document.querySelector('.reminder-toasts')?.remove();lastScope=key()}emit();tick()});
  window.addEventListener('storage',e=>{if(e.key===key()){emit();tick()}});document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick()});
  setInterval(tick,1000);
  function setup(m){
    let items=[];
    const form=m.querySelector('.reminders-form'),text=form.querySelector('[name="text"]'),date=form.querySelector('[name="date"]'),desktop=form.querySelector('[name="desktop"]'),list=m.querySelector('.reminders-list'),status=m.querySelector('.reminders-status');
    const defaultDate=()=>{const d=new Date(Date.now()+3600000);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)};date.value=defaultDate();
    const add=m.querySelector('.reminders-add');
    function compose(open){form.hidden=!open;m.classList.toggle('is-composing-reminder',open);add.setAttribute('aria-expanded',String(open));if(open){status.textContent='';if(new Date(date.value).getTime()<=Date.now())date.value=defaultDate();text.focus()}else add.focus({preventScroll:true})}
    add.onclick=()=>compose(form.hidden);m.querySelector('.reminders-cancel').onclick=()=>compose(false);form.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();compose(false)}});
    function render(){
      const stored=read();list.replaceChildren();
      if(!items.length){const empty=document.createElement('p');empty.className='reminders-empty';empty.textContent='A little nudge, right when you need it.';list.append(empty)}
      for(const item of [...items].sort((a,b)=>a.dueAt-b.dueAt)){
        const row=document.createElement('article');row.className='reminder-row';const copy=document.createElement('div'),title=document.createElement('strong'),time=document.createElement('small');title.textContent=item.text;time.textContent=(stored.items[item.id]?.firedAt?'Delivered · ':'')+new Date(item.dueAt).toLocaleString();copy.append(title,time);
        const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Delete reminder: '+item.text);remove.onclick=()=>{items=items.filter(other=>other.id!==item.id);cancel(item.id);notifyBoardChanged('reminder-delete');render()};row.append(copy,remove);list.append(row);
      }
    }
    desktop.addEventListener('change',async()=>{
      if(!desktop.checked)return;
      if(!('Notification' in window)||!window.isSecureContext){desktop.checked=false;status.textContent='Desktop notifications require HTTPS and a supported browser.';return}
      let permission=Notification.permission;try{if(permission==='default')permission=await Notification.requestPermission()}catch{}
      if(permission!=='granted'){desktop.checked=false;status.textContent='Desktop notifications are blocked. Allow them in your browser’s site settings, or use the other options.'}else status.textContent='Desktop notifications enabled.';
    });
    form.addEventListener('submit',e=>{
      e.preventDefault();const dueAt=new Date(date.value).getTime(),channels={inbox:form.elements.inbox.checked,popup:form.elements.popup.checked,desktop:desktop.checked};
      if(!text.value.trim()||!Number.isFinite(dueAt)||dueAt<=Date.now()){status.textContent='Enter a reminder and a future date and time.';return}
      if(!Object.values(channels).some(Boolean)){status.textContent='Choose at least one notification option.';return}
      if(items.length>=100){status.textContent='This tile holds up to 100 reminders. Remove old reminders to add more.';return}
      const item={id:crypto.randomUUID?.()||('reminder-'+Date.now().toString(36)+'-'+Array.from(crypto.getRandomValues(new Uint32Array(2))).join('-')),text:text.value.trim().slice(0,300),dueAt,...channels};
      try{register(item,window.TeacherTilesBoard?.activeBoardId);items.push(item);text.value='';status.textContent='Reminder scheduled.';notifyBoardChanged('reminder-add');render();compose(false)}catch{status.textContent='Could not save this reminder. Browser storage may be full.'}
    });
    list.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
    const onChange=()=>render();window.addEventListener('teachertiles:reminderschange',onChange);
    m._boardGetState=()=>({version:1,items:items.map(item=>({...item}))});
    m._boardSetState=state=>{items=(Array.isArray(state?.items)?state.items:[]).filter(item=>typeof item.id==='string'&&Number.isFinite(item.dueAt)).slice(0,100).map(item=>({...item,text:String(item.text||'').slice(0,300)}));render();scheduleSync()};
    const cleanup=m._cleanup;m._cleanup=()=>{window.removeEventListener('teachertiles:reminderschange',onChange);cleanup?.()};render();
  }
  window.TeacherTilesReminders=Object.freeze({setup,tick,reconcile,cancelBoard,inbox:()=>read().inbox,dismiss});
})();
