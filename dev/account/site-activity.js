// One lightweight activity update per account per five minutes, shared across tabs.
export function startSiteActivity(getUser,call) {
  let pending=false;
  const queue = 'indexedDB' in window ? import('./tile-placement-queue.js').catch(()=>null) : Promise.resolve(null);
  const placed = event => {
    const uid = getUser()?.uid, id = event.detail;
    if (uid && typeof id === 'string') void queue.then(store => store?.addPlacement(uid,id)).catch(()=>{});
  };
  window.addEventListener('teachertiles:placed-from-menu',placed);
  const tick=async()=>{
    const user=getUser();if(!user||document.hidden||pending)return;
    const key='teacherTilesActivity:'+user.uid;
    const send=async()=>{
      let last=0;try{last=Number(localStorage.getItem(key)||0)}catch{}
      if(Date.now()-last<300000)return;
      // Reserve the interval before sending, including failures, to avoid retry storms.
      try{localStorage.setItem(key,String(Date.now()))}catch{}
      let batch;
      const store = await queue;
      try { batch = await store?.pendingPlacements(user.uid); } catch {}
      try {
        const result = await call('recordSiteActivity',batch ? {placements:batch} : {});
        if (batch && result?.data) await store.finishPlacementBatch(user.uid,batch.id,result.data);
      } catch {}
    };
    pending=true;
    try{if(navigator.locks)await navigator.locks.request(key,{ifAvailable:true},lock=>lock?send():undefined);else await send();}finally{pending=false;}
  };
  const timer=setInterval(tick,30000);
  document.addEventListener('visibilitychange',tick);
  window.addEventListener('teachertiles:authchange',tick);
  void tick();
  return ()=>{window.removeEventListener('teachertiles:placed-from-menu',placed);clearInterval(timer);document.removeEventListener('visibilitychange',tick);window.removeEventListener('teachertiles:authchange',tick);};
}
