function normalizeBoardFrames(value){
  if(!Array.isArray(value))return[];
  return value.slice(0,BOARD_FRAME_LIMIT).map((frame,index)=>{
    const data=frame&&typeof frame==='object'?frame:{};
    const name=String(data.name||'').replace(/\s+/g,' ').trim().slice(0,40)||`Frame ${index+1}`;
    const centerX=Number(data.centerX),centerY=Number(data.centerY),scale=Number(data.scale);
    return{
      id:String(data.id||`frame-${Date.now().toString(36)}-${index}`),
      name,
      centerX:Number.isFinite(centerX)?centerX:BOARD_WIDTH/2,
      centerY:Number.isFinite(centerY)?centerY:BOARD_HEIGHT/2,
      scale:clamp(Number.isFinite(scale)?scale:1,BOARD_MIN_ZOOM,BOARD_MAX_ZOOM)
    };
  });
}

function closeBoardFrameMenu({force=false}={}){
  const isRenaming=Boolean(boardFrameMenu?.querySelector('.board-frame-name-input'));
  if(!boardFrameMenu||(!force&&(boardFrameKeyHeld||boardFrameMenu.matches(':hover')||isRenaming||boardFrameDragId)))return;
  clearTimeout(boardFrameCloseTimer);
  boardFrameMenu.hidden=true;
  boardFrameMenu.setAttribute('aria-hidden','true');
}

function scheduleBoardFrameMenuClose(delay=100){
  clearTimeout(boardFrameCloseTimer);
  boardFrameCloseTimer=setTimeout(()=>closeBoardFrameMenu(),delay);
}

function openBoardFrameMenu(){
  if(!boardFrameMenu)return;
  clearTimeout(boardFrameCloseTimer);
  boardFrameMenu.hidden=false;
  boardFrameMenu.setAttribute('aria-hidden','false');
}

function nextBoardFrameName(){
  const used=new Set(boardFrames.map(frame=>frame.name));
  for(let number=1;number<=BOARD_FRAME_LIMIT;number++)if(!used.has(`Frame ${number}`))return`Frame ${number}`;
  return`Frame ${boardFrames.length+1}`;
}

function jumpToBoardFrame(frame){
  if(!frame)return;
  const centerX=Number(frame.centerX),centerY=Number(frame.centerY);
  boardCamera.scale=clamp(Number(frame.scale)||1,BOARD_MIN_ZOOM,BOARD_MAX_ZOOM);
  boardCamera.x=innerWidth/2-(Number.isFinite(centerX)?centerX:BOARD_WIDTH/2)*boardCamera.scale;
  boardCamera.y=innerHeight/2-(Number.isFinite(centerY)?centerY:BOARD_HEIGHT/2)*boardCamera.scale;
  boardZoomIntentPercent=Math.round(boardCamera.scale*100);
  applyBoardCamera();
  showZoomIndicator(boardCamera.scale,{precise:false});
  clearTimeout(boardFrameJumpTimer);
  workspace.classList.remove('is-frame-jump');
  void workspace.offsetWidth;
  workspace.classList.add('is-frame-jump');
  boardFrameJumpTimer=setTimeout(()=>workspace.classList.remove('is-frame-jump'),190);
}

function beginBoardFrameRename(frame,button){
  clearTimeout(Number(button.dataset.jumpTimer)||0);
  const input=document.createElement('input');
  input.type='text';
  input.maxLength=40;
  input.className='board-frame-name-input';
  input.value=frame.name;
  input.setAttribute('aria-label',`Rename ${frame.name}`);
  button.replaceWith(input);
  let finished=false;
  const commit=()=>{
    if(finished)return;
    finished=true;
    const next=input.value.replace(/\s+/g,' ').trim().slice(0,40)||frame.name;
    if(next!==frame.name){frame.name=next;persistBoardFrameChange('board-frame-rename')}
    renderBoardFrames();
  };
  input.addEventListener('keydown',event=>{
    if(event.key==='Enter'){event.preventDefault();input.blur()}
    if(event.key==='Escape'){event.preventDefault();input.value=frame.name;input.blur()}
    event.stopPropagation();
  });
  input.addEventListener('blur',commit,{once:true});
  input.focus({preventScroll:true});
  input.select();
}

function persistBoardFrameChange(reason){
  notifyBoardChanged(reason);
  const save=window.TeacherTilesCloudBoards?.save;
  if(typeof save==='function'){
    Promise.resolve(save()).catch(error=>console.warn('TeacherTiles could not save board frames immediately',error));
  }
}

function renderBoardFrames(){
  if(!boardFrameList)return;
  boardFrameList.replaceChildren();
  boardFrames.forEach((frame,index)=>{
    const row=document.createElement('div');
    row.className='board-frame-row';
    row.dataset.frameId=frame.id;
    row.style.setProperty('animation-delay',`${index*18}ms`);
    const drag=document.createElement('button');
    drag.type='button';
    drag.className='board-frame-drag';
    drag.draggable=true;
    drag.title=`Drag to reorder ${frame.name}`;
    drag.setAttribute('aria-label',drag.title);
    drag.innerHTML='<span aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>';
    drag.addEventListener('click',event=>event.preventDefault());
    drag.addEventListener('dragstart',event=>{
      boardFrameDragId=frame.id;
      row.classList.add('is-dragging');
      boardFrameList.classList.add('is-reordering');
      event.dataTransfer.effectAllowed='move';
      event.dataTransfer.setData('text/plain',frame.id);
      try{event.dataTransfer.setDragImage(row,18,Math.min(20,row.offsetHeight/2))}catch{}
    });
    drag.addEventListener('dragend',()=>{
      row.classList.remove('is-dragging');
      boardFrameList.classList.remove('is-reordering');
      boardFrameList.querySelectorAll('.board-frame-row').forEach(item=>item.classList.remove('is-drop-before','is-drop-after'));
      boardFrameDragId='';
      scheduleBoardFrameMenuClose(120);
    });
    const button=document.createElement('button');
    button.type='button';
    button.className='board-frame-button';
    button.textContent=frame.name;
    button.title=`Jump to ${frame.name} · Double-click to rename`;
    button.addEventListener('click',event=>{
      if(event.detail===0){jumpToBoardFrame(frame);return}
      clearTimeout(Number(button.dataset.jumpTimer)||0);
      const timer=setTimeout(()=>jumpToBoardFrame(frame),220);
      button.dataset.jumpTimer=String(timer);
    });
    button.addEventListener('dblclick',event=>{
      event.preventDefault();
      event.stopPropagation();
      beginBoardFrameRename(frame,button);
    });
    const remove=document.createElement('button');
    remove.type='button';
    remove.className='board-frame-delete';
    remove.title=`Delete ${frame.name}`;
    remove.setAttribute('aria-label',`Delete ${frame.name}`);
    remove.innerHTML='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 7h14M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    remove.addEventListener('click',()=>{
      boardFrames=boardFrames.filter(item=>item.id!==frame.id);
      renderBoardFrames();
      persistBoardFrameChange('board-frame-delete');
    });
    row.append(drag,button,remove);
    boardFrameList.appendChild(row);
  });
  if(boardFrameEmpty)boardFrameEmpty.hidden=boardFrames.length>0;
  if(boardFrameCount)boardFrameCount.textContent=`${boardFrames.length} / ${BOARD_FRAME_LIMIT}`;
  if(boardFrameCapture){
    const full=boardFrames.length>=BOARD_FRAME_LIMIT;
    boardFrameCapture.disabled=full;
    const strong=boardFrameCapture.querySelector('strong');
    const small=boardFrameCapture.querySelector('small');
    if(strong)strong.textContent=full?'Frame limit reached':'Capture frame';
    if(small)small.textContent=full?'Delete a frame to capture another.':'Save the current board view';
  }
}

function isVisibleTypingTarget(target){
  if(!isTypingTarget(target)||!(target instanceof HTMLElement)||!target.isConnected)return false;
  if(target.closest('[hidden],[aria-hidden="true"]'))return false;
  const style=getComputedStyle(target);
  if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse')return false;
  return target.getClientRects().length>0;
}

function resetBoardFrameHotkey({blurTypingFocus=false}={}){
  boardFrameKeyHeld=false;
  clearTimeout(boardFrameCloseTimer);
  closeBoardFrameMenu({force:true});
  if(!blurTypingFocus)return;
  const active=document.activeElement;
  if(active instanceof HTMLElement&&isTypingTarget(active))active.blur();
}

function drawBoardMinimap(){
  boardMinimapFrame=0;
  if(!boardMinimap?.classList.contains('is-visible')||!boardMinimapCanvas)return;
  const ctx=boardMinimapCanvas.getContext('2d');
  if(!ctx)return;
  const width=boardMinimapCanvas.width,height=boardMinimapCanvas.height,pad=12;
  const scale=Math.min((width-pad*2)/BOARD_WIDTH,(height-pad*2)/BOARD_HEIGHT);
  const boardWidth=BOARD_WIDTH*scale,boardHeight=BOARD_HEIGHT*scale;
  const ox=(width-boardWidth)/2,oy=(height-boardHeight)/2;
  const bodyStyle=getComputedStyle(document.body);
  const background=bodyStyle.getPropertyValue('--bg').trim()||'#edf1f5';
  const surface=bodyStyle.getPropertyValue('--surface-solid').trim()||'#ffffff';
  const accent=bodyStyle.getPropertyValue('--accent').trim()||'#4c8ed9';
  const text=bodyStyle.getPropertyValue('--text').trim()||'#17191d';
  ctx.clearRect(0,0,width,height);
  ctx.fillStyle=surface;ctx.fillRect(0,0,width,height);
  ctx.fillStyle=background;ctx.fillRect(ox,oy,boardWidth,boardHeight);

  for(const module of workspace.querySelectorAll('.module')){
    const left=Number.parseFloat(module.style.left)||module.offsetLeft;
    const top=Number.parseFloat(module.style.top)||module.offsetTop;
    const moduleWidth=tileDisplayWidth(module);
    const moduleHeight=tileDisplayHeight(module);
    ctx.globalAlpha=module.dataset.type==='sticker'?.62:.82;
    ctx.fillStyle=module.dataset.type==='sticker'?'#f2b84b':accent;
    ctx.fillRect(ox+left*scale,oy+top*scale,Math.max(3,moduleWidth*scale),Math.max(3,moduleHeight*scale));
  }
  ctx.globalAlpha=1;

  const bounds=visibleBoardBounds();
  const left=clamp(bounds.left,0,BOARD_WIDTH);
  const top=clamp(bounds.top,0,BOARD_HEIGHT);
  const right=clamp(bounds.right,0,BOARD_WIDTH);
  const bottom=clamp(bounds.bottom,0,BOARD_HEIGHT);
  ctx.fillStyle='rgba(255,255,255,.13)';
  ctx.strokeStyle=text;
  ctx.lineWidth=4;
  ctx.fillRect(ox+left*scale,oy+top*scale,Math.max(8,(right-left)*scale),Math.max(8,(bottom-top)*scale));
  ctx.strokeRect(ox+left*scale,oy+top*scale,Math.max(8,(right-left)*scale),Math.max(8,(bottom-top)*scale));
  ctx.strokeStyle='rgba(255,255,255,.62)';
  ctx.lineWidth=1.5;
  ctx.strokeRect(ox+left*scale+2,oy+top*scale+2,Math.max(4,(right-left)*scale-4),Math.max(4,(bottom-top)*scale-4));
}

function requestBoardMinimapDraw(){
  if(boardMinimapFrame||!boardMinimap?.classList.contains('is-visible'))return;
  boardMinimapFrame=requestAnimationFrame(drawBoardMinimap);
}

function showBoardMinimap(){
  if(!boardMinimap)return;
  clearTimeout(boardMinimapHideTimer);
  boardMinimap.classList.add('is-visible');
  boardMinimap.setAttribute('aria-hidden','false');
  requestBoardMinimapDraw();
}

function beginBoardMinimapDelay(){
  clearTimeout(boardMinimapShowTimer);
  clearTimeout(boardMinimapHideTimer);
  boardMinimapShowTimer=setTimeout(showBoardMinimap,900);
}

function scheduleBoardMinimapHide(delay=1100){
  clearTimeout(boardMinimapShowTimer);
  clearTimeout(boardMinimapHideTimer);
  boardMinimapShowTimer=0;
  boardMinimapHideTimer=setTimeout(()=>{
    boardMinimap?.classList.remove('is-visible');
    boardMinimap?.setAttribute('aria-hidden','true');
  },delay);
}

function centerBoardFromMinimapPointer(event){
  if(!boardMinimapCanvas)return;
  const rect=boardMinimapCanvas.getBoundingClientRect();
  const canvasX=(event.clientX-rect.left)/rect.width*boardMinimapCanvas.width;
  const canvasY=(event.clientY-rect.top)/rect.height*boardMinimapCanvas.height;
  const x=clamp((canvasX-12)/(boardMinimapCanvas.width-24),0,1)*BOARD_WIDTH;
  const y=clamp((canvasY-12)/(boardMinimapCanvas.height-24),0,1)*BOARD_HEIGHT;
  boardCamera.x=innerWidth/2-x*boardCamera.scale;
  boardCamera.y=innerHeight/2-y*boardCamera.scale;
  applyBoardCamera();
}

function showZoomIndicator(scale=boardCamera.scale,{precise=boardZoomPrecision}={}){
  if(!zoomIndicator)return;
  zoomIndicator.replaceChildren();
  const value=document.createElement('strong');
  value.textContent=`${Math.round(scale*100)}%`;
  zoomIndicator.appendChild(value);
  if(precise){
    const hint=document.createElement('small');
    hint.textContent='SHIFT · 1% STEPS';
    zoomIndicator.appendChild(hint);
  }
  zoomIndicator.classList.toggle('is-precise',precise);
  zoomIndicator.classList.add('is-visible');
  clearTimeout(zoomIndicatorTimer);
  if(!precise)zoomIndicatorTimer=setTimeout(()=>zoomIndicator.classList.remove('is-visible'),720);
}

function clampBoardCamera(){
  const scaledW=BOARD_WIDTH*boardCamera.scale;
  const scaledH=BOARD_HEIGHT*boardCamera.scale;
  const minX=Math.min(BOARD_OVERSCROLL,innerWidth-scaledW-BOARD_OVERSCROLL);
  const minY=Math.min(BOARD_OVERSCROLL,innerHeight-scaledH-BOARD_OVERSCROLL);
  boardCamera.x=clamp(boardCamera.x,minX,BOARD_OVERSCROLL);
  boardCamera.y=clamp(boardCamera.y,minY,BOARD_OVERSCROLL);
}

function renderedBoardCameraOffset(){
  const pixelRatio=window.devicePixelRatio||1;
  return{
    x:Math.round(boardCamera.x*pixelRatio)/pixelRatio,
    y:Math.round(boardCamera.y*pixelRatio)/pixelRatio
  };
}

function isTilePinned(m){return Boolean(m&&m.dataset.tilePinned==='true')}

function syncTilePinControl(m){
  if(!m)return;
  const button=m.querySelector('.module-pin-action');
  const pinned=isTilePinned(m);
  m.querySelector(':scope>.module-pin')?.setAttribute('aria-pressed',String(pinned||isTileLocked(m)));
  m.classList.toggle('is-tile-pinned',pinned);
  if(!button)return;
  button.setAttribute('aria-pressed',String(pinned));
  button.setAttribute('aria-label',pinned?'Unpin tile from camera':'Pin tile to camera');
  button.title=pinned?'Unpin tile':'Pin tile';
  button.querySelector('span').textContent=pinned?'Unpin':'Pin';
}

function snapScreenCoordinate(value){
  const pixelRatio=window.devicePixelRatio||1;
  return Math.round(Number(value)*pixelRatio)/pixelRatio;
}

function capturePinnedTileScreenAnchor(m){
  if(!m?.isConnected)return;
  const rect=m.getBoundingClientRect();
  m.dataset.pinScreenX=String(snapScreenCoordinate(rect.left+rect.width/2));
  m.dataset.pinScreenY=String(snapScreenCoordinate(rect.top+rect.height/2));
}

function tileUniformScale(m){return clamp(Number(m?.dataset.uniformScale)||1,.85,1);}

function tileDisplayWidth(m){return m.offsetWidth*tileUniformScale(m);}

function tileDisplayHeight(m){return m.offsetHeight*tileUniformScale(m);}

function setTileUniformScale(m,value=1){
  const scale=clamp(Number(value)||1,.85,1);
  if(scale<.999)m.dataset.uniformScale=String(scale);else delete m.dataset.uniformScale;
  m.style.scale=String(scale/(isTilePinned(m)?Math.max(.05,boardCamera.scale):1));
}

function fitTileDisplaySize(m,width,height){
  const safe=m._resizeMinimum;
  if(!safe){m.style.width=width+'px';m.style.height=height+'px';setTileUniformScale(m);return;}
  width=Math.max(safe.width*.85,width);height=Math.max(safe.height*.85,height);
  const scale=Math.min(1,width/safe.width,height/safe.height);
  m.style.width=width/scale+'px';m.style.height=height/scale+'px';setTileUniformScale(m,scale);
}

function moduleViewportScale(m){
  if(!m)return Math.max(.05,boardCamera.scale||1);
  if(document.fullscreenElement===m)return 1;
  if(isTilePinned(m))return tileUniformScale(m);
  return Math.max(.05,boardCamera.scale||1)*tileUniformScale(m);
}

function syncPinnedTileToCamera(m,rendered=renderedBoardCameraOffset()){
  if(!m?.isConnected||m._tileFullscreenGeometry||document.fullscreenElement===m)return;
  if(!isTilePinned(m)){
    setTileUniformScale(m,tileUniformScale(m));
    syncTilePinControl(m);
    return;
  }
  let screenX=Number(m.dataset.pinScreenX),screenY=Number(m.dataset.pinScreenY);
  if(!Number.isFinite(screenX)||!Number.isFinite(screenY)){
    capturePinnedTileScreenAnchor(m);
    screenX=Number(m.dataset.pinScreenX);screenY=Number(m.dataset.pinScreenY);
  }
  const currentScale=Math.max(.05,boardCamera.scale||1);
  m.style.left=`${(screenX-rendered.x)/currentScale-m.offsetWidth/2}px`;
  m.style.top=`${(screenY-rendered.y)/currentScale-m.offsetHeight/2}px`;
  m.style.scale=String(tileUniformScale(m)/currentScale);
  syncTilePinControl(m);
}

function syncPinnedTilesToCamera(rendered=renderedBoardCameraOffset()){
  const pinned=[...workspace.querySelectorAll('.module[data-tile-pinned="true"]')];
  workspace.classList.toggle('has-pinned-tiles',pinned.length>0);
  pinned.forEach(m=>syncPinnedTileToCamera(m,rendered));
}

function setTilePinned(m,pinned){
  if(!m?.isConnected)return;
  const next=Boolean(pinned);
  if(next===isTilePinned(m)){syncTilePinControl(m);return}
  const rect=m.getBoundingClientRect();
  const screenX=rect.left+rect.width/2,screenY=rect.top+rect.height/2;
  const rendered=renderedBoardCameraOffset();
  if(next){
    clearSnapGroupMember(m,{notify:false});
    m.dataset.tilePinned='true';
    m.dataset.pinScreenX=String(snapScreenCoordinate(screenX));
    m.dataset.pinScreenY=String(snapScreenCoordinate(screenY));
    delete m.dataset.pinBaseScale;
    bringToFront(m);
    syncPinnedTileToCamera(m,rendered);
  }else{
    delete m.dataset.tilePinned;delete m.dataset.pinScreenX;delete m.dataset.pinScreenY;delete m.dataset.pinBaseScale;
    setTileUniformScale(m,tileUniformScale(m));
    const scale=Math.max(.05,boardCamera.scale||1);
    m.style.left=`${(screenX-rendered.x)/scale-tileDisplayWidth(m)/2}px`;
    m.style.top=`${(screenY-rendered.y)/scale-tileDisplayHeight(m)/2}px`;
    syncTilePinControl(m);
  }
  syncPinnedTilesToCamera(rendered);
  layoutTileOptionControls(m);
  notifyBoardChanged(next?'pin':'unpin');
}

function applyBoardCamera(){
  clampBoardCamera();
  const rendered=renderedBoardCameraOffset();
  workspace.style.transform=`translate(${rendered.x}px,${rendered.y}px) scale(${boardCamera.scale})`;
  workspace.style.setProperty('--board-zoom',boardCamera.scale);
  workspace.style.setProperty('--board-edge-width',`${2.5/boardCamera.scale}px`);
  syncPinnedTilesToCamera(rendered);
  requestAnimationFrame(()=>updateWorkspaceEmptyState());
  requestBoardMinimapDraw();
  notifyBoardChanged('camera');
}

function screenToBoard(clientX,clientY){
  return{x:(clientX-boardCamera.x)/boardCamera.scale,y:(clientY-boardCamera.y)/boardCamera.scale};
}

function visibleBoardBounds(){
  const tl=screenToBoard(0,0),br=screenToBoard(innerWidth,innerHeight);
  return{left:tl.x,top:tl.y,right:br.x,bottom:br.y};
}

function centerBoardCamera(){
  boardCamera.x=(innerWidth-BOARD_WIDTH*boardCamera.scale)/2;
  boardCamera.y=(innerHeight-BOARD_HEIGHT*boardCamera.scale)/2;
  applyBoardCamera();
}

function isSpaceTypingTarget(target){const field=target instanceof Element?target.closest('input,textarea,[contenteditable]:not([contenteditable="false"])'):null;return !!field&&!(field.dataset.textEditMode==='double'&&!field.classList.contains('module-text-edit-active'))&&(!(field instanceof HTMLInputElement)||!['button','submit','reset','checkbox','radio','range','color','file','image','hidden'].includes(field.type))}

function beginBoardPan(e){
  closeMenu();
  e.preventDefault();
  workspace.classList.add('is-panning');
  workspace.setPointerCapture(e.pointerId);
  const sx=e.clientX,sy=e.clientY,startX=boardCamera.x,startY=boardCamera.y;
  let minimapDelayStarted=false;
  const move=ev=>{
    if(!minimapDelayStarted&&Math.hypot(ev.clientX-sx,ev.clientY-sy)>=5){
      minimapDelayStarted=true;
      beginBoardMinimapDelay();
    }
    boardCamera.x=startX+(ev.clientX-sx);
    boardCamera.y=startY+(ev.clientY-sy);
    applyBoardCamera();
  };
  const end=()=>{
    workspace.classList.remove('is-panning');
    scheduleBoardMinimapHide();
    workspace.removeEventListener('pointermove',move);
    workspace.removeEventListener('pointerup',end);
    workspace.removeEventListener('pointercancel',end);
  };
  workspace.addEventListener('pointermove',move);
  workspace.addEventListener('pointerup',end);
  workspace.addEventListener('pointercancel',end);
}

function boardKeyboardPanBlocked(space=false){
  if(space?isSpaceTypingTarget(document.activeElement):isTypingTarget(document.activeElement))return true;
  const shop=document.getElementById('shop-modal');
  if(shop&&!shop.hidden)return true;
  const profile=document.getElementById('profile-modal');
  if(profile&&!profile.hidden)return true;
  const settings=document.getElementById('settings-modal');
  if(settings&&!settings.hidden)return true;
  const boards=document.getElementById('boards-view');
  if(boards&&!boards.hidden)return true;
  return false;
}

function stopBoardKeyboardPan(){
  boardPanKeys.clear();
  if(boardKeyboardPanFrame)cancelAnimationFrame(boardKeyboardPanFrame);
  boardKeyboardPanFrame=0;
  boardKeyboardPanTime=0;
  workspace.classList.remove('is-keyboard-panning');
}

function runBoardKeyboardPan(now){
  if(!boardPanKeys.size||boardKeyboardPanBlocked()){stopBoardKeyboardPan();return}
  if(!boardKeyboardPanTime)boardKeyboardPanTime=now;
  const dt=Math.min(.04,(now-boardKeyboardPanTime)/1000);
  boardKeyboardPanTime=now;
  let dx=0,dy=0;
  for(const key of boardPanKeys){
    const dir=boardPanKeyDirection[key];
    if(dir){dx+=dir[0];dy+=dir[1]}
  }
  if(dx||dy){
    if(dx&&dy){const inv=Math.SQRT1_2;dx*=inv;dy*=inv}
    boardCamera.x+=dx*BOARD_KEYBOARD_PAN_SPEED*dt;
    boardCamera.y+=dy*BOARD_KEYBOARD_PAN_SPEED*dt;
    applyBoardCamera();
  }
  boardKeyboardPanFrame=requestAnimationFrame(runBoardKeyboardPan);
}

function startBoardKeyboardPan(key){
  boardPanKeys.add(key);
  workspace.classList.add('is-keyboard-panning');
  if(!boardKeyboardPanFrame){
    boardKeyboardPanTime=0;
    boardKeyboardPanFrame=requestAnimationFrame(runBoardKeyboardPan);
  }
}

function beginBoardSelection(e){
  if(e.button!==0||!e.shiftKey||e.target!==workspace)return;
  closeMenu();
  e.preventDefault();
  workspace.setPointerCapture(e.pointerId);
  const sx=e.clientX,sy=e.clientY;
  const base=new Set(selectedModules);
  let dragging=false;

  const draw=ev=>{
    const left=Math.min(sx,ev.clientX),top=Math.min(sy,ev.clientY);
    const right=Math.max(sx,ev.clientX),bottom=Math.max(sy,ev.clientY);
    Object.assign(selectionMarquee.style,{left:`${left}px`,top:`${top}px`,width:`${right-left}px`,height:`${bottom-top}px`});
    const hits=[];
    for(const m of workspace.querySelectorAll('.module')){
      const r=m.getBoundingClientRect();
      if(r.right>=left&&r.left<=right&&r.bottom>=top&&r.top<=bottom)hits.push(m);
    }
    clearSelection();
    for(const m of base)selectModule(m);
    for(const m of hits)selectModule(m);
  };

  const move=ev=>{
    if(!dragging&&Math.hypot(ev.clientX-sx,ev.clientY-sy)<4)return;
    if(!dragging){dragging=true;selectionMarquee.hidden=false;document.body.classList.add('is-board-selecting')}
    draw(ev);
  };
  const cleanup=()=>{
    selectionMarquee.hidden=true;
    selectionMarquee.style.width='0px';
    selectionMarquee.style.height='0px';
    document.body.classList.remove('is-board-selecting');
    workspace.removeEventListener('pointermove',move);
    workspace.removeEventListener('pointerup',end);
    workspace.removeEventListener('pointercancel',cancel);
  };
  const end=ev=>{if(dragging)draw(ev);cleanup()};
  const cancel=()=>cleanup();
  workspace.addEventListener('pointermove',move);
  workspace.addEventListener('pointerup',end);
  workspace.addEventListener('pointercancel',cancel);
}

function cloneBoardClipboardValue(value){
  if(typeof structuredClone==='function'){
    try{return structuredClone(value)}catch{}
  }
  return JSON.parse(JSON.stringify(value));
}

function selectedBoardModules(){
  return [...workspace.querySelectorAll('.module')]
    .filter(module=>selectedModules.has(module))
    .sort((a,b)=>(Number(a.style.zIndex)||0)-(Number(b.style.zIndex)||0));
}

function copyBoardSelection(){
  const modules=selectedBoardModules();
  if(!modules.length)return false;
  const objects=modules.map(serializeBoardModule).filter(Boolean);
  if(!objects.length)return false;
  boardClipboard={
    schemaVersion:BOARD_SAVE_SCHEMA_VERSION,
    objects:cloneBoardClipboardValue(objects)
  };
  boardClipboardPasteCount=0;
  return true;
}

function boardDuplicateOffset(objects,distance=34){
  if(!objects.length)return{x:distance,y:distance};
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const object of objects){
    const t=object?.transform||{};
    const l=Number(t.left)||0;
    const tt=Number(t.top)||0;
    const w=Math.max(1,Number(t.width)||160);
    const h=Math.max(1,Number(t.height)||120);
    left=Math.min(left,l);top=Math.min(top,tt);right=Math.max(right,l+w);bottom=Math.max(bottom,tt+h);
  }
  let x=distance,y=distance;
  if(right+x>BOARD_WIDTH&&left-distance>=0)x=-distance;
  if(bottom+y>BOARD_HEIGHT&&top-distance>=0)y=-distance;
  return{x,y};
}

function duplicateBoardObjects(objects,{distance=34,record=true}={}){
  if(!Array.isArray(objects)||!objects.length)return[];
  const source=cloneBoardClipboardValue(objects);
  const offset=boardDuplicateOffset(source,distance);
  const snapGroupCounts=new Map();
  for(const state of source){
    const id=state?.dataset?.snapGroup;
    if(id)snapGroupCounts.set(id,(snapGroupCounts.get(id)||0)+1);
  }
  const duplicatedSnapGroups=new Map();
  const states=source.map(state=>{
    const next=cloneBoardClipboardValue(state);
    next.id=makeBoardObjectId();
    delete next.zIndex;
    const priorGroup=next?.dataset?.snapGroup;
    if(priorGroup){
      if((snapGroupCounts.get(priorGroup)||0)<2)delete next.dataset.snapGroup;
      else{
        if(!duplicatedSnapGroups.has(priorGroup))duplicatedSnapGroups.set(priorGroup,makeSnapGroupId());
        next.dataset.snapGroup=duplicatedSnapGroups.get(priorGroup);
      }
    }
    const t=next.transform||{};
    const width=Math.max(1,Number(t.width)||160);
    const height=Math.max(1,Number(t.height)||120);
    next.transform={
      ...t,
      left:clamp((Number(t.left)||0)+offset.x,0,BOARD_WIDTH-width),
      top:clamp((Number(t.top)||0)+offset.y,0,BOARD_HEIGHT-height),
      width,
      height
    };
    return next;
  });

  const created=[];
  withBoardChangesSuspended(()=>{
    for(const state of states){
      try{
        const module=restoreTeacherTilesBoardObject(state);
        if(module){bringToFront(module);created.push(module)}
      }catch(error){
        console.warn('TeacherTiles could not duplicate board object',state?.type,error);
      }
    }
  });

  if(!created.length)return[];
  normalizeSnapGroups();
  selectModules(created);
  if(record)recordHistory({type:'add',elements:created});
  updateWorkspaceEmptyState();
  return created;
}

function pasteBoardClipboard(){
  if(!boardClipboard?.objects?.length)return[];
  boardClipboardPasteCount+=1;
  return duplicateBoardObjects(boardClipboard.objects,{distance:34*Math.min(boardClipboardPasteCount,8)});
}

function duplicateBoardSelection(){
  const modules=selectedBoardModules();
  if(!modules.length)return[];
  const objects=modules.map(serializeBoardModule).filter(Boolean);
  return duplicateBoardObjects(objects,{distance:34});
}

function keepTileMenuOnScreen(){
  const viewport=window.visualViewport;
  const left=viewport?.offsetLeft||0,top=viewport?.offsetTop||0,width=viewport?.width||innerWidth,height=viewport?.height||innerHeight;
  menu.style.setProperty('--tile-menu-available-width',`${Math.max(0,width-16)}px`);
  menu.style.setProperty('--tile-menu-available-height',`${Math.max(0,height-16)}px`);
  if(!menu.classList.contains('is-open'))return;
  menu.style.left=`${Math.max(left+8,Math.min(parseFloat(menu.style.left)||left+8,left+width-menu.offsetWidth-8))}px`;
  menu.style.top=`${Math.max(top+8,Math.min(parseFloat(menu.style.top)||top+8,top+height-menu.offsetHeight-8))}px`;
}

function menuFavoriteCategory(item){
  const categories=(item.dataset.category||'').split(/\s+/);
  return [...menuCategoryOrder,...menuHolidays.map((_,i)=>`holiday:${i}`)].find(category=>!['all','favorites','holidays'].includes(category)&&categories.includes(category));
}

function menuCategoryLabel(category){
  if(category.startsWith('holiday:'))return menuHolidays[Number(category.split(':')[1])]||'HOLIDAY TILES';
  if(category.startsWith('favorite:'))return menuCategoryLabel(category.slice(9));
  if(category==='music')return 'MUSIC';
  if(category==='art')return 'ART';
  if(category==='holidays')return 'HOLIDAY TILES';
  return translateAppText(category==='all'?'context.all':`context.cat.${category}`);
}

function normalizeMenuSearch(value=''){
  return value.toLowerCase().replace(/[-‐‑–—]/g,' ').trim().replace(/\s+/g,' ');
}

function renderMenuCategoryPins(){
  const rail=menu.querySelector('.context-menu__category-drawer-grid');
  const sidebar=menu.querySelector('.context-menu__category-drawer'),savedScroll=sidebar.scrollTop;
  const ordered=[...menuCategoryOrder.filter(id=>menuPinnedCategories.has(id)),...[...menuPinnedCategories].filter(id=>id.startsWith('holiday:')),...['favorites','all'].filter(id=>!menuPinnedCategories.has(id)),...menuCategoryOrder.filter(id=>!['all','favorites','holidays'].includes(id)&&!menuPinnedCategories.has(id)),...(!menuPinnedCategories.has('holidays')?['holidays']:[])];
  const fragment=document.createDocumentFragment();
  for(const id of ordered){
    let button=menuDrawerFilters.find(item=>item.dataset.categoryDrawerFilter===id);
    if(!button&&id.startsWith('holiday:')){button=document.createElement('button');button.type='button';button.className='context-menu__filter';button.textContent=menuCategoryLabel(id).toUpperCase();button.classList.toggle('is-active',activeMenuCategory===id);button.addEventListener('click',event=>{event.stopPropagation();menuSearch.value='';setMenuCategory(id)})}
    if(!button)continue;
    const row=document.createElement('div');row.className='context-menu__category-row';row.appendChild(button);
    const nested=!['all','favorites','holidays'].includes(id)&&!menuPinnedCategories.has(id);
    if(nested){row.classList.add('context-menu__category-row--nested');row.hidden=!menuAllExpanded}
    if(['all','holidays','favorites'].includes(id)){
      row.classList.add('context-menu__category-parent');
      const expanded=id==='all'?menuAllExpanded:id==='favorites'?menuFavoritesExpanded:menuHolidaysExpanded;
      const disclosure=document.createElement('button');disclosure.type='button';disclosure.className='context-menu__disclosure';disclosure.innerHTML='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6 3 5 5-5 5"/></svg>';disclosure.setAttribute('aria-expanded',String(expanded));disclosure.setAttribute('aria-label',`${expanded?'Collapse':'Expand'} ${menuCategoryLabel(id)}`);
      disclosure.addEventListener('click',event=>{event.stopPropagation();if(id==='all')menuAllExpanded=!menuAllExpanded;else if(id==='favorites')menuFavoritesExpanded=!menuFavoritesExpanded;else menuHolidaysExpanded=!menuHolidaysExpanded;renderMenuCategoryPins()});row.appendChild(disclosure);
    }
    if(id!=='all'){
      const pin=document.createElement('button');pin.type='button';pin.className='context-menu__pin';pin.dataset.categoryPin=id;
      pin.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 3 6 0-1 7 4 4H6l4-4zM12 14v7"/></svg>';
      const pinned=menuPinnedCategories.has(id);pin.setAttribute('aria-pressed',String(pinned));pin.setAttribute('aria-label',`${pinned?'Unpin':'Pin'} ${menuCategoryLabel(id)}`);pin.title=pin.getAttribute('aria-label');row.appendChild(pin);
    }
    if(id==='all'&&menuPinnedCategories.size){const divider=document.createElement('div');divider.className='context-menu__favorites-divider';divider.setAttribute('role','separator');fragment.appendChild(divider)}
    fragment.appendChild(row);
    if(id==='favorites'){
      const children=document.createElement('div');children.className='context-menu__holiday-children';children.hidden=!menuFavoritesExpanded;
      for(const category of [...menuCategoryOrder,...menuHolidays.map((_,i)=>`holiday:${i}`)].filter(c=>!['all','favorites','holidays'].includes(c))){
        if(!menuItems.some(item=>menuFavorites.has(menuItemKey(item))&&menuFavoriteCategory(item)===category))continue;
        const child=document.createElement('button');child.type='button';child.className='context-menu__holiday-child';child.textContent=menuCategoryLabel(category);child.classList.toggle('is-active',activeMenuCategory===`favorite:${category}`);
        child.addEventListener('click',event=>{event.stopPropagation();menuSearch.value='';setMenuCategory(`favorite:${category}`);renderMenuCategoryPins()});children.appendChild(child);
      }
      fragment.appendChild(children);
    }
    if(id==='holidays'){
      const children=document.createElement('div');children.className='context-menu__holiday-children';children.hidden=!menuHolidaysExpanded;
      for(const [index,name] of menuHolidays.entries()){const child=document.createElement('button');child.type='button';child.className='context-menu__holiday-child';child.textContent=name;child.classList.toggle('is-active',activeMenuCategory===`holiday:${index}`);child.addEventListener('click',event=>{event.stopPropagation();menuSearch.value='';setMenuCategory(`holiday:${index}`);renderMenuCategoryPins()});const row=document.createElement('div');row.className='context-menu__category-row';const pin=document.createElement('button');pin.type='button';pin.className='context-menu__pin';pin.dataset.categoryPin=`holiday:${index}`;pin.setAttribute('aria-pressed',String(menuPinnedCategories.has(`holiday:${index}`)));pin.setAttribute('aria-label',`Pin ${name}`);pin.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m9 3 6 0-1 7 4 4H6l4-4zM12 14v7"/></svg>';row.append(pin,child);if(!menuPinnedCategories.has(`holiday:${index}`))children.appendChild(row)}
      fragment.appendChild(children);
    }
  }
  rail.replaceChildren(fragment);sidebar.scrollTop=savedScroll;
}

function syncMenuResetSize(){
  const width=parseFloat(menu.style.getPropertyValue('--tile-menu-width'))||580,height=parseFloat(menu.style.getPropertyValue('--tile-menu-height'))||500;
  menuResetSize.hidden=Math.abs(width-580)<1&&Math.abs(height-500)<1;
}

function sizeTileMenu(width,height){
  const rect=menu.getBoundingClientRect();
  const w=Math.max(0,Math.min(width,Math.max(0,innerWidth-rect.left-8))),h=Math.max(0,Math.min(height,Math.max(0,innerHeight-rect.top-8)));
  menu.style.setProperty('--tile-menu-width',`${w}px`);menu.style.setProperty('--tile-menu-height',`${h}px`);syncMenuResetSize();
}

function saveTileMenuSize(){try{const rect=menu.getBoundingClientRect();localStorage.setItem('teacherTiles.menuSize.v1',JSON.stringify({width:rect.width,height:rect.height}))}catch{}}

function menuSearchRank(item,query){
  if(!query)return 0;
  const name=normalizeMenuSearch(item.querySelector('strong')?.textContent||'');
  const aliases=normalizeMenuSearch(item.dataset.searchAliases||'').split(/\s+/).filter(Boolean);
  if(name===query||aliases.includes(query))return 0;
  if(name.startsWith(query)||aliases.some(alias=>alias.startsWith(query)))return 1;
  if(name.split(' ').some(word=>word.startsWith(query)))return 2;
  if(name.includes(query)||aliases.some(alias=>alias.includes(query)))return 3;
  const moduleName=normalizeMenuSearch(item.dataset.module||'');
  if(moduleName===query)return 4;
  if(moduleName.startsWith(query)||moduleName.includes(query))return 5;
  return 6;
}

function applyMenuView(){
  const query=normalizeMenuSearch(menuSearch?.value);
  const searching=Boolean(query);
  menu.classList.toggle('is-searching',searching);
  menuSearchClear?.classList.toggle('is-visible',searching);
  const list=menu.querySelector('.context-menu__list');
  // Search continues to cover the entire catalog, as in the original menu.
  const regularCategories=menuCategoryOrder.filter(category=>!['all','favorites','holidays'].includes(category));
  const holidayCategories=menuHolidays.map((_,i)=>`holiday:${i}`);
  let categories=searching||activeMenuCategory==='favorites'?[...regularCategories,...holidayCategories]:activeMenuCategory==='all'?regularCategories:activeMenuCategory==='holidays'?holidayCategories:[activeMenuCategory.startsWith('favorite:')?activeMenuCategory.slice(9):activeMenuCategory];
  if(searching){
    const categoryRank=category=>Math.min(...menuItems.filter(item=>(item.dataset.category||'').split(/\s+/).includes(category)).map(item=>{
      const searchable=normalizeMenuSearch([item.querySelector('strong')?.textContent,item.querySelector('small')?.textContent,item.dataset.module,item.dataset.category,item.dataset.searchAliases].join(' '));
      return searchable.includes(query)?menuSearchRank(item,query):Infinity;
    }));
    const timerSearch=/^timers?$/.test(query);
    const categorySearchPriority=category=>timerSearch&&category==='time'?-1:0;
    categories=[...categories].sort((a,b)=>categorySearchPriority(a)-categorySearchPriority(b)||categoryRank(a)-categoryRank(b)||menuCategoryLabel(a).localeCompare(menuCategoryLabel(b),undefined,{sensitivity:'base',numeric:true}));
  }
  const fragment=document.createDocumentFragment();
  const included=new Set();
  let visibleCount=0;
  menuItems.forEach(item=>{item.hidden=true});
  const passes=[!searching&&(activeMenuCategory==='favorites'||activeMenuCategory.startsWith('favorite:'))];
  for(const favoritesOnly of passes){
    const collection=document.createElement('div');collection.className='context-menu__collection';
    if(favoritesOnly)collection.classList.add('context-menu__collection--favorites');
    if(favoritesOnly&&activeMenuCategory==='all'){
      const title=document.createElement('h2');title.textContent=menuCategoryLabel('favorites');collection.appendChild(title);
    }
    let collectionCount=0;
    for(const category of categories){
      const matches=menuItems.filter(item=>{
        const searchable=[item.querySelector('strong')?.textContent,item.querySelector('small')?.textContent,item.dataset.module,item.dataset.category,item.dataset.searchAliases].join(' ').toLowerCase().replace(/[-‐‑–—]/g,' ');
        return (!searching||!included.has(item))&&(item.dataset.category||'').split(/\s+/).includes(category)&&(!favoritesOnly||(menuFavorites.has(menuItemKey(item))&&menuFavoriteCategory(item)===category))&&(!searching||searchable.includes(query));
      });
      const basicsOrder=['sticky','draw','textbubble','richtext','timer','clock','image','calculator'];
      matches.sort((a,b)=>searching
        ? menuSearchRank(a,query)-menuSearchRank(b,query)||(a.querySelector('strong')?.textContent||'').localeCompare(b.querySelector('strong')?.textContent||'',undefined,{sensitivity:'base',numeric:true})
        : category==='basics'
          ? basicsOrder.indexOf(a.dataset.module)-basicsOrder.indexOf(b.dataset.module)
          : (a.querySelector('strong')?.textContent||'').localeCompare(b.querySelector('strong')?.textContent||'',undefined,{sensitivity:'base',numeric:true}));
      if(!matches.length)continue;
      const section=document.createElement('section');section.className='context-menu__section';
      const heading=document.createElement('h3');heading.textContent=menuCategoryLabel(category);
      const grid=document.createElement('div');grid.className='context-menu__tile-grid';
      matches.forEach(item=>{
        const card=included.has(item)?item.cloneNode(true):item;included.add(item);card.hidden=false;
        const wrap=document.createElement('div');wrap.className='context-menu__card-wrap';
        const star=document.createElement('button');star.type='button';star.className='context-menu__favorite';
        const id=menuItemKey(item),favorite=menuFavorites.has(id),name=item.querySelector('strong')?.textContent;
        star.dataset.tileFavorite=id;star.textContent=favorite?'★':'☆';
        star.setAttribute('aria-pressed',String(favorite));star.setAttribute('aria-label',`${favorite?'Remove':'Add'} ${name} ${favorite?'from':'to'} favorites`);
        star.title=star.getAttribute('aria-label');wrap.append(card,star);grid.appendChild(wrap);visibleCount++;collectionCount++;
      });
      section.append(heading,grid);collection.appendChild(section);
    }
    if(favoritesOnly&&activeMenuCategory==='all'&&!collectionCount){
      const hint=document.createElement('p');hint.className='context-menu__favorites-hint';hint.textContent='Star a tile to keep it here.';collection.appendChild(hint);
    }
    fragment.appendChild(collection);
  }
  // Retain hidden buttons in the DOM for localization and catalog integrations.
  const hidden=document.createElement('div');hidden.hidden=true;
  menuItems.filter(item=>!included.has(item)).forEach(item=>hidden.appendChild(item));
  fragment.appendChild(hidden);
  menuNoResults.hidden=visibleCount>0;
  menuNoResults.querySelector('strong').textContent=searching?translateAppText('context.none'):menuCategoryLabel(activeMenuCategory);
  menuNoResults.querySelector('small').textContent=searching?translateAppText('context.try'):activeMenuCategory.startsWith('holiday:')?'Coming soon':activeMenuCategory==='favorites'?'Star a tile to keep it here.':'No tiles here yet. Explore another category.';
  fragment.appendChild(menuNoResults);
  list.replaceChildren(fragment);list.scrollTop=0;
}

function setMenuCategory(category='all'){
  activeMenuCategory=menuCategoryOrder.includes(category)||(category.startsWith('favorite:')&&(menuCategoryOrder.includes(category.slice(9))||/^holiday:[0-5]$/.test(category.slice(9))))||/^holiday:[0-5]$/.test(category)?category:'all';
  const label=menuCategoryLabel(activeMenuCategory);
  if(menuCategoryCycleLabel)menuCategoryCycleLabel.textContent=label;
  if(menuCategoryCycle){
    menuCategoryCycle.setAttribute('aria-label',`Current category: ${label}. Open category menu.`);
  }
  menuDrawerFilters.forEach(b=>{const active=b.dataset.categoryDrawerFilter===activeMenuCategory;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active))});
  renderMenuCategoryPins();
  applyMenuView();
}

function syncMenuCategoryDrawerLayout(){} // Sidebar uses responsive CSS layout.

function setMenuCategoryDrawer(){
  menu.classList.remove('has-category-drawer');
  menuCategoryDrawer?.setAttribute('aria-hidden','false');
}

function clearMenuSearch(){
  if(!menuSearch)return;
  menuSearch.value='';
  applyMenuView();
}

function closeMenu(){
  setMenuCategoryDrawer(false);
  if(menuCategoryDrawer)menuCategoryDrawer.scrollTop=0;
  menu.classList.remove('is-open');
  menu.setAttribute('aria-hidden','true');
}
