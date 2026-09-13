/* Capture user edits through the same serializers used by board saves. */
(()=>{
  let pending=null,timer=0;const deferred=new Set();
  const normalize=s=>{
    const value=structuredClone(s);delete value.transform;delete value.zIndex;
    value.classes=(value.classes||[]).filter(c=>!/^is-|^has-/.test(c)).sort();
    if(value.timer?.running)delete value.timer.left;
    return JSON.stringify(value);
  };
  function target(event){
    const direct=event.target.closest?.('.module');
    if(direct&&workspace.contains(direct))return direct;
    if(event.target.closest?.('.tile-appearance-flyout,.tile-skins-drawer,.timer-shape-shelf'))return workspace.querySelector('.is-appearance-open,.is-skins-open,.has-shape-shelf-open');
    return null;
  }
  function flush(){
    clearTimeout(timer);const transaction=pending;pending=null;if(!transaction||applyingHistory||boardChangeSuspended)return;
    const entries=[];
    for(const [el,before] of transaction.states){if(!el.isConnected)continue;const after=serializeBoardModule(el);if(!after||before.dataset.tileSkin!==after.dataset.tileSkin)continue;if(normalize(before)!==normalize(after))entries.push({el,before,after});}
    if(entries.length)recordHistory({type:'tile-edit',entries});
    else if(transaction.async&&Date.now()<transaction.expires)deferred.add(transaction);
  }
  function begin(event){
    if(applyingHistory||boardChangeSuspended)return;
    const m=target(event);if(!m)return;
    if(event.target.closest?.('.module-delete,.resize-handle,.module-drag-handle,.tile-skins-toggle')||m.dataset.type==='draw'&&event.target.closest?.('canvas'))return;
    if(pending?.module===m&&event.type!=='pointerdown'){clearTimeout(timer);return;}
    flush();const peers=m.dataset.timerSync==='true'?timerSyncPeers(m):[m];
    pending={module:m,async:event.target.matches?.('input[type=file]'),expires:Date.now()+60000,states:new Map(peers.map(el=>[el,serializeBoardModule(el)]).filter(([,s])=>s))};
  }
  function settle(){if(pending){clearTimeout(timer);timer=setTimeout(flush,450)}}
  for(const event of ['pointerdown','keydown','beforeinput','focusin'])document.addEventListener(event,begin,true);
  for(const event of ['click','input','change','pointerup','keyup','focusout'])document.addEventListener(event,settle,true);
  window.addEventListener('teachertiles:boardchange',()=>{
    settle();
    for(const transaction of [...deferred]){
      if(!transaction.module.isConnected||Date.now()>transaction.expires){deferred.delete(transaction);continue;}
      const entries=[];for(const [el,before] of transaction.states){const after=serializeBoardModule(el);if(after&&normalize(before)!==normalize(after))entries.push({el,before,after});}
      if(entries.length){deferred.delete(transaction);if(!applyingHistory&&!boardChangeSuspended)recordHistory({type:'tile-edit',entries});}
    }
  });
  window.TeacherTilesEditHistory={flush};
})();
