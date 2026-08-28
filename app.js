const workspace=document.getElementById('workspace');
const menu=document.getElementById('context-menu');
const uiSfxToggle=document.getElementById('ui-sfx-toggle');
const fullscreenToggle=document.getElementById('fullscreen-toggle');
const trashZone=document.getElementById('trash-zone');
let z=10,spawn={x:innerWidth/2,y:innerHeight/2},uid=0;
const selectedModules=new Set();
function clearSelection(){for(const el of selectedModules)el.classList.remove('is-selected');selectedModules.clear()}
function toggleSelection(m){if(selectedModules.has(m)){selectedModules.delete(m);m.classList.remove('is-selected')}else{selectedModules.add(m);m.classList.add('is-selected')}}
const FONT_OPTIONS=['inter','poppins','nunito','quicksand','oswald','lora','merriweather','playfair','caveat','phantom'];

const UI_SFX_KEY='teachertiles-ui-sfx-muted';
let uiSfxMuted=localStorage.getItem(UI_SFX_KEY)==='true';
const uiSfxPrototype=new Audio('assets/ui/pop.mp3');
uiSfxPrototype.preload='auto';

function playUiSfx(kind='click'){
  if(uiSfxMuted)return;
  try{
    const sound=uiSfxPrototype.cloneNode();
    sound.volume=kind==='intro'?.62:kind==='collection'?.18:.11;
    sound.playbackRate=kind==='intro'?1:kind==='collection'?.92:1.35;
    sound.currentTime=0;
    sound.play().catch(()=>{});
  }catch{}
}

function updateUiSfxToggle(){
  if(!uiSfxToggle)return;
  uiSfxToggle.setAttribute('aria-label',uiSfxMuted?'Turn UI sounds on':'Mute UI sounds');
  uiSfxToggle.classList.toggle('is-muted',uiSfxMuted);
}

uiSfxToggle?.addEventListener('click',()=>{
  const wasMuted=uiSfxMuted;
  uiSfxMuted=!uiSfxMuted;
  localStorage.setItem(UI_SFX_KEY,String(uiSfxMuted));
  updateUiSfxToggle();
  if(wasMuted&&!uiSfxMuted)playUiSfx('click');
});
updateUiSfxToggle();

document.addEventListener('click',e=>{
  const target=e.target;
  if(!(target instanceof Element))return;
  if(target.closest('#ui-sfx-toggle'))return;
  const interactive=target.closest('button,[role="button"],input[type="checkbox"],input[type="radio"],select');
  if(interactive&&!interactive.disabled)playUiSfx('click');
},true);


document.addEventListener('click',e=>{
  const t=e.target;
  if(!(t instanceof Element))return;
  if(t.closest('.collection-add,.collection-jar,.collection-canvas'))playUiSfx('collection');
},true);

document.addEventListener('change',e=>{
  const target=e.target;
  if(target instanceof HTMLInputElement&&target.type==='range')playUiSfx('click');
},true);

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const formatCountdown=s=>{s=Math.max(0,Math.ceil(s));const m=Math.floor(s/60),ss=s%60;return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`};

const BOARD_WIDTH=12000;
const BOARD_HEIGHT=8000;
const boardCamera={x:0,y:0,scale:1};
const BOARD_MIN_ZOOM=.35;
const BOARD_MAX_ZOOM=1.8;
const BOARD_OVERSCROLL=120;

workspace.style.width=`${BOARD_WIDTH}px`;
workspace.style.height=`${BOARD_HEIGHT}px`;
workspace.style.transformOrigin='0 0';

function clampBoardCamera(){
  const scaledW=BOARD_WIDTH*boardCamera.scale;
  const scaledH=BOARD_HEIGHT*boardCamera.scale;
  const minX=Math.min(BOARD_OVERSCROLL,innerWidth-scaledW-BOARD_OVERSCROLL);
  const minY=Math.min(BOARD_OVERSCROLL,innerHeight-scaledH-BOARD_OVERSCROLL);
  boardCamera.x=clamp(boardCamera.x,minX,BOARD_OVERSCROLL);
  boardCamera.y=clamp(boardCamera.y,minY,BOARD_OVERSCROLL);
}
function applyBoardCamera(){
  clampBoardCamera();
  workspace.style.transform=`translate3d(${boardCamera.x}px,${boardCamera.y}px,0) scale(${boardCamera.scale})`;
  workspace.style.setProperty('--board-zoom',boardCamera.scale);
  requestAnimationFrame(()=>updateWorkspaceEmptyState());
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
centerBoardCamera();

workspace.addEventListener('wheel',e=>{
  if(e.ctrlKey)return;
  e.preventDefault();
  const factor=Math.exp(-e.deltaY*.0012);
  const next=clamp(boardCamera.scale*factor,BOARD_MIN_ZOOM,BOARD_MAX_ZOOM);
  if(Math.abs(next-boardCamera.scale)<.0001)return;
  const anchor=screenToBoard(e.clientX,e.clientY);
  boardCamera.scale=next;
  boardCamera.x=e.clientX-anchor.x*next;
  boardCamera.y=e.clientY-anchor.y*next;
  applyBoardCamera();
},{passive:false});

function beginBoardPan(e){
  closeMenu();
  if(e.button===0)clearSelection();
  e.preventDefault();
  workspace.classList.add('is-panning');
  workspace.setPointerCapture(e.pointerId);
  const sx=e.clientX,sy=e.clientY,startX=boardCamera.x,startY=boardCamera.y;
  const move=ev=>{
    boardCamera.x=startX+(ev.clientX-sx);
    boardCamera.y=startY+(ev.clientY-sy);
    applyBoardCamera();
  };
  const end=()=>{
    workspace.classList.remove('is-panning');
    workspace.removeEventListener('pointermove',move);
    workspace.removeEventListener('pointerup',end);
    workspace.removeEventListener('pointercancel',end);
  };
  workspace.addEventListener('pointermove',move);
  workspace.addEventListener('pointerup',end);
  workspace.addEventListener('pointercancel',end);
}

workspace.addEventListener('pointerdown',e=>{
  const middlePan=e.button===1;
  const emptyBoardPan=e.button===0&&e.target===workspace&&!e.shiftKey;
  if(!middlePan&&!emptyBoardPan)return;
  beginBoardPan(e);
},true);

workspace.addEventListener('auxclick',e=>{
  if(e.button===1)e.preventDefault();
});

window.addEventListener('resize',applyBoardCamera);


workspace.addEventListener('contextmenu',e=>{e.preventDefault();spawn=screenToBoard(e.clientX,e.clientY);if(menuSearch)menuSearch.value='';setMenuCategory('all');menu.classList.remove('is-open');void menu.offsetWidth;menu.style.left=`${e.clientX}px`;menu.style.top=`${e.clientY}px`;menu.classList.add('is-open');const r=menu.getBoundingClientRect();menu.style.left=`${clamp(e.clientX,8,innerWidth-r.width-8)}px`;menu.style.top=`${clamp(e.clientY,8,innerHeight-r.height-8)}px`;menu.setAttribute('aria-hidden','false')});
document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))closeMenu();if(e.target===workspace&&!e.shiftKey)clearSelection()});

const menuFilters=[...menu.querySelectorAll('[data-category-filter]')];
const menuSearch=menu.querySelector('#context-menu-search');
const menuSearchClear=menu.querySelector('.context-menu__search-clear');
const menuNoResults=menu.querySelector('.context-menu__no-results');
const menuItems=[...menu.querySelectorAll('.context-menu__item[data-category]')];
let activeMenuCategory='all';

function normalizeMenuSearch(value=''){
  return value.toLowerCase().trim().replace(/\s+/g,' ');
}

function applyMenuView(){
  const query=normalizeMenuSearch(menuSearch?.value);
  const searching=Boolean(query);
  menu.classList.toggle('is-searching',searching);
  menuSearchClear?.classList.toggle('is-visible',searching);

  let visibleCount=0;
  menuItems.forEach(item=>{
    const searchable=[
      item.querySelector('strong')?.textContent||'',
      item.querySelector('small')?.textContent||'',
      item.dataset.module||'',
      item.dataset.category||''
    ].join(' ').toLowerCase();

    const matchesSearch=!searching||searchable.includes(query);
    const matchesCategory=activeMenuCategory==='all'||item.dataset.category===activeMenuCategory;
    const visible=searching?matchesSearch:matchesCategory;
    item.hidden=!visible;
    if(visible)visibleCount++;
  });

  if(menuNoResults)menuNoResults.hidden=!searching||visibleCount>0;
  const list=menu.querySelector('.context-menu__list');
  if(list)list.scrollTop=0;
}

function setMenuCategory(category='all'){
  activeMenuCategory=category;
  menuFilters.forEach(b=>b.classList.toggle('is-active',b.dataset.categoryFilter===category));
  applyMenuView();
}

function clearMenuSearch(){
  if(!menuSearch)return;
  menuSearch.value='';
  applyMenuView();
}

menuFilters.forEach(b=>b.addEventListener('click',e=>{
  e.stopPropagation();
  setMenuCategory(b.dataset.categoryFilter);
}));

menuSearch?.addEventListener('input',applyMenuView);
menuSearch?.addEventListener('pointerdown',e=>e.stopPropagation());
menuSearch?.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    e.stopPropagation();
    if(menuSearch.value){
      clearMenuSearch();
    }else{
      closeMenu();
    }
  }
});
menuSearchClear?.addEventListener('click',e=>{
  e.stopPropagation();
  clearMenuSearch();
  menuSearch?.focus();
});

setMenuCategory('all');

function closeMenu(){
  menu.classList.remove('is-open');
  menu.setAttribute('aria-hidden','true');
}
menu.addEventListener('click',e=>{const b=e.target.closest('[data-module]');if(!b)return;createModule(b.dataset.module,spawn.x,spawn.y);closeMenu()});

function createModule(type,x,y){const t=document.getElementById(`${type}-template`);if(!t)return null;const m=t.content.firstElementChild.cloneNode(true);workspace.appendChild(m);const w=m.offsetWidth,h=m.offsetHeight;m.style.left=`${clamp(x-w/2,0,BOARD_WIDTH-w)}px`;m.style.top=`${clamp(y-18,0,BOARD_HEIGHT-h)}px`;bringToFront(m);setupCommon(m);if(type==='sticky')setupSticky(m);if(type==='timer')setupTimer(m);if(type==='interactive')setupHourglass(m);if(type==='clock')setupClock(m);if(type==='stopwatch')setupStopwatch(m);if(type==='draw')setupDraw(m);if(type==='writinglines')setupWritingLines(m);if(type==='noise')setupNoise(m);if(type==='collections')setupCollections(m);if(type==='stoplight')setupStoplight(m);if(type==='groupmaker')setupGroupMaker(m);if(type==='lunchcount')setupLunchCount(m);if(type==='voting')setupVoting(m);if(type==='image')setupImage(m);if(type==='youtube')setupYoutube(m);if(type==='ambiencevideo')setupAmbienceVideo(m);if(type==='windowshare')setupWindowShare(m);if(type==='boombox')setupBoombox(m);
  if(type==='spinner')setupSpinner(m);if(type==='hangman')setupHangman(m);if(type==='wordypuzzle')setupWordyPuzzle(m);if(type==='cvcword')setupCVCWord(m);if(type==='highfrequency')setupHighFrequencyWords(m);if(type==='abc')setupABC(m);if(type==='ruler')setupRuler(m);if(type==='calculator')setupCalculator(m);if(type==='grapher')setupGrapher(m);if(type==='periodictable')setupPeriodicTable(m);if(type==='money')setupMoney(m);if(type==='numberline')setupNumberLine(m);if(type==='hundredschart')setupHundredsChart(m);if(type==='tenframes')setupTenFrames(m);if(type==='textbubble')setupTextBubble(m);if(type==='todo')setupTodo(m);if(type==='visualschedule')setupVisualSchedule(m);if(type==='progressbar')setupProgressBar(m);if(type==='date')setupDate(m);if(type==='calendar')setupCalendar(m);return m}

const workspaceEmptyHint=document.getElementById('workspace-empty-hint');

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

const workspaceModuleObserver=new MutationObserver(updateWorkspaceEmptyState);
workspaceModuleObserver.observe(workspace,{childList:true,subtree:false});
updateWorkspaceEmptyState();

function bringToFront(m){m.style.zIndex=++z}
function setupCommon(m){m.addEventListener('pointerdown',e=>{if(e.shiftKey){e.preventDefault();e.stopPropagation();toggleSelection(m);bringToFront(m)}},true);m.addEventListener('pointerdown',e=>{bringToFront(m);const interactive=e.target.closest('button,input,select,textarea,[contenteditable],iframe');if(!e.shiftKey&&!interactive&&!selectedModules.has(m))clearSelection()});m.querySelector('.module-delete').addEventListener('click',()=>{selectedModules.delete(m);m._cleanup?.();m.remove()});setupDrag(m);if(!['draw','sticker'].includes(m.dataset.type))setupResize(m)}
function setupDrag(m){
  const h=m.querySelector('.module-drag-handle'),guideX=workspace.querySelector('.snap-guide-x'),guideY=workspace.querySelector('.snap-guide-y');
  const pulse=mods=>{const unique=[...new Set(mods.filter(Boolean))];for(const el of unique){el.classList.remove('snap-pop');void el.offsetWidth;el.classList.add('snap-pop');setTimeout(()=>el.classList.remove('snap-pop'),240)}};
  const touching=(a,b)=>{const al=a.offsetLeft,at=a.offsetTop,ar=al+a.offsetWidth,ab=at+a.offsetHeight,bl=b.offsetLeft,bt=b.offsetTop,br=bl+b.offsetWidth,bb=bt+b.offsetHeight;const vo=Math.min(ab,bb)-Math.max(at,bt),ho=Math.min(ar,br)-Math.max(al,bl);return (vo>24&&(Math.abs(ar-bl)<=2.5||Math.abs(br-al)<=2.5))||(ho>24&&(Math.abs(ab-bt)<=2.5||Math.abs(bb-at)<=2.5))};
  const snappedGroup=start=>{const all=[...workspace.querySelectorAll('.module')],seen=new Set([start]),queue=[start];while(queue.length){const a=queue.shift();for(const b of all){if(seen.has(b)||b===a)continue;if(touching(a,b)){seen.add(b);queue.push(b)}}}return [...seen]};
  const clearPreview=()=>{guideX.classList.remove('is-visible');guideY.classList.remove('is-visible');document.querySelectorAll('.module.is-snap-target').forEach(x=>x.classList.remove('is-snap-target'))};
  const findSnap=(left,top)=>{
    const SNAP=15/boardCamera.scale,EDGE_SNAP=20/boardCamera.scale;
    const w=m.offsetWidth,hh=m.offsetHeight,right=left+w,bottom=top+hh;
    let sx=null,sy=null,bestX=SNAP+1,bestY=SNAP+1,targetX=null,targetY=null,seamX=0,seamY=0,xStart=0,xLength=0,yStart=0,yLength=0;
    for(const o of workspace.querySelectorAll('.module')){
      if(o===m||selectedModules.has(o))continue;
      const ol=o.offsetLeft,ot=o.offsetTop,ow=o.offsetWidth,oh=o.offsetHeight,or=ol+ow,ob=ot+oh;
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
    return{left:sx,top:sy,targetX,targetY,seamX,seamY,xStart,xLength,yStart,yLength};
  };
  h.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    e.preventDefault();
    m.classList.add('is-dragging');
    bringToFront(m);
    if(!selectedModules.has(m)){if(!e.shiftKey)clearSelection();selectedModules.add(m);m.classList.add('is-selected')}
    const group=[...selectedModules],multi=group.length>1;
    for(const g of group)bringToFront(g);
    const origins=new Map(group.map(g=>[g,{left:g.offsetLeft,top:g.offsetTop}]));
    h.setPointerCapture(e.pointerId);
    const sx=e.clientX,sy=e.clientY;
    let pending=null,overTrash=false;
    const trashHit=ev=>{if(!trashZone)return false;const b=trashZone.getBoundingClientRect();return ev.clientX>=b.left&&ev.clientX<=b.right&&ev.clientY>=b.top&&ev.clientY<=b.bottom};
    const setTrash=(visible,armed=false)=>{trashZone?.classList.toggle('is-visible',visible);trashZone?.classList.toggle('is-armed',visible&&armed);for(const g of group)g.classList.toggle('is-over-trash',visible&&armed)};
    setTrash(true,false);
    const move=ev=>{
      const dx=(ev.clientX-sx)/boardCamera.scale,dy=(ev.clientY-sy)/boardCamera.scale;
      for(const g of group){
        const o=origins.get(g);
        g.style.left=`${clamp(o.left+dx,0,BOARD_WIDTH-g.offsetWidth)}px`;
        g.style.top=`${clamp(o.top+dy,0,BOARD_HEIGHT-g.offsetHeight)}px`;
      }
      clearPreview();
      overTrash=trashHit(ev);
      setTrash(true,overTrash);
      if(overTrash||multi){pending=null;return}
      pending=findSnap(m.offsetLeft,m.offsetTop);
      if(pending.targetX)pending.targetX.classList.add('is-snap-target');
      if(pending.targetY)pending.targetY.classList.add('is-snap-target');
      if(pending.left!==null){
        const len=Math.max(12/boardCamera.scale,Math.min(46/boardCamera.scale,pending.xLength*.48)),st=pending.xStart+(pending.xLength-len)/2;
        Object.assign(guideX.style,{left:`${pending.seamX}px`,top:`${st}px`,height:`${len}px`});guideX.classList.add('is-visible')
      }
      if(pending.top!==null){
        const len=Math.max(12/boardCamera.scale,Math.min(46/boardCamera.scale,pending.yLength*.48)),st=pending.yStart+(pending.yLength-len)/2;
        Object.assign(guideY.style,{top:`${pending.seamY}px`,left:`${st}px`,width:`${len}px`});guideY.classList.add('is-visible')
      }
    };
    const cleanup=()=>{m.classList.remove('is-dragging');clearPreview();setTrash(false,false);h.removeEventListener('pointermove',move);h.removeEventListener('pointerup',end);h.removeEventListener('pointercancel',cancel)};
    const end=()=>{
      if(overTrash){cleanup();for(const g of group){selectedModules.delete(g);g._cleanup?.();g.classList.add('trash-delete');setTimeout(()=>g.remove(),150)}return}
      let willSnap=false;
      if(!multi&&pending){
        willSnap=pending.left!==null||pending.top!==null;
        if(pending.left!==null)m.style.left=`${clamp(pending.left,0,BOARD_WIDTH-m.offsetWidth)}px`;
        if(pending.top!==null)m.style.top=`${clamp(pending.top,0,BOARD_HEIGHT-m.offsetHeight)}px`;
      }
      cleanup();
      pulse(multi?group:(willSnap?snappedGroup(m):[m]));
    };
    const cancel=()=>cleanup();
    h.addEventListener('pointermove',move);
    h.addEventListener('pointerup',end);
    h.addEventListener('pointercancel',cancel);
  });
}

function setupResize(m){
  for(const d of ['t','r','b','l'])if(!m.querySelector(`[data-resize="${d}"]`)){const h=document.createElement('div');h.className=`resize-handle resize-handle--${d}`;h.dataset.resize=d;m.appendChild(h)}
  m.querySelectorAll('[data-resize]').forEach(h=>h.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    e.preventDefault();e.stopPropagation();bringToFront(m);h.setPointerCapture(e.pointerId);
    const d=h.dataset.resize,sx=e.clientX,sy=e.clientY,sl=m.offsetLeft,st=m.offsetTop,sw=m.offsetWidth,sh=m.offsetHeight,cs=getComputedStyle(m),mw=parseFloat(cs.minWidth)||220,mh=parseFloat(cs.minHeight)||180;
    const move=ev=>{
      const dx=(ev.clientX-sx)/boardCamera.scale,dy=(ev.clientY-sy)/boardCamera.scale;
      let l=sl,t=st,w=sw,hh=sh;
      if(d.includes('r'))w=clamp(sw+dx,mw,BOARD_WIDTH-sl);
      if(d.includes('b'))hh=clamp(sh+dy,mh,BOARD_HEIGHT-st);
      if(d.includes('l')){w=clamp(sw-dx,mw,sw+sl);l=sl+sw-w}
      if(d.includes('t')){hh=clamp(sh-dy,mh,sh+st);t=st+sh-hh}
      if(m._imageRatio){
        const ratio=m._imageRatio;
        if(d==='t'||d==='b'){
          w=Math.max(mw,hh*ratio);
          if(w>BOARD_WIDTH-l){w=BOARD_WIDTH-l;hh=w/ratio}
          if(d==='t')t=st+sh-hh;
        }else{
          hh=Math.max(mh,w/ratio);
          if(hh>BOARD_HEIGHT-t){hh=BOARD_HEIGHT-t;w=hh*ratio}
          if(d.includes('l'))l=sl+sw-w;
          if(d.includes('t'))t=st+sh-hh;
        }
      }
      Object.assign(m.style,{left:`${l}px`,top:`${t}px`,width:`${w}px`,height:`${hh}px`});
    };
    const end=()=>{updateWorkspaceEmptyState();h.removeEventListener('pointermove',move);h.removeEventListener('pointerup',end);h.removeEventListener('pointercancel',end)};
    h.addEventListener('pointermove',move);h.addEventListener('pointerup',end);h.addEventListener('pointercancel',end);
  }));
}

function updateStickerVisualSize(m){
  const emoji=m.querySelector('.sticker-emoji');
  if(!emoji)return;
  const size=Math.max(38,Math.min(m.offsetWidth,m.offsetHeight)*.72);
  emoji.style.fontSize=`${size}px`;
  emoji.style.setProperty('--sticker-outline',`${Math.max(2.5,size*.052)}px`);
}

function setupStickerTransformControls(m){
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
    const d=h.dataset.stickerResize,sx=e.clientX,sy=e.clientY,sl=m.offsetLeft,st=m.offsetTop,sw=m.offsetWidth,sh=m.offsetHeight;
    const right=sl+sw,bottom=st+sh;
    const minW=Math.max(52,52*ratio);
    const maxW=Math.max(minW,Math.min(d.includes('r')?BOARD_WIDTH-sl:right,(d.includes('b')?BOARD_HEIGHT-st:bottom)*ratio));
    m.classList.add('is-sticker-resizing');
    const move=ev=>{
      const dx=(ev.clientX-sx)/boardCamera.scale,dy=(ev.clientY-sy)/boardCamera.scale;
      const fromX=d.includes('r')?sw+dx:sw-dx;
      const fromY=(d.includes('b')?sh+dy:sh-dy)*ratio;
      let w=Math.abs(fromX-sw)>=Math.abs(fromY-sw)?fromX:fromY;
      w=clamp(w,minW,maxW);
      const hh=w/ratio;
      const l=d.includes('l')?right-w:sl;
      const t=d.includes('t')?bottom-hh:st;
      Object.assign(m.style,{left:`${l}px`,top:`${t}px`,width:`${w}px`,height:`${hh}px`});
      updateStickerVisualSize(m);
    };
    const end=()=>{
      m.classList.remove('is-sticker-resizing');
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
    const startRotation=parseFloat(m.dataset.stickerRotation)||0;
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
      rotate.removeEventListener('pointermove',move);rotate.removeEventListener('pointerup',end);rotate.removeEventListener('pointercancel',end);
    };
    rotate.addEventListener('pointermove',move);rotate.addEventListener('pointerup',end);rotate.addEventListener('pointercancel',end);
  });

  updateStickerVisualSize(m);
}

function setupSticky(m){const ed=m.querySelector('.sticky-editor'),bar=m.querySelector('.sticky-toolbar'),size=m.querySelector('.sticky-font-size'),cycle=m.querySelector('.sticky-color-cycle'),font=m.querySelector('.sticky-font-cycle'),dot=cycle.querySelector('span'),colors=['yellow','pink','blue','green','lavender'],hex={yellow:'#fff2aa',pink:'#ffdbe5',blue:'#dbeeff',green:'#ddf4df',lavender:'#eadfff'};let i=0;bar.addEventListener('pointerdown',e=>{if(e.target.closest('button'))e.preventDefault()});bar.addEventListener('click',e=>{const b=e.target.closest('[data-command]');if(!b)return;ed.focus();document.execCommand(b.dataset.command,false,null)});size.addEventListener('change',()=>{ed.focus();document.execCommand('fontSize',false,'7');ed.querySelectorAll('font[size="7"]').forEach(f=>{f.removeAttribute('size');f.style.fontSize=`${size.value}px`})});font.addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));cycle.addEventListener('click',()=>{i=(i+1)%colors.length;m.dataset.color=colors[i];dot.style.background=hex[colors[i]]})}

const shapePaths={
  circle:'M50 4 A46 46 0 1 1 49.999 4 Z',
  triangle:'M50 5 L96 92 L4 92 Z',
  square:'M8 8 H92 V92 H8 Z',
  diamond:'M50 4 L96 50 L50 96 L4 50 Z',
  hexagon:'M25 6 H75 L96 50 L75 94 H25 L4 50 Z',
  star:'M50 4 L61.4 36.2 L95.5 36.9 L68.4 57.7 L78.2 90.4 L50 71 L21.8 90.4 L31.6 57.7 L4.5 36.9 L38.6 36.2 Z',
  heart:'M50 91 C42 82 10 63 7 35 C5 16 18 6 33 6 C42 6 48 11 50 18 C52 11 58 6 67 6 C82 6 95 16 93 35 C90 63 58 82 50 91 Z'
};

function launchConfetti(m){const layer=m.querySelector('.confetti-layer');if(!layer)return;layer.innerHTML='';const colors=['#ff6b7a','#ffd34e','#69c6ff','#7edc8b','#9d7cff','#ff9c5a'];for(let i=0;i<54;i++){const p=document.createElement('i');p.className='confetti-piece';const a=Math.random()*Math.PI*2,d=90+Math.random()*230;p.style.setProperty('--x',`${Math.cos(a)*d}px`);p.style.setProperty('--y',`${Math.sin(a)*d-50}px`);p.style.setProperty('--r',`${Math.round(Math.random()*760-380)}deg`);p.style.setProperty('--confetti',colors[i%colors.length]);p.style.width=`${6+Math.random()*5}px`;p.style.height=`${8+Math.random()*10}px`;p.style.animationDelay=`${Math.random()*.12}s`;layer.appendChild(p)}setTimeout(()=>layer.innerHTML='',1700)}

function bindTimerControls(m,onRender,{onFinish}={}){const remain=m.querySelector('.timer-remaining, .hourglass-countdown, .candle-countdown'),presets=[...m.querySelectorAll('[data-minutes]')],input=m.querySelector('.timer-custom'),set=m.querySelector('.timer-set'),start=m.querySelector('.timer-start'),reset=m.querySelector('.timer-reset');let total=300,left=300,running=false,end=0,interval=null,finished=false;const render=()=>{remain.textContent=formatCountdown(left);onRender({progress:1-clamp(left/total,0,1),running,left,total})};const stop=()=>{if(interval){clearInterval(interval);interval=null}};const setDuration=min=>{const n=Number(min);if(!Number.isFinite(n)||n<=0)return;running=false;finished=false;stop();m.classList.remove('is-running','candle-finished');total=Math.round(n*60);left=total;end=0;start.textContent='Start';render()};presets.forEach(b=>b.addEventListener('click',()=>{presets.forEach(x=>x.classList.remove('is-active'));b.classList.add('is-active');input.value='';setDuration(b.dataset.minutes)}));set.addEventListener('click',()=>{if(input.value){presets.forEach(x=>x.classList.remove('is-active'));setDuration(input.value)}});input.addEventListener('keydown',e=>{if(e.key==='Enter')set.click()});const tick=()=>{if(!running)return;left=Math.max(0,(end-Date.now())/1000);render();if(left<=0){running=false;stop();m.classList.remove('is-running');start.textContent='Start';if(!finished){finished=true;onFinish?.();m.animate([{transform:'scale(1)'},{transform:'scale(1.025)'},{transform:'scale(1)'}],{duration:500})}}};start.addEventListener('click',()=>{if(running){left=Math.max(0,(end-Date.now())/1000);running=false;stop();m.classList.remove('is-running');start.textContent='Resume';render();return}if(left<=0){left=total;finished=false;m.classList.remove('candle-finished')}running=true;end=Date.now()+left*1000;m.classList.add('is-running');start.textContent='Pause';interval=setInterval(tick,80);tick()});reset.addEventListener('click',()=>{running=false;finished=false;stop();left=total;m.classList.remove('is-running','candle-finished');start.textContent='Start';render()});render();return()=>stop()}

function setupTimer(m){
  const stage=m.querySelector('.timer-stage'),visual=m.querySelector('.timer-visual'),readout=m.querySelector('.timer-readout'),clip=m.querySelector('.shape-clip'),clipPath=m.querySelector('.shape-clip path'),outline=m.querySelector('.shape-outline'),highlight=m.querySelector('.shape-highlight'),foreign=m.querySelector('.shape-foreign'),fill=m.querySelector('.shape-fill'),status=m.querySelector('.timer-status'),shapeButtons=[...m.querySelectorAll('.timer-shapes [data-shape]')];
  const clipId=`shape-clip-${++uid}`;
  clip.id=clipId;
  foreign.setAttribute('clip-path',`url(#${clipId})`);

  const setShape=(shape,animate=false)=>{
    const d=shapePaths[shape]||shapePaths.circle;
    m.dataset.timerShape=shape;
    clipPath.setAttribute('d',d);
    outline.setAttribute('d',d);
    highlight?.setAttribute('d',d);
    if(readout&&readout.parentElement!==visual)visual.appendChild(readout);
    requestAnimationFrame(sizeVisual);
    if(animate&&visual?.animate)visual.animate([
      {transform:'scale(1) rotate(0deg)'},
      {transform:'scale(.965) rotate(-.6deg)',offset:.38},
      {transform:'scale(1.012) rotate(.25deg)',offset:.72},
      {transform:'scale(1) rotate(0deg)'}
    ],{duration:330,easing:'cubic-bezier(.2,.8,.2,1)'});
  };

  shapeButtons.forEach(b=>b.addEventListener('click',()=>{
    shapeButtons.forEach(x=>x.classList.remove('is-active'));
    b.classList.add('is-active');
    setShape(b.dataset.shape,true);
  }));

  m.querySelector('.timer-font')?.addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.timer-text')?.addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));
  m.querySelector('.timer-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.timer-shape-color').addEventListener('click',()=>cycleData(m,'shapeColor',['blue','green','amber','rose','purple','teal']));

  const sizeVisual=()=>{
    if(!stage)return;
    const stageWidth=stage.clientWidth,stageHeight=stage.clientHeight;
    if(stageWidth<20||stageHeight<20)return;
    const shortest=Math.min(stageWidth,stageHeight);
    const breathingRoom=Math.max(10,Math.min(28,shortest*.055));
    const size=Math.max(118,shortest-(breathingRoom*2));
    visual.style.setProperty('--timer-visual-size',`${size}px`);
  };
  const sizeObserver=new ResizeObserver(sizeVisual);
  if(stage)sizeObserver.observe(stage);
  requestAnimationFrame(sizeVisual);

  setShape('circle');
  const stopTimer=bindTimerControls(m,({progress,running,left,total})=>{
    fill.style.setProperty('--progress',`${progress*360}deg`);
    m.style.setProperty('--timer-progress-ratio',progress.toFixed(4));
    const complete=left<=.05;
    const paused=!running&&!complete&&left<total-.05;
    m.classList.toggle('timer-complete',complete);
    m.classList.toggle('timer-paused',paused);
    if(status)status.textContent=complete?'DONE':running?'RUNNING':paused?'PAUSED':'READY';
  },{onFinish:()=>launchConfetti(m)});

  m._cleanup=()=>{
    stopTimer();
    sizeObserver.disconnect();
  };
}

function setupHourglass(m){const hourStage=m.querySelector('.hourglass-stage'),candleStage=m.querySelector('.candle-stage'),countdownHour=m.querySelector('.hourglass-countdown'),countdownCandle=m.querySelector('.candle-countdown'),topClip=m.querySelector('.hg-top-clip'),bottomClip=m.querySelector('.hg-bottom-clip'),top=m.querySelector('.hg-sand-top'),bottom=m.querySelector('.hg-sand-bottom'),pile=m.querySelector('.hg-bottom-pile'),stream=m.querySelector('.hg-stream'),candleBody=m.querySelector('.candle-body'),candleScene=m.querySelector('.candle-scene'),modeButtons=[...m.querySelectorAll('[data-interactive]')],bgBtn=m.querySelector('.interactive-bg'),candleColorBtn=m.querySelector('.candle-color-control');const topId=`hg-top-${++uid}`,bottomId=`hg-bottom-${++uid}`;topClip.id=topId;bottomClip.id=bottomId;top.setAttribute('clip-path',`url(#${topId})`);bottom.setAttribute('clip-path',`url(#${bottomId})`);pile.setAttribute('clip-path',`url(#${bottomId})`);let mode='hourglass';const setMode=next=>{mode=next;m.dataset.interactiveMode=mode;hourStage.hidden=mode!=='hourglass';candleStage.hidden=mode!=='candle';modeButtons.forEach(b=>b.classList.toggle('is-active',b.dataset.interactive===mode))};modeButtons.forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.interactive)));bgBtn.addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));candleColorBtn.addEventListener('click',()=>cycleData(m,'candleColor',['cream','blush','sage','sky','lavender','charcoal']));const cleanup=bindTimerControls(m,({progress,running,left})=>{const text=formatCountdown(left);countdownHour.textContent=text;countdownCandle.textContent=text;const topY=62+96*progress,topH=96*(1-progress);top.setAttribute('y',topY.toFixed(2));top.setAttribute('height',Math.max(0,topH).toFixed(2));const bottomH=96*progress,bottomY=278-bottomH;bottom.setAttribute('y',bottomY.toFixed(2));bottom.setAttribute('height',bottomH.toFixed(2));pile.setAttribute('opacity',progress>0.03?'1':'0');pile.setAttribute('transform',`translate(0 ${Math.max(0,30-progress*30).toFixed(2)}) scale(1 ${Math.max(.18,progress).toFixed(3)})`);stream.setAttribute('opacity',running&&left>0?'1':'0');const h=78-(70*progress);candleScene.style.setProperty('--candle-height',`${Math.max(8,h)}%`);m.classList.toggle('candle-finished',mode==='candle'&&left<=0)}, {onFinish:()=>{if(mode==='candle')m.classList.add('candle-finished')}});setMode('hourglass');m._cleanup=cleanup}

function cycleData(m,key,values){const current=m.dataset[key]||values[0],i=values.indexOf(current);m.dataset[key]=values[(i+1)%values.length]}
function setupClock(m){
  const display=m.querySelector('.clock-display');
  const content=m.querySelector('.clock-content');
  const main=m.querySelector('.clock-main');
  const sec=m.querySelector('.clock-seconds');
  const period=m.querySelector('.clock-period');
  const secondsBtn=m.querySelector('.clock-toggle-seconds');
  const periodBtn=m.querySelector('.clock-toggle-period');
  const modeBtn=m.querySelector('.clock-toggle-mode');
  const hourHand=m.querySelector('.analog-hour');
  const minuteHand=m.querySelector('.analog-minute');
  const secondHand=m.querySelector('.analog-second');

  const fit=()=>{
    if(m.dataset.clockMode==='analog')return;
    const aw=Math.max(30,display.clientWidth-12),ah=Math.max(30,display.clientHeight-12);
    let lo=12,hi=1200,best=12;
    for(let n=0;n<18;n++){
      const mid=(lo+hi)/2;
      m.style.setProperty('--clock-size',`${mid}px`);
      const r=content.getBoundingClientRect();
      if(r.width/boardCamera.scale<=aw&&r.height/boardCamera.scale<=ah){best=mid;lo=mid}else hi=mid;
    }
    m.style.setProperty('--clock-size',`${Math.max(12,best*.975)}px`);
  };
  const refit=()=>requestAnimationFrame(fit);

  m.querySelector('.clock-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.clock-font').addEventListener('click',()=>{cycleData(m,'font',FONT_OPTIONS);refit()});
  m.querySelector('.clock-text').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  modeBtn.addEventListener('click',()=>{
    const analog=m.dataset.clockMode!=='analog';
    m.dataset.clockMode=analog?'analog':'digital';
    modeBtn.classList.toggle('is-active',analog);
    modeBtn.querySelector('span').textContent=analog?'◴':'◷';
    secondsBtn.hidden=analog;
    periodBtn.hidden=analog;
    refit();
  });

  secondsBtn.addEventListener('click',()=>{m.classList.toggle('show-seconds');secondsBtn.classList.toggle('is-active');refit()});
  periodBtn.addEventListener('click',()=>{m.classList.toggle('hide-period');periodBtn.classList.toggle('is-active',!m.classList.contains('hide-period'));refit()});

  const update=()=>{
    const d=new Date();
    const parts=new Intl.DateTimeFormat([],{hour:'numeric',minute:'2-digit',hour12:true}).formatToParts(d);
    const hour=parts.find(p=>p.type==='hour')?.value||'';
    const minute=parts.find(p=>p.type==='minute')?.value||'';
    const dayPeriod=parts.find(p=>p.type==='dayPeriod')?.value||'';
    main.textContent=`${hour}:${minute}`;
    sec.textContent=`:${String(d.getSeconds()).padStart(2,'0')}`;
    period.textContent=dayPeriod;

    const seconds=d.getSeconds()+d.getMilliseconds()/1000;
    const minutes=d.getMinutes()+seconds/60;
    const hours=(d.getHours()%12)+minutes/60;
    hourHand.style.transform=`translateX(-50%) rotate(${hours*30}deg)`;
    minuteHand.style.transform=`translateX(-50%) rotate(${minutes*6}deg)`;
    secondHand.style.transform=`translateX(-50%) rotate(${seconds*6}deg)`;
    refit();
  };

  const ro=new ResizeObserver(refit);
  ro.observe(m);
  ro.observe(display);
  const id=setInterval(update,100);
  update();
  m._cleanup=()=>{clearInterval(id);ro.disconnect()};
}



function setupWritingLines(m){
  const paper=m.querySelector('.writinglines-paper');
  const rows=[...m.querySelectorAll('.writinglines-row')];
  const entries=[...m.querySelectorAll('.writinglines-entry')];
  const toggle=m.querySelector('.writinglines-toggle-type');
  const countBtn=m.querySelector('.writinglines-count');
  const countLabel=countBtn?.querySelector('span');
  const clear=m.querySelector('.writinglines-clear');
  const resizeHandles=[...m.querySelectorAll('[data-resize]')];
  let fitFrame=0;
  let preferredHeight=m.offsetHeight;
  let userSizingHeight=false;

  const visibleRows=()=>rows.filter(row=>!row.hidden);
  const visibleEntries=()=>entries.filter(entry=>!entry.closest('.writinglines-row')?.hidden);

  const fitAll=()=>{
    cancelAnimationFrame(fitFrame);
    fitFrame=requestAnimationFrame(()=>{
      const activeRows=visibleRows();
      const activeEntries=visibleEntries();
      if(!paper||!activeRows.length)return;

      const paperStyle=getComputedStyle(paper);
      const padY=(parseFloat(paperStyle.paddingTop)||0)+(parseFloat(paperStyle.paddingBottom)||0);
      const borderY=Math.max(0,paper.offsetHeight-paper.clientHeight);
      const moduleChrome=Math.max(0,m.offsetHeight-paper.offsetHeight);

      const targetModuleHeight=userSizingHeight?m.offsetHeight:preferredHeight;
      const targetPaperOuter=Math.max(10,targetModuleHeight-moduleChrome);
      const targetPaperInner=Math.max(10,targetPaperOuter-borderY-padY);
      const baseRowHeight=targetPaperInner/activeRows.length;

      paper.style.setProperty('--writing-row-height',`${baseRowHeight}px`);

      const innerWidth=Math.max(10,
        paper.clientWidth-
        (parseFloat(paperStyle.paddingLeft)||0)-
        (parseFloat(paperStyle.paddingRight)||0)
      );
      const availableTextWidth=Math.max(10,innerWidth-10);
      let sharedScale=1;

      activeEntries.forEach(entry=>{
        const naturalWidth=Math.max(entry.clientWidth,entry.scrollWidth);
        if(naturalWidth>availableTextWidth){
          sharedScale=Math.min(sharedScale,availableTextWidth/naturalWidth);
        }
      });

      sharedScale=Math.max(.22,Math.min(1,sharedScale));
      const finalRowHeight=baseRowHeight*sharedScale;
      paper.style.setProperty('--writing-row-height',`${finalRowHeight}px`);

      if(!userSizingHeight){
        const desiredPaperOuter=finalRowHeight*activeRows.length+padY+borderY;
        const desiredModuleHeight=moduleChrome+desiredPaperOuter;
        if(Math.abs(m.offsetHeight-desiredModuleHeight)>.75){
          m.style.height=`${desiredModuleHeight}px`;
        }
      }
    });
  };

  const setLineCount=count=>{
    const next=Math.max(1,Math.min(4,Number(count)||3));
    m.dataset.lineCount=String(next);
    rows.forEach((row,index)=>{
      row.hidden=index>=next;
    });
    if(countLabel)countLabel.textContent=String(next);
    countBtn?.setAttribute('aria-label',`${next} writing ${next===1?'line':'lines'}; click to change`);
    countBtn?.setAttribute('title',`${next} writing ${next===1?'line':'lines'} — click to change`);
    fitAll();
  };

  const setMode=typing=>{
    m.dataset.writingMode=typing?'type':'practice';
    toggle.classList.toggle('is-active',typing);
    entries.forEach(entry=>{
      entry.setAttribute('contenteditable',typing?'true':'false');
      entry.tabIndex=typing&&!entry.closest('.writinglines-row')?.hidden?0:-1;
    });
    fitAll();
    if(typing)requestAnimationFrame(()=>visibleEntries()[0]?.focus({preventScroll:true}));
  };

  toggle.addEventListener('click',()=>setMode(m.dataset.writingMode!=='type'));

  countBtn?.addEventListener('click',()=>{
    const current=Number(m.dataset.lineCount)||3;
    const next=current>=4?1:current+1;
    setLineCount(next);
    setMode(m.dataset.writingMode==='type');
  });

  clear.addEventListener('click',()=>{
    entries.forEach(entry=>entry.textContent='');
    fitAll();
    if(m.dataset.writingMode==='type')visibleEntries()[0]?.focus({preventScroll:true});
  });

  entries.forEach(entry=>{
    entry.addEventListener('input',fitAll);

    entry.addEventListener('keydown',e=>{
      const visible=visibleEntries();
      const index=visible.indexOf(entry);
      if(index<0)return;

      if(e.key==='Enter'){
        e.preventDefault();
        visible[Math.min(visible.length-1,index+1)]?.focus({preventScroll:true});
      }else if(e.key==='ArrowDown'&&index<visible.length-1){
        e.preventDefault();
        visible[index+1].focus({preventScroll:true});
      }else if(e.key==='ArrowUp'&&index>0){
        e.preventDefault();
        visible[index-1].focus({preventScroll:true});
      }
    });

    entry.addEventListener('paste',e=>{
      e.preventDefault();
      const text=(e.clipboardData||window.clipboardData)?.getData('text/plain')||'';
      document.execCommand('insertText',false,text.replace(/[\r\n]+/g,' '));
      requestAnimationFrame(fitAll);
    });
  });

  m.querySelector('.writinglines-bg').addEventListener('click',()=>{
    cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']);
  });

  m.querySelector('.writinglines-text').addEventListener('click',()=>{
    cycleData(m,'text',['dark','soft','blue','rose','white']);
  });

  resizeHandles.forEach(handle=>{
    const direction=handle.dataset.resize||'';
    if(!/[tb]/.test(direction))return;

    const begin=()=>{
      userSizingHeight=true;
    };
    const finish=()=>{
      preferredHeight=m.offsetHeight;
      userSizingHeight=false;
      fitAll();
    };

    handle.addEventListener('pointerdown',begin,true);
    handle.addEventListener('pointerup',finish,true);
    handle.addEventListener('pointercancel',finish,true);
  });

  const resizeObserver=new ResizeObserver(fitAll);
  resizeObserver.observe(m);
  if(paper)resizeObserver.observe(paper);

  if(document.fonts?.ready){
    document.fonts.ready.then(fitAll);
  }

  setLineCount(Number(m.dataset.lineCount)||3);
  setMode(false);
  fitAll();

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    cancelAnimationFrame(fitFrame);
    resizeObserver.disconnect();
  };
}

function setupStopwatch(m){
  const display=m.querySelector('.stopwatch-display');
  const start=m.querySelector('.stopwatch-start');
  const lap=m.querySelector('.stopwatch-lap');
  const clear=m.querySelector('.stopwatch-clear');
  const laps=m.querySelector('.stopwatch-laps');
  const bgBtn=m.querySelector('.stopwatch-bg');
  const fontBtn=m.querySelector('.stopwatch-font');
  const textBtn=m.querySelector('.stopwatch-text');
  const modeBtn=m.querySelector('.stopwatch-toggle-mode');
  const analogHand=m.querySelector('.analog-stopwatch-hand');
  const subdialHand=m.querySelector('.analog-stopwatch-subdial-hand');

  let running=false,startedAt=0,elapsed=0,raf=0,lapCount=0;

  const format=ms=>{
    const total=Math.max(0,ms);
    const minutes=Math.floor(total/60000);
    const seconds=Math.floor(total/1000)%60;
    const hundredths=Math.floor(total/10)%100;
    return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${String(hundredths).padStart(2,'0')}`;
  };

  const current=()=>elapsed+(running?performance.now()-startedAt:0);

  const render=()=>{
    const now=current();
    display.textContent=format(now);

    const totalSeconds=now/1000;
    const seconds=totalSeconds%60;
    const minutes=(totalSeconds/60)%30;

    analogHand.style.transform=`translateX(-50%) rotate(${seconds*6}deg)`;
    subdialHand.style.transform=`translateX(-50%) rotate(${minutes*12}deg)`;

    if(running)raf=requestAnimationFrame(render);
  };

  start.addEventListener('click',()=>{
    if(running){
      elapsed=current();
      running=false;
      cancelAnimationFrame(raf);
      start.textContent='Start';
      render();
    }else{
      startedAt=performance.now();
      running=true;
      start.textContent='Pause';
      render();
    }
  });

  lap.addEventListener('click',()=>{
    if(!running&&elapsed<=0)return;
    lapCount++;
    const row=document.createElement('div');
    row.className='stopwatch-lap-row';
    row.innerHTML=`<span>Lap ${lapCount}</span><strong>${format(current())}</strong>`;
    laps.prepend(row);
  });

  clear.addEventListener('click',()=>{
    running=false;
    cancelAnimationFrame(raf);
    startedAt=0;
    elapsed=0;
    lapCount=0;
    display.textContent='00:00.00';
    laps.replaceChildren();
    start.textContent='Start';
    analogHand.style.transform='translateX(-50%) rotate(0deg)';
    subdialHand.style.transform='translateX(-50%) rotate(0deg)';
  });

  bgBtn?.addEventListener('click',()=>{
    cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']);
  });

  fontBtn?.addEventListener('click',()=>{
    cycleData(m,'font',FONT_OPTIONS);
  });

  textBtn?.addEventListener('click',()=>{
    cycleData(m,'text',['dark','soft','blue','rose','white']);
  });

  modeBtn?.addEventListener('click',()=>{
    const analog=m.dataset.stopwatchMode!=='analog';
    m.dataset.stopwatchMode=analog?'analog':'digital';
    modeBtn.classList.toggle('is-active',analog);
    modeBtn.querySelector('span').textContent=analog?'◴':'◷';
    render();
  });

  render();
  m._cleanup=()=>cancelAnimationFrame(raf);
}

function setupDraw(m){
  const toggle=m.querySelector('.draw-toggle');
  const toggleLabel=m.querySelector('.draw-toggle-label');
  const color=m.querySelector('.draw-color');
  const swatch=m.querySelector('.draw-color-swatch');
  const size=m.querySelector('.draw-size');
  const clear=m.querySelector('.draw-clear');
  const toolButtons=[...m.querySelectorAll('.draw-tool')];

  const canvas=document.createElement('canvas');
  canvas.className='board-drawing-canvas';
  const drawScale=Math.min(1,4800/BOARD_WIDTH,3200/BOARD_HEIGHT);
  canvas.width=Math.max(1,Math.round(BOARD_WIDTH*drawScale));
  canvas.height=Math.max(1,Math.round(BOARD_HEIGHT*drawScale));
  canvas.style.width=`${BOARD_WIDTH}px`;
  canvas.style.height=`${BOARD_HEIGHT}px`;
  workspace.appendChild(canvas);

  const ctx=canvas.getContext('2d');
  const dpr=drawScale;
  ctx.scale(dpr,dpr);
  ctx.lineCap='round';
  ctx.lineJoin='round';

  let enabled=false;
  let tool='brush';
  let drawing=false;
  let lastX=0,lastY=0,lastTime=0;

  const updatePointerMode=()=>{
    canvas.classList.toggle('is-active',enabled);
    canvas.style.pointerEvents=enabled?'auto':'none';
    toggle.classList.toggle('is-on',enabled);
    toggle.setAttribute('aria-pressed',String(enabled));
    toggleLabel.textContent=enabled?'ON':'OFF';
  };

  const updateSwatch=()=>{swatch.style.background=color.value};
  updateSwatch();

  toggle.addEventListener('click',()=>{enabled=!enabled;updatePointerMode()});
  color.addEventListener('input',updateSwatch);

  toolButtons.forEach(b=>b.addEventListener('click',()=>{
    tool=b.dataset.drawTool;
    toolButtons.forEach(x=>x.classList.toggle('is-active',x===b));
  }));

  clear.addEventListener('click',()=>{
    ctx.clearRect(0,0,canvas.width/dpr,canvas.height/dpr);
  });

  const point=e=>screenToBoard(e.clientX,e.clientY);

  const down=e=>{
    if(!enabled||e.button!==0)return;
    drawing=true;
    const p=point(e);
    lastX=p.x;
    lastY=p.y;
    lastTime=performance.now();
    canvas.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };

  const move=e=>{
    if(!drawing||!enabled)return;

    const p=point(e);
    const now=performance.now();
    const dx=p.x-lastX;
    const dy=p.y-lastY;
    const distance=Math.hypot(dx,dy);
    const dt=Math.max(1,now-lastTime);
    const speed=distance/dt;
    const baseSize=Number(size.value);

    ctx.save();

    if(tool==='eraser'){
      ctx.globalCompositeOperation='destination-out';
      ctx.globalAlpha=1;
      ctx.strokeStyle='#000';
      ctx.lineWidth=Math.max(4,baseSize*1.6);
      ctx.lineCap='round';
      ctx.lineJoin='round';
      ctx.beginPath();
      ctx.moveTo(lastX,lastY);
      ctx.lineTo(p.x,p.y);
      ctx.stroke();
    }else if(tool==='pencil'){
      ctx.globalCompositeOperation='source-over';
      ctx.globalAlpha=.88;
      ctx.strokeStyle=color.value;
      ctx.lineWidth=Math.max(1,baseSize*.28);
      ctx.lineCap='round';
      ctx.lineJoin='round';
      ctx.beginPath();
      ctx.moveTo(lastX,lastY);
      ctx.lineTo(p.x,p.y);
      ctx.stroke();
    }else{
      // Brush is softer and responds to movement speed:
      // slower strokes are fuller, faster strokes taper slightly.
      const speedFactor=clamp(1.15-speed*.18,.58,1.15);
      const brushWidth=Math.max(2,baseSize*speedFactor);

      ctx.globalCompositeOperation='source-over';
      ctx.globalAlpha=.72;
      ctx.strokeStyle=color.value;
      ctx.lineWidth=brushWidth;
      ctx.lineCap='round';
      ctx.lineJoin='round';
      ctx.shadowColor=color.value;
      ctx.shadowBlur=Math.max(0.5,brushWidth*.16);

      ctx.beginPath();
      ctx.moveTo(lastX,lastY);
      ctx.quadraticCurveTo(lastX,lastY,p.x,p.y);
      ctx.stroke();

      // A lighter secondary pass gives the brush a softer painted edge.
      ctx.globalAlpha=.18;
      ctx.lineWidth=brushWidth*1.35;
      ctx.shadowBlur=0;
      ctx.beginPath();
      ctx.moveTo(lastX,lastY);
      ctx.lineTo(p.x,p.y);
      ctx.stroke();
    }

    ctx.restore();

    lastX=p.x;
    lastY=p.y;
    lastTime=now;
    e.preventDefault();
  };

  const up=()=>{drawing=false};

  canvas.addEventListener('pointerdown',down);
  canvas.addEventListener('pointermove',move);
  canvas.addEventListener('pointerup',up);
  canvas.addEventListener('pointercancel',up);

  const resize=()=>{
    const old=document.createElement('canvas');
    old.width=canvas.width;
    old.height=canvas.height;
    old.getContext('2d').drawImage(canvas,0,0);

    const ndpr=devicePixelRatio||1;
    canvas.width=Math.max(1,Math.round(innerWidth*ndpr));
    canvas.height=Math.max(1,Math.round(innerHeight*ndpr));
    canvas.style.width=`${innerWidth}px`;
    canvas.style.height=`${innerHeight}px`;

    ctx.setTransform(ndpr,0,0,ndpr,0,0);
    ctx.drawImage(old,0,0,old.width,old.height,0,0,innerWidth,innerHeight);
    ctx.lineCap='round';
    ctx.lineJoin='round';
  };

  window.addEventListener('resize',resize);
  updatePointerMode();

  m._cleanup=()=>{
    window.removeEventListener('resize',resize);
    canvas.remove();
  };
}

function setupNoise(m){
  const button=m.querySelector('.noise-start');
  const db=m.querySelector('.noise-db');
  const status=m.querySelector('.noise-status');
  const statusDot=m.querySelector('.noise-status-dot');
  const range=m.querySelector('.noise-range');
  const sensitivity=m.querySelector('.noise-sensitivity');
  const thresholdValue=m.querySelector('.noise-threshold-value');
  const sensitivityValue=m.querySelector('.noise-sensitivity-value');
  const viewSelect=m.querySelector('.noise-view-select');
  const horizontalFill=m.querySelector('.noise-led-fill--horizontal');
  const verticalFill=m.querySelector('.noise-led-fill--vertical');
  const horizontalThreshold=m.querySelector('.noise-threshold--horizontal');
  const verticalThreshold=m.querySelector('.noise-vertical-alert-marker');
  const waveformThreshold=m.querySelector('.noise-waveform-threshold');
  const waveform=m.querySelector('.noise-waveform');
  const waveCtx=waveform.getContext('2d');
  const alert=m.querySelector('.noise-alert');

  // Start the Noise Detector at a comfortable finished size.
  if(!m.style.width)m.style.width='500px';
  if(!m.style.height)m.style.height='380px';

  m.querySelector('.noise-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.noise-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.noise-text').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  const meterBtn=m.querySelector('.noise-meter-color');
  meterBtn.addEventListener('click',()=>{
    cycleData(m,'meter',['blue','green','amber','rose','purple']);
    meterBtn.dataset.current=m.dataset.meter;
  });
  meterBtn.dataset.current=m.dataset.meter;

  let stream=null;
  let ctx=null;
  let analyser=null;
  let raf=0;
  let active=false;
  let smoothedLevel=0;
  let waveW=0;
  let waveH=0;
  const data=new Uint8Array(2048);

  const meterColor=()=>getComputedStyle(m).getPropertyValue('--meter-color').trim()||'#6f8fb7';
  const textColor=()=>getComputedStyle(m).getPropertyValue('--module-text').trim()||'#17191d';

  function resizeWaveform(){
    const dpr=Math.min(2,window.devicePixelRatio||1);
    waveW=Math.max(120,waveform.clientWidth);
    waveH=Math.max(70,waveform.clientHeight);
    waveform.width=Math.round(waveW*dpr);
    waveform.height=Math.round(waveH*dpr);
    waveCtx.setTransform(dpr,0,0,dpr,0,0);
  }

  const waveRO=new ResizeObserver(resizeWaveform);
  waveRO.observe(waveform);

  const moduleRO=new ResizeObserver(()=>{
    requestAnimationFrame(resizeWaveform);
  });
  moduleRO.observe(m);

  // Force the exact same layout calculation that a first drag used to trigger,
  // but do it immediately without changing the module's size or position.
  const stabilizeInitialLayout=()=>{
    void m.offsetWidth;
    resizeWaveform();
    requestAnimationFrame(()=>{
      void m.offsetHeight;
      resizeWaveform();
    });
  };

  resizeWaveform();
  requestAnimationFrame(stabilizeInitialLayout);

  const updateThreshold=()=>{
    const value=Number(range.value);
    thresholdValue.textContent=`${value}%`;

    horizontalThreshold.style.left=`${value}%`;

    // This marker lives outside the clipped fill track, so it stays visible.
    // 0% = bottom, 100% = top.
    verticalThreshold.style.bottom=`calc(${value}% - 2px)`;
    verticalThreshold.dataset.threshold=value;

    waveformThreshold.style.setProperty('--threshold',`${value}%`);
  };

  const updateSensitivity=()=>{
    sensitivityValue.textContent=`${sensitivity.value}%`;
  };

  const updateView=()=>{
    const mode=viewSelect.value;
    m.dataset.noiseView=mode;

    if(mode==='vertical'){
      m.style.width='320px';
      m.style.height='590px';
    }else{
      m.style.width='500px';
      m.style.height='380px';
    }

    if(mode==='waveform'){
      const frame=m.querySelector('.noise-waveform-frame');
      frame?.classList.remove('is-unfolding');
      void frame?.offsetWidth;
      frame?.classList.add('is-unfolding');
      setTimeout(()=>frame?.classList.remove('is-unfolding'),420);
    }

    requestAnimationFrame(()=>{
      void m.offsetWidth;
      void m.offsetHeight;
      resizeWaveform();

      if(mode==='vertical'){
        const settingsPanel=m.querySelector('.noise-settings-panel');
        const customization=m.querySelector('.noise-customization');

        // Force the vertical grid/flex state to resolve immediately instead of
        // waiting for the first manual resize.
        void m.getBoundingClientRect();
        void settingsPanel?.getBoundingClientRect();
        void customization?.getBoundingClientRect();

        requestAnimationFrame(()=>{
          void m.offsetWidth;
          void m.offsetHeight;
          void settingsPanel?.offsetHeight;
          void customization?.offsetHeight;
        });

        setTimeout(()=>{
          void m.getBoundingClientRect();
          void settingsPanel?.getBoundingClientRect();
          void customization?.getBoundingClientRect();
        },30);
      }
    });
  };

  range.addEventListener('input',updateThreshold);
  sensitivity.addEventListener('input',updateSensitivity);
  viewSelect.addEventListener('change',updateView);
  updateThreshold();
  updateSensitivity();
  updateView();

  function setLevelVisuals(level){
    horizontalFill.style.width=`${level}%`;
    verticalFill.style.height=`${level}%`;
  }

  function drawWaveform(){
    waveCtx.clearRect(0,0,waveW,waveH);

    const mid=waveH/2;
    waveCtx.lineWidth=1;
    waveCtx.strokeStyle='rgba(127,127,127,.18)';
    waveCtx.beginPath();
    waveCtx.moveTo(0,mid);
    waveCtx.lineTo(waveW,mid);
    waveCtx.stroke();

    if(!active||!analyser){
      waveCtx.strokeStyle='rgba(127,127,127,.22)';
      waveCtx.lineWidth=2;
      waveCtx.beginPath();
      waveCtx.moveTo(0,mid);
      waveCtx.lineTo(waveW,mid);
      waveCtx.stroke();
      return;
    }

    analyser.getByteTimeDomainData(data);
    waveCtx.strokeStyle=meterColor();
    waveCtx.lineWidth=Math.max(2,Math.min(4,waveH*.035));
    waveCtx.lineJoin='round';
    waveCtx.lineCap='round';
    waveCtx.beginPath();

    const step=waveW/(data.length-1);
    const sensitivityMultiplier=Number(sensitivity.value)/100;
    for(let i=0;i<data.length;i++){
      const centered=(data[i]-128)/128;
      const amp=clamp(centered*sensitivityMultiplier,-1,1);
      const x=i*step;
      const y=mid+amp*(waveH*.42);
      if(i===0)waveCtx.moveTo(x,y);
      else waveCtx.lineTo(x,y);
    }
    waveCtx.stroke();
  }

  function stop(){
    active=false;
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach(t=>t.stop());
    if(ctx&&ctx.state!=='closed')ctx.close();
    stream=ctx=analyser=null;
    smoothedLevel=0;
    setLevelVisuals(0);
    drawWaveform();
    db.textContent='—';
    status.textContent='Microphone is off';
    statusDot.classList.remove('is-live');
    button.textContent='Enable microphone';
    m.classList.remove('is-loud');
    alert.hidden=true;
  }

  function loop(){
    if(!active||!analyser)return;

    analyser.getByteTimeDomainData(data);
    let sum=0;
    for(let i=0;i<data.length;i++){
      const n=(data[i]-128)/128;
      sum+=n*n;
    }

    const rms=Math.sqrt(sum/data.length);
    const rawLevel=clamp((20*Math.log10(rms||0.00001)+60)/60*100,0,100);
    const adjustedLevel=clamp(rawLevel*(Number(sensitivity.value)/100),0,100);
    smoothedLevel=smoothedLevel*.68+adjustedLevel*.32;

    setLevelVisuals(smoothedLevel);
    drawWaveform();
    db.textContent=`${Math.round(smoothedLevel)}%`;

    const loud=smoothedLevel>=Number(range.value);
    m.classList.toggle('is-loud',loud);
    alert.hidden=!loud;
    status.textContent=loud?'Above alert level':'Listening';
    statusDot.classList.toggle('is-loud',loud);

    raf=requestAnimationFrame(loop);
  }

  button.addEventListener('click',async()=>{
    if(active){
      stop();
      return;
    }

    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:true});
      ctx=new (window.AudioContext||window.webkitAudioContext)();
      analyser=ctx.createAnalyser();
      analyser.fftSize=4096;
      analyser.smoothingTimeConstant=.72;
      ctx.createMediaStreamSource(stream).connect(analyser);

      active=true;
      button.textContent='Stop microphone';
      status.textContent='Listening';
      statusDot.classList.add('is-live');
      loop();
    }catch{
      status.textContent=location.protocol==='file:'?'Microphone needs localhost or HTTPS':'Microphone permission was denied';
      button.textContent='Try again';
    }
  });

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    waveRO.disconnect();
    moduleRO.disconnect();
    stop();
  };
}

function setupCollections(m){
  const canvas=m.querySelector('.collection-canvas'),ctx=canvas.getContext('2d'),add=m.querySelector('.collection-add'),typeBtn=m.querySelector('.collection-type'),typeLabel=m.querySelector('.collection-type-label'),picker=m.querySelector('.collection-picker'),pickerButtons=[...m.querySelectorAll('[data-collection-type]')],countEl=m.querySelector('.collection-count'),clear=m.querySelector('.collection-clear'),bgBtn=m.querySelector('.collection-bg');
  const types=[
    {id:'pompom',label:'Pom poms'},{id:'candy',label:'Candies'},{id:'star',label:'Stars'},
    {id:'jellybean',label:'Jellybeans'},{id:'fruit',label:'Fruits'},{id:'coin',label:'Coins'}
  ];
  const colors=['#ef7e91','#70bce9','#f1c858','#72c58a','#9a82d8','#ef9b61'];
  const jarBehind=new Image();
  jarBehind.src='assets/jar-behind.png';
  let typeIndex=0,bodies=[],particles=[],raf=0,last=performance.now(),cw=260,ch=320,dpr=1,dead=false,currentJar=null;

  const jarRectFor=(w,h)=>{const size=Math.max(140,Math.min(w*.96,h*.98));return{x:(w-size)/2,y:(h-size)/2,w:size,h:size}};
  const jarBounds=()=>{const j=currentJar||jarRectFor(cw,ch);return{floor:j.y+j.h*.895,top:j.y+j.h*.105,neckL:j.x+j.w*.285,neckR:j.x+j.w*.715,bodyL:j.x+j.w*.215,bodyR:j.x+j.w*.785,shoulderTop:j.y+j.h*.205,shoulderBottom:j.y+j.h*.31,bottomCurve:j.y+j.h*.765,bottomL:j.x+j.w*.265,bottomR:j.x+j.w*.735,j}};
  const wallsAt=y=>{const b=jarBounds();if(y<b.shoulderTop)return[b.neckL,b.neckR];if(y<b.shoulderBottom){const t=clamp((y-b.shoulderTop)/(b.shoulderBottom-b.shoulderTop),0,1),ease=t*t*(3-2*t);return[b.neckL+(b.bodyL-b.neckL)*ease,b.neckR+(b.bodyR-b.neckR)*ease]}if(y>b.bottomCurve){const t=clamp((y-b.bottomCurve)/(b.floor-b.bottomCurve),0,1),ease=t*t*(3-2*t);return[b.bodyL+(b.bottomL-b.bodyL)*ease,b.bodyR+(b.bottomR-b.bodyR)*ease]}return[b.bodyL,b.bodyR]};

  function resizeCanvas(){
    const nw=Math.max(220,canvas.clientWidth),nh=Math.max(210,canvas.clientHeight),old=currentJar||jarRectFor(cw,ch),next=jarRectFor(nw,nh),scale=next.w/old.w;
    if(bodies.length)for(const b of bodies){b.x=next.x+(b.x-old.x)*scale;b.y=next.y+(b.y-old.y)*scale;b.r*=scale}
    if(particles.length)for(const p of particles){p.x=next.x+(p.x-old.x)*scale;p.y=next.y+(p.y-old.y)*scale;p.r*=scale}
    cw=nw;ch=nh;currentJar=next;dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(cw*dpr);canvas.height=Math.round(ch*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)
  }
  const ro=new ResizeObserver(resizeCanvas);ro.observe(canvas);resizeCanvas();

  function burst(body,n=7){
    for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=18+Math.random()*48;particles.push({type:body.type,variant:body.variant,color:body.color,x:body.x+(Math.random()-.5)*body.r*.5,y:body.y+body.r*.4,vx:Math.cos(a)*s,vy:Math.sin(a)*s-18,life:.38+Math.random()*.28,max:.66,r:Math.max(1.4,body.r*(.11+Math.random()*.08)),rot:Math.random()*Math.PI*2,av:(Math.random()-.5)*4})}
  }

  function addItem(){
    if(bodies.length>=80)return;
    const t=types[typeIndex],b=jarBounds(),r=Math.max(9,Math.min(16,b.j.w*.036))*(.88+Math.random()*.22);
    bodies.push({type:t.id,x:(b.neckL+b.neckR)/2+(Math.random()-.5)*(b.neckR-b.neckL)*.28,y:b.top-r-22,vx:(Math.random()-.5)*20,vy:18+Math.random()*12,r,rot:(Math.random()-.5)*.4,av:(Math.random()-.5)*1.25,color:colors[bodies.length%colors.length],variant:Math.floor(Math.random()*4),impact:false,onFloor:false});
    updateCount()
  }
  function updateCount(){countEl.textContent=`${bodies.length} item${bodies.length===1?'':'s'}`}

  function physics(dt){
    const floor=jarBounds().floor;
    for(const b of bodies){
      b.vy+=650*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.rot+=b.av*dt;
      b.vx*=Math.pow(.985,dt*60);b.av*=Math.pow(.94,dt*60);b.av=clamp(b.av,-2.25,2.25);b.onFloor=false;
      const [wl,wr]=wallsAt(b.y),edgeR=b.r*(b.type==='candy'?1.13:1.07);
      if(b.x-edgeR<wl){b.x=wl+edgeR;b.vx=Math.abs(b.vx)*.38;b.av=clamp(b.av+.18,-1.6,1.6)}
      if(b.x+edgeR>wr){b.x=wr-edgeR;b.vx=-Math.abs(b.vx)*.38;b.av=clamp(b.av-.18,-1.6,1.6)}
      if(b.y+b.r>floor){
        const impact=Math.abs(b.vy);b.y=floor-b.r;b.vy=-Math.abs(b.vy)*.14;b.vx*=.72;b.av*=.35;b.onFloor=true;
        if(impact>105&&!b.impact){burst(b,5);b.impact=true}
        if(Math.abs(b.vy)<18)b.vy=0;if(Math.abs(b.vx)<2.2)b.vx=0;if(Math.abs(b.av)<.12)b.av=0;
      }else b.impact=false;
    }
    for(let pass=0;pass<3;pass++)for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
      const a=bodies[i],b=bodies[j],dx=b.x-a.x,dy=b.y-a.y,rr=a.r+b.r,d2=dx*dx+dy*dy;if(d2<=0||d2>=rr*rr)continue;
      const d=Math.sqrt(d2),nx=dx/d,ny=dy/d,over=rr-d;a.x-=nx*over*.5;a.y-=ny*over*.5;b.x+=nx*over*.5;b.y+=ny*over*.5;
      const rvx=b.vx-a.vx,rvy=b.vy-a.vy,rel=rvx*nx+rvy*ny;if(rel<0){const imp=-(1.08)*rel*.46;a.vx-=imp*nx;a.vy-=imp*ny;b.vx+=imp*nx;b.vy+=imp*ny;const spin=clamp(rel*.0007,-.13,.13);a.av=clamp(a.av-spin,-1.5,1.5);b.av=clamp(b.av+spin,-1.5,1.5)}
    }
    for(const b of bodies){
      const [wl,wr]=wallsAt(b.y),edgeR=b.r*(b.type==='candy'?1.13:1.07);
      if(b.x-edgeR<wl){b.x=wl+edgeR;b.vx=Math.max(0,b.vx)*.3}
      if(b.x+edgeR>wr){b.x=wr-edgeR;b.vx=Math.min(0,b.vx)*.3}
      if(b.y+b.r>floor){b.y=floor-b.r;b.vy=Math.min(0,b.vy)*.15}
      if(b.y+b.r>=floor-.8){b.vx*=Math.pow(.88,dt*60);b.av*=Math.pow(.72,dt*60);if(Math.abs(b.vx)<1.5)b.vx=0;if(Math.abs(b.av)<.09)b.av=0}
      if(Math.hypot(b.vx,b.vy)<2.2&&Math.abs(b.av)<.1){b.vx=0;if(Math.abs(b.vy)<2)b.vy=0;b.av=0}
    }
    for(const p of particles){p.vy+=180*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.av*dt;p.life-=dt}
    particles=particles.filter(p=>p.life>0)
  }

  function starPath(r){ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rad=i%2?r*.46:r,px=Math.cos(a)*rad,py=Math.sin(a)*rad;i?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.closePath()}
  function drawPompom(b){
    const r=b.r;ctx.save();ctx.shadowColor='rgba(0,0,0,.13)';ctx.shadowBlur=r*.22;ctx.fillStyle=b.color;ctx.beginPath();ctx.arc(0,0,r*.7,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    for(let i=0;i<34;i++){const a=i*Math.PI*2/34+(b.variant*.17),dist=r*(.58+((i*17)%7)/34),fr=r*(.15+((i*13)%5)/42);ctx.globalAlpha=.78+.18*((i%3)/2);ctx.fillStyle=b.color;ctx.beginPath();ctx.arc(Math.cos(a)*dist,Math.sin(a)*dist,fr,0,Math.PI*2);ctx.fill()}
    ctx.globalAlpha=.28;ctx.fillStyle='#fff';for(let i=0;i<8;i++){const a=(i+.3)*Math.PI*2/8;ctx.beginPath();ctx.arc(Math.cos(a)*r*.42-r*.08,Math.sin(a)*r*.42-r*.1,r*.085,0,Math.PI*2);ctx.fill()}ctx.restore()
  }
  function drawBody(b){
    ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.rot);const r=b.r;
    if(b.type==='pompom')drawPompom(b);
    else if(b.type==='candy'){
      ctx.fillStyle=b.color;ctx.beginPath();ctx.roundRect(-r*.64,-r*.48,r*1.28,r*.96,r*.25);ctx.fill();ctx.beginPath();ctx.moveTo(-r*.62,-r*.32);ctx.lineTo(-r*1.05,-r*.62);ctx.lineTo(-r*.98,0);ctx.lineTo(-r*1.05,r*.62);ctx.lineTo(-r*.62,r*.32);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(r*.62,-r*.32);ctx.lineTo(r*1.05,-r*.62);ctx.lineTo(r*.98,0);ctx.lineTo(r*1.05,r*.62);ctx.lineTo(r*.62,r*.32);ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-r*.3,-r*.35);ctx.lineTo(r*.35,r*.28);ctx.stroke()
    }else if(b.type==='star'){
      ctx.fillStyle='#f0bd47';ctx.strokeStyle='#d39a25';ctx.lineWidth=1.2;starPath(r);ctx.fill();ctx.stroke();ctx.fillStyle='rgba(255,255,255,.32)';ctx.beginPath();ctx.arc(-r*.18,-r*.2,r*.16,0,Math.PI*2);ctx.fill()
    }else if(b.type==='jellybean'){
      ctx.scale(1.08,.86);ctx.fillStyle=['#8f78d8','#e7728b','#65b97d','#efb74e'][b.variant%4];ctx.beginPath();ctx.moveTo(-r*.75,-r*.1);ctx.bezierCurveTo(-r*.92,-r*.72,-r*.18,-r*.92,r*.3,-r*.66);ctx.bezierCurveTo(r*.95,-r*.32,r*.87,r*.5,r*.28,r*.72);ctx.bezierCurveTo(-r*.28,r*.92,-r*.52,r*.44,-r*.75,-r*.1);ctx.fill();ctx.fillStyle='rgba(255,255,255,.3)';ctx.beginPath();ctx.ellipse(-r*.23,-r*.38,r*.25,r*.1,-.35,0,Math.PI*2);ctx.fill()
    }else if(b.type==='fruit'){
      const fc=['#ef6b62','#f09a47','#e9c64e','#8cc765'][b.variant%4];ctx.fillStyle=fc;ctx.beginPath();ctx.arc(0,r*.08,r*.77,0,Math.PI*2);ctx.fill();ctx.fillStyle='#5e8f4f';ctx.beginPath();ctx.ellipse(r*.22,-r*.74,r*.34,r*.13,-.45,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#75543b';ctx.lineWidth=1.7;ctx.beginPath();ctx.moveTo(0,-r*.55);ctx.lineTo(r*.08,-r*.92);ctx.stroke();ctx.fillStyle='rgba(255,255,255,.24)';ctx.beginPath();ctx.arc(-r*.27,-r*.18,r*.18,0,Math.PI*2);ctx.fill()
    }else{
      ctx.fillStyle='#e5b23e';ctx.strokeStyle='#b98220';ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(0,0,r*.78,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle='rgba(255,244,180,.7)';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(0,0,r*.56,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#a9781d';ctx.font=`700 ${r*.7}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('¢',0,0)
    }
    ctx.restore()
  }
  function drawParticle(p){
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.globalAlpha=Math.max(0,p.life/p.max);const r=p.r;
    if(p.type==='pompom'){ctx.fillStyle=p.color;for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ctx.beginPath();ctx.arc(Math.cos(a)*r*.4,Math.sin(a)*r*.4,r*.55,0,Math.PI*2);ctx.fill()}}
    else if(p.type==='candy'){ctx.fillStyle=p.color;ctx.fillRect(-r*.7,-r*.38,r*1.4,r*.76);ctx.beginPath();ctx.moveTo(-r*.7,0);ctx.lineTo(-r*1.25,-r*.55);ctx.lineTo(-r*1.25,r*.55);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(r*.7,0);ctx.lineTo(r*1.25,-r*.55);ctx.lineTo(r*1.25,r*.55);ctx.closePath();ctx.fill()}
    else if(p.type==='star'){ctx.fillStyle='#f0bd47';starPath(r*1.1);ctx.fill()}
    else if(p.type==='jellybean'){ctx.fillStyle=['#8f78d8','#e7728b','#65b97d','#efb74e'][p.variant%4];ctx.beginPath();ctx.ellipse(0,0,r*1.15,r*.72,.45,0,Math.PI*2);ctx.fill()}
    else if(p.type==='fruit'){ctx.fillStyle=['#ef6b62','#f09a47','#e9c64e','#8cc765'][p.variant%4];ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#5e8f4f';ctx.beginPath();ctx.ellipse(r*.35,-r*.75,r*.55,r*.22,-.45,0,Math.PI*2);ctx.fill()}
    else{ctx.fillStyle='#e5b23e';ctx.strokeStyle='#b98220';ctx.lineWidth=.8;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.stroke()}
    ctx.restore()
  }
  function draw(){
    ctx.clearRect(0,0,cw,ch);const j=currentJar||jarRectFor(cw,ch);
    if(jarBehind.complete)ctx.drawImage(jarBehind,j.x,j.y,j.w,j.h);
    for(const b of bodies)drawBody(b);for(const p of particles)drawParticle(p);
    if(jarBehind.complete){ctx.save();ctx.beginPath();ctx.rect(j.x+j.w*.205,j.y+j.h*.092,j.w*.59,j.h*.078);ctx.clip();ctx.drawImage(jarBehind,j.x,j.y,j.w,j.h);ctx.restore()}
  }
  function loop(now){if(dead)return;const dt=Math.min(.025,(now-last)/1000||.016);last=now;physics(dt);draw();raf=requestAnimationFrame(loop)}
  function renderType(){const t=types[typeIndex];m.dataset.item=t.id;typeLabel.textContent=t.label.toUpperCase();const preview=m.querySelector('.collection-current-preview');preview.className=`collectible-preview collection-current-preview preview-${t.id}`;pickerButtons.forEach(b=>b.classList.toggle('is-active',b.dataset.collectionType===t.id))}
  function closePicker(){picker.hidden=true;typeBtn.setAttribute('aria-expanded','false')}
  function togglePicker(){picker.hidden=!picker.hidden;typeBtn.setAttribute('aria-expanded',String(!picker.hidden))}
  canvas.addEventListener('pointerdown',e=>{const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/boardCamera.scale,y=(e.clientY-r.top)/boardCamera.scale,[l,rr]=wallsAt(y),b=jarBounds();if(x>=l&&x<=rr&&y>b.top&&y<b.floor+8)addItem()});
  add.addEventListener('click',addItem);
  typeBtn.addEventListener('click',e=>{e.stopPropagation();togglePicker()});
  picker.addEventListener('click',e=>{const b=e.target.closest('[data-collection-type]');if(!b)return;const i=types.findIndex(t=>t.id===b.dataset.collectionType);if(i>=0){typeIndex=i;renderType();closePicker()}});
  document.addEventListener('pointerdown',e=>{if(!m.contains(e.target)||!e.target.closest('.collection-picker-wrap'))closePicker()});
  bgBtn.addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  clear.addEventListener('click',()=>{bodies=[];particles=[];updateCount()});renderType();updateCount();raf=requestAnimationFrame(loop);
  m._cleanup=()=>{dead=true;cancelAnimationFrame(raf);ro.disconnect()}
}

const LUNCH_COUNT_ICONS=[
  {src:'assets/lunch-icons/30.png',label:'Burger'},{src:'assets/lunch-icons/31.png',label:'Chicken sandwich'},
  {src:'assets/lunch-icons/32.png',label:'Pizza'},{src:'assets/lunch-icons/33.png',label:'Hot dog'},
  {src:'assets/lunch-icons/34.png',label:'Yogurt'},{src:'assets/lunch-icons/35.png',label:'Sandwich'},
  {src:'assets/lunch-icons/36.png',label:'Pasta'},{src:'assets/lunch-icons/37.png',label:'Spaghetti'},
  {src:'assets/lunch-icons/38.png',label:'Rice bowl'},{src:'assets/lunch-icons/39.png',label:'Snack'},
  {src:'assets/lunch-icons/40.png',label:'Chips'},{src:'assets/lunch-icons/41.png',label:'Taco'}
];

function setupLunchCount(m){
  const grid=m.querySelector('.lunchcount-grid');
  const pool=m.querySelector('.lunchcount-name-pool');
  const poolList=m.querySelector('.lunchcount-pool-list');
  const summary=m.querySelector('.lunchcount-summary');
  const modeButtons=[...m.querySelectorAll('[data-lunch-mode-button]')];
  const nameInput=m.querySelector('.lunchcount-name-input');
  const addNameButton=m.querySelector('.lunchcount-add-name');
  const resetCounts=m.querySelector('.lunchcount-reset-counts');
  const resetNames=m.querySelector('.lunchcount-reset-names');
  const inlineActions=m.querySelector('.lunchcount-inline-actions');
  const picker=m.querySelector('.lunchcount-icon-picker');
  const pickerGrid=m.querySelector('.lunchcount-icon-picker__grid');
  const pickerClose=m.querySelector('.lunchcount-icon-picker__close');

  let students=[];
  let draggedStudent='';
  let activeCategoryId='';
  let categoryId=0;

  const createCategory=(name,iconSrc,{kind='normal'}={})=>({
    id:`lunch-${++categoryId}`,name,iconSrc,kind,tally:0,students:[]
  });

  const categories=[
    createCategory('Absent','',{kind:'absent'}),
    createCategory('Main','assets/lunch-icons/30.png'),
    createCategory('Hot','assets/lunch-icons/33.png'),
    createCategory('Yogurt','assets/lunch-icons/34.png'),
    createCategory('PB&J','assets/lunch-icons/35.png'),
    createCategory('Packer','assets/lunch-icons/lunchbox.png',{kind:'packer'})
  ];

  const findCategory=id=>categories.find(category=>category.id===id);
  const assignment=name=>categories.find(category=>category.students.includes(name))?.id||'';

  const setMode=mode=>{
    const next=mode==='names'?'names':'tally';
    m.dataset.lunchMode=next;
    modeButtons.forEach(button=>{
      const active=button.dataset.lunchModeButton===next;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    summary.textContent=next==='tally'
      ?'Tap a category to add a tally'
      :'Add names below, then drag them to a lunch choice';
    pool.hidden=next!=='names';
    resetCounts.hidden=next!=='tally';
    resetNames.hidden=next!=='names';
    inlineActions.classList.toggle('is-names',next==='names');
    renderCategories();
    renderPool();
  };

  const addStudent=()=>{
    const value=nameInput.value.trim().replace(/\s+/g,' ');
    if(!value)return;
    if(students.some(name=>name.toLocaleLowerCase()===value.toLocaleLowerCase())){
      nameInput.select();
      return;
    }
    students.push(value);
    nameInput.value='';
    renderPool();
    nameInput.focus({preventScroll:true});
  };

  const removeStudent=name=>{
    categories.forEach(category=>{
      category.students=category.students.filter(student=>student!==name);
    });
    students=students.filter(student=>student!==name);
    renderCategories();
    renderPool();
  };

  const assign=(name,targetId='')=>{
    categories.forEach(category=>{
      category.students=category.students.filter(student=>student!==name);
    });
    if(targetId){
      const target=findCategory(targetId);
      if(target&&!target.students.includes(name))target.students.push(name);
    }
    renderCategories();
    renderPool();
  };

  const studentChip=(name,{removable=false}={})=>{
    const chip=document.createElement('div');
    chip.className='lunchcount-student-chip';
    chip.draggable=true;

    const text=document.createElement('span');
    text.textContent=name;
    chip.appendChild(text);

    chip.addEventListener('dragstart',event=>{
      draggedStudent=name;
      chip.classList.add('is-dragging');
      event.dataTransfer?.setData('text/plain',name);
      if(event.dataTransfer)event.dataTransfer.effectAllowed='move';
    });

    chip.addEventListener('dragend',()=>{
      draggedStudent='';
      chip.classList.remove('is-dragging');
      m.querySelectorAll('.is-drop-target').forEach(node=>node.classList.remove('is-drop-target'));
    });

    if(removable){
      const remove=document.createElement('button');
      remove.type='button';
      remove.textContent='×';
      remove.setAttribute('aria-label',`Remove ${name}`);
      remove.addEventListener('click',event=>{
        event.stopPropagation();
        removeStudent(name);
      });
      chip.appendChild(remove);
    }

    return chip;
  };

  const wireDrop=(element,targetId='')=>{
    element.addEventListener('dragover',event=>{
      if(m.dataset.lunchMode!=='names')return;
      event.preventDefault();
      element.classList.add('is-drop-target');
    });
    element.addEventListener('dragleave',event=>{
      if(!element.contains(event.relatedTarget))element.classList.remove('is-drop-target');
    });
    element.addEventListener('drop',event=>{
      if(m.dataset.lunchMode!=='names')return;
      event.preventDefault();
      element.classList.remove('is-drop-target');
      const name=draggedStudent||event.dataTransfer?.getData('text/plain');
      if(name&&students.includes(name))assign(name,targetId);
    });
  };

  const closePicker=()=>{
    activeCategoryId='';
    picker.hidden=true;
  };

  const openPicker=id=>{
    const category=findCategory(id);
    if(!category||category.kind!=='normal')return;
    activeCategoryId=id;
    pickerGrid.querySelectorAll('.lunchcount-icon-option').forEach(button=>{
      button.classList.toggle('is-selected',button.dataset.iconSrc===category.iconSrc);
    });
    picker.hidden=false;
  };

  const renderCategories=()=>{
    grid.replaceChildren();
    const namesMode=m.dataset.lunchMode==='names';

    categories.forEach((category,index)=>{
      const card=document.createElement('section');
      card.className='lunchcount-category';
      card.dataset.categoryKind=category.kind;
      if(namesMode)wireDrop(card,category.id);

      const controls=document.createElement('div');
      controls.className='lunchcount-category-controls';

      if(category.kind==='normal'){
        const remove=document.createElement('button');
        remove.type='button';
        remove.className='lunchcount-category-remove';
        remove.textContent='×';
        remove.title='Remove category';
        remove.setAttribute('aria-label',`Remove ${category.name}`);
        remove.addEventListener('click',event=>{
          event.stopPropagation();
          category.students.forEach(name=>assign(name,''));
          const categoryIndex=categories.indexOf(category);
          if(categoryIndex>=0)categories.splice(categoryIndex,1);
          renderCategories();
          renderPool();
        });
        controls.appendChild(remove);
      }

      const icon=document.createElement(category.kind==='normal'?'button':'div');
      if(category.kind==='normal')icon.type='button';
      icon.className='lunchcount-category-icon';

      if(category.kind==='absent'){
        icon.classList.add('is-empty');
        icon.innerHTML='<span aria-hidden="true">—</span>';
        icon.title='Absent does not use an icon';
      }else{
        const image=document.createElement('img');
        image.src=category.iconSrc;
        image.alt='';
        image.draggable=false;
        icon.appendChild(image);
      }

      if(category.kind==='normal'){
        icon.title='Change category icon';
        icon.addEventListener('click',event=>{
          event.stopPropagation();
          openPicker(category.id);
        });
      }
      if(category.kind==='packer')icon.title='Packer always uses the lunch box';

      const title=document.createElement('input');
      title.type='text';
      title.className='lunchcount-category-name';
      title.maxLength=22;
      title.value=category.name;
      title.addEventListener('click',event=>event.stopPropagation());
      title.addEventListener('input',()=>category.name=title.value);
      title.addEventListener('blur',()=>{
        category.name=title.value.trim()||`Choice ${index+1}`;
        title.value=category.name;
      });

      const count=document.createElement('strong');
      count.className='lunchcount-category-count';
      count.textContent=String(namesMode?category.students.length:category.tally);

      const content=document.createElement('div');
      content.className='lunchcount-category-content';

      if(namesMode){
        if(category.students.length){
          category.students.forEach(name=>content.appendChild(studentChip(name)));
        }else{
          const empty=document.createElement('span');
          empty.className='lunchcount-category-empty';
          empty.textContent='Drop names here';
          content.appendChild(empty);
        }
      }else{
        const label=document.createElement('span');
        label.className='lunchcount-tally-label';
        label.textContent=category.tally===1?'student':'students';
        content.appendChild(label);

        const minus=document.createElement('button');
        minus.type='button';
        minus.className='lunchcount-tally-minus';
        minus.textContent='−';
        minus.disabled=category.tally<=0;
        minus.setAttribute('aria-label',`Remove one ${category.name} tally`);
        minus.addEventListener('click',event=>{
          event.stopPropagation();
          category.tally=Math.max(0,category.tally-1);
          renderCategories();
        });
        content.appendChild(minus);

        card.classList.add('is-tally');
        card.tabIndex=0;
        card.setAttribute('role','button');
        card.setAttribute('aria-label',`${category.name}: ${category.tally} students. Add one tally.`);

        const add=()=>{
          category.tally++;
          renderCategories();
        };

        card.addEventListener('click',event=>{
          if(!event.target.closest('input,button'))add();
        });
        card.addEventListener('keydown',event=>{
          if(event.key==='Enter'||event.key===' '){
            event.preventDefault();
            add();
          }
        });
      }

      card.append(controls,icon,title,count,content);
      grid.appendChild(card);
    });

    const addCard=document.createElement('button');
    addCard.type='button';
    addCard.className='lunchcount-add-category-card';
    addCard.setAttribute('aria-label','Add lunch category');
    addCard.title='Add category';
    addCard.innerHTML='<span aria-hidden="true">+</span><small>Add Category</small>';
    addCard.addEventListener('click',()=>{
      categories.push(createCategory(`Choice ${categories.length+1}`,'assets/lunch-icons/30.png'));
      renderCategories();
      requestAnimationFrame(()=>{
        const titles=[...grid.querySelectorAll('.lunchcount-category-name')];
        titles.at(-1)?.focus({preventScroll:true});
        titles.at(-1)?.select();
      });
    });
    grid.appendChild(addCard);
  };

  const renderPool=()=>{
    poolList.replaceChildren();
    if(m.dataset.lunchMode!=='names')return;

    const unassigned=students.filter(name=>!assignment(name));

    if(!students.length){
      const empty=document.createElement('span');
      empty.className='lunchcount-pool-empty';
      empty.textContent='Add student names above';
      poolList.appendChild(empty);
      return;
    }

    if(!unassigned.length){
      const empty=document.createElement('span');
      empty.className='lunchcount-pool-empty';
      empty.textContent='Everyone has a lunch choice';
      poolList.appendChild(empty);
      return;
    }

    unassigned.forEach(name=>{
      poolList.appendChild(studentChip(name,{removable:true}));
    });
  };

  LUNCH_COUNT_ICONS.forEach(icon=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='lunchcount-icon-option';
    button.dataset.iconSrc=icon.src;

    const image=document.createElement('img');
    image.src=icon.src;
    image.alt='';
    image.draggable=false;

    const caption=document.createElement('span');
    caption.textContent=icon.label;

    button.append(image,caption);
    button.addEventListener('click',()=>{
      const category=findCategory(activeCategoryId);
      if(category&&category.kind==='normal'){
        category.iconSrc=icon.src;
        closePicker();
        renderCategories();
      }
    });
    pickerGrid.appendChild(button);
  });

  wireDrop(poolList,'');

  modeButtons.forEach(button=>{
    button.addEventListener('click',()=>setMode(button.dataset.lunchModeButton));
  });

  addNameButton.addEventListener('click',addStudent);
  nameInput.addEventListener('keydown',event=>{
    if(event.key==='Enter'){
      event.preventDefault();
      addStudent();
    }
  });

  resetCounts.addEventListener('click',()=>{
    categories.forEach(category=>category.tally=0);
    renderCategories();
  });

  resetNames.addEventListener('click',()=>{
    categories.forEach(category=>category.students=[]);
    renderCategories();
    renderPool();
  });

  pickerClose.addEventListener('click',closePicker);
  picker.addEventListener('pointerdown',event=>{
    if(event.target===picker)closePicker();
  });
  picker.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});

  m.querySelector('.lunchcount-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.lunchcount-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.lunchcount-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  setMode('tally');
}

function setupVoting(m){
  const grid=m.querySelector('.voting-grid');
  const pool=m.querySelector('.voting-name-pool');
  const poolList=m.querySelector('.voting-pool-list');
  const summary=m.querySelector('.voting-summary');
  const modeButtons=[...m.querySelectorAll('[data-voting-mode-button]')];
  const nameInput=m.querySelector('.voting-name-input');
  const addNameButton=m.querySelector('.voting-add-name');
  const resetCounts=m.querySelector('.voting-reset-counts');
  const resetNames=m.querySelector('.voting-reset-names');
  const inlineActions=m.querySelector('.voting-inline-actions');
  const imageInput=m.querySelector('.voting-image-input');

  let students=[];
  let draggedStudent='';
  let activeChoiceId='';
  let choiceId=0;

  const createChoice=name=>({
    id:`vote-${++choiceId}`,
    name,
    imageSrc:'',
    tally:0,
    students:[]
  });

  const choices=[
    createChoice('Choice 1'),
    createChoice('Choice 2')
  ];

  const findChoice=id=>choices.find(choice=>choice.id===id);
  const assignment=name=>choices.find(choice=>choice.students.includes(name))?.id||'';

  const setMode=mode=>{
    const next=mode==='names'?'names':'tally';
    m.dataset.votingMode=next;

    modeButtons.forEach(button=>{
      const active=button.dataset.votingModeButton===next;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',String(active));
    });

    summary.textContent=next==='tally'
      ?'Tap a choice to add a vote'
      :'Add names below, then drag them to a choice';

    pool.hidden=next!=='names';
    resetCounts.hidden=next!=='tally';
    resetNames.hidden=next!=='names';
    inlineActions.classList.toggle('is-names',next==='names');

    renderChoices();
    renderPool();
  };

  const addStudent=()=>{
    const value=nameInput.value.trim().replace(/\s+/g,' ');
    if(!value)return;

    if(students.some(name=>name.toLocaleLowerCase()===value.toLocaleLowerCase())){
      nameInput.select();
      return;
    }

    students.push(value);
    nameInput.value='';
    renderPool();
    nameInput.focus({preventScroll:true});
  };

  const removeStudent=name=>{
    choices.forEach(choice=>{
      choice.students=choice.students.filter(student=>student!==name);
    });
    students=students.filter(student=>student!==name);
    renderChoices();
    renderPool();
  };

  const assign=(name,targetId='')=>{
    choices.forEach(choice=>{
      choice.students=choice.students.filter(student=>student!==name);
    });
    if(targetId){
      const target=findChoice(targetId);
      if(target&&!target.students.includes(name))target.students.push(name);
    }
    renderChoices();
    renderPool();
  };

  const studentChip=(name,{removable=false}={})=>{
    const chip=document.createElement('div');
    chip.className='voting-student-chip';
    chip.draggable=true;

    const text=document.createElement('span');
    text.textContent=name;
    chip.appendChild(text);

    chip.addEventListener('dragstart',event=>{
      draggedStudent=name;
      chip.classList.add('is-dragging');
      event.dataTransfer?.setData('text/plain',name);
      if(event.dataTransfer)event.dataTransfer.effectAllowed='move';
    });

    chip.addEventListener('dragend',()=>{
      draggedStudent='';
      chip.classList.remove('is-dragging');
      m.querySelectorAll('.is-drop-target').forEach(node=>node.classList.remove('is-drop-target'));
    });

    if(removable){
      const remove=document.createElement('button');
      remove.type='button';
      remove.textContent='×';
      remove.setAttribute('aria-label',`Remove ${name}`);
      remove.addEventListener('click',event=>{
        event.stopPropagation();
        removeStudent(name);
      });
      chip.appendChild(remove);
    }

    return chip;
  };

  const wireDrop=(element,targetId='')=>{
    element.addEventListener('dragover',event=>{
      if(m.dataset.votingMode!=='names')return;
      event.preventDefault();
      element.classList.add('is-drop-target');
    });

    element.addEventListener('dragleave',event=>{
      if(!element.contains(event.relatedTarget))element.classList.remove('is-drop-target');
    });

    element.addEventListener('drop',event=>{
      if(m.dataset.votingMode!=='names')return;
      event.preventDefault();
      element.classList.remove('is-drop-target');
      const name=draggedStudent||event.dataTransfer?.getData('text/plain');
      if(name&&students.includes(name))assign(name,targetId);
    });
  };

  const openImagePicker=id=>{
    activeChoiceId=id;
    imageInput.value='';
    imageInput.click();
  };

  const renderChoices=()=>{
    grid.replaceChildren();
    const namesMode=m.dataset.votingMode==='names';

    choices.forEach((choice,index)=>{
      const card=document.createElement('section');
      card.className='voting-choice';
      if(namesMode)wireDrop(card,choice.id);

      const controls=document.createElement('div');
      controls.className='voting-choice-controls';

      const remove=document.createElement('button');
      remove.type='button';
      remove.className='voting-choice-remove';
      remove.textContent='×';
      remove.title='Remove choice';
      remove.setAttribute('aria-label',`Remove ${choice.name}`);
      remove.disabled=choices.length<=1;
      remove.addEventListener('click',event=>{
        event.stopPropagation();
        if(choices.length<=1)return;
        choice.students.forEach(name=>assign(name,''));
        const choiceIndex=choices.indexOf(choice);
        if(choiceIndex>=0)choices.splice(choiceIndex,1);
        renderChoices();
        renderPool();
      });
      controls.appendChild(remove);

      const imageButton=document.createElement('button');
      imageButton.type='button';
      imageButton.className='voting-choice-image';
      imageButton.setAttribute('aria-label',choice.imageSrc?`Change image for ${choice.name}`:`Add image for ${choice.name}`);
      imageButton.title=choice.imageSrc?'Change image':'Add image';

      if(choice.imageSrc){
        const image=document.createElement('img');
        image.src=choice.imageSrc;
        image.alt='';
        image.draggable=false;
        imageButton.appendChild(image);
      }else{
        imageButton.innerHTML='<span aria-hidden="true">＋</span><small>Add Image</small>';
      }

      imageButton.addEventListener('click',event=>{
        event.stopPropagation();
        openImagePicker(choice.id);
      });

      const title=document.createElement('input');
      title.type='text';
      title.className='voting-choice-name';
      title.maxLength=30;
      title.value=choice.name;
      title.setAttribute('aria-label',`Voting choice ${index+1}`);
      title.addEventListener('click',event=>event.stopPropagation());
      title.addEventListener('input',()=>choice.name=title.value);
      title.addEventListener('blur',()=>{
        choice.name=title.value.trim()||`Choice ${index+1}`;
        title.value=choice.name;
      });

      const count=document.createElement('strong');
      count.className='voting-choice-count';
      count.textContent=String(namesMode?choice.students.length:choice.tally);

      const content=document.createElement('div');
      content.className='voting-choice-content';

      if(namesMode){
        if(choice.students.length){
          choice.students.forEach(name=>content.appendChild(studentChip(name)));
        }else{
          const empty=document.createElement('span');
          empty.className='voting-choice-empty';
          empty.textContent='Drop names here';
          content.appendChild(empty);
        }
      }else{
        const label=document.createElement('span');
        label.className='voting-tally-label';
        label.textContent=choice.tally===1?'vote':'votes';
        content.appendChild(label);

        const minus=document.createElement('button');
        minus.type='button';
        minus.className='voting-tally-minus';
        minus.textContent='−';
        minus.disabled=choice.tally<=0;
        minus.setAttribute('aria-label',`Remove one vote from ${choice.name}`);
        minus.addEventListener('click',event=>{
          event.stopPropagation();
          choice.tally=Math.max(0,choice.tally-1);
          renderChoices();
        });
        content.appendChild(minus);

        card.classList.add('is-tally');
        card.tabIndex=0;
        card.setAttribute('role','button');
        card.setAttribute('aria-label',`${choice.name}: ${choice.tally} votes. Add one vote.`);

        const add=()=>{
          choice.tally++;
          renderChoices();
        };

        card.addEventListener('click',event=>{
          if(!event.target.closest('input,button'))add();
        });

        card.addEventListener('keydown',event=>{
          if(event.key==='Enter'||event.key===' '){
            event.preventDefault();
            add();
          }
        });
      }

      card.append(controls,imageButton,title,count,content);
      grid.appendChild(card);
    });

    const addCard=document.createElement('button');
    addCard.type='button';
    addCard.className='voting-add-choice-card';
    addCard.setAttribute('aria-label','Add voting choice');
    addCard.title='Add choice';
    addCard.innerHTML='<span aria-hidden="true">+</span><small>Add Choice</small>';
    addCard.addEventListener('click',()=>{
      choices.push(createChoice(`Choice ${choices.length+1}`));
      renderChoices();
      requestAnimationFrame(()=>{
        const titles=[...grid.querySelectorAll('.voting-choice-name')];
        titles.at(-1)?.focus({preventScroll:true});
        titles.at(-1)?.select();
      });
    });
    grid.appendChild(addCard);
  };

  const renderPool=()=>{
    poolList.replaceChildren();
    if(m.dataset.votingMode!=='names')return;

    const unassigned=students.filter(name=>!assignment(name));

    if(!students.length){
      const empty=document.createElement('span');
      empty.className='voting-pool-empty';
      empty.textContent='Add student names above';
      poolList.appendChild(empty);
      return;
    }

    if(!unassigned.length){
      const empty=document.createElement('span');
      empty.className='voting-pool-empty';
      empty.textContent='Everyone has voted';
      poolList.appendChild(empty);
      return;
    }

    unassigned.forEach(name=>{
      poolList.appendChild(studentChip(name,{removable:true}));
    });
  };

  wireDrop(poolList,'');

  modeButtons.forEach(button=>{
    button.addEventListener('click',()=>setMode(button.dataset.votingModeButton));
  });

  addNameButton.addEventListener('click',addStudent);
  nameInput.addEventListener('keydown',event=>{
    if(event.key==='Enter'){
      event.preventDefault();
      addStudent();
    }
  });

  resetCounts.addEventListener('click',()=>{
    choices.forEach(choice=>choice.tally=0);
    renderChoices();
  });

  resetNames.addEventListener('click',()=>{
    choices.forEach(choice=>choice.students=[]);
    renderChoices();
    renderPool();
  });

  imageInput.addEventListener('change',()=>{
    const file=imageInput.files?.[0];
    const choice=findChoice(activeChoiceId);
    if(!file||!choice)return;

    const reader=new FileReader();
    reader.addEventListener('load',()=>{
      if(typeof reader.result==='string'){
        choice.imageSrc=reader.result;
        renderChoices();
      }
    },{once:true});
    reader.readAsDataURL(file);
  });

  m.querySelector('.voting-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.voting-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.voting-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  setMode('tally');
}


function setupGroupMaker(m){
  const nameInput=m.querySelector('.groupmaker-name-input');
  const addNameBtn=m.querySelector('.groupmaker-add-name');
  const nameList=m.querySelector('.groupmaker-name-list');
  const sizeInput=m.querySelector('.groupmaker-size');
  const makeBtn=m.querySelector('.groupmaker-make');
  const shuffleBtn=m.querySelector('.groupmaker-shuffle');
  const editBtn=m.querySelector('.groupmaker-edit-names');
  const results=m.querySelector('.groupmaker-results');
  const countLabel=m.querySelector('.groupmaker-name-count');
  const summary=m.querySelector('.groupmaker-summary');
  const bg=m.querySelector('.groupmaker-bg');
  const font=m.querySelector('.groupmaker-font');
  const textColor=m.querySelector('.groupmaker-text-color');

  let names=[];
  let groupTitles=[];
  let shuffleTimer=0;

  const normalizeName=value=>value.trim().replace(/\s+/g,' ');

  const updateCount=()=>{
    const count=names.length;
    countLabel.textContent=`${count} ${count===1?'name':'names'}`;
    makeBtn.disabled=count<2;
  };

  const renderNameList=()=>{
    nameList.replaceChildren();

    names.forEach((name,index)=>{
      const chip=document.createElement('div');
      chip.className='groupmaker-name-chip';

      const text=document.createElement('span');
      text.textContent=name;

      const remove=document.createElement('button');
      remove.type='button';
      remove.textContent='×';
      remove.setAttribute('aria-label',`Remove ${name}`);
      remove.addEventListener('click',()=>{
        names.splice(index,1);
        renderNameList();
        updateCount();
        if(m.classList.contains('has-groups')){
          if(names.length>=2){
            makeGroups(true);
          }else{
            m.classList.remove('has-groups');
          }
        }
      });

      chip.append(text,remove);
      nameList.appendChild(chip);
    });

    nameList.classList.toggle('is-empty',names.length===0);
  };

  const addName=()=>{
    const value=normalizeName(nameInput.value);
    if(!value)return;

    const exists=names.some(name=>name.toLocaleLowerCase()===value.toLocaleLowerCase());
    if(exists){
      nameInput.select();
      return;
    }

    names.push(value);
    nameInput.value='';
    renderNameList();
    updateCount();
    nameInput.focus({preventScroll:true});
  };

  const shuffleNames=list=>{
    const copy=[...list];
    for(let i=copy.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [copy[i],copy[j]]=[copy[j],copy[i]];
    }
    return copy;
  };

  const balanceGroups=(list,targetSize)=>{
    if(!list.length)return [];
    const groupCount=Math.max(1,Math.ceil(list.length/targetSize));
    const groups=Array.from({length:groupCount},()=>[]);
    list.forEach((name,index)=>{
      groups[index%groupCount].push(name);
    });
    return groups;
  };

  const ensureGroupTitles=count=>{
    while(groupTitles.length<count){
      groupTitles.push(`Group ${groupTitles.length+1}`);
    }
    if(groupTitles.length>count){
      groupTitles=groupTitles.slice(0,count);
    }
  };

  const renderGroups=(groups,{animate=false}={})=>{
    ensureGroupTitles(groups.length);
    results.replaceChildren();
    results.classList.toggle('is-shuffling',animate);

    const grid=document.createElement('div');
    grid.className='groupmaker-grid';
    grid.style.setProperty('--group-count',String(groups.length));

    groups.forEach((group,index)=>{
      const card=document.createElement('section');
      card.className='groupmaker-group';
      if(animate)card.style.setProperty('--group-delay',`${index*55}ms`);

      const title=document.createElement('input');
      title.className='groupmaker-group-title-input';
      title.type='text';
      title.maxLength=28;
      title.value=groupTitles[index]||`Group ${index+1}`;
      title.setAttribute('aria-label',`Edit name for group ${index+1}`);
      title.addEventListener('input',()=>{
        groupTitles[index]=title.value;
      });
      title.addEventListener('blur',()=>{
        const fallback=`Group ${index+1}`;
        const value=title.value.trim();
        groupTitles[index]=value||fallback;
        title.value=groupTitles[index];
      });

      const list=document.createElement('ol');
      list.className='groupmaker-group-list';

      group.forEach((name,nameIndex)=>{
        const item=document.createElement('li');
        item.textContent=name;
        if(animate)item.style.setProperty('--name-delay',`${index*55+nameIndex*38}ms`);
        list.appendChild(item);
      });

      card.append(title,list);
      grid.appendChild(card);
    });

    results.appendChild(grid);
    const total=groups.reduce((sum,group)=>sum+group.length,0);
    summary.textContent=`${total} students · ${groups.length} ${groups.length===1?'group':'groups'}`;
    m.classList.add('has-groups');

    if(animate){
      clearTimeout(shuffleTimer);
      shuffleTimer=setTimeout(()=>results.classList.remove('is-shuffling'),750);
    }
  };

  const makeGroups=(animate=true)=>{
    if(names.length<2){
      m.classList.remove('has-groups');
      updateCount();
      return;
    }

    const targetSize=Math.max(2,Math.min(12,Math.round(Number(sizeInput.value)||4)));
    sizeInput.value=String(targetSize);
    renderGroups(balanceGroups(shuffleNames(names),targetSize),{animate});
  };

  addNameBtn.addEventListener('click',addName);
  nameInput.addEventListener('keydown',e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      addName();
    }
  });

  sizeInput.addEventListener('change',()=>{
    sizeInput.value=String(Math.max(2,Math.min(12,Math.round(Number(sizeInput.value)||4))));
    if(m.classList.contains('has-groups'))makeGroups(true);
  });

  makeBtn.addEventListener('click',()=>makeGroups(true));

  shuffleBtn.addEventListener('click',()=>{
    if(names.length<2){
      m.classList.remove('has-groups');
      nameInput.focus({preventScroll:true});
      return;
    }
    makeGroups(true);
  });

  editBtn.addEventListener('click',()=>{
    m.classList.remove('has-groups');
    summary.textContent='Edit your class list';
    requestAnimationFrame(()=>nameInput.focus({preventScroll:true}));
  });

  bg.addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  font.addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  textColor.addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  renderNameList();
  updateCount();

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    clearTimeout(shuffleTimer);
  };
}

function setupStoplight(m){
  const stage=m.querySelector('.stoplight-stage');
  const img=m.querySelector('.stoplight-image');
  const label=m.querySelector('.stoplight-label');
  const bg=m.querySelector('.stoplight-bg');
  const modeButton=m.querySelector('.stoplight-mode-button');
  const modeCurrent=m.querySelector('.stoplight-mode-button__current');
  const modeMenu=m.querySelector('.stoplight-mode-menu');
  const modeOptions=[...m.querySelectorAll('[data-stoplight-mode-option]')];

  const modes={
    voice:{
      name:'Voice Level',
      summary:'Normal · Whisper · Zero',
      labels:['NORMAL','WHISPER','ZERO']
    },
    choice:{
      name:'Yes / Maybe / No',
      summary:'Yes · Maybe · No',
      labels:['YES','MAYBE','NO']
    },
    classic:{
      name:'Classic',
      summary:'Go · Listen · Stop',
      labels:['GO','LISTEN','STOP']
    }
  };

  const states=[
    {id:'green',src:'assets/stoplight-green.png',alt:'Green stoplight'},
    {id:'yellow',src:'assets/stoplight-yellow.png',alt:'Yellow stoplight'},
    {id:'red',src:'assets/stoplight-red.png',alt:'Red stoplight'}
  ];

  let i=0;
  let mode=m.dataset.stoplightMode||'voice';
  if(!modes[mode])mode='voice';

  const closeModeMenu=()=>{
    modeMenu.hidden=true;
    modeButton.setAttribute('aria-expanded','false');
  };

  const render=(animate=true)=>{
    const state=states[i];
    const config=modes[mode];
    m.dataset.stoplight=state.id;
    m.dataset.stoplightMode=mode;
    label.textContent=config.labels[i];
    img.src=state.src;
    img.alt=state.alt;
    modeCurrent.textContent=config.summary;
    modeOptions.forEach(option=>{
      option.classList.toggle('is-active',option.dataset.stoplightModeOption===mode);
    });
    stage.setAttribute('aria-label',`${config.labels[i]}. Click to change stoplight state.`);
    modeButton.setAttribute('aria-label',`Change stoplight mode. Current mode: ${config.name}, ${config.summary}.`);
    if(animate){
      stage.classList.remove('stoplight-pop');
      void stage.offsetWidth;
      stage.classList.add('stoplight-pop');
      setTimeout(()=>stage.classList.remove('stoplight-pop'),220);
    }
  };

  stage.addEventListener('click',()=>{
    i=(i+1)%states.length;
    render(true);
  });

  modeButton.addEventListener('click',e=>{
    e.stopPropagation();
    const opening=modeMenu.hidden;
    modeMenu.hidden=!opening;
    modeButton.setAttribute('aria-expanded',String(opening));
  });

  modeOptions.forEach(option=>{
    option.addEventListener('click',e=>{
      e.stopPropagation();
      mode=option.dataset.stoplightModeOption;
      closeModeMenu();
      render(true);
    });
  });

  m.addEventListener('pointerdown',e=>{
    if(!e.target.closest('.stoplight-mode-wrap'))closeModeMenu();
  });

  bg.addEventListener('click',e=>{
    e.stopPropagation();
    cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']);
  });

  render(false);
}

function getDraggedImageSource(dt){
  const file=[...dt.files].find(f=>f.type.startsWith('image/'));if(file)return{file};
  const uri=(dt.getData('text/uri-list')||'').split(/\r?\n/).find(x=>x&&!x.startsWith('#'));
  const html=dt.getData('text/html')||'';const match=html.match(/<img[^>]+src=["']([^"']+)["']/i);
  const plain=(dt.getData('text/plain')||'').trim();
  const url=match?.[1]||uri||(/^https?:\/\//i.test(plain)||/^data:image\//i.test(plain)?plain:'');
  return url?{url}:null
}
function setupImage(m){
  const stage=m.querySelector('.image-stage'),img=m.querySelector('.image-display'),input=m.querySelector('.image-input');let objectUrl='';
  const fitModule=()=>{const ratio=(img.naturalWidth||1)/(img.naturalHeight||1);m._imageRatio=ratio;const maxW=Math.min(680,innerWidth-36),maxH=Math.min(560,innerHeight-36);let w=Math.min(560,maxW),h=w/ratio;if(h>maxH){h=maxH;w=h*ratio}w=Math.max(220,w);h=w/ratio;if(h<150){h=150;w=h*ratio}m.style.width=`${w}px`;m.style.height=`${h}px`;m.style.left=`${clamp(m.offsetLeft,0,innerWidth-w)}px`;m.style.top=`${clamp(m.offsetTop,0,innerHeight-h)}px`};
  const setSrc=(src,alt='Board image')=>{img.onload=fitModule;img.onerror=()=>{img.hidden=true;m.classList.remove('has-image')};img.src=src;img.alt=alt;img.hidden=false;m.classList.add('has-image')};
  const setFile=file=>{if(!file||!file.type?.startsWith('image/'))return;if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(file);setSrc(objectUrl,file.name||'Board image')};
  const setUrl=url=>{if(!url)return;if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=''}setSrc(url,'Board image')};
  m._setImage=setFile;m._setImageUrl=setUrl;
  stage.addEventListener('click',()=>input.click());input.addEventListener('change',()=>setFile(input.files?.[0]));
  stage.addEventListener('dragover',e=>{e.preventDefault();e.stopPropagation();stage.classList.add('is-dragover')});
  stage.addEventListener('dragleave',()=>stage.classList.remove('is-dragover'));
  stage.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();stage.classList.remove('is-dragover');const src=getDraggedImageSource(e.dataTransfer);if(src?.file)setFile(src.file);else if(src?.url)setUrl(src.url)});
  const prior=m._cleanup;m._cleanup=()=>{prior?.();if(objectUrl)URL.revokeObjectURL(objectUrl)}
}

function setupYoutube(m){
  const frame=m.querySelector('.youtube-frame'),empty=m.querySelector('.youtube-empty'),input=m.querySelector('.youtube-url'),load=m.querySelector('.youtube-load'),error=m.querySelector('.youtube-error');
  m.querySelector('.youtube-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  const getId=value=>{
    const raw=(value||'').trim();if(!raw)return null;if(/^[A-Za-z0-9_-]{11}$/.test(raw))return raw;
    try{const u=new URL(raw);const host=u.hostname.replace(/^www\./,'').toLowerCase();if(host==='youtu.be')return u.pathname.split('/').filter(Boolean)[0]||null;if(host.endsWith('youtube.com')){const v=u.searchParams.get('v');if(v)return v;const parts=u.pathname.split('/').filter(Boolean);if(['embed','shorts','live'].includes(parts[0])&&parts[1])return parts[1]}}catch{}
    return null
  };
  const loadVideo=()=>{const id=getId(input.value);if(!id){error.textContent='Enter a valid YouTube link.';return}if(location.protocol==='file:'){error.textContent='YouTube embeds require localhost or HTTPS. Run the included site through a local server.';frame.hidden=true;m.classList.remove('has-video');return}error.textContent='';const origin=(location.protocol==='http:'||location.protocol==='https:')?`&origin=${encodeURIComponent(location.origin)}`:'';frame.src=`https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0${origin}`;frame.hidden=false;m.classList.add('has-video')};
  load.addEventListener('click',loadVideo);input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();loadVideo()}});
  const prior=m._cleanup;m._cleanup=()=>{prior?.();frame.src=''}
}

function setupAmbienceVideo(m){
  const frame=m.querySelector('.ambience-video-frame');
  const title=m.querySelector('.ambience-video-title');
  const message=m.querySelector('.ambience-video-message');
  const channelButtons=[...m.querySelectorAll('[data-ambience-channel-button]')];

  const channels={
    campfire:{
      title:'Campfire',
      id:'E77jmtut1Zc'
    },
    fireplace:{
      title:'Fireplace',
      id:'mSX3OyW9Rao'
    },
    aquarium:{
      title:'Aquarium',
      id:'W0u-7lgWXpw'
    }
  };

  const loadChannel=channel=>{
    const key=channel in channels?channel:'campfire';
    const config=channels[key];

    m.dataset.ambienceChannel=key;
    title.textContent=config.title;
    frame.title=`${config.title} ambience video`;

    channelButtons.forEach(button=>{
      const active=button.dataset.ambienceChannelButton===key;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',String(active));
    });

    message.textContent='';
    frame.hidden=false;

    const params=new URLSearchParams({
      autoplay:'1',
      mute:'1',
      rel:'0',
      playsinline:'1'
    });

    if(location.protocol==='http:'||location.protocol==='https:'){
      params.set('origin',location.origin);
    }

    frame.src=`https://www.youtube.com/embed/${encodeURIComponent(config.id)}?${params.toString()}`;
  };

  channelButtons.forEach(button=>{
    button.addEventListener('click',()=>{
      loadChannel(button.dataset.ambienceChannelButton);
    });
  });

  m.querySelector('.ambience-video-font').addEventListener('click',()=>{
    cycleData(m,'font',FONT_OPTIONS);
  });

  loadChannel(m.dataset.ambienceChannel||'campfire');

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    frame.src='';
  };
}

function fitEditableText(el,m,cssVar){
  const measure=document.createElement('div');measure.className='text-fit-measure';m.appendChild(measure);
  const fit=()=>{const aw=Math.max(30,el.clientWidth-12),ah=Math.max(26,el.clientHeight-12);measure.style.width=`${aw}px`;measure.style.fontFamily=getComputedStyle(el).fontFamily;measure.style.fontWeight=getComputedStyle(el).fontWeight;measure.style.lineHeight=getComputedStyle(el).lineHeight;measure.textContent=el.innerText||' ';let lo=10,hi=800,best=10;for(let i=0;i<18;i++){const mid=(lo+hi)/2;measure.style.fontSize=`${mid}px`;if(measure.scrollHeight<=ah&&measure.scrollWidth<=aw){best=mid;lo=mid}else hi=mid}m.style.setProperty(cssVar,`${Math.max(10,best*.97)}px`)};
  const ro=new ResizeObserver(()=>requestAnimationFrame(fit));ro.observe(m);ro.observe(el);el.addEventListener('input',fit);requestAnimationFrame(fit);return()=>{ro.disconnect();measure.remove()}
}

function setupWindowShare(m){
  const video=m.querySelector('.windowshare-video');
  const empty=m.querySelector('.windowshare-empty');
  const startButton=m.querySelector('.windowshare-start');
  const changeButton=m.querySelector('.windowshare-change');
  const stopButton=m.querySelector('.windowshare-stop');
  const audioButton=m.querySelector('.windowshare-audio');
  const bgButton=m.querySelector('.windowshare-bg');
  const liveBadge=m.querySelector('.windowshare-live-badge');
  const message=m.querySelector('.windowshare-message');

  let stream=null;
  let messageTimer=0;

  function showMessage(text,hold=2600){
    clearTimeout(messageTimer);
    message.textContent=text;
    message.classList.add('is-visible');
    if(hold){
      messageTimer=setTimeout(()=>message.classList.remove('is-visible'),hold);
    }
  }

  function setAudioButton(){
    if(!stream){
      audioButton.textContent='🔊';
      audioButton.disabled=true;
      audioButton.title='No shared audio';
      return;
    }
    const tracks=stream.getAudioTracks();
    audioButton.disabled=!tracks.length;
    if(!tracks.length){
      audioButton.textContent='🔇';
      audioButton.title='This source is not sharing audio';
      return;
    }
    const enabled=tracks.some(t=>t.enabled);
    audioButton.textContent=enabled?'🔊':'🔇';
    audioButton.title=enabled?'Mute shared audio':'Unmute shared audio';
    audioButton.setAttribute('aria-label',audioButton.title);
  }

  function clearStreamTracks(){
    if(!stream)return;
    stream.getTracks().forEach(track=>{
      track.onended=null;
      try{track.stop()}catch{}
    });
    stream=null;
  }

  function resetShare({ended=false}={}){
    clearStreamTracks();
    video.pause();
    video.srcObject=null;
    m.classList.remove('is-sharing');
    liveBadge.hidden=true;
    setAudioButton();
    if(ended)showMessage('Sharing ended.',1800);
  }

  async function beginShare(){
    if(!navigator.mediaDevices?.getDisplayMedia){
      showMessage('Window sharing is not supported here. Open TeacherTiles through HTTPS or localhost.',4200);
      return;
    }

    if(!window.isSecureContext){
      showMessage('Window Share requires HTTPS or localhost.',4200);
      return;
    }

    try{
      const nextStream=await navigator.mediaDevices.getDisplayMedia({
        video:{
          frameRate:{ideal:30,max:60},
          cursor:'always'
        },
        audio:true,
        preferCurrentTab:false,
        selfBrowserSurface:'exclude',
        surfaceSwitching:'include',
        systemAudio:'include'
      });

      clearStreamTracks();
      stream=nextStream;

      const videoTrack=stream.getVideoTracks()[0];
      if(!videoTrack){
        resetShare();
        showMessage('No video source was selected.',2600);
        return;
      }

      videoTrack.onended=()=>resetShare({ended:true});
      stream.getAudioTracks().forEach(track=>{
        track.onended=()=>setAudioButton();
      });

      video.srcObject=stream;
      video.muted=false;
      try{await video.play()}catch{}

      m.classList.add('is-sharing');
      liveBadge.hidden=false;
      setAudioButton();

      const settings=videoTrack.getSettings?.()||{};
      const surface=settings.displaySurface;
      if(surface){
        const label=surface==='browser'?'Chrome tab':surface==='window'?'window':surface==='monitor'?'screen':surface;
        showMessage(`Sharing ${label}.`,1400);
      }
    }catch(err){
      if(err?.name==='NotAllowedError'||err?.name==='AbortError'){
        showMessage('Share cancelled.',1600);
      }else{
        console.error('Window Share error:',err);
        showMessage('Could not start sharing. Try selecting the source again.',3200);
      }
    }
  }

  startButton.addEventListener('click',beginShare);
  changeButton.addEventListener('click',beginShare);
  stopButton.addEventListener('click',()=>resetShare());

  audioButton.addEventListener('click',()=>{
    if(!stream)return;
    const tracks=stream.getAudioTracks();
    if(!tracks.length)return;
    const shouldEnable=!tracks.some(t=>t.enabled);
    tracks.forEach(t=>t.enabled=shouldEnable);
    setAudioButton();
  });

  bgButton.addEventListener('click',()=>{
    cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']);
  });

  setAudioButton();

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    clearTimeout(messageTimer);
    clearStreamTracks();
    video.pause();
    video.srcObject=null;
  };
}

function setupBoombox(m){
  const tracks=[
    {title:'Relaxing Rain',src:'assets/soundscapes/relaxing-rain.mp3',vinyl:'#6d7f91',deep:'#354553',label:'#dce6ee',text:'#273641'},
    {title:'Thunderstorm',src:'assets/soundscapes/Thunderstorm.mp3',vinyl:'#52596b',deep:'#292e3b',label:'#c8cddd',text:'#282d3a'},
    {title:'Blizzard',src:'assets/soundscapes/Blizzard.mp3',vinyl:'#b9d9e9',deep:'#6f9db3',label:'#edf8fc',text:'#31566a'},
    {title:'Flowing Stream',src:'assets/soundscapes/Flowing Stream.mp3',vinyl:'#4b9da0',deep:'#28696d',label:'#d4eeee',text:'#205456'},
    {title:'Campfire',src:'assets/soundscapes/campfire.mp3',vinyl:'#c96d3b',deep:'#783a24',label:'#f4d4b9',text:'#67321f'},
    {title:'Crickets',src:'assets/soundscapes/crickets.mp3',vinyl:'#6f8755',deep:'#3f5630',label:'#dce7ce',text:'#334626'},
    {title:'Waterfall',src:'assets/soundscapes/Waterfall.mp3',vinyl:'#4b83b1',deep:'#285375',label:'#d5e8f5',text:'#24445b'},
    {title:'Ocean Waves',src:'assets/soundscapes/ocean-waves.mp3',vinyl:'#315f87',deep:'#173b5b',label:'#cfe2ef',text:'#203d53'}
  ];
  const audio=m.querySelector('.boombox-audio'),titles=[...m.querySelectorAll('.boombox-title')],plays=[...m.querySelectorAll('.boombox-play')],prevs=[...m.querySelectorAll('.boombox-prev')],nexts=[...m.querySelectorAll('.boombox-next')],skips=[...m.querySelectorAll('.boombox-skip')],volumes=[...m.querySelectorAll('.boombox-volume')],volumeValues=[...m.querySelectorAll('.boombox-volume-value')],progresses=[...m.querySelectorAll('.boombox-progress span')],currents=[...m.querySelectorAll('.boombox-current')],durations=[...m.querySelectorAll('.boombox-duration')],styleButton=m.querySelector('.boombox-style-button'),styleMenu=m.querySelector('.boombox-style-menu');let index=0;
  const fmt=n=>{if(!Number.isFinite(n))return'0:00';n=Math.max(0,Math.floor(n));return`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`};
  const each=(arr,fn)=>arr.forEach(fn);
  const renderPlay=()=>{each(plays,b=>{b.textContent=audio.paused?(b.closest('.boombox-view--ipod')?'▶❚❚':'▶'):'❚❚';b.classList.toggle('is-playing',!audio.paused)});m.classList.toggle('is-playing',!audio.paused)};
  const fitVinylTitle=t=>{
    const label=t.closest('.vinyl-label');
    if(!label)return;
    const words=[...t.querySelectorAll('.vinyl-title-word')];
    if(!words.length)return;
    let size=Math.min(14,Math.max(7,label.clientWidth*.18));
    const minSize=6.25;
    t.style.fontSize=`${size}px`;
    const fits=()=>words.every(w=>w.scrollWidth<=t.clientWidth+1)&&t.scrollHeight<=t.clientHeight+1;
    while(size>minSize&&!fits()){
      size-=.25;
      t.style.fontSize=`${size}px`;
    }
  };
  const syncTrack=()=>{
    const track=tracks[index];
    each(titles,t=>{
      if(t.closest('.vinyl-label')){
        t.replaceChildren(...track.title.split(/\s+/).map(word=>{
          const span=document.createElement('span');
          span.className='vinyl-title-word';
          span.textContent=word;
          return span;
        }));
        requestAnimationFrame(()=>fitVinylTitle(t));
      }else{
        t.textContent=track.title;
      }
    });
    m.style.setProperty('--vinyl-label',track.label);
    m.style.setProperty('--vinyl-label-text',track.text);
  };
  const syncProgress=()=>{const pct=audio.duration?clamp(audio.currentTime/audio.duration*100,0,100):0;each(progresses,p=>p.style.width=`${pct}%`);each(currents,c=>c.textContent=fmt(audio.currentTime));each(durations,d=>d.textContent=fmt(audio.duration))};
  const load=(i,autoplay=false)=>{index=(i+tracks.length)%tracks.length;syncTrack();audio.src=tracks[index].src;audio.load();each(progresses,p=>p.style.width='0%');each(currents,c=>c.textContent='0:00');if(autoplay)audio.play().catch(()=>{});renderPlay()};
  each(plays,b=>b.addEventListener('click',()=>{if(audio.paused)audio.play().catch(()=>{});else audio.pause()}));
  each(prevs,b=>b.addEventListener('click',()=>load(index-1,!audio.paused)));
  each(nexts,b=>b.addEventListener('click',()=>load(index+1,!audio.paused)));
  each(skips,b=>b.addEventListener('click',()=>{if(Number.isFinite(audio.duration))audio.currentTime=Math.min(audio.duration,audio.currentTime+15)}));
  const setVolume=v=>{v=clamp(Number(v),0,100);audio.volume=v/100;each(volumes,x=>{if(Number(x.value)!==v)x.value=v});each(volumeValues,x=>x.textContent=`${Math.round(v)}%`)};
  each(volumes,v=>v.addEventListener('input',()=>setVolume(v.value)));
  const setStyle=style=>{
    m.dataset.playerStyle=style;
    m.querySelectorAll('.boombox-view').forEach(v=>v.hidden=!v.classList.contains(`boombox-view--${style}`));
    styleMenu.hidden=true;
    const needs={
      compact:{w:330,h:170,defaultW:390,defaultH:190},
      music:{w:270,h:330,defaultW:330,defaultH:430},
      ipod:{w:260,h:330,defaultW:300,defaultH:390},
      vinyl:{w:280,h:380,defaultW:320,defaultH:440}
    }[style];
    if(needs){
      m.style.minWidth=`${needs.w}px`;
      m.style.minHeight=`${needs.h}px`;
      const rect={width:m.offsetWidth,height:m.offsetHeight};
      if(style==='compact'){
        m.style.width=`${needs.defaultW}px`;
        m.style.height=`${needs.defaultH}px`;
      }else{
        if(rect.width<needs.w)m.style.width=`${needs.defaultW}px`;
        if(rect.height<needs.h)m.style.height=`${needs.defaultH}px`;
      }
    }
    if(style==='vinyl')requestAnimationFrame(()=>m.querySelectorAll('.vinyl-label .boombox-title').forEach(fitVinylTitle));
  };
  styleButton.addEventListener('click',e=>{e.stopPropagation();styleMenu.hidden=!styleMenu.hidden});
  styleMenu.querySelectorAll('[data-player-style-option]').forEach(b=>b.addEventListener('click',()=>setStyle(b.dataset.playerStyleOption)));
  document.addEventListener('pointerdown',m._boomboxOutside=e=>{if(!m.contains(e.target))styleMenu.hidden=true});
  audio.addEventListener('play',renderPlay);audio.addEventListener('pause',renderPlay);audio.addEventListener('loadedmetadata',syncProgress);audio.addEventListener('timeupdate',syncProgress);
  const boomboxResizeObserver=new ResizeObserver(()=>{
    if(m.dataset.playerStyle==='vinyl')m.querySelectorAll('.vinyl-label .boombox-title').forEach(fitVinylTitle);
  });
  boomboxResizeObserver.observe(m);
  setVolume(55);setStyle('compact');load(0,false);
  const prior=m._cleanup;m._cleanup=()=>{prior?.();boomboxResizeObserver.disconnect();document.removeEventListener('pointerdown',m._boomboxOutside);audio.pause();audio.removeAttribute('src');audio.load()}
}

function setupTextBubble(m){
  const text=m.querySelector('.textbubble-text');m.querySelector('.textbubble-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));m.querySelector('.textbubble-font').addEventListener('click',()=>{cycleData(m,'font',FONT_OPTIONS);requestAnimationFrame(()=>text.dispatchEvent(new Event('input')))});m.querySelector('.textbubble-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));const cleanup=fitEditableText(text,m,'--bubble-size');m._cleanup=cleanup
}


const VISUAL_SCHEDULE_ICONS=[
  {src:'assets/schedule-icons/15.png',label:'Lunch'},
  {src:'assets/schedule-icons/16.png',label:'Math'},
  {src:'assets/schedule-icons/17.png',label:'Reading'},
  {src:'assets/schedule-icons/18.png',label:'Recess'},
  {src:'assets/schedule-icons/19.png',label:'Science'},
  {src:'assets/schedule-icons/20.png',label:'Celebration'},
  {src:'assets/schedule-icons/21.png',label:'Morning'},
  {src:'assets/schedule-icons/22.png',label:'Arrival'},
  {src:'assets/schedule-icons/23.png',label:'Spanish'},
  {src:'assets/schedule-icons/24.png',label:'Writing'},
  {src:'assets/schedule-icons/25.png',label:'Art'},
  {src:'assets/schedule-icons/26.png',label:'PE'},
  {src:'assets/schedule-icons/27.png',label:'Rest'},
  {src:'assets/schedule-icons/28.png',label:'Computer'},
  {src:'assets/schedule-icons/29.png',label:'Music'}
];



function setupDate(m){
  const display=m.querySelector('.date-display');
  const weekday=m.querySelector('.date-weekday');
  const main=m.querySelector('.date-main');
  const year=m.querySelector('.date-year');
  const styleBtn=m.querySelector('.date-style');
  const layoutBtn=m.querySelector('.date-layout');
  const weekdayBtn=m.querySelector('.date-weekday-toggle');
  const yearBtn=m.querySelector('.date-year-toggle');

  let fitFrame=0;

  const fit=()=>{
    cancelAnimationFrame(fitFrame);
    fitFrame=requestAnimationFrame(()=>{
      const availableWidth=Math.max(40,m.clientWidth-24);
      const availableHeight=Math.max(40,m.clientHeight-34);

      let lo=10,hi=700,best=10;
      for(let i=0;i<18;i++){
        const mid=(lo+hi)/2;
        m.style.setProperty('--date-size',`${mid}px`);
        const fits=display.scrollWidth<=availableWidth+1&&display.scrollHeight<=availableHeight+1;
        if(fits){best=mid;lo=mid}else hi=mid;
      }
      m.style.setProperty('--date-size',`${Math.max(10,best*.97)}px`);
    });
  };

  const render=()=>{
    const d=new Date();
    const numeric=m.dataset.dateStyle==='numbers';
    const horizontal=m.dataset.dateLayout==='horizontal';
    const showWeekday=m.dataset.showWeekday!=='false';
    const showYear=m.dataset.showYear!=='false';

    m.classList.toggle('is-numeric',numeric);
    m.classList.toggle('is-horizontal',horizontal);

    weekday.hidden=!showWeekday;
    year.hidden=numeric||!showYear;

    const weekdayText=new Intl.DateTimeFormat([],{weekday:'long'}).format(d);
    const monthDayText=new Intl.DateTimeFormat([],{month:'long',day:'numeric'}).format(d);
    const numericText=new Intl.DateTimeFormat([],{month:'2-digit',day:'2-digit',year:'numeric'}).format(d);

    if(horizontal&&!numeric){
      weekday.textContent=showWeekday?`${weekdayText},`:'';
      main.textContent=showYear?`${monthDayText},`:monthDayText;
      year.textContent=String(d.getFullYear());
    }else{
      weekday.textContent=weekdayText.toUpperCase();
      main.textContent=numeric?numericText:monthDayText;
      year.textContent=String(d.getFullYear());
    }

    styleBtn.textContent=numeric?'Numbers':'Text';
    layoutBtn.textContent=horizontal?'Horizontal':'Stacked';

    weekdayBtn.classList.toggle('is-active',showWeekday);
    yearBtn.classList.toggle('is-active',showYear);
    yearBtn.disabled=numeric;
    yearBtn.hidden=numeric;
    yearBtn.setAttribute('aria-disabled',String(numeric));

    fit();
  };

  styleBtn.addEventListener('click',()=>{
    m.dataset.dateStyle=m.dataset.dateStyle==='numbers'?'text':'numbers';
    render();
  });

  layoutBtn.addEventListener('click',()=>{
    m.dataset.dateLayout=m.dataset.dateLayout==='horizontal'?'stacked':'horizontal';
    render();
  });

  weekdayBtn.addEventListener('click',()=>{
    m.dataset.showWeekday=m.dataset.showWeekday==='false'?'true':'false';
    render();
  });

  yearBtn.addEventListener('click',()=>{
    if(m.dataset.dateStyle==='numbers')return;
    m.dataset.showYear=m.dataset.showYear==='false'?'true':'false';
    render();
  });

  m.querySelector('.date-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.date-font').addEventListener('click',()=>{
    cycleData(m,'font',FONT_OPTIONS);
    fit();
  });
  m.querySelector('.date-text').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  const observer=new ResizeObserver(fit);
  observer.observe(m);
  observer.observe(display);

  const id=setInterval(render,30*1000);
  render();

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    clearInterval(id);
    cancelAnimationFrame(fitFrame);
    observer.disconnect();
  };
}

const CALENDAR_STORAGE_KEY='teachertiles-calendar-events-v1';

function getStoredCalendarEvents(){
  try{
    const parsed=JSON.parse(localStorage.getItem(CALENDAR_STORAGE_KEY)||'[]');
    return Array.isArray(parsed)?parsed:[];
  }catch{
    return [];
  }
}

function saveStoredCalendarEvents(events){
  try{localStorage.setItem(CALENDAR_STORAGE_KEY,JSON.stringify(events))}catch{}
}

function calendarDateKey(date){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function calendarObservedDate(date){
  const d=new Date(date);
  if(d.getDay()===6)d.setDate(d.getDate()-1);
  if(d.getDay()===0)d.setDate(d.getDate()+1);
  return d;
}

function nthWeekdayOfMonth(year,month,weekday,n){
  const d=new Date(year,month,1);
  const offset=(weekday-d.getDay()+7)%7;
  d.setDate(1+offset+(n-1)*7);
  return d;
}

function lastWeekdayOfMonth(year,month,weekday){
  const d=new Date(year,month+1,0);
  const offset=(d.getDay()-weekday+7)%7;
  d.setDate(d.getDate()-offset);
  return d;
}

function usCalendarHolidays(year){
  const rows=[];
  const add=(date,title)=>rows.push({date:calendarDateKey(date),title,type:'holiday',builtIn:true});

  add(new Date(year,0,1),"New Year's Day");
  add(nthWeekdayOfMonth(year,0,1,3),'Martin Luther King Jr. Day');
  add(nthWeekdayOfMonth(year,1,1,3),"Presidents' Day");
  add(lastWeekdayOfMonth(year,4,1),'Memorial Day');
  add(new Date(year,5,19),'Juneteenth');
  add(new Date(year,6,4),'Independence Day');
  add(nthWeekdayOfMonth(year,8,1,1),'Labor Day');
  add(nthWeekdayOfMonth(year,9,1,2),'Columbus Day');
  add(new Date(year,10,11),"Veterans Day");
  add(nthWeekdayOfMonth(year,10,4,4),'Thanksgiving');
  add(new Date(year,11,25),'Christmas Day');

  [
    [new Date(year,0,1),"New Year's Day (Observed)"],
    [new Date(year,5,19),'Juneteenth (Observed)'],
    [new Date(year,6,4),'Independence Day (Observed)'],
    [new Date(year,10,11),"Veterans Day (Observed)"],
    [new Date(year,11,25),'Christmas Day (Observed)']
  ].forEach(([date,title])=>{
    const observed=calendarObservedDate(date);
    if(observed.getTime()!==date.getTime())add(observed,title);
  });

  return rows;
}

function setupCalendar(m){
  const grid=m.querySelector('.calendar-grid');
  const monthLabel=m.querySelector('.calendar-month');
  const yearLabel=m.querySelector('.calendar-year');
  const prev=m.querySelector('.calendar-prev');
  const next=m.querySelector('.calendar-next');
  const monthButton=m.querySelector('.calendar-month-label');
  const todayButton=m.querySelector('.calendar-today');
  const addButton=m.querySelector('.calendar-add-event');

  const eventPopover=m.querySelector('.calendar-event-popover');
  const eventForm=m.querySelector('.calendar-event-form');
  const eventDate=m.querySelector('.calendar-event-date');
  const eventTitle=m.querySelector('.calendar-event-title');
  const eventType=m.querySelector('.calendar-event-type');
  const eventRecurring=m.querySelector('.calendar-event-recurring');
  const eventClose=m.querySelector('.calendar-event-close');

  const dayPopover=m.querySelector('.calendar-day-popover');
  const dayPopoverTitle=m.querySelector('.calendar-day-popover-title');
  const dayPopoverSubtitle=m.querySelector('.calendar-day-popover-subtitle');
  const dayEvents=m.querySelector('.calendar-day-events');
  const dayClose=m.querySelector('.calendar-day-popover-close');
  const dayAdd=m.querySelector('.calendar-day-add');

  const now=new Date();
  let viewYear=now.getFullYear();
  let viewMonth=now.getMonth();
  let selectedDate=calendarDateKey(now);
  let events=getStoredCalendarEvents();

  const allEventsForYear=year=>[...events,...usCalendarHolidays(year)];

  const eventMatchesDate=(event,dateKey)=>{
    if(event.recurring){
      return event.date.slice(5)===dateKey.slice(5);
    }
    return event.date===dateKey;
  };

  const eventsForDate=dateKey=>{
    const y=Number(dateKey.slice(0,4));
    return allEventsForYear(y).filter(event=>eventMatchesDate(event,dateKey));
  };

  const closeEventPopover=()=>eventPopover.hidden=true;
  const closeDayPopover=()=>dayPopover.hidden=true;

  const openEventPopover=(dateKey=selectedDate)=>{
    selectedDate=dateKey||selectedDate;
    eventDate.value=selectedDate;
    eventTitle.value='';
    eventType.value='event';
    eventRecurring.checked=false;
    eventPopover.hidden=false;
    closeDayPopover();
    requestAnimationFrame(()=>eventTitle.focus({preventScroll:true}));
  };

  const deleteEvent=id=>{
    events=events.filter(event=>event.id!==id);
    saveStoredCalendarEvents(events);
    render();
    openDayPopover(selectedDate);
  };

  const openDayPopover=dateKey=>{
    selectedDate=dateKey;
    const d=new Date(`${dateKey}T12:00:00`);
    dayPopoverTitle.textContent=new Intl.DateTimeFormat([],{weekday:'long',month:'long',day:'numeric'}).format(d);
    dayPopoverSubtitle.textContent=String(d.getFullYear());
    dayEvents.innerHTML='';

    const rows=eventsForDate(dateKey);
    if(!rows.length){
      const empty=document.createElement('div');
      empty.className='calendar-day-empty';
      empty.textContent='Nothing added yet.';
      dayEvents.appendChild(empty);
    }else{
      rows.forEach(event=>{
        const row=document.createElement('div');
        row.className=`calendar-day-event calendar-day-event--${event.type||'event'}`;

        const dot=document.createElement('span');
        dot.className='calendar-day-event-dot';

        const copy=document.createElement('div');
        copy.className='calendar-day-event-copy';
        const strong=document.createElement('strong');
        strong.textContent=event.title;
        const small=document.createElement('small');
        if(event.type==='birthday')small.textContent=event.recurring?'Birthday • repeats yearly':'Birthday';
        else if(event.type==='holiday')small.textContent='Holiday';
        else if(event.type==='reminder')small.textContent=event.recurring?'Reminder • repeats yearly':'Reminder';
        else small.textContent=event.recurring?'Event • repeats yearly':'Event';
        copy.append(strong,small);

        row.append(dot,copy);

        if(!event.builtIn){
          const remove=document.createElement('button');
          remove.type='button';
          remove.className='calendar-day-event-remove';
          remove.setAttribute('aria-label',`Delete ${event.title}`);
          remove.textContent='×';
          remove.addEventListener('click',e=>{
            e.stopPropagation();
            deleteEvent(event.id);
          });
          row.appendChild(remove);
        }

        dayEvents.appendChild(row);
      });
    }

    closeEventPopover();
    dayPopover.hidden=false;
  };

  const render=()=>{
    monthLabel.textContent=new Intl.DateTimeFormat([],{month:'long'}).format(new Date(viewYear,viewMonth,1));
    yearLabel.textContent=String(viewYear);
    grid.innerHTML='';

    const firstDay=new Date(viewYear,viewMonth,1).getDay();
    const daysInMonth=new Date(viewYear,viewMonth+1,0).getDate();
    const prevMonthDays=new Date(viewYear,viewMonth,0).getDate();
    const todayKey=calendarDateKey(new Date());

    for(let cellIndex=0;cellIndex<42;cellIndex++){
      let date;
      let outside=false;

      if(cellIndex<firstDay){
        date=new Date(viewYear,viewMonth-1,prevMonthDays-firstDay+cellIndex+1);
        outside=true;
      }else if(cellIndex>=firstDay+daysInMonth){
        date=new Date(viewYear,viewMonth+1,cellIndex-firstDay-daysInMonth+1);
        outside=true;
      }else{
        date=new Date(viewYear,viewMonth,cellIndex-firstDay+1);
      }

      const dateKey=calendarDateKey(date);
      const rows=eventsForDate(dateKey);
      const button=document.createElement('button');
      button.type='button';
      button.className='calendar-day';
      button.dataset.date=dateKey;
      button.setAttribute('role','gridcell');
      if(outside)button.classList.add('is-outside');
      if(dateKey===todayKey)button.classList.add('is-today');
      if(dateKey===selectedDate)button.classList.add('is-selected');

      const number=document.createElement('span');
      number.className='calendar-day-number';
      number.textContent=String(date.getDate());
      button.appendChild(number);

      if(rows.length){
        const dots=document.createElement('span');
        dots.className='calendar-day-dots';
        rows.slice(0,3).forEach(event=>{
          const dot=document.createElement('i');
          dot.className=`calendar-dot calendar-dot--${event.type||'event'}`;
          dots.appendChild(dot);
        });
        button.appendChild(dots);

        const firstLabel=document.createElement('span');
        firstLabel.className='calendar-day-label';
        firstLabel.textContent=rows[0].title;
        button.appendChild(firstLabel);
      }

      button.addEventListener('click',()=>{
        const target=new Date(`${dateKey}T12:00:00`);
        if(target.getMonth()!==viewMonth||target.getFullYear()!==viewYear){
          viewMonth=target.getMonth();
          viewYear=target.getFullYear();
        }
        selectedDate=dateKey;
        render();
        openDayPopover(dateKey);
      });

      grid.appendChild(button);
    }
  };

  prev.addEventListener('click',()=>{
    viewMonth--;
    if(viewMonth<0){viewMonth=11;viewYear--}
    closeDayPopover();
    closeEventPopover();
    render();
  });

  next.addEventListener('click',()=>{
    viewMonth++;
    if(viewMonth>11){viewMonth=0;viewYear++}
    closeDayPopover();
    closeEventPopover();
    render();
  });

  const goToday=()=>{
    const d=new Date();
    viewYear=d.getFullYear();
    viewMonth=d.getMonth();
    selectedDate=calendarDateKey(d);
    closeDayPopover();
    closeEventPopover();
    render();
  };

  todayButton.addEventListener('click',goToday);
  monthButton.addEventListener('click',goToday);
  addButton.addEventListener('click',()=>openEventPopover(selectedDate));
  dayAdd.addEventListener('click',()=>openEventPopover(selectedDate));
  eventClose.addEventListener('click',closeEventPopover);
  dayClose.addEventListener('click',closeDayPopover);

  eventPopover.addEventListener('pointerdown',e=>{
    if(e.target===eventPopover)closeEventPopover();
  });
  dayPopover.addEventListener('pointerdown',e=>{
    if(e.target===dayPopover)closeDayPopover();
  });

  eventForm.addEventListener('submit',e=>{
    e.preventDefault();
    const title=eventTitle.value.trim();
    const date=eventDate.value;
    if(!title||!date)return;

    events.push({
      id:`evt-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      date,
      title,
      type:eventType.value,
      recurring:eventRecurring.checked
    });
    saveStoredCalendarEvents(events);

    const d=new Date(`${date}T12:00:00`);
    viewYear=d.getFullYear();
    viewMonth=d.getMonth();
    selectedDate=date;
    closeEventPopover();
    render();
    openDayPopover(date);
  });

  m.querySelector('.calendar-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.calendar-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.calendar-text').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  render();
}

function setupProgressBar(m){
  const remaining=m.querySelector('.progress-bar-remaining');
  const endLabel=m.querySelector('.progress-bar-end-label');
  const track=m.querySelector('.progress-bar-track');
  const fill=m.querySelector('.progress-bar-fill');
  const endInput=m.querySelector('.progress-bar-end-time');
  const setEndButton=m.querySelector('.progress-bar-set-end');
  const orientationButton=m.querySelector('.progress-bar-orientation');
  const styleButton=m.querySelector('.progress-bar-style');
  const iconStart=m.querySelector('.progress-bar-icon-start');
  const iconEnd=m.querySelector('.progress-bar-icon-end');
  const picker=m.querySelector('.progress-bar-picker');
  const pickerGrid=m.querySelector('.progress-bar-picker__grid');
  const pickerClose=m.querySelector('.progress-bar-picker__close');

  const colors=['blue','green','amber','rose','purple','aqua'];
  const styles=[
    {key:'glass',label:'Glass'},
    {key:'striped',label:'Striped'},
    {key:'segmented',label:'Segments'},
    {key:'soft',label:'Soft'}
  ];

  let initializedAt=Date.now();
  let targetAt=initializedAt+60*60*1000;
  let activeIconSlot=null;
  let interval=0;
  let completed=false;

  const pad=n=>String(n).padStart(2,'0');
  const formatInputTime=date=>`${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const formatClock=date=>date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});

  const formatRemaining=ms=>{
    const total=Math.max(0,Math.ceil(ms/1000));
    const hours=Math.floor(total/3600);
    const minutes=Math.floor((total%3600)/60);
    const seconds=total%60;
    return hours>0?`${hours}:${pad(minutes)}:${pad(seconds)}`:`${pad(minutes)}:${pad(seconds)}`;
  };

  const setSlotIcon=(slot,icon)=>{
    const image=slot.querySelector('img');
    image.src=icon.src;
    image.alt=icon.label;
    slot.dataset.iconSrc=icon.src;
    slot.classList.add('has-icon');
  };

  const refreshPickerSelection=()=>{
    const current=activeIconSlot?.dataset.iconSrc||'';
    pickerGrid.querySelectorAll('.progress-bar-icon-option').forEach(button=>{
      button.classList.toggle('is-selected',button.dataset.iconSrc===current);
    });
  };

  const openPicker=slot=>{
    activeIconSlot=slot;
    refreshPickerSelection();
    picker.hidden=false;
    requestAnimationFrame(()=>pickerClose.focus({preventScroll:true}));
  };

  const closePicker=()=>{
    picker.hidden=true;
    activeIconSlot=null;
  };

  VISUAL_SCHEDULE_ICONS.forEach(icon=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='progress-bar-icon-option';
    button.dataset.iconSrc=icon.src;
    button.setAttribute('aria-label',`Use ${icon.label} image`);

    const image=document.createElement('img');
    image.src=icon.src;
    image.alt='';
    image.draggable=false;

    const caption=document.createElement('span');
    caption.textContent=icon.label;

    button.append(image,caption);
    button.addEventListener('click',()=>{
      if(activeIconSlot)setSlotIcon(activeIconSlot,icon);
      closePicker();
    });
    pickerGrid.appendChild(button);
  });

  const render=()=>{
    const now=Date.now();
    const duration=Math.max(1,targetAt-initializedAt);
    const elapsed=Math.max(0,now-initializedAt);
    const progress=clamp(elapsed/duration,0,1);

    const vertical=m.dataset.orientation==='vertical';
    const trackLength=vertical?track.clientHeight:track.clientWidth;
    const trueLength=Math.max(0,trackLength*progress);
    const visibleLength=progress>0&&progress<1?Math.max(6,trueLength):trueLength;

    if(vertical){
      fill.style.width='';
      fill.style.height=`${Math.min(trackLength,visibleLength)}px`;
    }else{
      fill.style.height='';
      fill.style.width=`${Math.min(trackLength,visibleLength)}px`;
    }

    m.style.setProperty('--progress',`${(progress*100).toFixed(4)}%`);
    remaining.textContent=formatRemaining(targetAt-now);
    endLabel.textContent=`until ${formatClock(new Date(targetAt))}`;

    const isComplete=progress>=1;
    m.classList.toggle('is-complete',isComplete);
    if(isComplete&&!completed){
      completed=true;
      playUiSfx('click');
    }else if(!isComplete){
      completed=false;
    }
  };

  const initializeFromInput=()=>{
    if(!endInput.value)return;
    const [hour,minute]=endInput.value.split(':').map(Number);
    if(!Number.isFinite(hour)||!Number.isFinite(minute))return;

    const now=new Date();
    const target=new Date(now);
    target.setHours(hour,minute,0,0);
    if(target.getTime()<=now.getTime())target.setDate(target.getDate()+1);

    initializedAt=Date.now();
    targetAt=target.getTime();
    completed=false;
    m.classList.remove('is-complete');
    render();
  };

  const setOrientation=orientation=>{
    const vertical=orientation==='vertical';
    m.dataset.orientation=orientation;
    orientationButton.textContent=vertical?'↕':'↔';
    orientationButton.title=vertical?'Switch to horizontal':'Switch to vertical';

    const centerX=m.offsetLeft+m.offsetWidth/2;
    const centerY=m.offsetTop+m.offsetHeight/2;

    if(vertical){
      m.style.width='250px';
      m.style.height='700px';
    }else{
      m.style.width='760px';
      m.style.height='190px';
    }

    const w=m.offsetWidth,h=m.offsetHeight;
    m.style.left=`${clamp(centerX-w/2,0,BOARD_WIDTH-w)}px`;
    m.style.top=`${clamp(centerY-h/2,0,BOARD_HEIGHT-h)}px`;
    render();
    updateWorkspaceEmptyState();
  };

  const cycleStyle=()=>{
    const current=m.dataset.barStyle||'glass';
    const index=styles.findIndex(option=>option.key===current);
    const next=styles[(index+1)%styles.length];
    m.dataset.barStyle=next.key;
    styleButton.textContent=next.label;
  };

  m.querySelector('.progress-bar-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.progress-bar-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.progress-bar-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));
  m.querySelector('.progress-bar-color').addEventListener('click',()=>cycleData(m,'barColor',colors));

  setEndButton.addEventListener('click',initializeFromInput);
  endInput.addEventListener('keydown',e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      initializeFromInput();
      endInput.blur();
    }
  });

  orientationButton.addEventListener('click',()=>{
    setOrientation(m.dataset.orientation==='vertical'?'horizontal':'vertical');
  });
  styleButton.addEventListener('click',cycleStyle);

  iconStart.addEventListener('click',()=>openPicker(iconStart));
  iconEnd.addEventListener('click',()=>openPicker(iconEnd));
  pickerClose.addEventListener('click',closePicker);
  picker.addEventListener('pointerdown',e=>{
    if(e.target===picker)closePicker();
  });
  picker.addEventListener('wheel',e=>{
    e.preventDefault();
    e.stopPropagation();
    pickerGrid.scrollTop+=e.deltaY;
  },{passive:false});

  const defaultEnd=new Date(Date.now()+30*60*1000);
  endInput.value=formatInputTime(defaultEnd);
  initializeFromInput();

  interval=window.setInterval(render,200);
  render();

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    window.clearInterval(interval);
  };
}

function setupVisualSchedule(m){
  const list=m.querySelector('.visual-schedule-list');
  const add=m.querySelector('.visual-schedule-add');
  const picker=m.querySelector('.visual-schedule-picker');
  const pickerGrid=m.querySelector('.visual-schedule-picker__grid');
  const pickerClose=m.querySelector('.visual-schedule-picker__close');
  let activeSegment=null;
  let autoSizeFrame=0;
  let lastObservedWidth=0;

  m.querySelector('.visual-schedule-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.visual-schedule-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.visual-schedule-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  const autoSize=()=>{
    cancelAnimationFrame(autoSizeFrame);
    autoSizeFrame=requestAnimationFrame(()=>{
      const top=m.offsetTop;
      m.style.height='auto';
      const desired=Math.ceil(m.scrollHeight);
      const maxHeight=Math.max(parseFloat(getComputedStyle(m).minHeight)||250,BOARD_HEIGHT-top);
      m.style.height=`${Math.min(desired,maxHeight)}px`;
    });
  };

  const closePicker=()=>{
    picker.hidden=true;
    activeSegment=null;
  };

  const refreshPickerSelection=()=>{
    const current=activeSegment?.dataset.iconSrc||'';
    pickerGrid.querySelectorAll('.visual-schedule-icon-option').forEach(button=>{
      button.classList.toggle('is-selected',button.dataset.iconSrc===current);
    });
  };

  VISUAL_SCHEDULE_ICONS.forEach(icon=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='visual-schedule-icon-option';
    button.dataset.iconSrc=icon.src;
    button.setAttribute('aria-label',`Use ${icon.label} image`);
    const image=document.createElement('img');
    image.src=icon.src;
    image.alt='';
    image.draggable=false;
    const caption=document.createElement('span');
    caption.textContent=icon.label;
    button.append(image,caption);
    button.addEventListener('click',()=>{
      if(!activeSegment)return;
      const targetImage=activeSegment.querySelector('.visual-schedule-image img');
      targetImage.src=icon.src;
      targetImage.alt=icon.label;
      activeSegment.dataset.iconSrc=icon.src;
      closePicker();
    });
    pickerGrid.appendChild(button);
  });

  const openPicker=segment=>{
    activeSegment=segment;
    refreshPickerSelection();
    picker.hidden=false;
    requestAnimationFrame(()=>pickerClose.focus({preventScroll:true}));
  };

  pickerClose.addEventListener('click',closePicker);
  picker.addEventListener('pointerdown',e=>{
    if(e.target===picker)closePicker();
  });
  picker.addEventListener('wheel',e=>{
    e.stopPropagation();
  },{passive:true});

  const addSegment=(data={},focus=false)=>{
    const icon=VISUAL_SCHEDULE_ICONS[data.iconIndex??(list.children.length%VISUAL_SCHEDULE_ICONS.length)];
    const row=document.createElement('div');
    row.className='visual-schedule-segment';
    row.dataset.iconSrc=icon.src;
    row.innerHTML=`
      <button class="visual-schedule-image" type="button" aria-label="Change segment image" title="Change image">
        <img src="${icon.src}" alt="${icon.label}" draggable="false">
      </button>
      <input class="visual-schedule-segment-title" type="text" aria-label="Activity title">
      <input class="visual-schedule-segment-time" type="text" aria-label="Activity time">
      <div class="visual-schedule-segment-actions">
        <button class="visual-schedule-complete" type="button" aria-pressed="false">Complete</button>
        <button class="visual-schedule-remove" type="button" aria-label="Remove segment" title="Remove segment">×</button>
      </div>
    `;
    const title=row.querySelector('.visual-schedule-segment-title');
    const time=row.querySelector('.visual-schedule-segment-time');
    title.value=data.title??'New Activity';
    time.value=data.time??'';
    row.classList.toggle('is-complete',Boolean(data.complete));
    const completeButton=row.querySelector('.visual-schedule-complete');
    const syncCompleteButton=()=>{
      const complete=row.classList.contains('is-complete');
      completeButton.textContent=complete?'Undo':'Complete';
      completeButton.setAttribute('aria-pressed',String(complete));
      completeButton.title=complete?'Mark segment incomplete':'Mark segment complete';
    };
    syncCompleteButton();

    completeButton.addEventListener('click',()=>{
      row.classList.toggle('is-complete');
      syncCompleteButton();
    });
    row.querySelector('.visual-schedule-image').addEventListener('click',()=>openPicker(row));
    row.querySelector('.visual-schedule-remove').addEventListener('click',()=>{
      if(activeSegment===row)closePicker();
      row.remove();
      autoSize();
    });

    list.appendChild(row);
    autoSize();
    if(focus)requestAnimationFrame(()=>{title.focus();title.select()});
  };

  add.addEventListener('click',()=>addSegment({},true));

  addSegment({title:'Arrival',time:'8:00 AM',iconIndex:7});
  addSegment({title:'Morning Work',time:'8:15 AM',iconIndex:6});
  addSegment({title:'Reading',time:'9:00 AM',iconIndex:2});

  const resizeObserver=new ResizeObserver(entries=>{
    const width=entries[0]?.contentRect.width||m.offsetWidth;
    if(Math.abs(width-lastObservedWidth)>1){
      lastObservedWidth=width;
      autoSize();
    }
  });
  resizeObserver.observe(m);

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    cancelAnimationFrame(autoSizeFrame);
    resizeObserver.disconnect();
  };

  autoSize();
}

function setupTodo(m){
  const list=m.querySelector('.todo-list'),add=m.querySelector('.todo-add');
  m.querySelector('.todo-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));m.querySelector('.todo-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));m.querySelector('.todo-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));
  const addRow=(value='New step')=>{const row=document.createElement('div');row.className='todo-row';row.innerHTML='<input class="todo-check" type="checkbox" aria-label="Complete step"><input class="todo-item-text" type="text" aria-label="Checklist step"><button class="todo-remove" type="button" aria-label="Remove step">×</button>';const check=row.querySelector('.todo-check'),text=row.querySelector('.todo-item-text');text.value=value;check.addEventListener('change',()=>row.classList.toggle('is-done',check.checked));row.querySelector('.todo-remove').addEventListener('click',()=>row.remove());list.appendChild(row);requestAnimationFrame(()=>{text.focus();text.select()})};
  add.addEventListener('click',()=>addRow());addRow('First step');
}

workspace.addEventListener('dragover',e=>{const types=[...e.dataTransfer.types];if(types.includes('Files')||types.includes('text/uri-list')||types.includes('text/html')||types.includes('text/plain'))e.preventDefault()});
workspace.addEventListener('drop',e=>{if(e.target.closest('.image-module'))return;const src=getDraggedImageSource(e.dataTransfer);if(!src)return;e.preventDefault();const p=screenToBoard(e.clientX,e.clientY);const m=createModule('image',p.x,p.y);if(src.file)m?._setImage?.(src.file);else if(src.url)m?._setImageUrl?.(src.url)});

const THEME_STORAGE_KEY='modular-space-theme';
const TEACHERTILES_THEMES=new Set([
  'light','dark','gray',
  'pastel-red','pastel-yellow','pastel-green','pastel-blue','pastel-lilac',
  'programmer-green','programmer-red','programmer-yellow','programmer-blue',
  'wood-oak','wood-spruce','wood-redwood','wood-cherry'
]);
const THEME_BODY_CLASSES=[
  'dark','theme-gray',
  'theme-pastel-red','theme-pastel-yellow','theme-pastel-green','theme-pastel-blue','theme-pastel-lilac',
  'theme-programmer-green','theme-programmer-red','theme-programmer-yellow','theme-programmer-blue',
  'theme-wood-oak','theme-wood-spruce','theme-wood-redwood','theme-wood-cherry'
];

function updateThemeControls(theme){
  const current=TEACHERTILES_THEMES.has(theme)?theme:'light';
  document.querySelectorAll('[data-theme-choice]').forEach(card=>{
    const selected=card.dataset.themeChoice===current;
    card.classList.toggle('is-selected',selected);
    card.setAttribute('aria-pressed',String(selected));
  });
}

function applyTeacherTheme(theme,{persist=true}={}){
  const next=TEACHERTILES_THEMES.has(theme)?theme:'light';
  document.body.classList.remove(...THEME_BODY_CLASSES);
  if(next==='dark')document.body.classList.add('dark');
  else if(next==='gray')document.body.classList.add('theme-gray');
  else if(next.startsWith('pastel-')||next.startsWith('programmer-')||next.startsWith('wood-'))document.body.classList.add(`theme-${next}`);
  document.body.dataset.theme=next;
  document.documentElement.style.colorScheme=(next==='dark'||next.startsWith('programmer-'))?'dark':'light';
  if(persist)localStorage.setItem(THEME_STORAGE_KEY,next);
  updateThemeControls(next);
}

const savedTheme=localStorage.getItem(THEME_STORAGE_KEY);
applyTeacherTheme(TEACHERTILES_THEMES.has(savedTheme)?savedTheme:'light',{persist:false});

fullscreenToggle.addEventListener('click',async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch{}});
document.addEventListener('fullscreenchange',()=>{fullscreenToggle.childNodes[0].nodeValue=document.fullscreenElement?'↙':'⛶'});
window.addEventListener('resize',()=>document.querySelectorAll('.module').forEach(m=>{m.style.left=`${clamp(m.offsetLeft,0,Math.max(0,BOARD_WIDTH-m.offsetWidth))}px`;m.style.top=`${clamp(m.offsetTop,0,Math.max(0,BOARD_HEIGHT-m.offsetHeight))}px`}));

function createStickerModule({src='',emoji='',name='Sticker',aspect=1},clientX,clientY){
  if(!src&&!emoji)return null;
  const p=screenToBoard(clientX,clientY);
  const ratio=emoji?1:(Number.isFinite(aspect)&&aspect>0?aspect:1);
  let width=180,height=180;
  if(ratio>=1){width=ratio>2?230:180;height=width/ratio}else{height=180;width=height*ratio}
  width=Math.max(64,width);
  height=Math.max(64,height);
  const m=document.createElement('section');
  m.className='module sticker-module sticker-placed';
  m.dataset.type='sticker';
  m.dataset.stickerRotation='0';
  m._stickerRatio=ratio;
  m.setAttribute('aria-label',`${name||'Sticker'} sticker`);
  m.style.width=`${width}px`;
  m.style.height=`${height}px`;
  m.style.left=`${clamp(p.x-width/2,0,BOARD_WIDTH-width)}px`;
  m.style.top=`${clamp(p.y-height/2,0,BOARD_HEIGHT-height)}px`;

  const drag=document.createElement('div');
  drag.className='module-drag-handle';
  drag.setAttribute('aria-hidden','true');
  const del=document.createElement('button');
  del.className='module-delete';del.type='button';del.setAttribute('aria-label','Delete sticker');del.textContent='×';
  const art=document.createElement('div');art.className='sticker-art';
  const visual=document.createElement('div');visual.className=`sticker-visual${emoji?' sticker-visual--emoji':''}`;
  if(emoji){
    const glyph=document.createElement('span');
    glyph.className='sticker-emoji';glyph.setAttribute('aria-hidden','true');glyph.textContent=emoji;
    visual.appendChild(glyph);
  }else{
    const img=document.createElement('img');img.src=src;img.alt=name||'Sticker';img.draggable=false;
    visual.appendChild(img);
  }
  art.appendChild(visual);
  const pop=document.createElement('span');pop.className='sticker-stick-pop';pop.setAttribute('aria-hidden','true');
  m.append(drag,del,art,pop);
  workspace.appendChild(m);
  bringToFront(m);
  setupCommon(m);
  setupStickerTransformControls(m);
  setTimeout(()=>m.classList.remove('sticker-placed'),620);
  return m;
}

function setupShelfStickerDrag(item,shelfShell){
  if(!item||item.dataset.stickerDragReady)return;
  item.dataset.stickerDragReady='true';
  item.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    const src=item.dataset.stickerSrc||'';
    const emoji=item.dataset.stickerEmoji||'';
    const name=item.dataset.stickerName||'Sticker';
    const preview=item.querySelector('img');
    const aspect=emoji?1:(preview?.naturalWidth&&preview?.naturalHeight?preview.naturalWidth/preview.naturalHeight:1);
    if(!src&&!emoji)return;
    e.preventDefault();
    e.stopPropagation();
    item.setPointerCapture(e.pointerId);
    const startX=e.clientX,startY=e.clientY;
    let dragging=false;
    let ghost=null;
    let canDrop=false;

    const ensureGhost=()=>{
      if(ghost)return;
      ghost=document.createElement('div');
      ghost.className=`sticker-drag-ghost${emoji?' sticker-drag-ghost--emoji':''}`;
      if(emoji){
        const glyph=document.createElement('span');glyph.className='sticker-emoji sticker-emoji--ghost';glyph.textContent=emoji;ghost.appendChild(glyph);
      }else{
        const img=document.createElement('img');img.src=src;img.alt='';img.draggable=false;ghost.appendChild(img);
      }
      document.body.appendChild(ghost);
    };
    const updateGhost=ev=>{
      ensureGhost();
      ghost.style.left=`${ev.clientX}px`;
      ghost.style.top=`${ev.clientY}px`;
      const shellRect=shelfShell.getBoundingClientRect();
      const insideShelf=ev.clientX>=shellRect.left&&ev.clientX<=shellRect.right&&ev.clientY>=shellRect.top&&ev.clientY<=shellRect.bottom;
      const blocked=document.elementsFromPoint(ev.clientX,ev.clientY).some(el=>el.closest?.('.workspace-controls,.workspace-upcoming-controls,.context-menu'));
      canDrop=!insideShelf&&!blocked&&ev.clientX>=0&&ev.clientX<=innerWidth&&ev.clientY>=0&&ev.clientY<=innerHeight;
      ghost.classList.toggle('can-drop',canDrop);
    };
    const move=ev=>{
      if(!dragging&&Math.hypot(ev.clientX-startX,ev.clientY-startY)<5)return;
      if(!dragging){
        dragging=true;
        item.classList.add('is-dragging');
        document.body.classList.add('is-dragging-shelf-sticker');
      }
      updateGhost(ev);
    };
    const cleanup=()=>{
      item.classList.remove('is-dragging');
      document.body.classList.remove('is-dragging-shelf-sticker');
      ghost?.remove();
      item.removeEventListener('pointermove',move);
      item.removeEventListener('pointerup',end);
      item.removeEventListener('pointercancel',cancel);
    };
    const end=ev=>{
      if(dragging&&canDrop)createStickerModule({src,emoji,name,aspect},ev.clientX,ev.clientY);
      cleanup();
    };
    const cancel=()=>cleanup();
    item.addEventListener('pointermove',move);
    item.addEventListener('pointerup',end);
    item.addEventListener('pointercancel',cancel);
  });
}

function setupCollectionShelf(){
  const shelf=document.getElementById('asset-shelf');
  const title=document.getElementById('asset-shelf-title');
  const closeButton=document.getElementById('asset-shelf-close');
  const themeButton=document.getElementById('theme-shelf-toggle');
  const stickerButton=document.getElementById('sticker-shelf-toggle');
  const themePanel=document.getElementById('theme-shelf-content');
  const stickerPanel=document.getElementById('sticker-shelf-content');
  const packs=[...document.querySelectorAll('[data-theme-pack]')];
  const stickerPacks=[...document.querySelectorAll('[data-sticker-pack]')];
  const stickerItems=[...document.querySelectorAll('[data-sticker-src],[data-sticker-emoji]')];
  const bottomTray=document.querySelector('.workspace-upcoming-controls');
  const shelfScroll=themePanel?.querySelector('.asset-shelf__scroll');
  const stickerScroll=stickerPanel?.querySelector('.asset-shelf__scroll');
  stickerPanel?.querySelectorAll('.sticker-pack-drawer').forEach(drawer=>drawer.style.setProperty('--sticker-count',String(drawer.querySelectorAll('.sticker-shelf-item').length)));
  const shelfShell=shelf.querySelector('.asset-shelf__shell');
  if(!shelf||!title||!closeButton||!themeButton||!stickerButton||!themePanel||!stickerPanel||!shelfShell||!packs.length)return;

  let activeShelf=null;
  let activePack=null;
  let activeFan=null;
  let activeStickerPack=null;
  let activeStickerDrawer=null;

  const positionThemeFan=()=>{
    if(!activePack||!activeFan||!activeFan.classList.contains('is-open'))return;
    const packRect=activePack.getBoundingClientRect();
    const fanRect=activeFan.getBoundingClientRect();
    const width=fanRect.width||98;
    const height=fanRect.height||318;
    const left=clamp(packRect.left+(packRect.width-width)/2,10,Math.max(10,innerWidth-width-10));
    const top=Math.max(10,packRect.top-height-11);
    activeFan.style.left=`${left}px`;
    activeFan.style.top=`${top}px`;
  };

  const closeThemeFan=()=>{
    if(activePack){
      activePack.classList.remove('is-open');
      activePack.setAttribute('aria-expanded','false');
    }
    if(activeFan){
      activeFan.classList.remove('is-open');
      activeFan.setAttribute('aria-hidden','true');
    }
    activePack=null;
    activeFan=null;
  };

  const toggleThemeFan=pack=>{
    const fanId=pack.getAttribute('aria-controls');
    const fan=fanId?document.getElementById(fanId):null;
    if(!fan)return;
    if(activePack===pack&&fan.classList.contains('is-open')){
      closeThemeFan();
      return;
    }
    closeThemeFan();
    activePack=pack;
    activeFan=fan;
    pack.classList.add('is-open');
    pack.setAttribute('aria-expanded','true');
    fan.classList.add('is-open');
    fan.setAttribute('aria-hidden','false');
    positionThemeFan();
    requestAnimationFrame(positionThemeFan);
  };

  const closeStickerPack=()=>{
    if(activeStickerPack){
      activeStickerPack.classList.remove('is-open');
      activeStickerPack.setAttribute('aria-expanded','false');
    }
    if(activeStickerDrawer){
      activeStickerDrawer.classList.remove('is-open');
      activeStickerDrawer.setAttribute('aria-hidden','true');
    }
    activeStickerPack=null;
    activeStickerDrawer=null;
  };

  const toggleStickerPack=pack=>{
    const drawerId=pack.getAttribute('aria-controls');
    const drawer=drawerId?document.getElementById(drawerId):null;
    if(!drawer)return;
    if(activeStickerPack===pack&&drawer.classList.contains('is-open')){
      closeStickerPack();
      return;
    }
    closeStickerPack();
    activeStickerPack=pack;
    activeStickerDrawer=drawer;
    pack.classList.add('is-open');
    pack.setAttribute('aria-expanded','true');
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden','false');
    requestAnimationFrame(()=>{
      const left=Math.max(0,pack.parentElement.offsetLeft-12);
      stickerScroll?.scrollTo({left,behavior:'smooth'});
    });
  };

  const syncShelfButtons=()=>{
    themeButton.classList.toggle('is-active',activeShelf==='themes');
    stickerButton.classList.toggle('is-active',activeShelf==='stickers');
    themeButton.setAttribute('aria-expanded',String(activeShelf==='themes'));
    stickerButton.setAttribute('aria-expanded',String(activeShelf==='stickers'));
    bottomTray?.classList.toggle('has-shelf-open',Boolean(activeShelf));
  };

  const closeShelf=()=>{
    if(!activeShelf)return;
    activeShelf=null;
    closeThemeFan();
    closeStickerPack();
    shelf.classList.remove('is-open');
    shelf.setAttribute('aria-hidden','true');
    syncShelfButtons();
  };

  const openShelf=type=>{
    if(activeShelf===type){closeShelf();return}
    activeShelf=type;
    closeThemeFan();
    if(type!=='stickers')closeStickerPack();
    const themes=type==='themes';
    themePanel.hidden=!themes;
    stickerPanel.hidden=themes;
    themePanel.classList.toggle('is-active',themes);
    stickerPanel.classList.toggle('is-active',!themes);
    title.textContent=themes?'Themes':'Stickers';
    shelf.classList.add('is-open');
    shelf.setAttribute('aria-hidden','false');
    syncShelfButtons();
  };

  themeButton.addEventListener('click',e=>{e.stopPropagation();openShelf('themes')});
  stickerButton.addEventListener('click',e=>{e.stopPropagation();openShelf('stickers')});
  closeButton.addEventListener('click',closeShelf);
  packs.forEach(pack=>pack.addEventListener('click',e=>{e.stopPropagation();toggleThemeFan(pack)}));
  stickerPacks.forEach(pack=>pack.addEventListener('click',e=>{e.stopPropagation();toggleStickerPack(pack)}));
  stickerItems.forEach(item=>setupShelfStickerDrag(item,shelfShell));

  document.querySelectorAll('.theme-fan [data-theme-choice]').forEach(card=>{
    card.addEventListener('click',()=>applyTeacherTheme(card.dataset.themeChoice));
  });

  shelfScroll?.addEventListener('scroll',positionThemeFan,{passive:true});
  shelfScroll?.addEventListener('wheel',e=>{
    if(shelfScroll.scrollWidth<=shelfScroll.clientWidth)return;
    if(Math.abs(e.deltaY)<=Math.abs(e.deltaX))return;
    shelfScroll.scrollLeft+=e.deltaY;
    e.preventDefault();
  },{passive:false});

  stickerScroll?.addEventListener('wheel',e=>{
    if(stickerScroll.scrollWidth<=stickerScroll.clientWidth)return;
    if(Math.abs(e.deltaY)<=Math.abs(e.deltaX))return;
    stickerScroll.scrollLeft+=e.deltaY;
    e.preventDefault();
  },{passive:false});

  window.addEventListener('resize',positionThemeFan,{passive:true});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&activeShelf)closeShelf()});
  document.addEventListener('pointerdown',e=>{
    if(!activeShelf)return;
    const target=e.target;
    if(!(target instanceof Element))return;
    if(target.closest('#asset-shelf,.theme-fan,.workspace-upcoming-controls'))return;
    closeShelf();
  });

  updateThemeControls(document.body.dataset.theme||'light');
}
setupCollectionShelf();



const PERIODIC_ELEMENTS=[{"n":1,"symbol":"H","name":"Hydrogen","mass":"1.008","period":1,"group":1,"row":1,"col":1,"category":"Reactive nonmetal","categoryKey":"reactive-nonmetal","block":"s"},{"n":2,"symbol":"He","name":"Helium","mass":"4.003","period":1,"group":18,"row":1,"col":18,"category":"Noble gas","categoryKey":"noble-gas","block":"p"},{"n":3,"symbol":"Li","name":"Lithium","mass":"6.941","period":2,"group":1,"row":2,"col":1,"category":"Alkali metal","categoryKey":"alkali-metal","block":"s"},{"n":4,"symbol":"Be","name":"Beryllium","mass":"9.012","period":2,"group":2,"row":2,"col":2,"category":"Alkaline earth metal","categoryKey":"alkaline-earth-metal","block":"s"},{"n":5,"symbol":"B","name":"Boron","mass":"10.812","period":2,"group":13,"row":2,"col":13,"category":"Metalloid","categoryKey":"metalloid","block":"p"},{"n":6,"symbol":"C","name":"Carbon","mass":"12.011","period":2,"group":14,"row":2,"col":14,"category":"Reactive nonmetal","categoryKey":"reactive-nonmetal","block":"p"},{"n":7,"symbol":"N","name":"Nitrogen","mass":"14.007","period":2,"group":15,"row":2,"col":15,"category":"Reactive nonmetal","categoryKey":"reactive-nonmetal","block":"p"},{"n":8,"symbol":"O","name":"Oxygen","mass":"15.999","period":2,"group":16,"row":2,"col":16,"category":"Reactive nonmetal","categoryKey":"reactive-nonmetal","block":"p"},{"n":9,"symbol":"F","name":"Fluorine","mass":"18.998","period":2,"group":17,"row":2,"col":17,"category":"Halogen","categoryKey":"halogen","block":"p"},{"n":10,"symbol":"Ne","name":"Neon","mass":"20.18","period":2,"group":18,"row":2,"col":18,"category":"Noble gas","categoryKey":"noble-gas","block":"p"},{"n":11,"symbol":"Na","name":"Sodium","mass":"22.99","period":3,"group":1,"row":3,"col":1,"category":"Alkali metal","categoryKey":"alkali-metal","block":"s"},{"n":12,"symbol":"Mg","name":"Magnesium","mass":"24.305","period":3,"group":2,"row":3,"col":2,"category":"Alkaline earth metal","categoryKey":"alkaline-earth-metal","block":"s"},{"n":13,"symbol":"Al","name":"Aluminium","mass":"26.982","period":3,"group":13,"row":3,"col":13,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":14,"symbol":"Si","name":"Silicon","mass":"28.086","period":3,"group":14,"row":3,"col":14,"category":"Metalloid","categoryKey":"metalloid","block":"p"},{"n":15,"symbol":"P","name":"Phosphorus","mass":"30.974","period":3,"group":15,"row":3,"col":15,"category":"Reactive nonmetal","categoryKey":"reactive-nonmetal","block":"p"},{"n":16,"symbol":"S","name":"Sulfur","mass":"32.067","period":3,"group":16,"row":3,"col":16,"category":"Reactive nonmetal","categoryKey":"reactive-nonmetal","block":"p"},{"n":17,"symbol":"Cl","name":"Chlorine","mass":"35.453","period":3,"group":17,"row":3,"col":17,"category":"Halogen","categoryKey":"halogen","block":"p"},{"n":18,"symbol":"Ar","name":"Argon","mass":"39.948","period":3,"group":18,"row":3,"col":18,"category":"Noble gas","categoryKey":"noble-gas","block":"p"},{"n":19,"symbol":"K","name":"Potassium","mass":"39.098","period":4,"group":1,"row":4,"col":1,"category":"Alkali metal","categoryKey":"alkali-metal","block":"s"},{"n":20,"symbol":"Ca","name":"Calcium","mass":"40.078","period":4,"group":2,"row":4,"col":2,"category":"Alkaline earth metal","categoryKey":"alkaline-earth-metal","block":"s"},{"n":21,"symbol":"Sc","name":"Scandium","mass":"44.956","period":4,"group":3,"row":4,"col":3,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":22,"symbol":"Ti","name":"Titanium","mass":"47.867","period":4,"group":4,"row":4,"col":4,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":23,"symbol":"V","name":"Vanadium","mass":"50.944","period":4,"group":5,"row":4,"col":5,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":24,"symbol":"Cr","name":"Chromium","mass":"51.996","period":4,"group":6,"row":4,"col":6,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":25,"symbol":"Mn","name":"Manganese","mass":"54.938","period":4,"group":7,"row":4,"col":7,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":26,"symbol":"Fe","name":"Iron","mass":"55.845","period":4,"group":8,"row":4,"col":8,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":27,"symbol":"Co","name":"Cobalt","mass":"58.933","period":4,"group":9,"row":4,"col":9,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":28,"symbol":"Ni","name":"Nickel","mass":"58.693","period":4,"group":10,"row":4,"col":10,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":29,"symbol":"Cu","name":"Copper","mass":"63.546","period":4,"group":11,"row":4,"col":11,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":30,"symbol":"Zn","name":"Zinc","mass":"65.39","period":4,"group":12,"row":4,"col":12,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":31,"symbol":"Ga","name":"Gallium","mass":"69.723","period":4,"group":13,"row":4,"col":13,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":32,"symbol":"Ge","name":"Germanium","mass":"72.61","period":4,"group":14,"row":4,"col":14,"category":"Metalloid","categoryKey":"metalloid","block":"p"},{"n":33,"symbol":"As","name":"Arsenic","mass":"74.922","period":4,"group":15,"row":4,"col":15,"category":"Metalloid","categoryKey":"metalloid","block":"p"},{"n":34,"symbol":"Se","name":"Selenium","mass":"78.96","period":4,"group":16,"row":4,"col":16,"category":"Reactive nonmetal","categoryKey":"reactive-nonmetal","block":"p"},{"n":35,"symbol":"Br","name":"Bromine","mass":"79.904","period":4,"group":17,"row":4,"col":17,"category":"Halogen","categoryKey":"halogen","block":"p"},{"n":36,"symbol":"Kr","name":"Krypton","mass":"83.8","period":4,"group":18,"row":4,"col":18,"category":"Noble gas","categoryKey":"noble-gas","block":"p"},{"n":37,"symbol":"Rb","name":"Rubidium","mass":"85.468","period":5,"group":1,"row":5,"col":1,"category":"Alkali metal","categoryKey":"alkali-metal","block":"s"},{"n":38,"symbol":"Sr","name":"Strontium","mass":"87.62","period":5,"group":2,"row":5,"col":2,"category":"Alkaline earth metal","categoryKey":"alkaline-earth-metal","block":"s"},{"n":39,"symbol":"Y","name":"Yttrium","mass":"88.906","period":5,"group":3,"row":5,"col":3,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":40,"symbol":"Zr","name":"Zirconium","mass":"91.224","period":5,"group":4,"row":5,"col":4,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":41,"symbol":"Nb","name":"Niobium","mass":"92.906","period":5,"group":5,"row":5,"col":5,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":42,"symbol":"Mo","name":"Molybdenum","mass":"95.94","period":5,"group":6,"row":5,"col":6,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":43,"symbol":"Tc","name":"Technetium","mass":"98","period":5,"group":7,"row":5,"col":7,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":44,"symbol":"Ru","name":"Ruthenium","mass":"101.07","period":5,"group":8,"row":5,"col":8,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":45,"symbol":"Rh","name":"Rhodium","mass":"102.906","period":5,"group":9,"row":5,"col":9,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":46,"symbol":"Pd","name":"Palladium","mass":"106.42","period":5,"group":10,"row":5,"col":10,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":47,"symbol":"Ag","name":"Silver","mass":"107.868","period":5,"group":11,"row":5,"col":11,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":48,"symbol":"Cd","name":"Cadmium","mass":"112.412","period":5,"group":12,"row":5,"col":12,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":49,"symbol":"In","name":"Indium","mass":"114.818","period":5,"group":13,"row":5,"col":13,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":50,"symbol":"Sn","name":"Tin","mass":"118.711","period":5,"group":14,"row":5,"col":14,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":51,"symbol":"Sb","name":"Antimony","mass":"121.76","period":5,"group":15,"row":5,"col":15,"category":"Metalloid","categoryKey":"metalloid","block":"p"},{"n":52,"symbol":"Te","name":"Tellurium","mass":"127.6","period":5,"group":16,"row":5,"col":16,"category":"Metalloid","categoryKey":"metalloid","block":"p"},{"n":53,"symbol":"I","name":"Iodine","mass":"126.904","period":5,"group":17,"row":5,"col":17,"category":"Halogen","categoryKey":"halogen","block":"p"},{"n":54,"symbol":"Xe","name":"Xenon","mass":"131.29","period":5,"group":18,"row":5,"col":18,"category":"Noble gas","categoryKey":"noble-gas","block":"p"},{"n":55,"symbol":"Cs","name":"Caesium","mass":"132.905","period":6,"group":1,"row":6,"col":1,"category":"Alkali metal","categoryKey":"alkali-metal","block":"s"},{"n":56,"symbol":"Ba","name":"Barium","mass":"137.328","period":6,"group":2,"row":6,"col":2,"category":"Alkaline earth metal","categoryKey":"alkaline-earth-metal","block":"s"},{"n":57,"symbol":"La","name":"Lanthanum","mass":"138.906","period":6,"group":3,"row":6,"col":3,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":58,"symbol":"Ce","name":"Cerium","mass":"140.116","period":6,"group":null,"row":8,"col":4,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":59,"symbol":"Pr","name":"Praseodymium","mass":"140.908","period":6,"group":null,"row":8,"col":5,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":60,"symbol":"Nd","name":"Neodymium","mass":"144.24","period":6,"group":null,"row":8,"col":6,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":61,"symbol":"Pm","name":"Promethium","mass":"145","period":6,"group":null,"row":8,"col":7,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":62,"symbol":"Sm","name":"Samarium","mass":"150.36","period":6,"group":null,"row":8,"col":8,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":63,"symbol":"Eu","name":"Europium","mass":"151.964","period":6,"group":null,"row":8,"col":9,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":64,"symbol":"Gd","name":"Gadolinium","mass":"157.25","period":6,"group":null,"row":8,"col":10,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":65,"symbol":"Tb","name":"Terbium","mass":"158.925","period":6,"group":null,"row":8,"col":11,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":66,"symbol":"Dy","name":"Dysprosium","mass":"162.5","period":6,"group":null,"row":8,"col":12,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":67,"symbol":"Ho","name":"Holmium","mass":"164.93","period":6,"group":null,"row":8,"col":13,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":68,"symbol":"Er","name":"Erbium","mass":"167.26","period":6,"group":null,"row":8,"col":14,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":69,"symbol":"Tm","name":"Thulium","mass":"168.934","period":6,"group":null,"row":8,"col":15,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":70,"symbol":"Yb","name":"Ytterbium","mass":"173.04","period":6,"group":null,"row":8,"col":16,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":71,"symbol":"Lu","name":"Lutetium","mass":"174.967","period":6,"group":null,"row":8,"col":17,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":72,"symbol":"Hf","name":"Hafnium","mass":"178.49","period":6,"group":4,"row":6,"col":4,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":73,"symbol":"Ta","name":"Tantalum","mass":"180.948","period":6,"group":5,"row":6,"col":5,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":74,"symbol":"W","name":"Tungsten","mass":"183.84","period":6,"group":6,"row":6,"col":6,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":75,"symbol":"Re","name":"Rhenium","mass":"186.207","period":6,"group":7,"row":6,"col":7,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":76,"symbol":"Os","name":"Osmium","mass":"190.23","period":6,"group":8,"row":6,"col":8,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":77,"symbol":"Ir","name":"Iridium","mass":"192.217","period":6,"group":9,"row":6,"col":9,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":78,"symbol":"Pt","name":"Platinum","mass":"195.078","period":6,"group":10,"row":6,"col":10,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":79,"symbol":"Au","name":"Gold","mass":"196.967","period":6,"group":11,"row":6,"col":11,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":80,"symbol":"Hg","name":"Mercury","mass":"200.59","period":6,"group":12,"row":6,"col":12,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":81,"symbol":"Tl","name":"Thallium","mass":"204.383","period":6,"group":13,"row":6,"col":13,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":82,"symbol":"Pb","name":"Lead","mass":"207.2","period":6,"group":14,"row":6,"col":14,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":83,"symbol":"Bi","name":"Bismuth","mass":"208.98","period":6,"group":15,"row":6,"col":15,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":84,"symbol":"Po","name":"Polonium","mass":"209","period":6,"group":16,"row":6,"col":16,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":85,"symbol":"At","name":"Astatine","mass":"210","period":6,"group":17,"row":6,"col":17,"category":"Halogen","categoryKey":"halogen","block":"p"},{"n":86,"symbol":"Rn","name":"Radon","mass":"222","period":6,"group":18,"row":6,"col":18,"category":"Noble gas","categoryKey":"noble-gas","block":"p"},{"n":87,"symbol":"Fr","name":"Francium","mass":"223","period":7,"group":1,"row":7,"col":1,"category":"Alkali metal","categoryKey":"alkali-metal","block":"s"},{"n":88,"symbol":"Ra","name":"Radium","mass":"226","period":7,"group":2,"row":7,"col":2,"category":"Alkaline earth metal","categoryKey":"alkaline-earth-metal","block":"s"},{"n":89,"symbol":"Ac","name":"Actinium","mass":"227","period":7,"group":3,"row":7,"col":3,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":90,"symbol":"Th","name":"Thorium","mass":"232.038","period":7,"group":null,"row":9,"col":4,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":91,"symbol":"Pa","name":"Protactinium","mass":"231.036","period":7,"group":null,"row":9,"col":5,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":92,"symbol":"U","name":"Uranium","mass":"238.029","period":7,"group":null,"row":9,"col":6,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":93,"symbol":"Np","name":"Neptunium","mass":"237","period":7,"group":null,"row":9,"col":7,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":94,"symbol":"Pu","name":"Plutonium","mass":"244","period":7,"group":null,"row":9,"col":8,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":95,"symbol":"Am","name":"Americium","mass":"243","period":7,"group":null,"row":9,"col":9,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":96,"symbol":"Cm","name":"Curium","mass":"247","period":7,"group":null,"row":9,"col":10,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":97,"symbol":"Bk","name":"Berkelium","mass":"247","period":7,"group":null,"row":9,"col":11,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":98,"symbol":"Cf","name":"Californium","mass":"251","period":7,"group":null,"row":9,"col":12,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":99,"symbol":"Es","name":"Einsteinium","mass":"252","period":7,"group":null,"row":9,"col":13,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":100,"symbol":"Fm","name":"Fermium","mass":"257","period":7,"group":null,"row":9,"col":14,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":101,"symbol":"Md","name":"Mendelevium","mass":"258","period":7,"group":null,"row":9,"col":15,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":102,"symbol":"No","name":"Nobelium","mass":"259","period":7,"group":null,"row":9,"col":16,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":103,"symbol":"Lr","name":"Lawrencium","mass":"262","period":7,"group":null,"row":9,"col":17,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":104,"symbol":"Rf","name":"Rutherfordium","mass":"267","period":7,"group":4,"row":7,"col":4,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":105,"symbol":"Db","name":"Dubnium","mass":"268","period":7,"group":5,"row":7,"col":5,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":106,"symbol":"Sg","name":"Seaborgium","mass":"269","period":7,"group":6,"row":7,"col":6,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":107,"symbol":"Bh","name":"Bohrium","mass":"270","period":7,"group":7,"row":7,"col":7,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":108,"symbol":"Hs","name":"Hassium","mass":"269","period":7,"group":8,"row":7,"col":8,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":109,"symbol":"Mt","name":"Meitnerium","mass":"278","period":7,"group":9,"row":7,"col":9,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":110,"symbol":"Ds","name":"Darmstadtium","mass":"281","period":7,"group":10,"row":7,"col":10,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":111,"symbol":"Rg","name":"Roentgenium","mass":"281","period":7,"group":11,"row":7,"col":11,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":112,"symbol":"Cn","name":"Copernicium","mass":"285","period":7,"group":12,"row":7,"col":12,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":113,"symbol":"Nh","name":"Nihonium","mass":"284","period":7,"group":13,"row":7,"col":13,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":114,"symbol":"Fl","name":"Flerovium","mass":"289","period":7,"group":14,"row":7,"col":14,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":115,"symbol":"Mc","name":"Moscovium","mass":"288","period":7,"group":15,"row":7,"col":15,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":116,"symbol":"Lv","name":"Livermorium","mass":"293","period":7,"group":16,"row":7,"col":16,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":117,"symbol":"Ts","name":"Tennessine","mass":"292","period":7,"group":17,"row":7,"col":17,"category":"Halogen","categoryKey":"halogen","block":"p"},{"n":118,"symbol":"Og","name":"Oganesson","mass":"294","period":7,"group":18,"row":7,"col":18,"category":"Noble gas","categoryKey":"noble-gas","block":"p"}];

const CVC_WORD_SETS={"a":["cab","dab","jab","lab","tab","nab","tad","bad","dad","had","lad","pad","mad","rad","sad","wag","bag","gag","lag","nag","sag","rag","tag","hag","Sam","dam","ham"],"e":["bed","wed","fed","led","red","Ted","zed","Jed","Ned","beg","leg","peg","keg","Meg","neg","Ben","den","men","pen","ten","hen","Zen","Ken","Yen","bet","get","jet"],"i":["bib","fib","rib","jib","sib","bid","did","hid","kid","lid","rid","big","dig","fig","pig","rig","wig","jig","zig","dim","him","Kim","rim","Tim","Jim","Vim","bin"],"o":["cob","gob","job","lob","mob","rob","sob","dog","fog","jog","log","cop","hop","mop","pop","top","cot","dot","hot","not","pot","God","rod","pod","mod","cod","bop"],"u":["cub","hub","rub","pug","sub","tub","nub","rug","pub","dub","bud","tug","dud","mud","cud","gum","bug","dug","hug","hum","jug","lug","mug","mum"]};

function setupCVCWord(m){
  const card=m.querySelector('.cvcword-card');
  const wordEl=m.querySelector('.cvcword-word');
  const vowelLabel=m.querySelector('.cvcword-vowel-label');
  const categoryLabel=m.querySelector('.cvcword-category-label');
  const categorySelect=m.querySelector('.cvcword-category');
  const nextButton=m.querySelector('.cvcword-next');

  const categoryNames={
    all:'All Short Vowels',
    a:'Short A',
    e:'Short E',
    i:'Short I',
    o:'Short O',
    u:'Short U'
  };

  let currentWord='';
  let currentCategory='a';
  let animating=false;
  let resizeFrame=0;

  const measurer=document.createElement('span');
  measurer.className='cvcword-word cvcword-measurer';
  measurer.setAttribute('aria-hidden','true');
  card.appendChild(measurer);

  const getAvailableSpace=()=>{
    const cardRect=card.getBoundingClientRect();
    const labelRect=vowelLabel.getBoundingClientRect();

    return {
      maxWidth:Math.max(80,cardRect.width-34),
      maxHeight:Math.max(48,cardRect.height-38)
    };
  };

  const measureWordSize=word=>{
    const {maxWidth,maxHeight}=getAvailableSpace();

    measurer.textContent=word;
    measurer.style.fontFamily=getComputedStyle(wordEl).fontFamily;
    measurer.style.fontWeight=getComputedStyle(wordEl).fontWeight;
    measurer.style.letterSpacing=getComputedStyle(wordEl).letterSpacing;

    let low=18;
    let high=Math.max(24,Math.min(240,Math.floor(maxHeight*.9)));
    let best=low;

    while(low<=high){
      const mid=Math.floor((low+high)/2);
      measurer.style.fontSize=`${mid}px`;

      const rect=measurer.getBoundingClientRect();
      const fitsWidth=rect.width<=maxWidth+1;
      const fitsHeight=rect.height<=maxHeight+1;

      if(fitsWidth&&fitsHeight){
        best=mid;
        low=mid+1;
      }else{
        high=mid-1;
      }
    }

    return best;
  };

  const fitCurrentWord=()=>{
    cancelAnimationFrame(resizeFrame);
    resizeFrame=requestAnimationFrame(()=>{
      if(!currentWord)return;
      const size=measureWordSize(currentWord);
      wordEl.style.fontSize=`${size}px`;
      wordEl.classList.remove('is-fitting');
    });
  };

  const getPool=category=>{
    if(category!=='all'){
      return CVC_WORD_SETS[category].map(word=>({word,category}));
    }

    return Object.entries(CVC_WORD_SETS).flatMap(([key,words])=>
      words.map(word=>({word,category:key}))
    );
  };

  const chooseWord=()=>{
    const category=m.dataset.cvcCategory||'all';
    const pool=getPool(category);
    if(!pool.length)return null;

    let candidates=pool.filter(item=>item.word!==currentWord);
    if(!candidates.length)candidates=pool;

    return candidates[Math.floor(Math.random()*candidates.length)];
  };

  const prepareWord=item=>{
    if(!item)return null;
    return {
      ...item,
      fontSize:measureWordSize(item.word)
    };
  };

  const applyPreparedWord=prepared=>{
    if(!prepared)return;

    currentWord=prepared.word;
    currentCategory=prepared.category;

    wordEl.classList.add('is-fitting');
    wordEl.textContent=prepared.word;
    wordEl.style.fontSize=`${prepared.fontSize}px`;

    vowelLabel.textContent=`short ${prepared.category}`;
    card.dataset.vowel=prepared.category;
    card.setAttribute('aria-label',`${prepared.word}. Click for another CVC word.`);

    requestAnimationFrame(()=>{
      wordEl.classList.remove('is-fitting');
    });
  };

  const showNext=()=>{
    if(animating)return;

    const next=chooseWord();
    if(!next)return;

    const prepared=prepareWord(next);
    animating=true;

    card.classList.remove('is-flipping');
    void card.offsetWidth;
    card.classList.add('is-flipping');

    window.setTimeout(()=>{
      applyPreparedWord(prepared);
    },180);

    window.setTimeout(()=>{
      card.classList.remove('is-flipping');
      animating=false;
    },430);
  };

  const setCategory=category=>{
    const next=category in categoryNames?category:'all';
    m.dataset.cvcCategory=next;
    categorySelect.value=next;
    categoryLabel.textContent=categoryNames[next];
    currentWord='';
    showNext();
  };

  card.addEventListener('click',showNext);
  nextButton.addEventListener('click',showNext);

  categorySelect.addEventListener('change',()=>{
    setCategory(categorySelect.value);
  });

  m.querySelector('.cvcword-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.cvcword-font').addEventListener('click',()=>{
    cycleData(m,'font',FONT_OPTIONS);
    fitCurrentWord();
  });
  m.querySelector('.cvcword-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  const ro=new ResizeObserver(()=>{
    if(!currentWord)return;
    fitCurrentWord();
  });
  ro.observe(card);

  setCategory('all');

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    ro.disconnect();
    cancelAnimationFrame(resizeFrame);
    measurer.remove();
  };
}


const HIGH_FREQUENCY_WORD_SETS={"k":["can","I","the","we","see","a","like","to","and","go","you","do","my","are","with","he","is","little","she","was","for","have","of","they","said","want","here","me","this","what","help","too","has","play","where","look","good","who","come","does"],"1":["a","can","do","go","has","the","I","like","to","you","this","is","my","look","little","where","here","play","we","one","me","she","with","for","and","have","said","see","was","does","not","school","what","down","out","up","very","be","come","good","pull","fun","make","they","too","jump","move","run","two","again","help","new","there","use","could","live","then","three","eat","no","of","under","who","all","call","day","her","want","around","by","many","place","walk","away","now","some","today","way","why","green","grow","pretty","should","together","water","any","from","happy","once","so","upon","ago","boy","girl","how","old","people","after","buy","done","every","soon","work","about","animal","carry","eight","give","our","because","blue","into","or","other","small","find","food","more","over","start","warm","caught","flew","know","laugh","listen","were","found","hard","near","woman","would","write","four","large","none","only","put","round","another","climb","full","great","poor","through","began","better","guess","learn","right","sure","color","early","instead","nothing","oh","thought","above","build","fall","knew","money","toward","answer","brought","busy","door","enough","eyes","brother","father","friend","love","mother","picture","been","children","month","question","their","year","before","front","heard","push","tomorrow","your","favorite","few","gone","surprise","wonder","young"],"2":["ball","blue","both","even","for","help","put","there","why","yellow","could","find","funny","green","how","little","one","or","see","sounds","boy","by","girl","he","here","she","small","want","were","what","another","done","into","move","now","show","too","water","year","your","all","any","goes","new","number","other","right","says","understands","work"],"3plus":["a","about","after","again","all","also","always","am","an","and","another","any","are","around","as","ask","at","ate","away","back","be","because","been","before","best","better","big","black","blue","both","think","this","those","three","through","time","today","together","under","upon","very","want","water","went","where","which","would","write","years","yellow","yes","you","your"]};

function setupHighFrequencyWords(m){
  const card=m.querySelector('.highfrequency-card');
  const wordEl=m.querySelector('.highfrequency-word');
  const gradeLabel=m.querySelector('.highfrequency-grade-label');
  const gradeSelect=m.querySelector('.highfrequency-grade');
  const nextButton=m.querySelector('.highfrequency-next');
  const settingsButton=m.querySelector('.highfrequency-settings-button');
  const settings=m.querySelector('.highfrequency-settings');
  const settingsClose=m.querySelector('.highfrequency-settings-close');
  const settingsTitle=m.querySelector('.highfrequency-settings-title');
  const wordOptions=m.querySelector('.highfrequency-word-options');
  const enableAll=m.querySelector('.highfrequency-enable-all');
  const disableAll=m.querySelector('.highfrequency-disable-all');
  const enabledCount=m.querySelector('.highfrequency-enabled-count');

  const gradeNames={
    k:'Kindergarten',
    1:'Grade 1',
    2:'Grade 2',
    '3plus':'Grade 3+'
  };

  const enabledByGrade={};
  Object.entries(HIGH_FREQUENCY_WORD_SETS).forEach(([grade,words])=>{
    enabledByGrade[grade]=new Set(words);
  });

  let currentWord='';
  let animating=false;
  let resizeFrame=0;

  const measurer=document.createElement('span');
  measurer.className='highfrequency-word highfrequency-measurer';
  measurer.setAttribute('aria-hidden','true');
  card.appendChild(measurer);

  const measureWordSize=word=>{
    const cardRect=card.getBoundingClientRect();
    const maxWidth=Math.max(90,cardRect.width-36);
    const maxHeight=Math.max(54,cardRect.height-40);

    measurer.textContent=word;
    const computed=getComputedStyle(wordEl);
    measurer.style.fontFamily=computed.fontFamily;
    measurer.style.fontWeight=computed.fontWeight;
    measurer.style.letterSpacing=computed.letterSpacing;

    let low=18;
    let high=Math.max(24,Math.min(240,Math.floor(maxHeight*.9)));
    let best=low;

    while(low<=high){
      const mid=Math.floor((low+high)/2);
      measurer.style.fontSize=`${mid}px`;

      const rect=measurer.getBoundingClientRect();
      if(rect.width<=maxWidth+1&&rect.height<=maxHeight+1){
        best=mid;
        low=mid+1;
      }else{
        high=mid-1;
      }
    }

    return best;
  };

  const enabledWords=grade=>HIGH_FREQUENCY_WORD_SETS[grade].filter(word=>enabledByGrade[grade].has(word));

  const chooseWord=()=>{
    const grade=m.dataset.hfwGrade||'k';
    const pool=enabledWords(grade);
    if(!pool.length)return null;

    let candidates=pool.filter(word=>word!==currentWord);
    if(!candidates.length)candidates=pool;

    return candidates[Math.floor(Math.random()*candidates.length)];
  };

  const applyWord=(word,size)=>{
    currentWord=word;
    wordEl.classList.add('is-fitting');
    wordEl.textContent=word;
    wordEl.style.fontSize=`${size}px`;
    card.setAttribute('aria-label',`${word}. Click for another high frequency word.`);
    requestAnimationFrame(()=>wordEl.classList.remove('is-fitting'));
  };

  const fitCurrentWord=()=>{
    cancelAnimationFrame(resizeFrame);
    resizeFrame=requestAnimationFrame(()=>{
      if(!currentWord)return;
      wordEl.style.fontSize=`${measureWordSize(currentWord)}px`;
      wordEl.classList.remove('is-fitting');
    });
  };

  const showNext=()=>{
    if(animating)return;

    const next=chooseWord();
    if(!next){
      currentWord='';
      wordEl.classList.remove('is-fitting');
      wordEl.style.fontSize='';
      wordEl.textContent='No words enabled';
      card.classList.add('is-empty');
      return;
    }

    const size=measureWordSize(next);
    animating=true;
    card.classList.remove('is-empty','is-flipping');
    void card.offsetWidth;
    card.classList.add('is-flipping');

    window.setTimeout(()=>applyWord(next,size),180);

    window.setTimeout(()=>{
      card.classList.remove('is-flipping');
      animating=false;
    },430);
  };

  const renderSettings=()=>{
    const grade=m.dataset.hfwGrade||'k';
    const words=HIGH_FREQUENCY_WORD_SETS[grade];
    const enabled=enabledByGrade[grade];

    settingsTitle.textContent=gradeNames[grade];
    enabledCount.textContent=`${enabled.size} of ${words.length} enabled`;
    wordOptions.replaceChildren();

    words.forEach(word=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='highfrequency-word-option';
      button.textContent=word;
      button.classList.toggle('is-enabled',enabled.has(word));
      button.setAttribute('aria-pressed',String(enabled.has(word)));

      button.addEventListener('click',()=>{
        if(enabled.has(word))enabled.delete(word);
        else enabled.add(word);

        button.classList.toggle('is-enabled',enabled.has(word));
        button.setAttribute('aria-pressed',String(enabled.has(word)));
        enabledCount.textContent=`${enabled.size} of ${words.length} enabled`;

        if(currentWord&&!enabled.has(currentWord)){
          currentWord='';
          showNext();
        }
      });

      wordOptions.appendChild(button);
    });
  };

  const setGrade=grade=>{
    const next=grade in gradeNames?grade:'k';
    m.dataset.hfwGrade=next;
    gradeSelect.value=next;
    gradeLabel.textContent=gradeNames[next];
    currentWord='';
    renderSettings();
    showNext();
  };

  card.addEventListener('click',showNext);
  nextButton.addEventListener('click',showNext);

  gradeSelect.addEventListener('change',()=>setGrade(gradeSelect.value));

  settingsButton.addEventListener('click',()=>{
    renderSettings();
    settings.hidden=false;
  });

  settingsClose.addEventListener('click',()=>{settings.hidden=true;});
  settings.addEventListener('pointerdown',event=>{
    if(event.target===settings)settings.hidden=true;
  });

  enableAll.addEventListener('click',()=>{
    const grade=m.dataset.hfwGrade||'k';
    enabledByGrade[grade]=new Set(HIGH_FREQUENCY_WORD_SETS[grade]);
    renderSettings();
    if(!currentWord)showNext();
  });

  disableAll.addEventListener('click',()=>{
    const grade=m.dataset.hfwGrade||'k';
    enabledByGrade[grade].clear();
    currentWord='';
    renderSettings();
    showNext();
  });

  m.querySelector('.highfrequency-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.highfrequency-font').addEventListener('click',()=>{
    cycleData(m,'font',FONT_OPTIONS);
    fitCurrentWord();
  });
  m.querySelector('.highfrequency-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  const ro=new ResizeObserver(()=>{
    if(currentWord)fitCurrentWord();
  });
  ro.observe(card);

  setGrade('k');

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    ro.disconnect();
    cancelAnimationFrame(resizeFrame);
    measurer.remove();
  };
}

function setupABC(m){
  const card=m.querySelector('.abc-card');
  const letterEl=m.querySelector('.abc-letter');
  const modeLabel=m.querySelector('.abc-mode-label');
  const modeSelect=m.querySelector('.abc-mode');
  const nextButton=m.querySelector('.abc-next');

  const uppercase='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const lowercase='abcdefghijklmnopqrstuvwxyz'.split('');

  const modeNames={
    uppercase:'Uppercase Letters',
    lowercase:'Lowercase Letters',
    both:'Uppercase + Lowercase'
  };

  let current='';
  let animating=false;
  let resizeFrame=0;

  const measurer=document.createElement('span');
  measurer.className='abc-letter abc-measurer';
  measurer.setAttribute('aria-hidden','true');
  card.appendChild(measurer);

  const measureLetterSize=letter=>{
    const rect=card.getBoundingClientRect();
    const maxWidth=Math.max(80,rect.width-34);
    const maxHeight=Math.max(80,rect.height-36);

    measurer.textContent=letter;

    let low=28;
    let high=Math.max(36,Math.min(300,Math.floor(maxHeight*.9)));
    let best=low;

    while(low<=high){
      const mid=Math.floor((low+high)/2);
      measurer.style.fontSize=`${mid}px`;
      const measured=measurer.getBoundingClientRect();

      if(measured.width<=maxWidth+1&&measured.height<=maxHeight+1){
        best=mid;
        low=mid+1;
      }else{
        high=mid-1;
      }
    }

    return best;
  };

  const poolForMode=mode=>{
    if(mode==='lowercase')return lowercase;
    if(mode==='both')return [...uppercase,...lowercase];
    return uppercase;
  };

  const chooseLetter=()=>{
    const pool=poolForMode(m.dataset.abcMode||'uppercase');
    let candidates=pool.filter(letter=>letter!==current);
    if(!candidates.length)candidates=pool;
    return candidates[Math.floor(Math.random()*candidates.length)];
  };

  const applyLetter=(letter,size)=>{
    current=letter;
    letterEl.classList.add('is-fitting');
    letterEl.textContent=letter;
    letterEl.style.fontSize=`${size}px`;
    card.setAttribute('aria-label',`${letter}. Click for another letter.`);
    requestAnimationFrame(()=>letterEl.classList.remove('is-fitting'));
  };

  const fitCurrent=()=>{
    cancelAnimationFrame(resizeFrame);
    resizeFrame=requestAnimationFrame(()=>{
      if(!current)return;
      letterEl.style.fontSize=`${measureLetterSize(current)}px`;
      letterEl.classList.remove('is-fitting');
    });
  };

  const showNext=()=>{
    if(animating)return;

    const next=chooseLetter();
    const size=measureLetterSize(next);

    animating=true;
    card.classList.remove('is-flipping');
    void card.offsetWidth;
    card.classList.add('is-flipping');

    window.setTimeout(()=>applyLetter(next,size),180);
    window.setTimeout(()=>{
      card.classList.remove('is-flipping');
      animating=false;
    },430);
  };

  const setMode=mode=>{
    const next=mode in modeNames?mode:'uppercase';
    m.dataset.abcMode=next;
    modeSelect.value=next;
    modeLabel.textContent=modeNames[next];
    current='';
    showNext();
  };

  card.addEventListener('click',showNext);
  nextButton.addEventListener('click',showNext);
  modeSelect.addEventListener('change',()=>setMode(modeSelect.value));

  m.querySelector('.abc-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.abc-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  const ro=new ResizeObserver(()=>{
    if(current)fitCurrent();
  });
  ro.observe(card);

  setMode('uppercase');

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    ro.disconnect();
    cancelAnimationFrame(resizeFrame);
    measurer.remove();
  };
}

function setupRuler(m){
  const stage=m.querySelector('.ruler-stage');
  const face=m.querySelector('.ruler-face');
  const svg=m.querySelector('.ruler-svg');
  const measurement=m.querySelector('.ruler-measurement');
  const handles={
    a:m.querySelector('[data-ruler-handle="a"]'),
    b:m.querySelector('[data-ruler-handle="b"]')
  };
  const readouts={
    a:m.querySelector('.ruler-a-value'),
    b:m.querySelector('.ruler-b-value')
  };
  const selectButtons=[...m.querySelectorAll('[data-ruler-select]')];
  const unitButtons=[...m.querySelectorAll('[data-ruler-unit-option]')];
  const resetButton=m.querySelector('.ruler-reset');

  let unit='in';
  let a=0;
  let b=1;
  let active='a';
  let dragging=null;
  let scaleFrame=0;

  const config=()=>unit==='cm'
    ?{max:30,divisions:10}
    :{max:12,divisions:8};

  const formatInches=value=>{
    const eighths=Math.round(value*8);
    const whole=Math.floor(eighths/8);
    const remainder=eighths%8;
    if(!remainder)return`${whole} in`;

    const divisor=remainder%4===0?4:remainder%2===0?2:1;
    const numerator=remainder/divisor;
    const denominator=8/divisor;

    return whole
      ?`${whole} ${numerator}/${denominator} in`
      :`${numerator}/${denominator} in`;
  };

  const formatValue=value=>{
    if(unit==='in')return formatInches(value);
    const rounded=Math.round(value*10)/10;
    return`${Number(rounded.toFixed(1))} cm`;
  };

  const valueFromFraction=fraction=>{
    const {max,divisions}=config();
    const steps=max*divisions;
    return Math.round(Math.max(0,Math.min(1,fraction))*steps)/divisions;
  };

  const renderScale=()=>{
    cancelAnimationFrame(scaleFrame);
    scaleFrame=requestAnimationFrame(()=>{
      const {max,divisions}=config();
      const total=max*divisions;

      const width=Math.max(320,Math.round(face.clientWidth||stage.clientWidth||760));
      const height=Math.max(82,Math.round(face.clientHeight||98));
      const baseline=height;
      const labelY=Math.max(17,Math.round(height*.22));

      svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
      svg.replaceChildren();

      const make=(tag,attrs={})=>{
        const el=document.createElementNS('http://www.w3.org/2000/svg',tag);
        Object.entries(attrs).forEach(([key,value])=>el.setAttribute(key,String(value)));
        return el;
      };

      const cmLabelEvery=width<590?5:width<820?2:1;

      for(let step=0;step<=total;step++){
        const x=step/total*width;
        const fraction=step/divisions;
        const isMajor=step%divisions===0;

        let tickHeight;
        if(unit==='in'){
          const eighth=step%8;
          tickHeight=isMajor
            ?Math.round(height*.55)
            :eighth===4
              ?Math.round(height*.40)
              :eighth%2===0
                ?Math.round(height*.30)
                :Math.round(height*.22);
        }else{
          const tenth=step%10;
          tickHeight=isMajor
            ?Math.round(height*.55)
            :tenth===5
              ?Math.round(height*.38)
              :Math.round(height*.23);
        }

        svg.appendChild(make('line',{
          x1:x,
          x2:x,
          y1:baseline-tickHeight,
          y2:baseline,
          class:isMajor?'ruler-tick ruler-tick--major':'ruler-tick'
        }));

        const showLabel=isMajor&&(
          unit==='in'||
          Math.round(fraction)%cmLabelEvery===0
        );

        if(showLabel){
          const label=make('text',{
            x,
            y:labelY,
            'text-anchor':step===0?'start':step===total?'end':'middle',
            class:'ruler-scale-label'
          });
          label.textContent=String(Math.round(fraction));
          svg.appendChild(label);
        }
      }
    });
  };

  const render=()=>{
    const {max}=config();
    const aValue=a*max;
    const bValue=b*max;
    const distance=Math.abs(bValue-aValue);

    handles.a.style.setProperty('--ruler-position',`${a*100}%`);
    handles.b.style.setProperty('--ruler-position',`${b*100}%`);

    handles.a.classList.toggle('is-active',active==='a');
    handles.b.classList.toggle('is-active',active==='b');

    selectButtons.forEach(button=>{
      button.classList.toggle('is-active',button.dataset.rulerSelect===active);
    });

    readouts.a.textContent=formatValue(aValue);
    readouts.b.textContent=formatValue(bValue);
    measurement.textContent=formatValue(distance);

    handles.a.setAttribute('aria-label',`Point A at ${formatValue(aValue)}`);
    handles.b.setAttribute('aria-label',`Point B at ${formatValue(bValue)}`);
  };

  const setHandleFromClient=(which,clientX)=>{
    const rect=stage.getBoundingClientRect();
    if(!rect.width)return;

    const raw=(clientX-rect.left)/rect.width;
    const {max}=config();
    const snapped=valueFromFraction(raw);
    const fraction=snapped/max;

    if(which==='a')a=fraction;
    else b=fraction;

    render();
  };

  const select=which=>{
    active=which==='b'?'b':'a';
    render();
  };

  Object.entries(handles).forEach(([which,handle])=>{
    handle.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;
      event.preventDefault();
      event.stopPropagation();

      dragging=which;
      select(which);
      handle.setPointerCapture(event.pointerId);
      setHandleFromClient(which,event.clientX);
    });

    handle.addEventListener('pointermove',event=>{
      if(dragging!==which)return;
      event.preventDefault();
      setHandleFromClient(which,event.clientX);
    });

    const stop=event=>{
      if(dragging!==which)return;
      dragging=null;
      try{handle.releasePointerCapture(event.pointerId)}catch{}
    };

    handle.addEventListener('pointerup',stop);
    handle.addEventListener('pointercancel',stop);
  });

  stage.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.target.closest('.ruler-handle'))return;
    event.preventDefault();
    setHandleFromClient(active,event.clientX);
  });

  selectButtons.forEach(button=>{
    button.addEventListener('click',()=>select(button.dataset.rulerSelect));
  });

  unitButtons.forEach(button=>{
    button.addEventListener('click',()=>{
      unit=button.dataset.rulerUnitOption==='cm'?'cm':'in';
      m.dataset.rulerUnit=unit;

      unitButtons.forEach(item=>{
        item.classList.toggle('is-active',item.dataset.rulerUnitOption===unit);
      });

      renderScale();
      render();
    });
  });

  resetButton.addEventListener('click',()=>{
    a=0;
    b=1;
    active='a';
    render();
  });

  m.querySelector('.ruler-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.ruler-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.ruler-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  const rulerResizeObserver=new ResizeObserver(renderScale);
  rulerResizeObserver.observe(face);

  renderScale();
  render();

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    rulerResizeObserver.disconnect();
    cancelAnimationFrame(scaleFrame);
  };
}


function setupCalculator(m){
  const expressionEl=m.querySelector('.calculator-expression');
  const valueEl=m.querySelector('.calculator-value');
  const valueButtons=[...m.querySelectorAll('[data-calc-value]')];
  const actionButtons=[...m.querySelectorAll('[data-calc-action]')];

  let expression='';
  let justEvaluated=false;

  const displayExpression=value=>value
    .replace(/\*/g,'×')
    .replace(/\//g,'÷');

  const evaluate=()=>{
    if(!expression)return 0;
    if(!/^[0-9+\-*/().\s]+$/.test(expression))throw new Error('Invalid expression');
    const result=Function(`"use strict";return (${expression})`)();
    if(typeof result!=='number'||!Number.isFinite(result))throw new Error('Invalid result');
    return Math.round((result+Number.EPSILON)*1e12)/1e12;
  };

  const render=()=>{
    expressionEl.textContent=displayExpression(expression);
    if(!expression){
      valueEl.textContent='0';
      return;
    }
    try{
      const endsWithOperator=/[+\-*/.(]$/.test(expression);
      if(!endsWithOperator)valueEl.textContent=String(evaluate());
    }catch{
      valueEl.textContent='…';
    }
  };

  const append=value=>{
    if(justEvaluated&&/[0-9.]/.test(value)){
      expression='';
    }
    justEvaluated=false;

    if(/[+\-*/]/.test(value)){
      if(!expression&&value!=='-')return;
      if(/[+\-*/]$/.test(expression)){
        expression=expression.slice(0,-1)+value;
        render();
        return;
      }
    }

    if(value==='.'){
      const tail=expression.split(/[+\-*/()]/).at(-1)||'';
      if(tail.includes('.'))return;
      if(!tail)expression+='0';
    }

    expression+=value;
    render();
  };

  const equals=()=>{
    if(!expression)return;
    try{
      const result=evaluate();
      expression=String(result);
      valueEl.textContent=String(result);
      expressionEl.textContent='';
      justEvaluated=true;
    }catch{
      valueEl.textContent='Error';
      justEvaluated=true;
    }
  };

  const percent=()=>{
    const match=expression.match(/(-?\d*\.?\d+)$/);
    if(!match)return;
    const value=Number(match[1])/100;
    expression=expression.slice(0,-match[1].length)+String(value);
    render();
  };

  const toggleSign=()=>{
    const match=expression.match(/(-?\d*\.?\d+)$/);
    if(!match)return;
    const raw=match[1];
    const replacement=raw.startsWith('-')?raw.slice(1):`-${raw}`;
    expression=expression.slice(0,-raw.length)+replacement;
    render();
  };

  valueButtons.forEach(button=>button.addEventListener('click',()=>append(button.dataset.calcValue)));

  actionButtons.forEach(button=>button.addEventListener('click',()=>{
    switch(button.dataset.calcAction){
      case 'clear':
        expression='';
        justEvaluated=false;
        render();
        break;
      case 'backspace':
        expression=expression.slice(0,-1);
        justEvaluated=false;
        render();
        break;
      case 'percent':
        percent();
        break;
      case 'sign':
        toggleSign();
        break;
      case 'equals':
        equals();
        break;
    }
  }));

  m.addEventListener('pointerdown',event=>{
    if(!event.target.closest('.module-delete,.resize-handle'))m.focus({preventScroll:true});
  });

  m.addEventListener('keydown',event=>{
    if(event.target.closest('input,textarea'))return;

    if(/^[0-9.]$/.test(event.key)){
      event.preventDefault();
      append(event.key);
    }else if(['+','-','*','/','(',')'].includes(event.key)){
      event.preventDefault();
      append(event.key);
    }else if(event.key==='Enter'||event.key==='='){
      event.preventDefault();
      equals();
    }else if(event.key==='Backspace'){
      event.preventDefault();
      expression=expression.slice(0,-1);
      render();
    }else if(event.key==='Escape'){
      expression='';
      render();
    }
  });

  m.querySelector('.calculator-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.calculator-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.calculator-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  render();
}

function setupGrapher(m){
  const svg=m.querySelector('.grapher-svg');
  const equationInput=m.querySelector('.grapher-equation');
  const graphButton=m.querySelector('.grapher-graph-equation');
  const pointX=m.querySelector('.grapher-point-x');
  const pointY=m.querySelector('.grapher-point-y');
  const addPointButton=m.querySelector('.grapher-add-point');
  const clearPoints=m.querySelector('.grapher-clear-points');
  const coordinateReadout=m.querySelector('.grapher-coordinate-readout');
  const xminInput=m.querySelector('.grapher-xmin');
  const xmaxInput=m.querySelector('.grapher-xmax');
  const yminInput=m.querySelector('.grapher-ymin');
  const ymaxInput=m.querySelector('.grapher-ymax');
  const applyRange=m.querySelector('.grapher-apply-range');
  const error=m.querySelector('.grapher-error');

  let range={xmin:-10,xmax:10,ymin:-10,ymax:10};
  let points=[];
  let equation='x';

  const W=700,H=480,pad=34;
  const mapX=x=>pad+(x-range.xmin)/(range.xmax-range.xmin)*(W-pad*2);
  const mapY=y=>H-pad-(y-range.ymin)/(range.ymax-range.ymin)*(H-pad*2);
  const unmapX=px=>range.xmin+(px-pad)/(W-pad*2)*(range.xmax-range.xmin);
  const unmapY=py=>range.ymin+(H-pad-py)/(H-pad*2)*(range.ymax-range.ymin);

  const niceStep=span=>{
    const raw=span/10;
    const power=Math.pow(10,Math.floor(Math.log10(raw)));
    const normalized=raw/power;
    const nice=normalized<=1?1:normalized<=2?2:normalized<=5?5:10;
    return nice*power;
  };

  const compileEquation=raw=>{
    let expr=(raw||'').trim().toLowerCase().replace(/^y\s*=\s*/,'').replace(/\^/g,'**');
    if(!expr)throw new Error('Enter an equation.');

    const words=expr.match(/[a-z]+/g)||[];
    const allowed=new Set(['x','sin','cos','tan','sqrt','abs','log','ln','exp','floor','ceil','round','pi','e']);
    if(words.some(word=>!allowed.has(word)))throw new Error('Use x, numbers, + − × ÷, powers, and common functions.');

    if(!/^[0-9a-z+\-*/().,\s*]+$/.test(expr))throw new Error('That equation contains unsupported characters.');

    expr=expr
      .replace(/\bpi\b/g,'Math.PI')
      .replace(/\be\b/g,'Math.E')
      .replace(/\bln\b/g,'Math.log')
      .replace(/\b(sin|cos|tan|sqrt|abs|log|exp|floor|ceil|round)\b/g,'Math.$1');

    const fn=Function('x',`"use strict";return (${expr})`);
    const test=fn(0);
    if(typeof test!=='number')throw new Error('Could not graph that equation.');
    return fn;
  };

  const makeSvg=(tag,attrs={})=>{
    const el=document.createElementNS('http://www.w3.org/2000/svg',tag);
    Object.entries(attrs).forEach(([key,value])=>el.setAttribute(key,String(value)));
    return el;
  };

  const render=()=>{
    svg.replaceChildren();

    const plot=makeSvg('rect',{x:pad,y:pad,width:W-pad*2,height:H-pad*2,class:'grapher-plot-bg'});
    svg.appendChild(plot);

    const xStep=niceStep(range.xmax-range.xmin);
    const yStep=niceStep(range.ymax-range.ymin);

    const firstX=Math.ceil(range.xmin/xStep)*xStep;
    for(let x=firstX;x<=range.xmax+1e-9;x+=xStep){
      const px=mapX(x);
      const line=makeSvg('line',{x1:px,x2:px,y1:pad,y2:H-pad,class:Math.abs(x)<1e-9?'grapher-axis':'grapher-grid-line'});
      svg.appendChild(line);
      const label=makeSvg('text',{x:px,y:Math.min(H-pad+20,Math.max(pad+14,mapY(0)+18)),class:'grapher-axis-label','text-anchor':'middle'});
      label.textContent=Number(x.toFixed(6)).toString();
      svg.appendChild(label);
    }

    const firstY=Math.ceil(range.ymin/yStep)*yStep;
    for(let y=firstY;y<=range.ymax+1e-9;y+=yStep){
      const py=mapY(y);
      const line=makeSvg('line',{x1:pad,x2:W-pad,y1:py,y2:py,class:Math.abs(y)<1e-9?'grapher-axis':'grapher-grid-line'});
      svg.appendChild(line);
      if(Math.abs(y)>1e-9){
        const label=makeSvg('text',{x:Math.min(W-pad-4,Math.max(pad+4,mapX(0)+7)),y:py-5,class:'grapher-axis-label'});
        label.textContent=Number(y.toFixed(6)).toString();
        svg.appendChild(label);
      }
    }

    try{
      const fn=compileEquation(equation);
      let d='';
      let drawing=false;

      for(let px=pad;px<=W-pad;px+=2){
        const x=unmapX(px);
        let y;
        try{y=fn(x)}catch{y=NaN}

        if(Number.isFinite(y)&&y>=range.ymin-(range.ymax-range.ymin)*.2&&y<=range.ymax+(range.ymax-range.ymin)*.2){
          const py=mapY(y);
          d+=`${drawing?'L':'M'}${px.toFixed(2)},${py.toFixed(2)}`;
          drawing=true;
        }else{
          drawing=false;
        }
      }

      if(d){
        const path=makeSvg('path',{d,class:'grapher-function'});
        svg.appendChild(path);
      }
      error.textContent='';
    }catch(err){
      error.textContent=err.message||'Could not graph that equation.';
    }

    points.forEach((point,index)=>{
      const group=makeSvg('g',{class:'grapher-point',tabindex:'0'});
      const circle=makeSvg('circle',{cx:mapX(point.x),cy:mapY(point.y),r:7});
      const label=makeSvg('text',{x:mapX(point.x)+10,y:mapY(point.y)-10});
      label.textContent=`(${Number(point.x.toFixed(2))}, ${Number(point.y.toFixed(2))})`;
      group.append(circle,label);
      group.addEventListener('click',event=>{
        event.stopPropagation();
        points.splice(index,1);
        render();
      });
      svg.appendChild(group);
    });

    svg.setAttribute('aria-label',`Coordinate plane from x ${range.xmin} to ${range.xmax} and y ${range.ymin} to ${range.ymax}.`);
  };

  const addPoint=(x,y)=>{
    if(!Number.isFinite(x)||!Number.isFinite(y))return;
    if(x<range.xmin||x>range.xmax||y<range.ymin||y>range.ymax){
      error.textContent='That point is outside the current graph range.';
      return;
    }
    points.push({x,y});
    coordinateReadout.textContent=`Last point: (${Number(x.toFixed(2))}, ${Number(y.toFixed(2))})`;
    error.textContent='';
    render();
  };

  svg.addEventListener('click',event=>{
    if(event.target.closest?.('.grapher-point'))return;
    const rect=svg.getBoundingClientRect();
    const px=(event.clientX-rect.left)/rect.width*W;
    const py=(event.clientY-rect.top)/rect.height*H;
    if(px<pad||px>W-pad||py<pad||py>H-pad)return;
    addPoint(unmapX(px),unmapY(py));
  });

  addPointButton.addEventListener('click',()=>addPoint(Number(pointX.value),Number(pointY.value)));
  clearPoints.addEventListener('click',()=>{points=[];coordinateReadout.textContent='Click the plane to place points';render();});

  const graphEquation=()=>{
    equation=equationInput.value.trim()||'x';
    render();
  };
  graphButton.addEventListener('click',graphEquation);
  equationInput.addEventListener('keydown',event=>{
    if(event.key==='Enter'){event.preventDefault();graphEquation();}
  });

  applyRange.addEventListener('click',()=>{
    const next={
      xmin:Number(xminInput.value),xmax:Number(xmaxInput.value),
      ymin:Number(yminInput.value),ymax:Number(ymaxInput.value)
    };
    if(!Object.values(next).every(Number.isFinite)||next.xmin>=next.xmax||next.ymin>=next.ymax){
      error.textContent='Use valid minimum and maximum values.';
      return;
    }
    range=next;
    points=points.filter(p=>p.x>=range.xmin&&p.x<=range.xmax&&p.y>=range.ymin&&p.y<=range.ymax);
    error.textContent='';
    render();
  });

  m.querySelector('.grapher-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.grapher-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.grapher-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  render();
}

function setupPeriodicTable(m){
  const grid=m.querySelector('.periodic-grid');
  const legend=m.querySelector('.periodic-legend');
  const detail=m.querySelector('.periodic-detail');
  const closeButton=m.querySelector('.periodic-detail-close');
  const symbolEl=m.querySelector('.periodic-detail-symbol');
  const numberEl=m.querySelector('.periodic-detail-number');
  const nameEl=m.querySelector('.periodic-detail-name');
  const categoryEl=m.querySelector('.periodic-detail-category');
  const facts=m.querySelector('.periodic-detail-facts');

  const categoryOrder=[
    'Alkali metal','Alkaline earth metal','Transition metal','Post-transition metal',
    'Metalloid','Reactive nonmetal','Halogen','Noble gas','Lanthanide','Actinide'
  ];

  const openElement=element=>{
    symbolEl.textContent=element.symbol;
    symbolEl.dataset.category=element.categoryKey;
    numberEl.textContent=`Atomic number ${element.n}`;
    nameEl.textContent=element.name;
    categoryEl.textContent=element.category;

    const group=element.group===null?'f-block':`Group ${element.group}`;
    facts.replaceChildren();

    [
      ['Atomic mass',element.mass],
      ['Period',String(element.period)],
      ['Group',group],
      ['Block',`${element.block}-block`]
    ].forEach(([label,value])=>{
      const item=document.createElement('div');
      const small=document.createElement('span');
      small.textContent=label;
      const strong=document.createElement('strong');
      strong.textContent=value;
      item.append(small,strong);
      facts.appendChild(item);
    });

    detail.hidden=false;
    detail.classList.remove('periodic-detail-pop');
    void detail.offsetWidth;
    detail.classList.add('periodic-detail-pop');
  };

  PERIODIC_ELEMENTS.forEach(element=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='periodic-element';
    button.dataset.category=element.categoryKey;
    button.style.gridRow=String(element.row);
    button.style.gridColumn=String(element.col);
    button.setAttribute('aria-label',`${element.name}, atomic number ${element.n}`);

    const number=document.createElement('span');
    number.className='periodic-element-number';
    number.textContent=String(element.n);

    const symbol=document.createElement('strong');
    symbol.textContent=element.symbol;

    const name=document.createElement('span');
    name.className='periodic-element-name';
    name.textContent=element.name;

    button.append(number,symbol,name);
    button.addEventListener('click',()=>openElement(element));
    grid.appendChild(button);
  });

  categoryOrder.forEach(category=>{
    const sample=PERIODIC_ELEMENTS.find(element=>element.category===category);
    if(!sample)return;

    const item=document.createElement('span');
    item.className='periodic-legend-item';

    const swatch=document.createElement('i');
    swatch.dataset.category=sample.categoryKey;

    const text=document.createElement('span');
    text.textContent=category;

    item.append(swatch,text);
    legend.appendChild(item);
  });

  closeButton.addEventListener('click',()=>{detail.hidden=true;});
  detail.addEventListener('keydown',event=>{
    if(event.key==='Escape')detail.hidden=true;
  });

  m.querySelector('.periodic-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.periodic-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
}

function setupMoney(m){
  const workspaceEl=m.querySelector('.money-workspace');
  const palette=m.querySelector('.money-palette');
  const totalEl=m.querySelector('.money-total');
  const toggleTotal=m.querySelector('.money-toggle-total');
  const countEl=m.querySelector('.money-count');
  const clearButton=m.querySelector('.money-clear');
  const empty=m.querySelector('.money-workspace-empty');

  const denominations=[
    {id:'penny',label:'Penny',cents:1,src:'assets/money/penny.png'},
    {id:'nickel',label:'Nickel',cents:5,src:'assets/money/nickle.png'},
    {id:'dime',label:'Dime',cents:10,src:'assets/money/dime.png'},
    {id:'quarter',label:'Quarter',cents:25,src:'assets/money/quarter.png'},
    {id:'half-dollar',label:'Half Dollar',cents:50,src:'assets/money/half dollar.png'},
    {id:'dollar',label:'Dollar',cents:100,src:'assets/money/dollar.png'}
  ];

  let pieces=[];
  let nextId=0;
  let totalVisible=true;
  let paletteDragId='';

  const denom=id=>denominations.find(item=>item.id===id);

  const updateSummary=()=>{
    const cents=pieces.reduce((sum,piece)=>sum+(denom(piece.denom)?.cents||0),0);
    totalEl.textContent=`$${(cents/100).toFixed(2)}`;
    totalEl.classList.toggle('is-hidden',!totalVisible);
    toggleTotal.textContent=totalVisible?'Hide Total':'Show Total';
    countEl.textContent=`${pieces.length} ${pieces.length===1?'piece':'pieces'}`;
    empty.hidden=pieces.length>0;
  };

  const clampPiece=(piece,el)=>{
    const rect=workspaceEl.getBoundingClientRect();
    const w=el?.offsetWidth||76;
    const h=el?.offsetHeight||76;
    piece.x=Math.max(0,Math.min(rect.width-w,piece.x));
    piece.y=Math.max(0,Math.min(rect.height-h,piece.y));
  };

  const addPiece=(denomId,x=null,y=null)=>{
    const rect=workspaceEl.getBoundingClientRect();
    const d=denom(denomId);
    if(!d)return;

    const piece={
      id:++nextId,
      denom:denomId,
      x:x===null?Math.max(8,(rect.width-76)/2+(Math.random()-.5)*70):x,
      y:y===null?Math.max(8,(rect.height-76)/2+(Math.random()-.5)*50):y
    };
    pieces.push(piece);
    renderPieces();
  };

  const renderPieces=()=>{
    workspaceEl.querySelectorAll('.money-piece').forEach(el=>el.remove());

    pieces.forEach(piece=>{
      const d=denom(piece.denom);
      const el=document.createElement('button');
      el.type='button';
      el.className=`money-piece money-piece--${piece.denom}`;
      el.dataset.moneyPiece=String(piece.id);
      el.style.left=`${piece.x}px`;
      el.style.top=`${piece.y}px`;
      el.title=`${d.label} · drag to move · double-click to remove`;
      el.setAttribute('aria-label',`${d.label}. Drag to move. Double click to remove.`);

      const img=document.createElement('img');
      img.src=d.src;
      img.alt=d.label;
      img.draggable=false;
      el.appendChild(img);

      let dragging=false;
      let offsetX=0;
      let offsetY=0;

      el.addEventListener('pointerdown',event=>{
        if(event.button!==0)return;
        event.stopPropagation();
        dragging=true;
        const pieceRect=el.getBoundingClientRect();
        offsetX=event.clientX-pieceRect.left;
        offsetY=event.clientY-pieceRect.top;
        el.setPointerCapture(event.pointerId);
        el.classList.add('is-dragging');
      });

      el.addEventListener('pointermove',event=>{
        if(!dragging)return;
        const rect=workspaceEl.getBoundingClientRect();
        piece.x=event.clientX-rect.left-offsetX;
        piece.y=event.clientY-rect.top-offsetY;
        clampPiece(piece,el);
        el.style.left=`${piece.x}px`;
        el.style.top=`${piece.y}px`;
      });

      const stopDrag=event=>{
        if(!dragging)return;
        dragging=false;
        el.classList.remove('is-dragging');
        try{el.releasePointerCapture(event.pointerId)}catch{}
      };

      el.addEventListener('pointerup',stopDrag);
      el.addEventListener('pointercancel',stopDrag);

      el.addEventListener('dblclick',event=>{
        event.stopPropagation();
        pieces=pieces.filter(item=>item.id!==piece.id);
        renderPieces();
      });

      workspaceEl.appendChild(el);
    });

    updateSummary();
  };

  denominations.forEach(d=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='money-palette-item';
    button.draggable=true;
    button.dataset.denom=d.id;
    button.setAttribute('aria-label',`Add a ${d.label}`);

    const img=document.createElement('img');
    img.src=d.src;
    img.alt='';
    img.draggable=false;

    const text=document.createElement('span');
    const label=document.createElement('strong');
    label.textContent=d.label;
    const value=document.createElement('small');
    value.textContent=d.cents>=100?'$1.00':`${d.cents}¢`;
    text.append(label,value);

    button.append(img,text);

    button.addEventListener('click',()=>addPiece(d.id));
    button.addEventListener('dragstart',event=>{
      paletteDragId=d.id;
      event.dataTransfer?.setData('text/plain',d.id);
      if(event.dataTransfer)event.dataTransfer.effectAllowed='copy';
    });
    button.addEventListener('dragend',()=>{paletteDragId='';});

    palette.appendChild(button);
  });

  workspaceEl.addEventListener('dragover',event=>{
    event.preventDefault();
    workspaceEl.classList.add('is-drop-target');
    if(event.dataTransfer)event.dataTransfer.dropEffect='copy';
  });

  workspaceEl.addEventListener('dragleave',event=>{
    if(!workspaceEl.contains(event.relatedTarget))workspaceEl.classList.remove('is-drop-target');
  });

  workspaceEl.addEventListener('drop',event=>{
    event.preventDefault();
    workspaceEl.classList.remove('is-drop-target');

    const id=paletteDragId||event.dataTransfer?.getData('text/plain');
    if(!denom(id))return;

    const rect=workspaceEl.getBoundingClientRect();
    addPiece(id,event.clientX-rect.left-38,event.clientY-rect.top-38);
  });

  toggleTotal.addEventListener('click',()=>{
    totalVisible=!totalVisible;
    updateSummary();
  });

  clearButton.addEventListener('click',()=>{
    pieces=[];
    renderPieces();
  });

  m.querySelector('.money-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.money-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.money-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  const ro=new ResizeObserver(()=>{
    pieces.forEach(piece=>{
      const el=workspaceEl.querySelector(`[data-money-piece="${piece.id}"]`);
      if(el){
        clampPiece(piece,el);
        el.style.left=`${piece.x}px`;
        el.style.top=`${piece.y}px`;
      }
    });
  });
  ro.observe(workspaceEl);

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    ro.disconnect();
  };

  renderPieces();
}

function setupNumberLine(m){
  const stage=m.querySelector('.numberline-stage');
  const svg=m.querySelector('.numberline-svg');
  const valueAEl=m.querySelector('.numberline-value-a');
  const valueBEl=m.querySelector('.numberline-value-b');
  const pointSelectors=[...m.querySelectorAll('[data-numberline-point-select]')];
  const hopCount=m.querySelector('.numberline-hop-count');
  const stepButtons=[...m.querySelectorAll('[data-numberline-step]')];
  const extendButtons=[...m.querySelectorAll('[data-numberline-extend]')];
  const secondPointButton=m.querySelector('.numberline-second-point');
  const resetButton=m.querySelector('.numberline-reset');

  const defaultStart=0;
  const defaultEnd=20;
  const defaultWidth=920;
  const sidePadding=58;

  let start=defaultStart;
  let end=defaultEnd;
  let valueA=0;
  let valueB=null;
  let activePoint='a';

  const clampValue=n=>Math.max(start,Math.min(end,n));

  const labelSpacing=()=>{
    const longest=Math.max(String(start).length,String(end).length);
    return Math.max(38,longest*12+10);
  };

  const geometry=()=>{
    const spacing=labelSpacing();
    const count=end-start+1;
    const right=sidePadding+(count-1)*spacing;
    const totalWidth=right+sidePadding;
    return {
      spacing,
      left:sidePadding,
      right,
      totalWidth,
      xFor:n=>sidePadding+(n-start)*spacing
    };
  };

  const fitModuleToRange=({resetWidth=false}={})=>{
    const {totalWidth}=geometry();
    const requiredOuter=Math.ceil(totalWidth+36);
    const width=resetWidth
      ?Math.max(defaultWidth,requiredOuter)
      :Math.max(defaultWidth,requiredOuter,m.offsetWidth);

    m.style.minWidth=`${Math.max(defaultWidth,requiredOuter)}px`;
    m.style.width=`${width}px`;

    const currentLeft=parseFloat(m.style.left)||m.offsetLeft||0;
    if(currentLeft+width>BOARD_WIDTH){
      m.style.left=`${Math.max(0,BOARD_WIDTH-width)}px`;
    }
  };

  const selectPoint=point=>{
    if(point==='b'&&valueB===null)return;
    activePoint=point==='b'?'b':'a';

    pointSelectors.forEach(button=>{
      button.classList.toggle('is-active',button.dataset.numberlinePointSelect===activePoint);
    });

    render({fit:false});
  };

  const makeMarker=(point,value,xFor)=>{
    const marker=document.createElementNS('http://www.w3.org/2000/svg','g');
    marker.setAttribute('class',`numberline-marker numberline-marker--${point}${activePoint===point?' is-active':''}`);
    marker.dataset.numberlineMarkerPoint=point;
    marker.style.setProperty('--numberline-x',`${xFor(value)}px`);

    const stem=document.createElementNS('http://www.w3.org/2000/svg','line');
    stem.setAttribute('x1','0');
    stem.setAttribute('x2','0');
    stem.setAttribute('y1','50');
    stem.setAttribute('y2','93');
    stem.setAttribute('class','numberline-marker-stem');

    const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');
    circle.setAttribute('cx','0');
    circle.setAttribute('cy','38');
    circle.setAttribute('r','18');
    circle.setAttribute('class','numberline-marker-dot');

    const markerText=document.createElementNS('http://www.w3.org/2000/svg','text');
    markerText.setAttribute('x','0');
    markerText.setAttribute('y','44');
    markerText.setAttribute('text-anchor','middle');
    markerText.setAttribute('class','numberline-marker-text');
    markerText.textContent=String(value);

    marker.append(stem,circle,markerText);
    marker.addEventListener('click',event=>{
      event.stopPropagation();
      selectPoint(point);
    });

    return marker;
  };

  const renderHops=(xFor)=>{
    if(valueB===null||valueA===valueB)return;

    const direction=valueB>valueA?1:-1;
    const hops=Math.abs(valueB-valueA);

    for(let i=0;i<hops;i++){
      const from=valueA+i*direction;
      const to=from+direction;
      const x1=xFor(from);
      const x2=xFor(to);
      const mid=(x1+x2)/2;

      const path=document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d',`M ${x1} 101 Q ${mid} 63 ${x2} 101`);
      path.setAttribute('class','numberline-hop');
      path.style.setProperty('--hop-delay',`${i*70}ms`);
      svg.appendChild(path);

      const arrow=document.createElementNS('http://www.w3.org/2000/svg','path');
      arrow.setAttribute(
        'd',
        direction>0
          ?`M ${x2-8} 96 L ${x2} 101 L ${x2-8} 106`
          :`M ${x2+8} 96 L ${x2} 101 L ${x2+8} 106`
      );
      arrow.setAttribute('class','numberline-hop-arrow');
      arrow.style.setProperty('--hop-delay',`${i*70+110}ms`);
      svg.appendChild(arrow);
    }
  };

  const render=({fit=true,resetWidth=false}={})=>{
    if(fit)fitModuleToRange({resetWidth});

    svg.replaceChildren();

    const {spacing,left,right,totalWidth,xFor}=geometry();
    svg.setAttribute('viewBox',`0 0 ${totalWidth} 200`);
    svg.style.width=`${totalWidth}px`;
    svg.style.minWidth=`${totalWidth}px`;
    svg.style.maxWidth=`${totalWidth}px`;

    const line=document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1',String(left));
    line.setAttribute('x2',String(right));
    line.setAttribute('y1','105');
    line.setAttribute('y2','105');
    line.setAttribute('class','numberline-axis');
    svg.appendChild(line);

    const leftArrow=document.createElementNS('http://www.w3.org/2000/svg','path');
    leftArrow.setAttribute('d',`M ${left} 105 l 15 -9 v 18 z`);
    leftArrow.setAttribute('class','numberline-arrow');
    svg.appendChild(leftArrow);

    const rightArrow=document.createElementNS('http://www.w3.org/2000/svg','path');
    rightArrow.setAttribute('d',`M ${right} 105 l -15 -9 v 18 z`);
    rightArrow.setAttribute('class','numberline-arrow');
    svg.appendChild(rightArrow);

    renderHops(xFor);

    for(let n=start;n<=end;n++){
      const x=xFor(n);

      const tick=document.createElementNS('http://www.w3.org/2000/svg','line');
      tick.setAttribute('x1',String(x));
      tick.setAttribute('x2',String(x));
      tick.setAttribute('y1',n%5===0?'84':'91');
      tick.setAttribute('y2',n%5===0?'126':'119');
      tick.setAttribute('class','numberline-tick');
      tick.dataset.value=String(n);
      svg.appendChild(tick);

      const label=document.createElementNS('http://www.w3.org/2000/svg','text');
      label.setAttribute('x',String(x));
      label.setAttribute('y','158');
      label.setAttribute('text-anchor','middle');
      label.setAttribute('class','numberline-label');
      label.textContent=String(n);
      label.dataset.value=String(n);
      svg.appendChild(label);
    }

    svg.appendChild(makeMarker('a',valueA,xFor));
    if(valueB!==null)svg.appendChild(makeMarker('b',valueB,xFor));

    valueAEl.textContent=String(valueA);
    valueBEl.textContent=valueB===null?'':String(valueB);

    const bSelector=pointSelectors.find(button=>button.dataset.numberlinePointSelect==='b');
    if(bSelector)bSelector.hidden=valueB===null;

    pointSelectors.forEach(button=>{
      button.classList.toggle('is-active',button.dataset.numberlinePointSelect===activePoint);
    });

    secondPointButton.textContent=valueB===null?'+ Point':'Remove Point';

    if(valueB===null){
      hopCount.hidden=true;
      hopCount.textContent='';
    }else{
      const hops=Math.abs(valueB-valueA);
      hopCount.hidden=false;
      hopCount.textContent=`${hops} ${hops===1?'hop':'hops'}`;
    }

    const pointDescription=valueB===null
      ?`Point A is ${valueA}.`
      :`Point A is ${valueA}. Point B is ${valueB}. ${Math.abs(valueB-valueA)} hops between them.`;

    svg.setAttribute('aria-label',`Number line from ${start} to ${end}. ${pointDescription}`);
  };

  const moveActiveTo=next=>{
    const clamped=clampValue(Math.round(next));
    const current=activePoint==='b'?valueB:valueA;
    if(current===clamped)return;

    if(activePoint==='b'&&valueB!==null)valueB=clamped;
    else valueA=clamped;

    const readout=activePoint==='b'?valueBEl:valueAEl;
    readout.classList.remove('numberline-value-pop');
    void readout.offsetWidth;
    readout.classList.add('numberline-value-pop');

    render({fit:false});
  };

  svg.addEventListener('click',event=>{
    const marker=event.target.closest?.('[data-numberline-marker-point]');
    if(marker){
      selectPoint(marker.dataset.numberlineMarkerPoint);
      return;
    }

    const target=event.target.closest?.('[data-value]');
    if(target){
      moveActiveTo(Number(target.dataset.value));
      return;
    }

    const rect=svg.getBoundingClientRect();
    if(!rect.width)return;

    const {spacing}=geometry();
    const viewBox=svg.viewBox.baseVal;
    const x=((event.clientX-rect.left)/rect.width)*viewBox.width;
    const approx=start+(x-sidePadding)/spacing;
    moveActiveTo(Math.round(approx));
  });

  pointSelectors.forEach(button=>{
    button.addEventListener('click',()=>selectPoint(button.dataset.numberlinePointSelect));
  });

  stepButtons.forEach(button=>{
    button.addEventListener('click',()=>{
      const current=activePoint==='b'&&valueB!==null?valueB:valueA;
      moveActiveTo(current+Number(button.dataset.numberlineStep));
    });
  });

  secondPointButton.addEventListener('click',()=>{
    if(valueB===null){
      valueB=valueA<end?Math.min(end,valueA+5):Math.max(start,valueA-5);
      activePoint='b';
    }else{
      valueB=null;
      activePoint='a';
    }

    render({fit:false});
  });

  extendButtons.forEach(button=>{
    button.addEventListener('click',()=>{
      const nextStart=button.dataset.numberlineExtend==='left'?start-5:start;
      const nextEnd=button.dataset.numberlineExtend==='right'?end+5:end;

      const previousStart=start;
      const previousEnd=end;
      start=nextStart;
      end=nextEnd;

      const required=Math.ceil(geometry().totalWidth+36);
      if(required>BOARD_WIDTH-80){
        start=previousStart;
        end=previousEnd;
        return;
      }

      render();
    });
  });

  resetButton.addEventListener('click',()=>{
    start=defaultStart;
    end=defaultEnd;
    valueA=0;
    valueB=null;
    activePoint='a';
    m.style.minWidth='';
    m.style.width=`${defaultWidth}px`;
    render({fit:true,resetWidth:true});
  });

  m.addEventListener('pointerdown',event=>{
    if(!event.target.closest('button,input')){
      m.focus({preventScroll:true});
    }
  });

  m.addEventListener('keydown',event=>{
    if(event.target.closest('button,input'))return;

    const current=activePoint==='b'&&valueB!==null?valueB:valueA;

    if(event.key==='ArrowLeft'){
      event.preventDefault();
      moveActiveTo(current-1);
    }else if(event.key==='ArrowRight'){
      event.preventDefault();
      moveActiveTo(current+1);
    }
  });

  m.querySelector('.numberline-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.numberline-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.numberline-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  render({fit:true,resetWidth:true});
}


function setupHundredsChart(m){
  const grid=m.querySelector('.hundreds-grid');
  const toggleAll=m.querySelector('.hundreds-toggle-all');
  const highlightButton=m.querySelector('.hundreds-highlight');

  const hidden=new Set();
  let highlight='off';

  const isHighlighted=n=>{
    if(highlight==='5')return n%5===0;
    if(highlight==='10')return n%10===0;
    return false;
  };

  const render=()=>{
    grid.replaceChildren();

    for(let n=1;n<=100;n++){
      const button=document.createElement('button');
      button.type='button';
      button.className='hundreds-cell';
      button.dataset.number=String(n);
      button.setAttribute('aria-label',hidden.has(n)?`Reveal ${n}`:`Hide ${n}`);
      button.classList.toggle('is-hidden',hidden.has(n));
      button.classList.toggle('is-highlighted',isHighlighted(n));

      const span=document.createElement('span');
      span.textContent=String(n);
      button.appendChild(span);

      button.addEventListener('click',()=>{
        if(hidden.has(n))hidden.delete(n);
        else hidden.add(n);

        button.classList.remove('hundreds-cell-pop');
        void button.offsetWidth;
        button.classList.add('hundreds-cell-pop');
        render();
      });

      grid.appendChild(button);
    }

    toggleAll.textContent=hidden.size===100?'Show All':'Hide All';
    highlightButton.textContent=highlight==='off'
      ?'Highlight: Off'
      :highlight==='5'
        ?'Highlight: 5s'
        :'Highlight: 10s';

    m.dataset.highlight=highlight;
  };

  toggleAll.addEventListener('click',()=>{
    if(hidden.size===100)hidden.clear();
    else{
      hidden.clear();
      for(let n=1;n<=100;n++)hidden.add(n);
    }
    render();
  });

  highlightButton.addEventListener('click',()=>{
    highlight=highlight==='off'?'5':highlight==='5'?'10':'off';
    render();
  });

  m.querySelector('.hundreds-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.hundreds-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.hundreds-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  render();
}

function setupTenFrames(m){
  const board=m.querySelector('.tenframes-board');
  const countEl=m.querySelector('.tenframes-count');
  const frameCountEl=m.querySelector('.tenframes-frame-count');
  const addFrameButton=m.querySelector('.tenframes-add-frame');
  const removeFrameButton=m.querySelector('.tenframes-remove-frame');
  const addButtons=[...m.querySelectorAll('[data-tenframes-add]')];
  const clearButton=m.querySelector('.tenframes-clear');

  let frameCount=1;
  let placements=Array(10).fill(false);
  let draggedIndex=-1;

  const capacity=()=>frameCount*10;
  const countCounters=()=>placements.slice(0,capacity()).filter(Boolean).length;

  const ensureCapacityFor=amount=>{
    const current=countCounters();
    const needed=current+amount;
    const framesNeeded=Math.min(10,Math.max(frameCount,Math.ceil(needed/10)));
    if(framesNeeded>frameCount){
      frameCount=framesNeeded;
      while(placements.length<capacity())placements.push(false);
    }
  };

  const addCounters=amount=>{
    ensureCapacityFor(amount);
    let remaining=amount;

    for(let i=0;i<capacity()&&remaining>0;i++){
      if(!placements[i]){
        placements[i]=true;
        remaining--;
      }
    }

    render();
  };

  const moveCounter=(from,to)=>{
    if(from===to||from<0||to<0||from>=capacity()||to>=capacity())return;
    if(!placements[from])return;

    if(placements[to]){
      placements[from]=false;
    }else{
      placements[from]=false;
      placements[to]=true;
    }

    render();
  };

  const render=()=>{
    while(placements.length<capacity())placements.push(false);
    if(placements.length>capacity())placements=placements.slice(0,capacity());

    board.replaceChildren();

    for(let frameIndex=0;frameIndex<frameCount;frameIndex++){
      const frame=document.createElement('section');
      frame.className='tenframe';
      frame.setAttribute('aria-label',`Ten frame ${frameIndex+1}`);

      for(let cell=0;cell<10;cell++){
        const absolute=frameIndex*10+cell;
        const slot=document.createElement('button');
        slot.type='button';
        slot.className='tenframe-slot';
        slot.dataset.slot=String(absolute);
        slot.setAttribute('aria-label',placements[absolute]?`Counter in box ${absolute+1}. Click to remove.`:`Empty box ${absolute+1}. Click to add counter.`);

        if(placements[absolute]){
          const counter=document.createElement('span');
          counter.className='tenframe-counter';
          counter.draggable=true;
          counter.dataset.counter=String(absolute);

          counter.addEventListener('dragstart',event=>{
            draggedIndex=absolute;
            counter.classList.add('is-dragging');
            event.dataTransfer?.setData('text/plain',String(absolute));
            if(event.dataTransfer)event.dataTransfer.effectAllowed='move';
          });

          counter.addEventListener('dragend',()=>{
            draggedIndex=-1;
            counter.classList.remove('is-dragging');
            board.querySelectorAll('.is-drop-target').forEach(node=>node.classList.remove('is-drop-target'));
          });

          slot.appendChild(counter);
        }

        slot.addEventListener('click',event=>{
          if(event.target.closest('.tenframe-counter'))return;
          placements[absolute]=!placements[absolute];
          render();
        });

        slot.addEventListener('dragover',event=>{
          event.preventDefault();
          slot.classList.add('is-drop-target');
          if(event.dataTransfer)event.dataTransfer.dropEffect='move';
        });

        slot.addEventListener('dragleave',()=>{
          slot.classList.remove('is-drop-target');
        });

        slot.addEventListener('drop',event=>{
          event.preventDefault();
          slot.classList.remove('is-drop-target');
          const from=draggedIndex>=0?draggedIndex:Number(event.dataTransfer?.getData('text/plain'));
          if(Number.isInteger(from))moveCounter(from,absolute);
        });

        frame.appendChild(slot);
      }

      board.appendChild(frame);
    }

    const total=countCounters();
    countEl.textContent=String(total);
    frameCountEl.textContent=`${frameCount} ${frameCount===1?'frame':'frames'}`;
    removeFrameButton.disabled=frameCount<=1;
    addFrameButton.disabled=frameCount>=10;
    addButtons.forEach(button=>{
      button.disabled=total>=100;
    });
  };

  addFrameButton.addEventListener('click',()=>{
    if(frameCount>=10)return;
    frameCount++;
    while(placements.length<capacity())placements.push(false);
    render();
  });

  removeFrameButton.addEventListener('click',()=>{
    if(frameCount<=1)return;

    const removedStart=(frameCount-1)*10;
    const hasCounters=placements.slice(removedStart,removedStart+10).some(Boolean);

    if(hasCounters){
      const freeSlots=placements.slice(0,removedStart).reduce((sum,filled)=>sum+(filled?0:1),0);
      const removedCount=placements.slice(removedStart,removedStart+10).filter(Boolean).length;

      if(freeSlots<removedCount)return;

      let toMove=removedCount;
      for(let i=0;i<removedStart&&toMove>0;i++){
        if(!placements[i]){
          placements[i]=true;
          toMove--;
        }
      }
    }

    frameCount--;
    placements=placements.slice(0,capacity());
    render();
  });

  addButtons.forEach(button=>{
    button.addEventListener('click',()=>{
      addCounters(Number(button.dataset.tenframesAdd));
    });
  });

  clearButton.addEventListener('click',()=>{
    placements=Array(capacity()).fill(false);
    render();
  });

  m.querySelector('.tenframes-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.tenframes-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.tenframes-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  render();
}

function setupWordyPuzzle(m){
  const board=m.querySelector('.wordy-board');
  const keyboard=m.querySelector('.wordy-keyboard');
  const status=m.querySelector('.wordy-status');
  const guessCount=m.querySelector('.wordy-guess-count');
  const message=m.querySelector('.wordy-message');
  const setup=m.querySelector('.wordy-setup');
  const secretInput=m.querySelector('.wordy-secret-input');
  const setupError=m.querySelector('.wordy-setup-error');
  const startButton=m.querySelector('.wordy-start');
  const result=m.querySelector('.wordy-result');
  const resultLabel=m.querySelector('.wordy-result-label');
  const resultWord=m.querySelector('.wordy-result-word');
  const playAgain=m.querySelector('.wordy-play-again');
  const bgButton=m.querySelector('.wordy-bg');
  const fontButton=m.querySelector('.wordy-font');

  const keyboardRows=['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'];
  const maxGuesses=6;

  let secret='';
  let guesses=[];
  let current='';
  let finished=false;
  let revealing=false;
  let keyboardState={};

  const normalizeWord=value=>(value||'')
    .toUpperCase()
    .replace(/[^A-Z]/g,'');

  const stateRank=state=>({absent:1,present:2,correct:3}[state]||0);

  function setKeyState(letter,state){
    if(stateRank(state)>stateRank(keyboardState[letter])){
      keyboardState[letter]=state;
    }
  }

  function clearAnimations(){
    board.querySelectorAll('.wordy-row,.wordy-tile').forEach(el=>{
      el.classList.remove('is-shaking','is-bouncing','is-flipping');
    });
  }

  function buildBoard(){
    board.replaceChildren();
    board.style.maxWidth=`${Math.min(590,secret.length*64)}px`;

    for(let rowIndex=0;rowIndex<maxGuesses;rowIndex++){
      const row=document.createElement('div');
      row.className='wordy-row';
      row.dataset.row=String(rowIndex);
      row.style.gridTemplateColumns=`repeat(${secret.length},minmax(0,1fr))`;

      for(let col=0;col<secret.length;col++){
        const tile=document.createElement('div');
        tile.className='wordy-tile';
        tile.setAttribute('aria-hidden','true');
        row.appendChild(tile);
      }

      board.appendChild(row);
    }
  }

  function buildKeyboard(){
    keyboard.replaceChildren();

    keyboardRows.forEach((letters,rowIndex)=>{
      const row=document.createElement('div');
      row.className='wordy-keyboard-row';

      if(rowIndex===2){
        const enter=document.createElement('button');
        enter.type='button';
        enter.className='wordy-key wordy-key--wide';
        enter.textContent='ENTER';
        enter.dataset.action='enter';
        enter.addEventListener('click',submitGuess);
        row.appendChild(enter);
      }

      [...letters].forEach(letter=>{
        const button=document.createElement('button');
        button.type='button';
        button.className='wordy-key';
        button.textContent=letter;
        button.dataset.letter=letter;
        button.addEventListener('click',()=>typeLetter(letter));
        row.appendChild(button);
      });

      if(rowIndex===2){
        const backspace=document.createElement('button');
        backspace.type='button';
        backspace.className='wordy-key wordy-key--wide wordy-key--backspace';
        backspace.textContent='⌫';
        backspace.dataset.action='backspace';
        backspace.setAttribute('aria-label','Backspace');
        backspace.addEventListener('click',backspaceLetter);
        row.appendChild(backspace);
      }

      keyboard.appendChild(row);
    });
  }

  function renderKeyboard(){
    keyboard.querySelectorAll('.wordy-key[data-letter]').forEach(button=>{
      const keyState=keyboardState[button.dataset.letter]||'';
      button.dataset.state=keyState;
      button.disabled=finished||revealing||!secret;
    });

    keyboard.querySelectorAll('.wordy-key[data-action]').forEach(button=>{
      button.disabled=finished||revealing||!secret;
    });
  }

  function renderCurrent(){
    const row=board.querySelector(`.wordy-row[data-row="${guesses.length}"]`);
    if(!row)return;

    [...row.children].forEach((tile,index)=>{
      tile.textContent=current[index]||'';
      tile.classList.toggle('has-letter',Boolean(current[index]));
    });
  }

  function renderProgress(){
    status.textContent=finished?'ROUND COMPLETE':'GUESS THE WORD';
    guessCount.textContent=secret&&!finished
      ?`Guess ${Math.min(guesses.length+1,maxGuesses)} of ${maxGuesses}`
      :'';
    renderKeyboard();
  }

  function scoreGuess(guess){
    const states=Array(secret.length).fill('absent');
    const remaining={};

    for(let i=0;i<secret.length;i++){
      if(guess[i]===secret[i]){
        states[i]='correct';
      }else{
        remaining[secret[i]]=(remaining[secret[i]]||0)+1;
      }
    }

    for(let i=0;i<secret.length;i++){
      if(states[i]==='correct')continue;
      const letter=guess[i];
      if(remaining[letter]>0){
        states[i]='present';
        remaining[letter]--;
      }
    }

    return states;
  }

  function shakeCurrentRow(text){
    const row=board.querySelector(`.wordy-row[data-row="${guesses.length}"]`);
    if(!row)return;

    message.textContent=text;
    row.classList.remove('is-shaking');
    void row.offsetWidth;
    row.classList.add('is-shaking');
    setTimeout(()=>row.classList.remove('is-shaking'),420);
  }

  function revealGuess(guess,states){
    revealing=true;
    renderKeyboard();

    const rowIndex=guesses.length-1;
    const row=board.querySelector(`.wordy-row[data-row="${rowIndex}"]`);
    const tiles=[...row.children];

    tiles.forEach((tile,index)=>{
      tile.textContent=guess[index];
      tile.classList.remove('has-letter');
      tile.classList.add('is-flipping');
      tile.style.setProperty('--wordy-delay',`${index*115}ms`);

      setTimeout(()=>{
        tile.dataset.state=states[index];
        setKeyState(guess[index],states[index]);
      },index*115+170);
    });

    const duration=(secret.length-1)*115+560;

    setTimeout(()=>{
      revealing=false;
      tiles.forEach(tile=>tile.classList.remove('is-flipping'));
      renderKeyboard();

      const won=guess===secret;
      const lost=!won&&guesses.length>=maxGuesses;

      if(won){
        row.classList.add('is-bouncing');
        setTimeout(()=>finishRound(true),430);
      }else if(lost){
        finishRound(false);
      }else{
        current='';
        message.textContent='';
        renderCurrent();
        renderProgress();
      }
    },duration);
  }

  function submitGuess(){
    if(!secret||finished||revealing)return;

    if(current.length!==secret.length){
      shakeCurrentRow(`Enter ${secret.length} letters`);
      return;
    }

    const guess=current;
    const states=scoreGuess(guess);
    guesses.push(guess);
    revealGuess(guess,states);
  }

  function typeLetter(letter){
    if(!secret||finished||revealing)return;
    if(current.length>=secret.length)return;

    current+=letter;
    message.textContent='';
    renderCurrent();

    const row=board.querySelector(`.wordy-row[data-row="${guesses.length}"]`);
    const tile=row?.children[current.length-1];
    if(tile){
      tile.classList.remove('wordy-pop');
      void tile.offsetWidth;
      tile.classList.add('wordy-pop');
    }
  }

  function backspaceLetter(){
    if(!secret||finished||revealing||!current.length)return;
    current=current.slice(0,-1);
    message.textContent='';
    renderCurrent();
  }

  function finishRound(won){
    finished=true;
    revealing=false;
    status.textContent=won?'YOU GOT IT!':'ROUND COMPLETE';
    guessCount.textContent='';
    renderKeyboard();

    resultLabel.textContent=won
      ?'You guessed the word'
      :'You ran out of guesses';
    resultWord.textContent=secret;
    result.hidden=false;

    if(won)launchConfetti(m);
  }

  function startGame(){
    const next=normalizeWord(secretInput.value);

    if(next.length<3||next.length>8){
      setupError.textContent='Enter a word from 3 to 8 letters.';
      secretInput.focus();
      return;
    }

    secret=next;
    guesses=[];
    current='';
    finished=false;
    revealing=false;
    keyboardState={};

    setupError.textContent='';
    secretInput.value='';
    setup.hidden=true;
    result.hidden=true;
    resultLabel.textContent='';
    resultWord.textContent='';
    message.textContent='';

    buildBoard();
    renderProgress();

    requestAnimationFrame(()=>{
      m.focus({preventScroll:true});
    });
  }

  function openSetup(){
    secret='';
    guesses=[];
    current='';
    finished=false;
    revealing=false;
    keyboardState={};

    clearAnimations();
    board.replaceChildren();
    message.textContent='';
    status.textContent='TEACHER SETUP';
    guessCount.textContent='';
    result.hidden=true;
    setup.hidden=false;
    setupError.textContent='';
    secretInput.value='';

    keyboard.querySelectorAll('.wordy-key').forEach(button=>{
      button.disabled=true;
      delete button.dataset.state;
    });

    requestAnimationFrame(()=>secretInput.focus({preventScroll:true}));
  }

  startButton.addEventListener('click',startGame);

  secretInput.addEventListener('input',()=>{
    const cleaned=normalizeWord(secretInput.value);
    if(secretInput.value!==cleaned)secretInput.value=cleaned;
    setupError.textContent='';
  });

  secretInput.addEventListener('keydown',event=>{
    if(event.key==='Enter'){
      event.preventDefault();
      startGame();
    }
  });

  playAgain.addEventListener('click',event=>{
    event.stopPropagation();
    openSetup();
  });

  m.addEventListener('pointerdown',event=>{
    if(setup.hidden&&result.hidden&&!event.target.closest('button,input')){
      m.focus({preventScroll:true});
    }
  });

  m.addEventListener('keydown',event=>{
    if(!secret||finished||revealing)return;
    if(event.target.closest('input'))return;

    if(/^[a-zA-Z]$/.test(event.key)){
      event.preventDefault();
      typeLetter(event.key.toUpperCase());
      return;
    }

    if(event.key==='Backspace'){
      event.preventDefault();
      backspaceLetter();
      return;
    }

    if(event.key==='Enter'){
      event.preventDefault();
      submitGuess();
    }
  });

  bgButton.addEventListener('click',()=>{
    cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']);
  });

  fontButton.addEventListener('click',()=>{
    cycleData(m,'font',FONT_OPTIONS);
  });

  buildKeyboard();
  openSetup();
}

function setupHangman(m){
  const status=m.querySelector('.hangman-status');
  const wordEl=m.querySelector('.hangman-word');
  const wrongEl=m.querySelector('.hangman-wrong-letters');
  const keyboard=m.querySelector('.hangman-keyboard');
  const setup=m.querySelector('.hangman-setup');
  const input=m.querySelector('.hangman-word-input');
  const saveButton=m.querySelector('.hangman-save-word');
  const result=m.querySelector('.hangman-result');
  const resultLabel=m.querySelector('.hangman-result-label');
  const resultMessage=m.querySelector('.hangman-result-message');
  const bgButton=m.querySelector('.hangman-bg');
  const fontButton=m.querySelector('.hangman-font');
  const parts=[...m.querySelectorAll('.hangman-part')];

  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  let secret='';
  let guessed=new Set();
  let wrong=[];
  let finished=false;
  const maxWrong=6;

  function normalizeWord(value){
    return value.toUpperCase().replace(/[^A-Z ]+/g,'').replace(/\s+/g,' ').trim();
  }

  function clearRound(){
    secret='';
    guessed=new Set();
    wrong=[];
    finished=false;
    m.classList.remove('is-finished');
    result.hidden=true;
    resultLabel.textContent='';
    resultMessage.textContent='';
    status.textContent='READY';
    wrongEl.textContent='—';

    parts.forEach(part=>part.classList.remove('is-visible'));

    wordEl.replaceChildren();
    const placeholder=document.createElement('div');
    placeholder.style.opacity='.35';
    placeholder.style.fontWeight='800';
    placeholder.style.fontSize='13px';
    placeholder.textContent='New round';
    wordEl.append(placeholder);

    keyboard.querySelectorAll('.hangman-key').forEach(b=>{
      b.disabled=true;
      b.classList.remove('is-correct','is-wrong');
    });
  }

  function openSetup(){
    clearRound();
    input.value='';
    setup.hidden=false;
    requestAnimationFrame(()=>input.focus());
  }

  function closeSetup(){
    setup.hidden=true;
  }

  function buildKeyboard(){
    keyboard.replaceChildren();
    alphabet.forEach(letter=>{
      const b=document.createElement('button');
      b.className='hangman-key';
      b.type='button';
      b.textContent=letter;
      b.dataset.letter=letter;
      b.disabled=true;
      b.addEventListener('click',()=>guess(letter));
      keyboard.append(b);
    });
  }

  function renderFigure(){
    parts.forEach((part,i)=>part.classList.toggle('is-visible',i<wrong.length));
  }

  function renderWord(){
    wordEl.replaceChildren();

    if(!secret)return;

    [...secret].forEach(char=>{
      const slot=document.createElement('span');
      slot.className='hangman-letter-slot';

      if(char===' '){
        slot.classList.add('is-space');
      }else{
        slot.textContent=guessed.has(char)||finished?char:'';
      }

      wordEl.append(slot);
    });
  }

  function renderKeyboard(){
    keyboard.querySelectorAll('.hangman-key').forEach(b=>{
      const letter=b.dataset.letter;
      const used=guessed.has(letter);

      b.disabled=!secret||finished||used;
      b.classList.toggle('is-correct',used&&secret.includes(letter));
      b.classList.toggle('is-wrong',used&&!secret.includes(letter));
    });
  }

  function render(){
    renderWord();
    renderFigure();
    renderKeyboard();
    wrongEl.textContent=wrong.length?wrong.join(' '):'—';

    if(secret&&!finished){
      const tries=maxWrong-wrong.length;
      status.textContent=`${tries} ${tries===1?'TRY':'TRIES'} LEFT`;
    }
  }

  function checkWin(){
    const letters=[...new Set(secret.replace(/ /g,''))];
    return letters.every(letter=>guessed.has(letter));
  }

  function finish(won){
    finished=true;
    m.classList.add('is-finished');
    renderWord();
    renderKeyboard();

    if(won){
      status.textContent='YOU WON!';
      resultLabel.textContent='YOU WON!';
      resultMessage.textContent=`The word was ${secret}!`;
      launchConfetti(m);
    }else{
      status.textContent='TRY AGAIN!';
      resultLabel.textContent='TRY AGAIN!';
      resultMessage.textContent=`The word was ${secret}!`;
    }

    result.hidden=false;
  }

  function guess(letter){
    if(!secret||finished||guessed.has(letter))return;

    guessed.add(letter);

    if(!secret.includes(letter)){
      wrong.push(letter);
    }

    if(checkWin()){
      finish(true);
      return;
    }

    if(wrong.length>=maxWrong){
      finish(false);
      return;
    }

    render();
  }

  function startGame(){
    const next=normalizeWord(input.value);

    if(!next){
      input.focus();
      return;
    }

    secret=next;
    guessed=new Set();
    wrong=[];
    finished=false;
    m.classList.remove('is-finished');
    closeSetup();
    render();
  }

  saveButton.addEventListener('click',startGame);

  input.addEventListener('keydown',e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      startGame();
    }
  });

  result.addEventListener('click',e=>{
    e.stopPropagation();
    if(result.hidden)return;
    openSetup();
  });

  bgButton.addEventListener('click',()=>{
    cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']);
  });

  fontButton.addEventListener('click',()=>{
    cycleData(m,'font',FONT_OPTIONS);
  });

  buildKeyboard();
  openSetup();
}

function setupSpinner(m){
  const canvas=m.querySelector('.spinner-canvas');
  const ctx=canvas.getContext('2d');
  const spinButton=m.querySelector('.spinner-spin-button');
  const winner=m.querySelector('.spinner-winner');
  const resultOverlay=m.querySelector('.spinner-result-overlay');
  const resultName=m.querySelector('.spinner-result-name');
  const confettiLayer=m.querySelector('.spinner-confetti-layer');
  const spinAudio=m.querySelector('.spinner-spin-audio');
  const input=m.querySelector('.spinner-name-input');
  const addButton=m.querySelector('.spinner-add-name');
  const list=m.querySelector('.spinner-name-list');
  const bgButton=m.querySelector('.spinner-bg');
  const fontButton=m.querySelector('.spinner-font');

  let names=['Alex','Jordan','Taylor','Morgan'];
  let rotation=0;
  let spinning=false;
  let raf=0;
  let winnerVisible=false;

  const palette=[
    '#f2b5a7','#f5d38b','#bedca8','#9fd8cf',
    '#a9c8ef','#c5b5ec','#efb5d0','#d7c6a5',
    '#f3c1a0','#b8d6e8','#c9dda5','#e5b7a7'
  ];

  const getWheelFont=()=>{
    const family=getComputedStyle(m).getPropertyValue('--module-font').trim();
    return family||'Inter,system-ui,sans-serif';
  };

  function renderNameList(){
    list.replaceChildren();
    names.forEach((name,i)=>{
      const chip=document.createElement('div');
      chip.className='spinner-name-chip';
      const text=document.createElement('span');
      text.textContent=name;
      const remove=document.createElement('button');
      remove.type='button';
      remove.setAttribute('aria-label',`Remove ${name}`);
      remove.textContent='×';
      remove.addEventListener('click',()=>{
        if(spinning)return;
        names.splice(i,1);
        renderNameList();
        drawWheel();
        winner.textContent=names.length?'CLICK TO SPIN':'ADD NAMES';
      });
      chip.append(text,remove);
      list.append(chip);
    });
  }

  function drawWheel(){
    const dpr=Math.max(1,window.devicePixelRatio||1);
    const size=560;
    if(canvas.width!==size*dpr||canvas.height!==size*dpr){
      canvas.width=size*dpr;
      canvas.height=size*dpr;
      canvas.style.aspectRatio='1';
    }
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,size,size);

    const cx=size/2,cy=size/2,r=258;
    ctx.save();
    ctx.translate(cx,cy);
    ctx.rotate(rotation);

    if(!names.length){
      ctx.beginPath();
      ctx.arc(0,0,r,0,Math.PI*2);
      ctx.fillStyle='#ececef';
      ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,.12)';
      ctx.lineWidth=3;
      ctx.stroke();
      ctx.restore();
      return;
    }

    const arc=Math.PI*2/names.length;
    const fontBase=Math.max(12,Math.min(25,165/names.length+10));
    const wheelFont=getWheelFont();

    names.forEach((name,i)=>{
      const start=-Math.PI/2+i*arc;
      const end=start+arc;

      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.arc(0,0,r,start,end);
      ctx.closePath();
      ctx.fillStyle=palette[i%palette.length];
      ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.68)';
      ctx.lineWidth=2;
      ctx.stroke();

      ctx.save();
      ctx.rotate(start+arc/2);
      ctx.translate(r*.63,0);
      ctx.rotate(Math.PI/2);
      ctx.fillStyle='#22252a';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.font=`800 ${fontBase}px ${wheelFont}`;

      let label=name;
      const maxWidth=Math.max(60,r*arc*.58);
      if(ctx.measureText(label).width>maxWidth){
        while(label.length>3&&ctx.measureText(label+'…').width>maxWidth)label=label.slice(0,-1);
        label+='…';
      }
      ctx.fillText(label,0,0);
      ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(0,0,r,0,Math.PI*2);
    ctx.strokeStyle='rgba(0,0,0,.13)';
    ctx.lineWidth=4;
    ctx.stroke();
    ctx.restore();
  }

  function addName(){
    const value=input.value.trim();
    if(!value||spinning)return;
    names.push(value);
    input.value='';
    renderNameList();
    drawWheel();
    winner.textContent='CLICK TO SPIN';
    input.focus();
  }

  function fireSpinnerConfetti(){
    confettiLayer.replaceChildren();
    const colors=['#ff6b7a','#ffd34e','#69c6ff','#7edc8b','#9d7cff','#ff9c5a'];
    for(let i=0;i<66;i++){
      const p=document.createElement('i');
      p.className='spinner-confetti-piece';
      const a=Math.random()*Math.PI*2;
      const d=110+Math.random()*250;
      p.style.setProperty('--x',`${Math.cos(a)*d}px`);
      p.style.setProperty('--y',`${Math.sin(a)*d+65}px`);
      p.style.setProperty('--r',`${Math.round(Math.random()*900-450)}deg`);
      p.style.setProperty('--confetti',colors[i%colors.length]);
      p.style.width=`${5+Math.random()*6}px`;
      p.style.height=`${7+Math.random()*9}px`;
      p.style.animationDelay=`${Math.random()*.1}s`;
      confettiLayer.append(p);
    }
    setTimeout(()=>confettiLayer.replaceChildren(),1550);
  }

  function dismissWinner(){
    if(!winnerVisible)return;
    winnerVisible=false;
    resultOverlay.classList.remove('is-visible');
    resultOverlay.hidden=true;
    winner.textContent=names.length?'CLICK TO SPIN':'ADD NAMES';
  }

  function showWinner(name){
    winnerVisible=true;
    winner.textContent=name;
    resultName.textContent=name;
    resultOverlay.hidden=false;
    resultOverlay.classList.remove('is-visible');
    void resultOverlay.offsetWidth;
    resultOverlay.classList.add('is-visible');

    m.classList.remove('spinner-pop');
    void m.offsetWidth;
    m.classList.add('spinner-pop');

    fireSpinnerConfetti();
    playUiSfx('collection');
  }

  async function spin(){
    if(spinning||winnerVisible||names.length<1)return;

    spinning=true;
    m.classList.add('is-spinning');
    spinButton.disabled=true;
    winner.textContent='SPINNING…';

    resultOverlay.classList.remove('is-visible');
    resultOverlay.hidden=true;

    const arc=Math.PI*2/names.length;

    // Choose a target segment, but stop inside its safe center zone rather than on an edge.
    const targetIndex=Math.floor(Math.random()*names.length);
    const safety=arc*.18;
    const jitterRange=Math.max(0,arc/2-safety);
    const centerJitter=(Math.random()*2-1)*jitterRange*.55;

    // Segments are drawn starting at -PI/2 before wheel rotation.
    // The fixed pointer is at -PI/2, so solve the final rotation that places
    // the selected segment's interior point directly beneath the pointer.
    const targetLocalAngle=-Math.PI/2+(targetIndex+.5)*arc+centerJitter;
    const desiredRotation=-Math.PI/2-targetLocalAngle;

    const tau=Math.PI*2;
    const currentNorm=((rotation%tau)+tau)%tau;
    const desiredNorm=((desiredRotation%tau)+tau)%tau;

    let delta=desiredNorm-currentNorm;
    if(delta<0)delta+=tau;

    const turns=5+Math.floor(Math.random()*3);
    const total=turns*tau+delta;
    const startRotation=rotation;

    spinAudio.pause();
    spinAudio.currentTime=0;

    if(!Number.isFinite(spinAudio.duration)||spinAudio.duration<=0){
      await new Promise(resolve=>{
        const done=()=>resolve();
        spinAudio.addEventListener('loadedmetadata',done,{once:true});
        spinAudio.load();
      });
    }

    const duration=Math.max(600,(Number.isFinite(spinAudio.duration)?spinAudio.duration:3.683)*1000);
    const start=performance.now();
    const ease=t=>1-Math.pow(1-t,4);

    spinAudio.play().catch(()=>{});

    cancelAnimationFrame(raf);
    const tick=now=>{
      const t=Math.min(1,(now-start)/duration);
      rotation=startRotation+total*ease(t);
      drawWheel();

      if(t<1){
        raf=requestAnimationFrame(tick);
      }else{
        rotation=startRotation+total;
        drawWheel();

        spinning=false;
        m.classList.remove('is-spinning');
        spinButton.disabled=false;

        if(!spinAudio.paused){
          spinAudio.pause();
          spinAudio.currentTime=spinAudio.duration||0;
        }

        // Determine the actual winning segment from the wheel's final physical
        // position under the fixed pointer. This guarantees popup = landed tile.
        const finalNorm=((rotation%tau)+tau)%tau;
        const pointerLocal=(((-Math.PI/2-finalNorm)+tau)%tau);
        const segmentIndex=Math.floor(((pointerLocal+Math.PI/2+tau)%tau)/arc)%names.length;

        showWinner(names[segmentIndex]);
      }
    };

    raf=requestAnimationFrame(tick);
  }

  bgButton.addEventListener('click',()=>{
    cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']);
  });

  fontButton.addEventListener('click',()=>{
    cycleData(m,'font',FONT_OPTIONS);
    requestAnimationFrame(drawWheel);
  });

  addButton.addEventListener('click',addName);
  input.addEventListener('keydown',e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      addName();
    }
  });

  spinButton.addEventListener('click',e=>{
    e.stopPropagation();
    spin();
  });

  canvas.addEventListener('click',e=>{
    e.stopPropagation();
    spin();
  });

  m.addEventListener('click',e=>{
    if(!winnerVisible)return;
    if(e.target.closest('.module-delete,.spinner-customization,.spinner-settings,.resize-handle'))return;
    dismissWinner();
  });

  const ro=new ResizeObserver(()=>drawWheel());
  ro.observe(m);

  renderNameList();
  drawWheel();

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    cancelAnimationFrame(raf);
    ro.disconnect();
    spinAudio.pause();
    spinAudio.currentTime=0;
  };
}


function setupChangelog(){
  const button=document.getElementById('changelog-toggle');
  const backdrop=document.getElementById('changelog-backdrop');
  const panel=document.getElementById('changelog-panel');
  const closeButton=document.getElementById('changelog-close');
  const changelogContent=document.getElementById('changelog-content');
  const newsContent=document.getElementById('news-content');
  const tabs=[...document.querySelectorAll('[data-updates-tab]')];
  const panes=[...document.querySelectorAll('[data-updates-pane]')];
  const contactForm=document.getElementById('contact-form');
  const contactStatus=document.getElementById('contact-status');
  const contactSubmit=document.getElementById('contact-submit');

  if(!button||!backdrop||!panel||!closeButton||!changelogContent||!newsContent)return;

  const loaded={changelog:false,news:false};
  let activeTab='changelog';

  const escapeHtml=value=>String(value)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");

  const inlineMarkdown=text=>{
    let safe=escapeHtml(text);
    safe=safe.replace(/`([^`]+)`/g,'<code>$1</code>');
    safe=safe.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
    safe=safe.replace(/\*([^*]+)\*/g,'<em>$1</em>');
    safe=safe.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return safe;
  };

  const renderMarkdown=markdown=>{
    const lines=markdown.replace(/\r\n?/g,'\n').split('\n');
    const out=[];
    let listOpen=false;

    const closeList=()=>{
      if(listOpen){
        out.push('</ul>');
        listOpen=false;
      }
    };

    for(const raw of lines){
      const line=raw.trimEnd();
      if(!line.trim()){
        closeList();
        continue;
      }

      const heading=line.match(/^(#{1,3})\s+(.+)$/);
      if(heading){
        closeList();
        const level=heading[1].length;
        out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
        continue;
      }

      const bullet=line.match(/^\s*[-*]\s+(.+)$/);
      if(bullet){
        if(!listOpen){
          out.push('<ul>');
          listOpen=true;
        }
        out.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
        continue;
      }

      closeList();
      out.push(`<p>${inlineMarkdown(line)}</p>`);
    }

    closeList();
    return out.join('');
  };

  async function loadFeed(kind){
    const isNews=kind==='news';
    const content=isNews?newsContent:changelogContent;
    const folder=isNews?'news':'changelog';
    const globalData=isNews?window.TeacherTilesNewsData:window.TeacherTilesChangelogData;
    const label=isNews?'news':'changelog';

    content.innerHTML=`<div class="changelog-loading">Loading ${label}…</div>`;

    try{
      let valid=[];

      if(Array.isArray(globalData)&&globalData.length){
        valid=globalData
          .filter(entry=>entry&&entry.file&&typeof entry.text==='string')
          .slice();
      }else{
        const response=await fetch(`${folder}/index.json?ts=${Date.now()}`,{cache:'no-store'});
        if(!response.ok)throw new Error(`Could not load ${label} index.`);

        const data=await response.json();
        const files=Array.isArray(data.files)?data.files:[];

        const entries=await Promise.all(files.map(async entry=>{
          const file=typeof entry==='string'?entry:entry.file;
          const addedAt=typeof entry==='object'&&entry?entry.addedAt:null;
          if(!file)return null;

          const res=await fetch(`${folder}/${encodeURIComponent(file)}?ts=${Date.now()}`,{cache:'no-store'});
          if(!res.ok)return null;
          return {file,addedAt,text:await res.text()};
        }));

        valid=entries.filter(Boolean);
      }

      if(!valid.length){
        content.innerHTML=`<div class="changelog-empty">No ${label} entries yet.</div>`;
        loaded[kind]=true;
        return;
      }

      content.replaceChildren();
      for(const entry of valid){
        const article=document.createElement('article');
        article.className='changelog-entry';
        article.innerHTML=renderMarkdown(entry.text);
        content.append(article);
      }

      loaded[kind]=true;
    }catch(err){
      content.innerHTML=`<div class="changelog-error">The ${label} feed could not be loaded.</div>`;
      console.error(err);
    }
  }

  async function selectTab(name){
    activeTab=name;

    for(const tab of tabs){
      const active=tab.dataset.updatesTab===name;
      tab.classList.toggle('is-active',active);
      tab.setAttribute('aria-selected',String(active));
    }

    for(const pane of panes){
      const active=pane.dataset.updatesPane===name;
      pane.hidden=!active;
      pane.classList.toggle('is-active',active);
    }

    if((name==='changelog'||name==='news')&&!loaded[name]){
      await loadFeed(name);
    }
  }

  async function openChangelog(){
    backdrop.hidden=false;
    requestAnimationFrame(()=>backdrop.classList.add('is-open'));
    await selectTab(activeTab);
    closeButton.focus({preventScroll:true});
  }

  function closeChangelog(){
    backdrop.classList.remove('is-open');
    window.setTimeout(()=>{backdrop.hidden=true},190);
    button.focus({preventScroll:true});
  }

  tabs.forEach(tab=>{
    tab.addEventListener('click',()=>selectTab(tab.dataset.updatesTab));
  });

  if(contactForm&&contactSubmit&&contactStatus){
    contactForm.addEventListener('submit',async e=>{
      e.preventDefault();

      if(!contactForm.reportValidity())return;

      const formData=new FormData(contactForm);
      const name=String(formData.get('name')||'').trim();
      const email=String(formData.get('email')||'').trim();
      const subject=String(formData.get('subject')||'').trim();
      const message=String(formData.get('message')||'').trim();

      contactSubmit.disabled=true;
      contactSubmit.textContent='Sending…';
      contactStatus.className='contact-status';
      contactStatus.textContent='Sending your message…';

      try{
        const payload=new FormData();
        payload.append('name',name);
        payload.append('email',email);
        payload.append('subject',subject);
        payload.append('message',message);
        payload.append('_subject',`TeacherTiles Contact: ${subject}`);
        payload.append('_template','table');
        payload.append('_captcha','false');

        const response=await fetch('https://formsubmit.co/ajax/jacksweikert@gmail.com',{
          method:'POST',
          headers:{Accept:'application/json'},
          body:payload
        });

        const result=await response.json().catch(()=>null);
        if(!response.ok||result?.success===false){
          throw new Error(result?.message||'Message could not be sent.');
        }

        contactForm.reset();
        contactStatus.className='contact-status is-success';
        contactStatus.textContent='Message sent. Thank you!';
      }catch(err){
        console.error(err);
        contactStatus.className='contact-status is-error';
        contactStatus.textContent='Could not send automatically. Please try again in a moment.';
      }finally{
        contactSubmit.disabled=false;
        contactSubmit.textContent='Send Message';
      }
    });
  }

  button.addEventListener('click',openChangelog);
  closeButton.addEventListener('click',closeChangelog);
  backdrop.addEventListener('click',e=>{
    if(e.target===backdrop)closeChangelog();
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!backdrop.hidden)closeChangelog();
  });
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',setupChangelog,{once:true});
}else{
  setupChangelog();
}

(function setupTeacherTilesIntro() {
  const intro = document.getElementById('teachertiles-intro');
  if (!intro) return;

  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const holdTime = reduced ? 220 : 1260;

  if (!reduced) window.setTimeout(() => playUiSfx('intro'), 830);

  window.setTimeout(() => {
    intro.classList.add('is-leaving');
    window.setTimeout(() => intro.remove(), reduced ? 150 : 430);
  }, holdTime);
})();


(() => {
  const topRightTray = document.querySelector('.workspace-controls');
  const bottomLeftTray = document.querySelector('.workspace-upcoming-controls');
  if (!topRightTray || !bottomLeftTray) return;

  const FULL_X = 250;
  const FULL_Y = 175;
  const NEAR_X = 330;
  const NEAR_Y = 235;

  const setState = (tray, full, near) => {
    tray.classList.toggle('is-revealed', full);
    tray.classList.toggle('is-near', !full && near);
  };

  document.addEventListener('pointermove', event => {
    if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;

    const topRightFull =
      event.clientX >= window.innerWidth - FULL_X &&
      event.clientY <= FULL_Y;
    const topRightNear =
      event.clientX >= window.innerWidth - NEAR_X &&
      event.clientY <= NEAR_Y;

    const bottomLeftFull =
      event.clientX <= FULL_X &&
      event.clientY >= window.innerHeight - FULL_Y;
    const bottomLeftNear =
      event.clientX <= NEAR_X &&
      event.clientY >= window.innerHeight - NEAR_Y;

    setState(
      topRightTray,
      topRightFull || topRightTray.matches(':hover') || topRightTray.matches(':focus-within'),
      topRightNear
    );
    setState(
      bottomLeftTray,
      bottomLeftFull || bottomLeftTray.matches(':hover') || bottomLeftTray.matches(':focus-within'),
      bottomLeftNear
    );
  }, { passive:true });

  topRightTray.addEventListener('pointerenter', () => setState(topRightTray, true, true));
  bottomLeftTray.addEventListener('pointerenter', () => setState(bottomLeftTray, true, true));
})();

