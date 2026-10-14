function clearSelection(){for(const el of selectedModules)el.classList.remove('is-selected');selectedModules.clear()}

function selectModule(m){if(!m||!m.isConnected)return;selectedModules.add(m);m.classList.add('is-selected')}

function toggleSelection(m){if(selectedModules.has(m)){selectedModules.delete(m);m.classList.remove('is-selected')}else selectModule(m)}

function selectModules(modules,{add=false}={}){if(!add)clearSelection();for(const m of modules)selectModule(m)}

function notifyBoardChanged(reason='change'){
  if(boardChangeSuspended)return;
  clearTimeout(boardChangeTimer);
  boardChangeTimer=setTimeout(()=>{
    window.dispatchEvent(new CustomEvent('teachertiles:boardchange',{detail:{reason}}));
  },90);
}

function withBoardChangesSuspended(fn){
  boardChangeSuspended++;
  try{return fn()}finally{boardChangeSuspended=Math.max(0,boardChangeSuspended-1)}
}

function isTypingTarget(target){
  if(!(target instanceof Element))return false;
  return Boolean(target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'));
}

function disableModuleSpellcheck(root){
  if(!(root instanceof Element))return;
  if(root.classList.contains('module'))root.setAttribute('spellcheck','false');
  const fields=[];
  if(root.matches('input,textarea,[contenteditable]'))fields.push(root);
  fields.push(...root.querySelectorAll('input,textarea,[contenteditable]'));
  for(const field of fields){
    if(field.dataset.spellcheckManaged==='true')continue;
    field.spellcheck=false;
    field.setAttribute('spellcheck','false');
  }
}

function captureModuleTransform(m){
  if(m?._tileFullscreenTransform)return {...m._tileFullscreenTransform};
  const restingHeight=Number(m?._transientRestingHeight);
  return{
    left:m.offsetLeft,
    top:m.offsetTop,
    width:m.offsetWidth,
    height:Number.isFinite(restingHeight)?restingHeight:m.offsetHeight,
    rotation:m.dataset.stickerRotation??null,
    snapGroup:m.dataset.snapGroup??null,
    uniformScale:tileUniformScale(m)
  };
}

function applyModuleTransform(m,state){
  if(!m||!state)return;
  const priorSnapGroup=m.dataset.snapGroup||'';
  const displayHeightOffset=Number(m._resizeDisplayHeightOffset)||0;
  const legacyScale=Math.max(.5,Math.min(1,Number(state.uniformScale)||1));
  const stateHeight=(Number(state.height)||m.offsetHeight)*legacyScale;
  if(displayHeightOffset)m._transientRestingHeight=stateHeight;
  Object.assign(m.style,{left:`${state.left}px`,top:`${state.top}px`,width:`${state.width*legacyScale}px`,height:`${stateHeight+displayHeightOffset}px`});
  fitTileDisplaySize(m,state.width*legacyScale,stateHeight+displayHeightOffset);
  if(state.rotation!==null){
    m.dataset.stickerRotation=String(state.rotation);
    m.style.setProperty('--sticker-rotation',`${state.rotation}deg`);
    const readout=m.querySelector('.sticker-rotation-readout');
    if(readout)readout.textContent=`${Math.round(((Number(state.rotation)%360)+360)%360)}°`;
  }
  if(state.snapGroup!==undefined){
    if(state.snapGroup)m.dataset.snapGroup=String(state.snapGroup);
    else delete m.dataset.snapGroup;
    if(priorSnapGroup)refreshSnapGroupState(priorSnapGroup);
    if(state.snapGroup)refreshSnapGroupState(String(state.snapGroup));
    else m.classList.remove('is-snap-grouped');
  }
  if(m.dataset.type==='sticker')updateStickerVisualSize(m);
}

function transformsDiffer(a,b){
  if(!a||!b)return true;
  if(Math.abs((a.uniformScale||1)-(b.uniformScale||1))>.001)return true;
  return Math.abs(a.left-b.left)>.1||Math.abs(a.top-b.top)>.1||Math.abs(a.width-b.width)>.1||Math.abs(a.height-b.height)>.1||String(a.rotation)!==String(b.rotation)||String(a.snapGroup)!==String(b.snapGroup);
}

function historyElements(action){
  if(action.type==='transform'||action.type==='tile-edit'||action.type==='tab-merge')return action.entries.map(entry=>entry.el);
  if(action.type==='delete')return action.entries.map(entry=>entry.el);
  if(action.type==='drawing'||action.type==='skin')return action.el?[action.el]:[];
  return action.elements||[];
}

function finalizeHistoryAction(action){
  if(!action)return;
  if(action.type==='drawing')return;
  for(const el of historyElements(action))if(el&&!el.isConnected)el._cleanup?.();
}

function recordHistory(action){
  if(applyingHistory||!action)return;
  undoStack.push(action);
  while(undoStack.length>HISTORY_LIMIT)finalizeHistoryAction(undoStack.shift());
  while(redoStack.length)finalizeHistoryAction(redoStack.pop());
  notifyBoardChanged(action.type||'history');
}

function recordTransformHistory(modules,before){
  if(applyingHistory)return;
  const entries=[];
  for(const el of modules){
    if(!el||!el.isConnected)continue;
    const prior=before.get(el);
    const after=captureModuleTransform(el);
    if(prior&&transformsDiffer(prior,after))entries.push({el,before:prior,after});
  }
  if(entries.length)recordHistory({type:'transform',entries});
}

function detachHistoryElements(elements){
  const snapGroups=new Set(elements.map(el=>el?.dataset.snapGroup).filter(Boolean));
  for(const el of elements){
    selectedModules.delete(el);
    el.classList.remove('is-selected','is-over-trash','is-dragging');
    el._deactivate?.();
    for(const media of el.querySelectorAll('audio,video'))media.pause();
    for(const sound of el._activeTileSounds||[]){sound.pause();releaseBoostedMedia(sound)}
    el._activeTileSounds?.clear();
    if(el.isConnected)el.remove();
  }
  for(const id of snapGroups)refreshSnapGroupState(id);
}

function restoreDeletedEntries(entries){
  const snapGroups=new Set();
  for(const entry of [...entries].reverse()){
    const {el,nextSibling}=entry;
    if(el.dataset.snapGroup)snapGroups.add(el.dataset.snapGroup);
    if(el.isConnected)continue;
    if(nextSibling?.parentNode===workspace)workspace.insertBefore(el,nextSibling);
    else workspace.appendChild(el);
    el._reactivate?.();
  }
  for(const id of snapGroups)refreshSnapGroupState(id);
}

function applyHistoryAction(action,direction){
  applyingHistory=true;
  try{
    if(action.type==='add'){
      if(direction==='undo')detachHistoryElements(action.elements);
      else for(const el of action.elements)if(!el.isConnected){workspace.appendChild(el);el._reactivate?.()}
    }else if(action.type==='delete'){
      if(direction==='undo')restoreDeletedEntries(action.entries);
      else detachHistoryElements(action.entries.map(entry=>entry.el));
    }else if(action.type==='transform'){
      for(const entry of action.entries){
        applyModuleTransform(entry.el,direction==='undo'?entry.before:entry.after);
        if(isTilePinned(entry.el))capturePinnedTileScreenAnchor(entry.el,{baseScale:Number(entry.el.dataset.pinBaseScale)||boardCamera.scale});
      }
     }else if(action.type==='tab-merge'){
      const [target,source]=action.entries;
      target.el=restoreTileEdit(target.el,direction==='undo'?target.before:target.after);
      if(direction==='undo'){
        restoreDeletedEntries([source]);
        source.el=restoreTileEdit(source.el,source.before);
      }else detachHistoryElements([source.el]);
    }else if(action.type==='tile-edit'){
      for(const entry of action.entries)entry.el=restoreTileEdit(entry.el,direction==='undo'?entry.before:entry.after);
    }else if(action.type==='skin'){
      action.el=applyTileSkinToModule(action.el,direction==='undo'?action.before:action.after,{record:false});
    }else if(action.type==='drawing'){
      action.el?._setDrawHistoryCursor?.(direction==='undo'?action.before:action.after);
    }
    const active=historyElements(action).filter(el=>el.isConnected);
    if(active.length)selectModules(active);
    else clearSelection();
    updateWorkspaceEmptyState();
  }finally{applyingHistory=false}
}

function undoBoardAction(){
  window.TeacherTilesEditHistory?.flush();
  const action=undoStack.pop();
  if(!action)return;
  applyHistoryAction(action,'undo');
  redoStack.push(action);
  notifyBoardChanged('undo');
}

function redoBoardAction(){
  window.TeacherTilesEditHistory?.flush();
  const action=redoStack.pop();
  if(!action)return;
  applyHistoryAction(action,'redo');
  undoStack.push(action);
  notifyBoardChanged('redo');
}

function deleteModules(modules,{record=true}={}){
  const unique=[...new Set(modules)].filter(el=>el?.isConnected&&el.classList.contains('module'));
  if(!unique.length)return;
  const entries=unique.map(el=>({el,nextSibling:el.nextSibling}));
  if(record)recordHistory({type:'delete',entries});
  detachHistoryElements(unique);
  updateWorkspaceEmptyState();
}
