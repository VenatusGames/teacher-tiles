function createModule(type,x,y,{record=true,boardState=null,tileSkin=''}={}){
  const t=document.getElementById(`${type}-template`);
  if(!t)return null;
  const m=t.content.firstElementChild.cloneNode(true);
  const pbisMenuItem=menu.querySelector(`[data-module="${CSS.escape(type)}"][data-pbis-tracking="true"]`);
  if(pbisMenuItem){
    const badge=document.createElement('span');
    badge.className='module-pbis-badge';
    badge.textContent='PBIS';
    badge.setAttribute('aria-label','PBIS tracking tile');
    m.appendChild(badge);
  }
  if(boardState)applyBoardPreSetupState(m,boardState);
  else applyNewModuleTileSkin(m,type,tileSkin);
  workspace.appendChild(m);
  const w=m.offsetWidth,h=m.offsetHeight;
  m.style.left=`${clamp(x-w/2,0,BOARD_WIDTH-w)}px`;
  m.style.top=`${clamp(y-18,0,BOARD_HEIGHT-h)}px`;
  bringToFront(m);
  m._isBoardRestore=Boolean(boardState);
  setupModuleByType(m,type);
  m._defaultTileSize={width:m.offsetWidth,height:m.offsetHeight};
  if(boardState)applyBoardPostSetupState(m,boardState);
  delete m._isBoardRestore;
  if(record)recordHistory({type:'add',elements:[m]});
  return m;
}

function moduleIntersectsViewport(m){
  const r=m.getBoundingClientRect();
  return r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight;
}

function updateWorkspaceEmptyState(){
  const modules=[...workspace.querySelectorAll('.module')];
  const hasModules=modules.length>0;
  const hasVisibleModule=modules.some(moduleIntersectsViewport);
  workspace.classList.toggle('has-modules',hasModules);
  workspaceEmptyHint?.classList.toggle('is-visible',!hasVisibleModule);
}

function makeSnapGroupId(){return`sg-${Date.now().toString(36)}-${(++snapGroupSequence).toString(36)}`}

function snapGroupMembers(m){
  const id=m?.dataset.snapGroup;
  if(!id)return m?[m]:[];
  return[...workspace.querySelectorAll('.module')].filter(module=>module.dataset.snapGroup===id);
}

function refreshSnapGroupState(id){
  if(!id)return[];
  const members=[...workspace.querySelectorAll('.module')].filter(module=>module.dataset.snapGroup===id);
  syncSnapGroupClass(members);
  if(members.length>1){
    const z=Math.max(...members.map(module=>Number(module.style.zIndex)||1));
    for(const module of members)module.style.zIndex=String(z);
  }
  return members;
}

function syncSnapGroupClass(modules){
  const list=[...new Set(modules.filter(Boolean))];
  const grouped=list.length>1;
  for(const module of list)module.classList.toggle('is-snap-grouped',grouped);
}

function clearSnapGroupMember(m,{notify=true}={}){
  const id=m?.dataset.snapGroup;
  if(!id)return false;
  const prior=snapGroupMembers(m);
  delete m.dataset.snapGroup;
  m.classList.remove('is-snap-grouped');
  const remaining=prior.filter(module=>module!==m&&module.isConnected);
  if(remaining.length<=1){
    for(const module of remaining){delete module.dataset.snapGroup;module.classList.remove('is-snap-grouped')}
  }else syncSnapGroupClass(remaining);
  if(notify)notifyBoardChanged('ungroup');
  return true;
}

function assignSnapGroup(modules){
  const connected=[...new Set(modules.filter(module=>module?.isConnected&&!isTileLocked(module)&&module.dataset.type!=='sticker'))];
  if(connected.length<2)return connected;
  const expanded=new Set(connected);
  for(const module of connected)for(const member of snapGroupMembers(module))if(member.dataset.type!=='sticker')expanded.add(member);
  const group=[...expanded];
  const id=group.map(module=>module.dataset.snapGroup).find(Boolean)||makeSnapGroupId();
  for(const module of group)module.dataset.snapGroup=id;
  syncSnapGroupClass(group);
  syncSnapGroupLayer(group);
  notifyBoardChanged('group');
  return group;
}

function syncSnapGroupLayer(modules){
  const group=[...new Set(modules.filter(module=>module?.isConnected))];
  if(!group.length)return;
  const tiles=group.filter(module=>module.dataset.type!=='sticker');
  if(tiles.length){
    tileZ=Math.min(tileZ+1,STICKER_Z_BASE-1);
    for(const module of tiles)module.style.zIndex=String(tileZ);
  }
}

function normalizeSnapGroups(){
  const groups=new Map();
  for(const module of workspace.querySelectorAll('.module')){
    if(isTileLocked(module)){delete module.dataset.snapGroup;module.classList.remove('is-snap-grouped');continue;}
    const id=module.dataset.snapGroup;
    if(id){if(!groups.has(id))groups.set(id,[]);groups.get(id).push(module)}
  }
  for(const modules of groups.values()){
    if(modules.length<2){delete modules[0]?.dataset.snapGroup;modules[0]?.classList.remove('is-snap-grouped');continue}
    syncSnapGroupClass(modules);
    const z=Math.max(...modules.map(module=>Number(module.style.zIndex)||1));
    for(const module of modules)module.style.zIndex=String(z);
    tileZ=Math.max(tileZ,z);
  }
}

function bringToFront(m){
  if(!m)return;
  if(m.dataset.type==='sticker'){m.style.zIndex=String(STICKER_Z_BASE+(++stickerZ));return}
  const group=snapGroupMembers(m);
  if(group.length>1){syncSnapGroupLayer(group);return}
  tileZ=Math.min(tileZ+1,STICKER_Z_BASE-1);m.style.zIndex=String(tileZ);
}

function collapseTextEntrySelection(field){
  if(!(field instanceof HTMLElement))return;
  if(field instanceof HTMLInputElement||field instanceof HTMLTextAreaElement){
    const end=Number.isFinite(field.selectionEnd)?field.selectionEnd:field.value.length;
    try{field.setSelectionRange(end,end)}catch{}
    return;
  }
  const selection=getSelection();
  if(selection)selection.removeAllRanges();
}

function findModuleTextEditTarget(target,m){
  if(!(target instanceof Element)||!m)return null;
  const field=target.closest(TEXT_ENTRY_SELECTOR);
  return field&&m.contains(field)?field:null;
}

function isDoubleClickModuleText(field){
  return field instanceof HTMLElement&&field.dataset.textEditMode==='double';
}

function isImmediateModuleInput(field){
  return !isDoubleClickModuleText(field);
}

function exitModuleTextEdit(field=activeModuleTextEditor){
  if(!field)return;
  collapseTextEntrySelection(field);
  field.classList.remove('module-text-edit-active');
  field.closest('.module')?.classList.remove('is-text-editing');
  if(document.activeElement===field)field.blur();
  if(activeModuleTextEditor===field)activeModuleTextEditor=null;
}

function enterModuleTextEdit(field){
  if(!(field instanceof HTMLElement))return;
  if(activeModuleTextEditor&&activeModuleTextEditor!==field)exitModuleTextEdit(activeModuleTextEditor);
  activeModuleTextEditor=field;
  field.classList.add('module-text-edit-active');
  field.closest('.module')?.classList.add('is-text-editing');
  field.focus({preventScroll:true});
  if(field instanceof HTMLInputElement||field instanceof HTMLTextAreaElement){
    const end=field.value.length;
    try{field.setSelectionRange(end,end)}catch{}
  }else if(field.isContentEditable){
    const selection=getSelection();
    if(selection){
      const range=document.createRange();
      range.selectNodeContents(field);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
}

function prepareModuleTextEditors(m){
  const selector=TEXT_ENTRY_SELECTOR;
  m.querySelectorAll(selector).forEach(field=>field.classList.add('module-text-edit-target'));
  const observer=new MutationObserver(records=>{
    for(const record of records){
      for(const node of record.addedNodes){
        if(!(node instanceof Element))continue;
        if(node.matches?.(selector))node.classList.add('module-text-edit-target');
        node.querySelectorAll?.(selector).forEach(field=>field.classList.add('module-text-edit-target'));
      }
    }
  });
  observer.observe(m,{childList:true,subtree:true});
  const previousCleanup=m._cleanup;
  m._cleanup=()=>{observer.disconnect();if(activeModuleTextEditor&&m.contains(activeModuleTextEditor))exitModuleTextEdit(activeModuleTextEditor);previousCleanup?.()};
}

function isInteractiveModuleTarget(target,m){
  if(!(target instanceof Element)||!m)return false;
  if(target.closest('[data-preserve-text-edit="true"]'))return true;
  if(target.closest('.module-drag-handle'))return false;
  if(m.dataset.type==='timer'&&target.closest('.timer-stage'))return false;
  if(m.dataset.type==='interactive'&&target.closest('.hourglass-stage,.candle-stage,.timer-story-stage'))return false;
  const textField=findModuleTextEditTarget(target,m);
  if(textField)return isImmediateModuleInput(textField)||textField.classList.contains('module-text-edit-active');
  if(target.closest('button,input,select,textarea,[contenteditable],[draggable="true"],iframe,audio,video,canvas,a,label,[role="button"],[role="slider"],[role="textbox"],[data-resize],[data-sticker-resize],.resize-handle,.sticker-rotate-handle,.module-delete,.module-fullscreen,.module-pin,.ruler-handle'))return true;
  for(let el=target;el&&el!==m;el=el.parentElement){
    const cursor=getComputedStyle(el).cursor||'';
    if(cursor==='pointer'||cursor==='text'||cursor==='crosshair'||cursor==='not-allowed'||cursor.includes('resize'))return true;
  }
  return false;
}

function isFloatingTileSkinDragSurface(target,m){
  if(!(target instanceof Element)||!m||!FLOATING_TILE_SKIN_IDS.has(m.dataset.tileSkin))return false;
  if(target.closest('input,select,textarea,[contenteditable],[draggable="true"],iframe,audio,video,canvas,a,label,[role="slider"],[role="textbox"],[data-resize],[data-sticker-resize],.resize-handle,.sticker-rotate-handle,.module-delete,.module-fullscreen,.module-pin,.ruler-handle'))return false;
  const action=target.closest('button,[role="button"]');
  return !action||(m.dataset.tileSkin==='stoplight-freestanding'&&action.classList.contains('stoplight-stage'));
}

function tileOptionImportantElements(m){
  return[...m.querySelectorAll(':scope>[data-yield-to-tile-options="true"]')].filter(el=>{
    const style=getComputedStyle(el);
    if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)return false;
    const rect=el.getBoundingClientRect();
    return rect.width>2&&rect.height>2;
  });
}

function rectsOverlap(a,b,pad=4){return a.left<b.right+pad&&a.right>b.left-pad&&a.top<b.bottom+pad&&a.bottom>b.top-pad}

function clearTileOptionObstructionShift(m){
  m?.querySelectorAll('.is-shifted-for-tile-options').forEach(el=>{
    el.classList.remove('is-shifted-for-tile-options');
    el.style.removeProperty('--tile-option-shift-x');
    el.style.removeProperty('--tile-option-shift-y');
  });
}

function tileOptionsAreVisible(m){
  return Boolean(
    (document.body?.classList.contains('tile-options-always-visible')&&m?.matches(':hover'))||
    m?.classList.contains('is-tile-options-hotzone')||
    m?.querySelector(':scope>.module-delete:focus-visible,:scope>.module-fullscreen:focus-visible,:scope>.module-pin:focus-visible')
  );
}

function shiftTileControlsAwayFromOptions(m){
  const optionsActive=Boolean(m?.isConnected&&tileOptionsAreVisible(m));
  m?.classList.toggle('is-tile-options-active',optionsActive);
  clearTileOptionObstructionShift(m);
  if(!optionsActive||document.fullscreenElement===m)return;

  const options=[
    m.querySelector(':scope>.module-delete'),
    m.querySelector(':scope>.module-fullscreen'),
    m.querySelector(':scope>.module-pin')
  ].filter(Boolean);
  if(options.length<3)return;

  const optionRects=options.map(button=>button.getBoundingClientRect());
  const cluster={
    left:Math.min(...optionRects.map(rect=>rect.left))-5,
    top:Math.min(...optionRects.map(rect=>rect.top))-5,
    right:Math.max(...optionRects.map(rect=>rect.right))+5,
    bottom:Math.max(...optionRects.map(rect=>rect.bottom))+5
  };
  const candidates=tileOptionImportantElements(m);
  const overlapping=candidates.filter(el=>rectsOverlap(el.getBoundingClientRect(),cluster,2));
  if(!overlapping.length)return;

  const moduleRect=m.getBoundingClientRect();
  const gap=7;
  const rects=overlapping.map(el=>el.getBoundingClientRect());
  const groupLeft=Math.min(...rects.map(rect=>rect.left));
  const groupRight=Math.max(...rects.map(rect=>rect.right));
  const groupTop=Math.min(...rects.map(rect=>rect.top));
  const groupBottom=Math.max(...rects.map(rect=>rect.bottom));

  // First choice: move the tile's own controls left as a group, preserving their spacing.
  let dx=cluster.left-gap-groupRight;
  let dy=0;
  if(groupLeft+dx<moduleRect.left+5){
    // Very wide controls that cannot fit to the left move below the fixed corner cluster instead.
    dx=0;
    dy=cluster.bottom+gap-groupTop;
    if(groupBottom+dy>moduleRect.bottom-5){
      // Last-resort clamp: keep the corner cluster fixed and move the controls as far left as possible.
      dy=0;
      dx=(moduleRect.left+5)-groupLeft;
    }
  }

  for(const el of overlapping){
    el.classList.add('is-shifted-for-tile-options');
    el.style.setProperty('--tile-option-shift-x',`${dx}px`);
    el.style.setProperty('--tile-option-shift-y',`${dy}px`);
  }
}

function layoutTileOptionControls(m){
  if(!m?.isConnected)return;
  const del=m.querySelector(':scope>.module-delete'),full=m.querySelector(':scope>.module-fullscreen'),pin=m.querySelector(':scope>.module-pin');
  if(!del||!full||!pin)return;

  // The universal corner cluster is always authoritative. Other tile controls move around it.
  if(document.fullscreenElement===m){
    m.style.setProperty('--tile-fullscreen-right','48px');
    m.style.setProperty('--tile-fullscreen-top','12px');
    m.style.setProperty('--tile-pin-right','12px');
    m.style.setProperty('--tile-pin-top','48px');
    clearTileOptionObstructionShift(m);
    return;
  }

  const delStyle=getComputedStyle(del);
  const delRight=parseFloat(delStyle.right)||0;
  const delTop=parseFloat(delStyle.top)||0;
  const delWidth=del.offsetWidth||28;
  const delHeight=del.offsetHeight||28;
  const gap=6;

  m.style.setProperty('--tile-fullscreen-right',`${delRight+delWidth+gap}px`);
  m.style.setProperty('--tile-fullscreen-top',`${delTop}px`);
  m.style.setProperty('--tile-pin-right',`${delRight}px`);
  m.style.setProperty('--tile-pin-top',`${delTop+delHeight+gap}px`);

  requestAnimationFrame(()=>shiftTileControlsAwayFromOptions(m));
}

function isTileLocked(m){return m?.dataset.tileLocked==='true'}

function syncTileLockControl(m){
  const locked=isTileLocked(m);
  const button=m.querySelector('.module-lock-action');
  if(button){button.setAttribute('aria-pressed',String(locked));button.querySelector('span').textContent=locked?'Unlock':'Lock';}
}

function setTileLocked(m,locked){
  if(locked){clearSnapGroupMember(m);m.dataset.tileLocked='true';}
  else delete m.dataset.tileLocked;
  syncTileLockControl(m);
  notifyBoardChanged('tile-lock');
}

function ensureTilePinControl(m){
  let button=m.querySelector(':scope>.module-pin');
  if(button){syncTilePinControl(m);syncTileLockControl(m);return button;}
  const del=m.querySelector(':scope>.module-delete');if(!del)return null;
  button=document.createElement('button');button.className='module-pin';button.type='button';
  button.setAttribute('aria-label','Pin and Lock');button.setAttribute('aria-expanded','false');button.title='Pin and Lock';
  button.innerHTML=TILE_PIN_OFF_ICON;
  const drawer=document.createElement('div');drawer.className='module-position-drawer';drawer.hidden=true;
  drawer.setAttribute('role','group');drawer.setAttribute('aria-label','Tile Position');
  drawer.innerHTML=`<button type="button" class="module-pin-action" aria-pressed="false">${TILE_PIN_OFF_ICON}<span>Pin</span></button><button type="button" class="module-lock-action" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg><span>Lock</span></button>`;
  del.after(button,drawer);
  let controller;
  const close=()=>{drawer.hidden=true;button.setAttribute('aria-expanded','false');controller?.abort();};
  button.addEventListener('pointerdown',event=>event.stopPropagation());
  drawer.addEventListener('pointerdown',event=>event.stopPropagation());
  button.addEventListener('click',event=>{
    event.stopPropagation();if(!drawer.hidden){close();return;}
    drawer.hidden=false;button.setAttribute('aria-expanded','true');
    drawer.style.top=`${button.offsetTop+button.offsetHeight+7}px`;
    drawer.style.right=`${Math.max(8,m.clientWidth-button.offsetLeft-button.offsetWidth)}px`;
    controller=new AbortController();
    document.addEventListener('pointerdown',e=>{if(!drawer.contains(e.target)&&!button.contains(e.target))close();},{capture:true,signal:controller.signal});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){close();button.focus();}},{signal:controller.signal});
  });
  drawer.querySelector('.module-pin-action').addEventListener('click',()=>setTilePinned(m,!isTilePinned(m)));
  drawer.querySelector('.module-lock-action').addEventListener('click',()=>setTileLocked(m,!isTileLocked(m)));
  syncTilePinControl(m);syncTileLockControl(m);return button;
}

function syncTileFullscreenControls(){
  const active=document.fullscreenElement?.classList?.contains('module')?document.fullscreenElement:null;
  document.querySelectorAll('.module').forEach(module=>{
    const button=module.querySelector(':scope>.module-fullscreen');
    const isActive=module===active;
    module.classList.toggle('is-tile-fullscreen',isActive);
    if(!button)return;
    button.setAttribute('aria-pressed',String(isActive));
    button.setAttribute('aria-label',isActive?'Exit tile fullscreen':'View tile fullscreen');
    button.title=isActive?'Exit fullscreen':'Fullscreen';
    if(!isActive&&isTilePinned(module))syncPinnedTileToCamera(module);
    layoutTileOptionControls(module);
  });
}

function rememberTileFullscreenGeometry(m){
  if(!m?.isConnected||m._tileFullscreenGeometry)return;
  m._tileFullscreenTransform=captureModuleTransform(m);
  m._tileFullscreenGeometry={
    left:m.style.left,
    top:m.style.top,
    width:m.style.width,
    height:m.style.height
  };
}

function restoreTileFullscreenGeometry(m){
  const state=m?._tileFullscreenGeometry;
  if(!state||document.fullscreenElement===m)return;
  const apply=()=>{if(!m.isConnected||document.fullscreenElement===m||m._tileFullscreenGeometry!==state)return false;Object.assign(m.style,state);return true};
  apply();
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!apply())return;delete m._tileFullscreenGeometry;delete m._tileFullscreenTransform;if(isTilePinned(m))syncPinnedTileToCamera(m);m._syncTransientResize?.();m._afterModuleResize?.()}));
}

function ensureTileFullscreenControl(m){
  let button=m.querySelector(':scope>.module-fullscreen');
  if(button)return button;
  const del=m.querySelector(':scope>.module-delete');
  if(!del)return null;
  button=document.createElement('button');
  button.className='module-fullscreen';
  button.type='button';
  button.setAttribute('aria-label','View tile fullscreen');
  button.setAttribute('aria-pressed','false');
  button.title='Fullscreen';
  button.innerHTML=`${TILE_FULLSCREEN_ENTER_ICON}${TILE_FULLSCREEN_EXIT_ICON}`;
  del.before(button);
  button.addEventListener('pointerdown',event=>{event.stopPropagation()});
  button.addEventListener('click',async event=>{
    event.preventDefault();
    event.stopPropagation();
    try{
      if(document.fullscreenElement===m){
        await document.exitFullscreen();
      }else{
        rememberTileFullscreenGeometry(m);
        try{await m.requestFullscreen({navigationUI:'hide'})}catch(error){restoreTileFullscreenGeometry(m);throw error}
      }
    }catch{}
  });
  return button;
}

function setupCommon(m){
  m._defaultTileSize={width:m.offsetWidth,height:m.offsetHeight};
  if(m.dataset.type!=='sticker'){
  const resetScale=document.createElement('button');
  resetScale.type='button';resetScale.className='tile-reset-scale';
  resetScale.title='Reset Scale';resetScale.setAttribute('aria-label','Reset Scale');
  resetScale.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M4 4l5 5M20 15v5h-5m5 0-5-5M14 4h6v6M4 14v6h6"/></svg>';
  resetScale.addEventListener('click',event=>{
    event.stopPropagation();
    window.TeacherTilesEditHistory?.flush();
    const before=captureModuleTransform(m),size=m._defaultTileSize;
    clearSnapGroupMember(m);
    m.style.width=size.width+'px';m.style.height=size.height+'px';setTileUniformScale(m,1);
    m._syncTransientResize?.();m._afterModuleResize?.();
    if(m.dataset.type==='sticker')updateStickerVisualSize(m);
    if(isTilePinned(m))capturePinnedTileScreenAnchor(m);
    recordTransformHistory([m],new Map([[m,before]]));notifyBoardChanged('reset-scale');
  });
  m.appendChild(resetScale);
  }
  disableModuleSpellcheck(m);
  prepareModuleTextEditors(m);
  if(m.dataset.type!=='sticker'){
    ensureTileFullscreenControl(m);
    ensureTilePinControl(m);
    window.TeacherTilesTabs?.setup(m);
  }
  layoutTileOptionControls(m);
  const optionResizeObserver=new ResizeObserver(()=>requestAnimationFrame(()=>layoutTileOptionControls(m)));
  optionResizeObserver.observe(m);
  m.addEventListener('focusin',()=>requestAnimationFrame(()=>layoutTileOptionControls(m)));
  m.addEventListener('focusout',()=>requestAnimationFrame(()=>layoutTileOptionControls(m)));
  const priorOptionCleanup=m._cleanup;m._cleanup=()=>{optionResizeObserver.disconnect();clearTileOptionObstructionShift(m);m.classList.remove('is-tile-options-active');priorOptionCleanup?.()};
  const updateDeleteHotzone=e=>{
    const rect=m.getBoundingClientRect();
    const proximityX=Math.max(88,Math.min(126,rect.width*.4));
    const proximityY=Math.max(90,Math.min(124,rect.height*.38));
    m.classList.toggle('is-tab-options-hotzone',e.clientX>=rect.left&&e.clientX<=rect.left+proximityX&&e.clientY>=rect.top&&e.clientY<=rect.top+proximityY);
    const nearCorner=e.clientX>=rect.right-proximityX&&e.clientX<=rect.right&&e.clientY>=rect.top&&e.clientY<=rect.top+proximityY;
    if(nearCorner&&!m.classList.contains('is-tile-options-hotzone'))layoutTileOptionControls(m);
    const nearOption=[m.querySelector(':scope>.module-delete'),m.querySelector(':scope>.module-fullscreen'),m.querySelector(':scope>.module-pin')].filter(Boolean).some(button=>{
      const r=button.getBoundingClientRect(),pad=12;
      return e.clientX>=r.left-pad&&e.clientX<=r.right+pad&&e.clientY>=r.top-pad&&e.clientY<=r.bottom+pad;
    });
    const nearYieldingControl=[...m.querySelectorAll(':scope>[data-yield-to-tile-options="true"]')].some(control=>{
      const style=getComputedStyle(control);
      if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)return false;
      const r=control.getBoundingClientRect(),pad=14;
      return e.clientX>=r.left-pad&&e.clientX<=r.right+pad&&e.clientY>=r.top-pad&&e.clientY<=r.bottom+pad;
    });

    const interactionHold=Number(m.dataset.tileOptionsHoldUntil||0)>performance.now();
    const inside=nearCorner||nearOption||nearYieldingControl||interactionHold;
    const changed=m.classList.contains('is-tile-options-hotzone')!==inside;
    m.classList.toggle('is-delete-hotzone',inside);
    m.classList.toggle('is-tile-options-hotzone',inside);
    if(changed)requestAnimationFrame(()=>shiftTileControlsAwayFromOptions(m));
  };
  m.addEventListener('pointerenter',event=>{
    layoutTileOptionControls(m);
    updateDeleteHotzone(event);
  },{capture:true,passive:true});
  m.addEventListener('pointermove',updateDeleteHotzone,{capture:true,passive:true});
  m.addEventListener('pointerdown',event=>{
    const target=event.target instanceof Element?event.target.closest('[data-yield-to-tile-options="true"]'):null;
    if(!target||!m.contains(target))return;
    m.dataset.tileOptionsHoldUntil=String(performance.now()+900);
    m.classList.add('is-delete-hotzone','is-tile-options-hotzone');
    shiftTileControlsAwayFromOptions(m);
  },true);
  m.addEventListener('pointerleave',()=>{
    delete m.dataset.tileOptionsHoldUntil;
    m.classList.remove('is-delete-hotzone','is-tile-options-hotzone','is-tab-options-hotzone');
    requestAnimationFrame(()=>shiftTileControlsAwayFromOptions(m));
  });
  let grabCursorTarget=null;
  const clearGrabCursor=()=>{grabCursorTarget?.classList.remove('module-grab-cursor');grabCursorTarget=null};
  m.addEventListener('pointerover',e=>{
    const target=e.target instanceof Element?e.target:null;
    if(!target||findModuleTextEditTarget(target,m)||isInteractiveModuleTarget(target,m)){clearGrabCursor();return}
    if(grabCursorTarget!==target){clearGrabCursor();target.classList.add('module-grab-cursor');grabCursorTarget=target}
  });
  m.addEventListener('pointerleave',clearGrabCursor);
  m.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    const field=findModuleTextEditTarget(e.target,m);
    if(!field)return;
    if(isImmediateModuleInput(field)){
      e.stopPropagation();
      enterModuleTextEdit(field);
      return;
    }
    if(field.classList.contains('module-text-edit-active'))return;
    const previous=moduleTextClickState.get(field);
    const now=performance.now();
    const isDouble=previous&&now-previous.time<=420&&Math.hypot(e.clientX-previous.x,e.clientY-previous.y)<=8;
    moduleTextClickState.set(field,{time:now,x:e.clientX,y:e.clientY});
    if(isDouble){
      e.preventDefault();
      e.stopPropagation();
      moduleTextClickState.delete(field);
      enterModuleTextEdit(field);
    }
  },true);
  m.addEventListener('pointerdown',e=>{bringToFront(m);const interactive=isInteractiveModuleTarget(e.target,m);if(!e.shiftKey&&!interactive&&!selectedModules.has(m))clearSelection()});
  m.querySelector('.module-delete').addEventListener('click',e=>{e.stopPropagation();playUiSfx('click');deleteModules(selectedModules.has(m)?[...selectedModules]:[m])});
  setupDrag(m);
  if(!['draw','sticker'].includes(m.dataset.type))setupResize(m)
}

function setupDrag(m){
  const h=m,guideX=workspace.querySelector('.snap-guide-x'),guideY=workspace.querySelector('.snap-guide-y');
  const pulse=mods=>{const unique=[...new Set(mods.filter(Boolean))];for(const el of unique){el.classList.remove('snap-pop');void el.offsetWidth;el.classList.add('snap-pop');setTimeout(()=>el.classList.remove('snap-pop'),240)}};
  let landing=workspace.querySelector('.snap-landing');
  if(!landing){landing=document.createElement('div');landing.className='snap-landing';landing.setAttribute('aria-hidden','true');workspace.appendChild(landing)}
  const clearPreview=()=>{landing.classList.remove('is-visible');guideX.classList.remove('is-visible');guideY.classList.remove('is-visible');workspace.querySelectorAll('.module.is-snap-target').forEach(x=>x.classList.remove('is-snap-target'))};
  const findSnap=(left,top)=>{
    const SNAP=6/boardCamera.scale,EDGE_SNAP=4/boardCamera.scale;
    const w=tileDisplayWidth(m),hh=tileDisplayHeight(m),right=left+w,bottom=top+hh;
    let sx=null,sy=null,bestX=SNAP,bestY=SNAP,targetX=null,targetY=null,seamX=0,seamY=0,xStart=0,xLength=0,yStart=0,yLength=0;
    for(const o of workspace.querySelectorAll('.module')){
      if(o===m||isTileLocked(o)||selectedModules.has(o)||o.dataset.type==='sticker')continue;
      const ol=o.offsetLeft,ot=o.offsetTop,ow=tileDisplayWidth(o),oh=tileDisplayHeight(o),or=ol+ow,ob=ot+oh;
      const vStart=Math.max(top,ot),vEnd=Math.min(bottom,ob),vOverlap=vEnd-vStart,hStart=Math.max(left,ol),hEnd=Math.min(right,or),hOverlap=hEnd-hStart;
      if(vOverlap>28){
        const a=Math.abs(left-or),b=Math.abs(right-ol);
        if(a<bestX){bestX=a;sx=or;targetX=o;seamX=or;xStart=vStart;xLength=vOverlap}
        if(b<bestX){bestX=b;sx=ol-w;targetX=o;seamX=ol;xStart=vStart;xLength=vOverlap}
      }
      if(hOverlap>28){
        const a=Math.abs(top-ob),b=Math.abs(bottom-ot);
        if(a<bestY){bestY=a;sy=ob;targetY=o;seamY=ob;yStart=hStart;yLength=hOverlap}
        if(b<bestY){bestY=b;sy=ot-hh;targetY=o;seamY=ot;yStart=hStart;yLength=hOverlap}
      }
    }
    const view=visibleBoardBounds();
    const edgeCandidatesX=[
      {distance:Math.abs(left-view.left),value:view.left,seam:view.left},
      {distance:Math.abs(right-view.right),value:view.right-w,seam:view.right}
    ];
    for(const edge of edgeCandidatesX)if(edge.distance<=EDGE_SNAP&&edge.distance<bestX){
      bestX=edge.distance;sx=edge.value;targetX=null;seamX=edge.seam;xStart=Math.max(top,view.top);xLength=Math.max(32,Math.min(hh,view.bottom-view.top));
    }
    const edgeCandidatesY=[
      {distance:Math.abs(top-view.top),value:view.top,seam:view.top},
      {distance:Math.abs(bottom-view.bottom),value:view.bottom-hh,seam:view.bottom}
    ];
    for(const edge of edgeCandidatesY)if(edge.distance<=EDGE_SNAP&&edge.distance<bestY){
      bestY=edge.distance;sy=edge.value;targetY=null;seamY=edge.seam;yStart=Math.max(left,view.left);yLength=Math.max(32,Math.min(w,view.right-view.left));
    }
    // Commit to one seam: never pull a tile into two unrelated groups at once.
    if(sx!==null&&sy!==null){
      if(bestX<=bestY){sy=null;targetY=null}else{sx=null;targetX=null}
    }
    return{left:sx,top:sy,targetX,targetY,seamX,seamY,xStart,xLength,yStart,yLength};
  };
  h.addEventListener('pointerdown',e=>{
    const floatingDragSurface=isFloatingTileSkinDragSurface(e.target,m);
    if(isTileLocked(m)||e.button!==0||(isInteractiveModuleTarget(e.target,m)&&!floatingDragSurface))return;
    const clickableStoplightSurface=floatingDragSurface&&e.target instanceof Element&&Boolean(e.target.closest('.stoplight-stage'));
    if(!clickableStoplightSurface)e.preventDefault();
    m.classList.add('is-dragging');
    document.body.classList.add('is-module-dragging');
    bringToFront(m);
    const pinnedDrag=isTilePinned(m);
    if(pinnedDrag){clearSelection();selectedModules.add(m);m.classList.add('is-selected')}
    else if(!selectedModules.has(m)){clearSelection();selectedModules.add(m);m.classList.add('is-selected')}
    const selected=pinnedDrag?[m]:[...selectedModules];
    const connectedToAnchor=snapGroupMembers(m);
    const expanded=new Set();
    for(const selectedModule of selected){
      expanded.add(selectedModule);
      for(const member of snapGroupMembers(selectedModule))expanded.add(member);
    }
    let group=[...expanded].filter(module=>!isTileLocked(module));
    let multi=group.length>1;
    let tugCandidate=selected.length===1&&selected[0]===m&&connectedToAnchor.length>1;
    let tugArmed=false;
    let tugged=false;
    let tugBreakDx=0,tugBreakDy=0,tugBreakVisualDx=0,tugBreakVisualDy=0;
    const dragStartGroup=[...group];
    const origins=new Map(group.map(g=>[g,captureModuleTransform(g)]));
    let dragCaptured=false;
    if(!clickableStoplightSurface){h.setPointerCapture(e.pointerId);dragCaptured=true}
    const sx=e.clientX,sy=e.clientY;
    const tugHoldTimer=tugCandidate?setTimeout(()=>{tugArmed=true;m.classList.add('is-tug-armed')},520):null;
    let pending=null,pendingTab=null,overTrash=false,dragMoved=false;
    let snappingDisabled=false;
    const trashHit=ev=>{if(!trashZone)return false;const b=trashZone.getBoundingClientRect();return ev.clientX>=b.left&&ev.clientX<=b.right&&ev.clientY>=b.top&&ev.clientY<=b.bottom};
    const setTrash=(visible,armed=false)=>{trashZone?.classList.toggle('is-visible',visible);trashZone?.classList.toggle('is-armed',visible&&armed);for(const g of dragStartGroup)g.classList.toggle('is-over-trash',visible&&armed)};
    const setSnappingDisabled=disabled=>{
      snappingDisabled=Boolean(disabled);
      if(snappingDisabled){
        boardZoomPrecision=false;
        zoomIndicator?.classList.remove('is-precise','is-visible');
      }
      if(snapDisabledIndicator){
        snapDisabledIndicator.hidden=!snappingDisabled;
        snapDisabledIndicator.classList.toggle('is-visible',snappingDisabled);
      }
      if(snappingDisabled){pending=null;clearPreview()}
    };
    const keyDown=event=>{if(event.key==='Shift')setSnappingDisabled(true)};
    const keyUp=event=>{if(event.key==='Shift')setSnappingDisabled(false)};
    const windowBlur=()=>setSnappingDisabled(false);
    setTrash(true,false);
    window.addEventListener('keydown',keyDown);
    window.addEventListener('keyup',keyUp);
    window.addEventListener('blur',windowBlur);
    setSnappingDisabled(e.shiftKey);
    const move=ev=>{
      setSnappingDisabled(ev.shiftKey);
      const dx=(ev.clientX-sx)/boardCamera.scale,dy=(ev.clientY-sy)/boardCamera.scale;
      const distance=Math.hypot(ev.clientX-sx,ev.clientY-sy);
      if(distance>=4){
        dragMoved=true;
        if(!dragCaptured){try{h.setPointerCapture(e.pointerId);dragCaptured=true}catch{}}
      }
      if(tugCandidate&&!tugArmed&&distance>8){clearTimeout(tugHoldTimer);tugCandidate=false}
      if(tugArmed&&!tugged&&distance>=36){
        tugBreakDx=dx;tugBreakDy=dy;
        tugBreakVisualDx=dx*.2;tugBreakVisualDy=dy*.2;
        for(const member of group)if(member!==m)applyModuleTransform(member,origins.get(member));
        clearSnapGroupMember(m);
        group=[m];multi=false;tugCandidate=false;tugged=true;
        tugArmed=false;m.classList.remove('is-tug-armed');
        bringToFront(m);
      }
      for(const g of group){
        const o=origins.get(g);
        let moveX=dx,moveY=dy;
        if(tugArmed&&!tugged&&g===m){moveX=dx*.2;moveY=dy*.2}
        else if(tugged&&g===m){moveX=tugBreakVisualDx+(dx-tugBreakDx);moveY=tugBreakVisualDy+(dy-tugBreakDy)}
        g.style.left=`${clamp(o.left+moveX,0,BOARD_WIDTH-tileDisplayWidth(g))}px`;
        g.style.top=`${clamp(o.top+moveY,0,BOARD_HEIGHT-tileDisplayHeight(g))}px`;
      }
      clearPreview();
      overTrash=trashHit(ev);
      setTrash(true,overTrash);
      if(overTrash||multi||snappingDisabled||!dragMoved||pinnedDrag){pending=null;pendingTab=null;workspace.querySelectorAll('.is-tab-drop-target').forEach(el=>el.classList.remove('is-tab-drop-target'));return}
      pendingTab=window.TeacherTilesTabs?.dropTarget(m,ev.clientX,ev.clientY)||null;
      if(pendingTab){pending=null;return;}
      pending=findSnap(m.offsetLeft,m.offsetTop);
      workspace.style.setProperty('--snap-unit',`${1/boardCamera.scale}px`);
      if(pending.left!==null||pending.top!==null){
        Object.assign(landing.style,{left:`${pending.left??m.offsetLeft}px`,top:`${pending.top??m.offsetTop}px`,width:`${tileDisplayWidth(m)}px`,height:`${tileDisplayHeight(m)}px`});
        landing.classList.add('is-visible');
      }
      if(pending.targetX)pending.targetX.classList.add('is-snap-target');
      if(pending.targetY)pending.targetY.classList.add('is-snap-target');
      if(pending.left!==null){
        const len=pending.xLength,st=pending.xStart+(pending.xLength-len)/2;
        Object.assign(guideX.style,{left:`${pending.seamX}px`,top:`${st}px`,height:`${len}px`});guideX.classList.add('is-visible')
      }
      if(pending.top!==null){
        const len=pending.yLength,st=pending.yStart+(pending.yLength-len)/2;
        Object.assign(guideY.style,{top:`${pending.seamY}px`,left:`${st}px`,width:`${len}px`});guideY.classList.add('is-visible')
      }
    };
    const dragEventTarget=clickableStoplightSurface?window:h;
    const cleanup=()=>{workspace.querySelectorAll('.is-tab-drop-target').forEach(el=>el.classList.remove('is-tab-drop-target'));clearTimeout(tugHoldTimer);m.classList.remove('is-dragging','is-tug-armed');document.body.classList.remove('is-module-dragging');setSnappingDisabled(false);clearPreview();setTrash(false,false);window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',windowBlur);dragEventTarget.removeEventListener('pointermove',move);dragEventTarget.removeEventListener('pointerup',end);dragEventTarget.removeEventListener('pointercancel',cancel)};
    const suppressPostDragClick=()=>{
      if(!dragMoved)return;
      const block=event=>{event.preventDefault();event.stopImmediatePropagation()};
      m.addEventListener('click',block,{capture:true,once:true});
      setTimeout(()=>m.removeEventListener('click',block,true),0);
    };
    const end=ev=>{
      suppressPostDragClick();
      if(overTrash){cleanup();deleteModules(dragStartGroup.filter(module=>module.isConnected));return}
      if(tugArmed&&!tugged){for(const [module,origin] of origins)applyModuleTransform(module,origin);cleanup();return}
      let releaseTab=null;
      if(!multi&&!snappingDisabled&&dragMoved&&!pinnedDrag&&Number.isFinite(ev?.clientX)&&Number.isFinite(ev?.clientY)){
        releaseTab=window.TeacherTilesTabs?.dropTarget(m,ev.clientX,ev.clientY)||null;
      }else if(!ev&&pendingTab){
        releaseTab=pendingTab;
      }
      if(releaseTab){const target=releaseTab;cleanup();applyModuleTransform(m,origins.get(m));window.TeacherTilesTabs.merge(target,m);return;}
      let willSnap=false;
      if(!multi&&pending){
        willSnap=pending.left!==null||pending.top!==null;
        if(pending.left!==null)m.style.left=`${clamp(pending.left,0,BOARD_WIDTH-tileDisplayWidth(m))}px`;
        if(pending.top!==null)m.style.top=`${clamp(pending.top,0,BOARD_HEIGHT-tileDisplayHeight(m))}px`;
      }
      let joined=group;
      if(willSnap){
        const snapMembers=[m,...snapGroupMembers(pending.targetX||pending.targetY)].filter(Boolean);
        for(const member of snapMembers)if(!origins.has(member))origins.set(member,captureModuleTransform(member));
        joined=assignSnapGroup(snapMembers);
      }
      recordTransformHistory([...origins.keys()],origins);
      if(pinnedDrag)capturePinnedTileScreenAnchor(m);
      cleanup();
      if(willSnap)pulse(joined);
    };
    const cancel=()=>{for(const [g,origin] of origins)applyModuleTransform(g,origin);if(tugged)assignSnapGroup(connectedToAnchor);cleanup()};
    dragEventTarget.addEventListener('pointermove',move);
    dragEventTarget.addEventListener('pointerup',end);
    dragEventTarget.addEventListener('pointercancel',cancel);
  });
}

function setupResize(m){
  const tabbed=m.classList.contains('is-tabbed-tile');m.classList.remove('is-tabbed-tile');
  const cs=getComputedStyle(m);
  m._resizeMinimum={width:parseFloat(cs.minWidth)||220,height:parseFloat(cs.minHeight)||180};
  if(tabbed)m.classList.add('is-tabbed-tile');
  m.style.setProperty('min-width',m._resizeMinimum.width+'px','important');
  m.style.setProperty('min-height',m._resizeMinimum.height+'px','important');
  for(const d of ['t','r','b','l'])if(!m.querySelector('[data-resize="'+d+'"]')){const h=document.createElement('div');h.className='resize-handle resize-handle--'+d;h.dataset.resize=d;m.appendChild(h);}
  m.querySelectorAll('[data-resize]').forEach(h=>h.addEventListener('pointerdown',e=>{
    if(isTileLocked(m)||e.button!==0)return;e.preventDefault();e.stopPropagation();
    const before=captureModuleTransform(m),d=h.dataset.resize,sx=e.clientX,sy=e.clientY,sl=m.offsetLeft,st=m.offsetTop,sw=tileDisplayWidth(m),sh=tileDisplayHeight(m);
    const minimum=m._resizeMinimum,mw=minimum.width*.85,mh=minimum.height*.85,viewportScale=moduleViewportScale(m)/tileUniformScale(m);
    m.classList.add('is-resizing');clearSnapGroupMember(m);bringToFront(m);h.setPointerCapture(e.pointerId);
    const move=ev=>{
      const dx=(ev.clientX-sx)/viewportScale,dy=(ev.clientY-sy)/viewportScale;
      const horizontal=d.includes('l')||d.includes('r'),vertical=d.includes('t')||d.includes('b');
      let w=Math.max(mw,d.includes('r')?sw+dx:d.includes('l')?sw-dx:sw);
      let height=Math.max(mh,d.includes('b')?sh+dy:d.includes('t')?sh-dy:sh);
      // Keep both axes independent, but prevent extreme strips in either direction.
      if(horizontal&&!vertical)w=clamp(w,Math.max(mw,height/3),Math.max(mw,height*3));
      else if(vertical&&!horizontal)height=clamp(height,Math.max(mh,w/3),Math.max(mh,w*3));
      else{w=Math.max(w,height/3);height=Math.max(height,w/3);}
      if(m._imageRatio){if(!horizontal)w=height*m._imageRatio;else height=w/m._imageRatio;}
      const left=d.includes('l')?sl+sw-w:sl,top=d.includes('t')?st+sh-height:st;
      Object.assign(m.style,{left:clamp(left,0,Math.max(0,BOARD_WIDTH-w))+'px',top:clamp(top,0,Math.max(0,BOARD_HEIGHT-height))+'px'});
      fitTileDisplaySize(m,w,height);
    };
    const finish=cancelled=>{
      if(cancelled)applyModuleTransform(m,before);
      else{m._syncTransientResize?.();m._afterModuleResize?.();recordTransformHistory([m],new Map([[m,before]]));}
      m.classList.remove('is-resizing');if(isTilePinned(m))capturePinnedTileScreenAnchor(m);
      updateWorkspaceEmptyState();h.removeEventListener('pointermove',move);h.removeEventListener('pointerup',end);h.removeEventListener('pointercancel',cancel);
    };
    const end=()=>finish(false),cancel=()=>finish(true);
    h.addEventListener('pointermove',move);h.addEventListener('pointerup',end);h.addEventListener('pointercancel',cancel);
  }));
}

function updateStickerVisualSize(m){
  m.style.setProperty('--sticker-handle-radius',`${m.offsetHeight/2+26}px`);
  m.style.setProperty('--sticker-delete-x',`${m.offsetWidth/2-4}px`);
  const emoji=m.querySelector('.sticker-emoji');
  if(!emoji)return;
  const size=Math.max(38,Math.min(m.offsetWidth,m.offsetHeight)*.72);
  emoji.style.fontSize=`${size}px`;
  emoji.style.setProperty('--sticker-outline',`${Math.max(2.5,size*.052)}px`);
}

function setupStickerTransformControls(m){
  // A brief exit grace period bridges the raised X without covering resize handles.
  if(m&&!m._stickerDeleteHoverReady){
    m._stickerDeleteHoverReady=true;
    let exitTimer;
    m.addEventListener('pointerenter',()=>{clearTimeout(exitTimer);m.classList.add('is-sticker-delete-hover')});
    m.addEventListener('pointerleave',()=>{clearTimeout(exitTimer);exitTimer=setTimeout(()=>m.classList.remove('is-sticker-delete-hover'),220)});
  }

  if(!m||m.dataset.stickerTransformReady)return;
  m.dataset.stickerTransformReady='true';
  const ratio=m._stickerRatio||Math.max(.12,m.offsetWidth/Math.max(1,m.offsetHeight));
  m._stickerRatio=ratio;

  const rotate=document.createElement('button');
  rotate.type='button';
  rotate.className='sticker-rotate-handle';
  rotate.setAttribute('aria-label','Rotate sticker');
  rotate.innerHTML='<span aria-hidden="true">↻</span><b class="sticker-rotation-readout" aria-hidden="true">0°</b>';
  m.appendChild(rotate);

  for(const d of ['tl','tr','bl','br']){
    const h=document.createElement('button');
    h.type='button';
    h.className=`sticker-resize-handle sticker-resize-handle--${d}`;
    h.dataset.stickerResize=d;
    h.setAttribute('aria-label','Resize sticker');
    m.appendChild(h);
  }

  m.querySelectorAll('[data-sticker-resize]').forEach(h=>h.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    e.preventDefault();e.stopPropagation();bringToFront(m);h.setPointerCapture(e.pointerId);
    const before=captureModuleTransform(m),d=h.dataset.stickerResize,sx=e.clientX,sy=e.clientY,sl=m.offsetLeft,st=m.offsetTop,sw=m.offsetWidth,sh=m.offsetHeight;
    const right=sl+sw,bottom=st+sh;
    const angle=(Number(m.dataset.stickerRotation)||0)*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
    const signX=d.includes('r')?1:-1,signY=d.includes('b')?1:-1;
    const anchorX=sl+sw/2-cos*signX*sw/2+sin*signY*sh/2;
    const anchorY=st+sh/2-sin*signX*sw/2-cos*signY*sh/2;
    const minW=Math.max(52,52*ratio);
    const maxW=Math.max(minW,Math.min(d.includes('r')?BOARD_WIDTH-sl:right,(d.includes('b')?BOARD_HEIGHT-st:bottom)*ratio));
    m.classList.add('is-sticker-resizing');
    const move=ev=>{
      const screenDx=(ev.clientX-sx)/boardCamera.scale,screenDy=(ev.clientY-sy)/boardCamera.scale;
      const dx=cos*screenDx+sin*screenDy,dy=-sin*screenDx+cos*screenDy;
      const fromX=d.includes('r')?sw+dx:sw-dx;
      const fromY=(d.includes('b')?sh+dy:sh-dy)*ratio;
      let w=Math.abs(fromX-sw)>=Math.abs(fromY-sw)?fromX:fromY;
      w=clamp(w,minW,maxW);
      const hh=w/ratio;
      const l=anchorX+cos*signX*w/2-sin*signY*hh/2-w/2;
      const t=anchorY+sin*signX*w/2+cos*signY*hh/2-hh/2;
      Object.assign(m.style,{left:`${l}px`,top:`${t}px`,width:`${w}px`,height:`${hh}px`});
      updateStickerVisualSize(m);
    };
    const end=()=>{
      m.classList.remove('is-sticker-resizing');
      recordTransformHistory([m],new Map([[m,before]]));
      updateWorkspaceEmptyState();
      h.removeEventListener('pointermove',move);h.removeEventListener('pointerup',end);h.removeEventListener('pointercancel',end);
    };
    h.addEventListener('pointermove',move);h.addEventListener('pointerup',end);h.addEventListener('pointercancel',end);
  }));

  rotate.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    e.preventDefault();e.stopPropagation();bringToFront(m);rotate.setPointerCapture(e.pointerId);
    const rect=m.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
    const angleOf=ev=>Math.atan2(ev.clientY-cy,ev.clientX-cx)*180/Math.PI;
    let lastAngle=angleOf(e),accumulated=0;
    const before=captureModuleTransform(m),startRotation=parseFloat(m.dataset.stickerRotation)||0;
    const readout=rotate.querySelector('.sticker-rotation-readout');
    m.classList.add('is-sticker-rotating');
    const move=ev=>{
      const angle=angleOf(ev);
      let delta=angle-lastAngle;
      if(delta>180)delta-=360;
      if(delta<-180)delta+=360;
      accumulated+=delta;
      lastAngle=angle;
      let next=startRotation+accumulated;
      if(ev.shiftKey)next=Math.round(next/15)*15;
      m.dataset.stickerRotation=String(next);
      m.style.setProperty('--sticker-rotation',`${next}deg`);
      if(readout)readout.textContent=`${Math.round(((next%360)+360)%360)}°`;
    };
    const end=()=>{
      m.classList.remove('is-sticker-rotating');
      recordTransformHistory([m],new Map([[m,before]]));
      rotate.removeEventListener('pointermove',move);rotate.removeEventListener('pointerup',end);rotate.removeEventListener('pointercancel',end);
    };
    rotate.addEventListener('pointermove',move);rotate.addEventListener('pointerup',end);rotate.addEventListener('pointercancel',end);
  });

  updateStickerVisualSize(m);
}
