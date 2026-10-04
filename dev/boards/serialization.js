function makeBoardObjectId(){
  if(globalThis.crypto?.randomUUID)return crypto.randomUUID();
  return`obj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
}

function ensureBoardObjectId(m){
  if(!m.dataset.boardObjectId)m.dataset.boardObjectId=makeBoardObjectId();
  return m.dataset.boardObjectId;
}

function boardTypeAvailable(type){
  return type==='sticker'||Boolean(document.getElementById(`${type}-template`));
}

function boardStickerAvailable(sticker){
  if(!sticker||typeof sticker!=='object')return false;
  const wantedEmoji=String(sticker.emoji||'');
  const wantedSrc=String(sticker.src||'');
  if(!wantedEmoji&&!wantedSrc)return false;
  return[...document.querySelectorAll('[data-sticker-src],[data-sticker-emoji]')].some(item=>{
    if(wantedEmoji&&String(item.dataset.stickerEmoji||'')===wantedEmoji)return true;
    if(wantedSrc&&String(item.dataset.stickerSrc||'')===wantedSrc)return true;
    return false;
  });
}

function captureBoardDataset(m){
  const data={};
  for(const [key,value] of Object.entries(m.dataset)){
    if(['type','boardObjectId','stickerDragReady'].includes(key))continue;
    data[key]=value;
  }
  return data;
}

function restoreBoardDataset(m,dataset){
  if(!dataset||typeof dataset!=='object')return;
  for(const [key,value] of Object.entries(dataset)){
    if(key==='type'||key==='boardObjectId')continue;
    m.dataset[key]=String(value);
  }
}

function captureBoardFields(m){
  return[...m.querySelectorAll('input,textarea,select')].map((field,index)=>{
    if(field instanceof HTMLInputElement&&field.type==='file')return null;
    const saved={index,value:field.value};
    if('checked'in field)saved.checked=Boolean(field.checked);
    return saved;
  }).filter(Boolean);
}

function restoreBoardFields(m,fields,{dispatch=false}={}){
  if(!Array.isArray(fields))return;
  const controls=[...m.querySelectorAll('input,textarea,select')];
  for(const saved of fields){
    const field=controls[saved.index];
    if(!field||(field instanceof HTMLInputElement&&field.type==='file'))continue;
    if(typeof saved.value==='string')field.value=saved.value;
    if(saved.checked!==undefined&&'checked'in field)field.checked=Boolean(saved.checked);
    if(dispatch){
      field.dispatchEvent(new Event('input',{bubbles:true}));
      field.dispatchEvent(new Event('change',{bubbles:true}));
    }
  }
}

function captureBoardEditables(m){
  return[...m.querySelectorAll('[contenteditable]:not([contenteditable="false"])')].map((el,index)=>({index,html:el.innerHTML}));
}

function restoreBoardEditables(m,editables,{dispatch=false}={}){
  if(!Array.isArray(editables))return;
  const elements=[...m.querySelectorAll('[contenteditable]:not([contenteditable="false"])')];
  for(const saved of editables){
    const el=elements[saved.index];
    if(!el)continue;
    el.innerHTML=typeof saved.html==='string'?saved.html:'';
    if(dispatch)el.dispatchEvent(new Event('input',{bubbles:true}));
  }
}

function captureBoardClasses(m){
  return[...m.classList].filter(name=>
    !BOARD_TRANSIENT_CLASSES.has(name)&&
    name!=='module'&&
    !name.endsWith('-module')
  );
}

function applyBoardPreSetupState(m,state){
  if(!state)return;
  if(state.id)m.dataset.boardObjectId=state.id;
  restoreBoardDataset(m,state.dataset);
  if(m.dataset.type==='boombox'&&!m.dataset.tileSkin){
    const legacyStyle=m.dataset.playerStyle||state.special?.playerStyle||'';
    const legacySkinId={vinyl:'soundscapes-vinyl',music:'soundscapes-music-player',ipod:'soundscapes-ipod'}[legacyStyle]||'';
    const legacySkin=legacySkinId?tileSkinById(legacySkinId):null;
    if(legacySkin&&tileSkinIsOwned(legacySkin))m.dataset.tileSkin=legacySkinId;
  }
  if(m.dataset.type==='boombox')delete m.dataset.playerStyle;
  for(const cls of Array.isArray(state.classes)?state.classes:[]){
    if(!BOARD_TRANSIENT_CLASSES.has(cls))m.classList.add(cls);
  }
  restoreBoardFields(m,state.fields,{dispatch:false});
  restoreBoardEditables(m,state.editables,{dispatch:false});
}

function applyBoardPostSetupState(m,state){
  if(!m||!state)return;
  // Setup routines may establish their own default data attributes while they
  // wire controls. Reapply the saved customization after setup so colors,
  // fonts, layouts, styles, and other dataset-backed choices always survive.
  restoreBoardDataset(m,state.dataset);
  if(m.dataset.type==='boombox')delete m.dataset.playerStyle;
  restoreBoardFields(m,state.fields,{dispatch:true});
  restoreBoardEditables(m,state.editables,{dispatch:true});

  if(state.special&&typeof m._boardSetState==='function'){
    try{m._boardSetState(state.special)}catch(error){console.warn('TeacherTiles could not restore module state',state.type,error)}
  }
  if(state.timer&&typeof m._boardTimerSetState==='function'){
    try{m._boardTimerSetState(state.timer)}catch(error){console.warn('TeacherTiles could not restore timer state',error)}
  }

  if(m.dataset.type==='sticker'){
    delete m.dataset.tilePinned;delete m.dataset.pinScreenX;delete m.dataset.pinScreenY;
    m.classList.remove('is-tile-pinned','is-tabbed-tile');
  }else if(state.tabs)window.TeacherTilesTabs?.restore(m,state.tabs);
  if(state.transform)applyModuleTransform(m,state.transform);
  if(state.zIndex!==undefined&&Number.isFinite(Number(state.zIndex))){
    const saved=Math.max(1,Math.round(Number(state.zIndex)));
    if(m.dataset.type==='sticker'){
      const local=saved>=STICKER_Z_BASE?saved-STICKER_Z_BASE:saved;
      stickerZ=Math.max(stickerZ,local);
      m.style.zIndex=String(STICKER_Z_BASE+local);
    }else{
      const local=Math.min(STICKER_Z_BASE-1,saved);
      tileZ=Math.max(tileZ,local);
      m.style.zIndex=String(local);
    }
  }

  if(m.dataset.type==='youtube'&&state.special?.loaded&&m.querySelector('.youtube-load')){
    requestAnimationFrame(()=>{if(m.isConnected)m.querySelector('.youtube-load')?.click()});
  }
  disableModuleSpellcheck(m);
  syncTilePinControl(m);
  syncTileLockControl(m);
  if(isTilePinned(m)){
    delete m.dataset.pinBaseScale;
    syncPinnedTileToCamera(m);
  }
  layoutTileOptionControls(m);
}

function serializeBoardModule(m){
  const type=m.dataset.type||'';
  if(!type||!boardTypeAvailable(type))return null;
  const id=ensureBoardObjectId(m);
  const base={
    id,
    schemaVersion:BOARD_SAVE_SCHEMA_VERSION,
    type,
    transform:captureModuleTransform(m),
    zIndex:Number(m.style.zIndex)||0,
    dataset:captureBoardDataset(m),
    fields:captureBoardFields(m),
    editables:captureBoardEditables(m),
    classes:captureBoardClasses(m)
  };

  if(type==='sticker'){
    base.sticker={
      src:m.dataset.stickerSrc||m.querySelector('.sticker-visual img')?.getAttribute('src')||'',
      emoji:m.dataset.stickerEmoji||m.querySelector('.sticker-emoji')?.textContent||'',
      name:m.dataset.stickerName||m.getAttribute('aria-label')?.replace(/\s+sticker$/i,'')||'Sticker',
      aspect:Number(m.dataset.stickerAspect)||m._stickerRatio||1
    };
  }

  if(typeof m._boardGetState==='function'){
    try{base.special=m._boardGetState()}catch(error){console.warn('TeacherTiles could not capture module state',type,error)}
  }
  if(typeof m._boardTimerGetState==='function'){
    try{base.timer=m._boardTimerGetState()}catch(error){console.warn('TeacherTiles could not capture timer state',error)}
  }

  return window.TeacherTilesTabs?.capture(m,base)||base;
}

function buildBoardPreview(objects){
  const list=(Array.isArray(objects)?objects:[]).filter(Boolean).slice(0,48);
  if(!list.length)return[];
  const boxes=list.map(object=>{
    const t=object.transform||{};
    return{
      object,
      left:Number(t.left)||0,
      top:Number(t.top)||0,
      width:Math.max(24,(Number(t.width)||160)*(Number(t.uniformScale)||1)),
      height:Math.max(24,(Number(t.height)||120)*(Number(t.uniformScale)||1))
    };
  });
  let minX=Math.min(...boxes.map(box=>box.left));
  let minY=Math.min(...boxes.map(box=>box.top));
  let maxX=Math.max(...boxes.map(box=>box.left+box.width));
  let maxY=Math.max(...boxes.map(box=>box.top+box.height));
  const pad=Math.max(120,Math.max(maxX-minX,maxY-minY)*.08);
  minX-=pad;minY-=pad;maxX+=pad;maxY+=pad;
  let spanX=Math.max(1,maxX-minX),spanY=Math.max(1,maxY-minY);
  const previewAspect=16/10,contentAspect=spanX/spanY;
  if(contentAspect>previewAspect){
    const fittedHeight=spanX/previewAspect;
    minY-=(fittedHeight-spanY)/2;
    spanY=fittedHeight;
  }else{
    const fittedWidth=spanY*previewAspect;
    minX-=(fittedWidth-spanX)/2;
    spanX=fittedWidth;
  }

  return boxes.map(({object,left,top,width,height})=>({
    type:object.type,
    x:clamp((left-minX)/spanX,0,1),
    y:clamp((top-minY)/spanY,0,1),
    w:clamp(width/spanX,.001,1),
    h:clamp(height/spanY,.001,1),
    zIndex:Number(object.zIndex)||0,
    emoji:object.sticker?.emoji||'',
    src:object.sticker?.src&&!String(object.sticker.src).startsWith('data:')?object.sticker.src:''
  }));
}

function captureTeacherTilesBoard(){
  const objects=[...workspace.querySelectorAll('.module')].map(serializeBoardModule).filter(Boolean);
  objects.push(...unrestoredBoardObjects);
  return{
    schemaVersion:BOARD_SAVE_SCHEMA_VERSION,
    theme:activeBoardTheme||'light',
    camera:{x:boardCamera.x,y:boardCamera.y,scale:boardCamera.scale},
    frames:boardFrames.map(frame=>({...frame})),
    preferences:boardPreferenceSnapshot(),
    calendarEvents:getStoredCalendarEvents(),
    objects,
    preview:buildBoardPreview(objects)
  };
}

function clearTeacherTilesBoard(){
  clearSelection();
  unrestoredBoardObjects=[];
  boardFrames=[];
  renderBoardFrames();
  for(const m of [...workspace.querySelectorAll('.module')]){
    try{m._cleanup?.()}catch{}
    m.remove();
  }
  workspace.querySelectorAll('.board-drawing-canvas').forEach(canvas=>canvas.remove());
  undoStack.splice(0,undoStack.length);
  redoStack.splice(0,redoStack.length);
  tileZ=10;
  stickerZ=10;
  updateWorkspaceEmptyState();
}

function restoreTeacherTilesBoardObject(state){
  if(!state||!boardTypeAvailable(state.type))return null;
  const t=state.transform||{};
  if(state.type==='sticker'){
    const sticker=state.sticker||{};
    if(!boardStickerAvailable(sticker))return null;
    const centerX=(Number(t.left)||BOARD_WIDTH/2)+(Number(t.width)||180)/2;
    const centerY=(Number(t.top)||BOARD_HEIGHT/2)+(Number(t.height)||180)/2;
    const clientX=boardCamera.x+centerX*boardCamera.scale;
    const clientY=boardCamera.y+centerY*boardCamera.scale;
    const m=createStickerModule({
      src:sticker.src||'',
      emoji:sticker.emoji||'',
      name:sticker.name||'Sticker',
      aspect:Number(sticker.aspect)||1
    },clientX,clientY,{record:false,animate:false,objectId:state.id||makeBoardObjectId()});
    if(!m)return null;
    applyBoardPreSetupState(m,state);
    applyBoardPostSetupState(m,state);
    return m;
  }

  const x=(Number(t.left)||BOARD_WIDTH/2)+(Number(t.width)||320)/2;
  const y=(Number(t.top)||BOARD_HEIGHT/2)+18;
  return createModule(state.type,x,y,{record:false,boardState:state});
}

function loadTeacherTilesBoard(snapshot){
  if(window.TeacherTilesBoardAccessCheck?.(snapshot)===false)return {locked:true};
  const data=snapshot&&typeof snapshot==='object'?snapshot:{};
  const removedObjectIds=[];
  withBoardChangesSuspended(()=>{
    clearTeacherTilesBoard();
    if(data.preferences&&typeof data.preferences==='object')applyAppPreferences(data.preferences,{persist:true,notify:false,applyView:false});
    applyTeacherTheme(TEACHERTILES_THEMES.has(data.theme)?data.theme:'light',{persist:false});
    if(Array.isArray(data.calendarEvents)){
      try{localStorage.setItem(CALENDAR_STORAGE_KEY,JSON.stringify(data.calendarEvents))}catch{}
    }

    const camera=data.camera||{};
    boardCamera.scale=clamp(Number(camera.scale)||1,BOARD_MIN_ZOOM,BOARD_MAX_ZOOM);
    boardCamera.x=Number.isFinite(Number(camera.x))?Number(camera.x):(innerWidth-BOARD_WIDTH*boardCamera.scale)/2;
    boardCamera.y=Number.isFinite(Number(camera.y))?Number(camera.y):(innerHeight-BOARD_HEIGHT*boardCamera.scale)/2;
    applyBoardCamera();
    boardFrames=normalizeBoardFrames(data.frames);
    renderBoardFrames();

    for(const object of Array.isArray(data.objects)?data.objects:[]){
      if(!boardTypeAvailable(object?.type)){
        unrestoredBoardObjects.push(object);
        if(object?.id)removedObjectIds.push(object.id);
        continue;
      }
      try{
        const restored=restoreTeacherTilesBoardObject(object);
        if(!restored&&object?.id){removedObjectIds.push(object.id);unrestoredBoardObjects.push(object)}
      }catch(error){
        console.warn('TeacherTiles skipped a saved board object',object?.type,error);
        unrestoredBoardObjects.push(object);
        if(object?.id)removedObjectIds.push(object.id);
      }
    }
    normalizeSnapGroups();
    clearSelection();
    undoStack.splice(0,undoStack.length);
    redoStack.splice(0,redoStack.length);
    updateWorkspaceEmptyState();
  });
  window.dispatchEvent(new CustomEvent('teachertiles:boardloaded',{detail:{removedObjectIds}}));
  return{removedObjectIds};
}

function blankTeacherTilesBoard(){
  const scale=clamp((Number(appPreferences.defaultViewSize)||100)/100,BOARD_MIN_ZOOM,BOARD_MAX_ZOOM);
  return{
    schemaVersion:BOARD_SAVE_SCHEMA_VERSION,
    theme:'light',
    camera:{
      x:(innerWidth-BOARD_WIDTH*scale)/2,
      y:(innerHeight-BOARD_HEIGHT*scale)/2,
      scale
    },
    frames:[],
    preferences:boardPreferenceSnapshot(),
    calendarEvents:[],
    objects:[],
    preview:[]
  };
}
