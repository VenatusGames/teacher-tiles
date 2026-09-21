(() => {
  'use strict';
  const colors=['#88bdf0','#b9a2e7','#83cbb8','#edbc7b','#e9a3b6','#9fc681'];
  const strips=new Map();
  let frame=0;
  const clone=value=>structuredClone(value);
  function label(snapshot,index){return snapshot.tabLabel||document.querySelector(`.context-menu__item[data-module="${CSS.escape(snapshot.type)}"] strong`)?.textContent||`Tab ${index+1}`;}
  function bare(snapshot){const copy=clone(snapshot);delete copy.tabs;copy.classes=(copy.classes||[]).filter(name=>name!=='is-tabbed-tile');return copy;}
  function capture(m,base){
    if(!m._tileTabs)return base;
    const state=clone(m._tileTabs);
    state.items[state.active]={...bare(base),tabLabel:state.items[state.active]?.tabLabel||''};
    base.tabs=state;
    return base;
  }
  function pages(snapshot){return snapshot.tabs?clone(snapshot.tabs.items):[bare(snapshot)];}
  function compose(before,items,active){
    const selected=bare(items[active]);
    selected.id=before.id;selected.transform=clone(before.transform);selected.zIndex=before.zIndex;
    for(const key of ['tilePinned','pinScreenX','pinScreenY']){
      if(before.dataset[key]!==undefined)selected.dataset[key]=before.dataset[key];else delete selected.dataset[key];
    }
    const current=[...workspace.querySelectorAll('.module')].find(m=>m.dataset.boardObjectId===before.id);
    const style=current?getComputedStyle(current):null;
    const minimum=before.tabs?.minimum||{width:parseFloat(style?.minWidth)||220,height:parseFloat(style?.minHeight)||180};
    selected.tabs={active,items:clone(items),minimum};
    return selected;
  }
  function replace(m,snapshot,{history=true}={}){
    window.TeacherTilesEditHistory?.flush();
    const before=serializeBoardModule(m);
    const next=restoreTileEdit(m,snapshot);
    if(next===m)return m;
    if(history)recordHistory({type:'tile-edit',entries:[{el:next,before,after:serializeBoardModule(next)}]});
    notifyBoardChanged('tile-tabs');
    return next;
  }
  function switchTo(m,index){
    if(!m.isConnected||document.fullscreenElement===m)return;
    const before=serializeBoardModule(m),items=pages(before);
    if(index<0||index>=items.length||index===before.tabs?.active)return;
    const keyboardFocus=strips.get(m)?.contains(document.activeElement);
    const next=replace(m,compose(before,items,index),{history:false});
    if(keyboardFocus)strips.get(next)?.querySelector('[aria-selected="true"]')?.focus({preventScroll:true});
  }
  function add(m){
    if(document.fullscreenElement===m)return;
    window.TeacherTilesEditHistory?.flush();
    const before=serializeBoardModule(m),items=pages(before);
    const fresh=withBoardChangesSuspended(()=>m.dataset.type==='sticker'?restoreTeacherTilesBoardObject(bare(before)):createModule(m.dataset.type,0,0,{record:false}));
    if(!fresh)return;
    const item=bare(serializeBoardModule(fresh));item.id=makeBoardObjectId();
    fresh._deactivate?.();fresh._cleanup?.();fresh.remove();
    items.push(item);
    replace(m,compose(before,items,items.length-1));
  }
  function merge(target,source){
    if(!target?.isConnected||!source?.isConnected||target===source||document.fullscreenElement)return false;
    window.TeacherTilesEditHistory?.flush();
    const before=serializeBoardModule(target),sourceSnapshot=serializeBoardModule(source);
    if(!before||!sourceSnapshot)return false;
    const items=[...pages(before),...pages(sourceSnapshot)];
    const next=replace(target,compose(before,items,pages(before).length+(sourceSnapshot.tabs?.active||0)),{history:false});
    if(next===target)return false;
    const sibling=source.nextSibling;
    detachHistoryElements([source]);
    recordHistory({type:'tab-merge',entries:[{el:next,before,after:serializeBoardModule(next)},{el:source,nextSibling:sibling,before:sourceSnapshot}]});
    notifyBoardChanged('tile-tab-merge');
    return true;
  }
  function remove(m,index){
    const before=serializeBoardModule(m),items=pages(before);
    if(items.length<2)return;
    items.splice(index,1);
    const active=Math.max(0,Math.min(items.length-1,before.tabs.active-(index<before.tabs.active?1:0)));
    const after=compose(before,items,active);
    if(items.length===1)delete after.tabs;
    replace(m,after);
  }
  function release(m){const strip=strips.get(m);if(strip)strip.remove();strips.delete(m);}
  function position(){
    frame=0;
    for(const [m,strip] of strips){
      if(!m.isConnected){release(m);continue;}
      const rect=m.getBoundingClientRect(),board=workspace.getBoundingClientRect();
      const scale=rect.width/Math.max(1,m.offsetWidth)/boardCamera.scale;
      const left=(rect.left-board.left)/boardCamera.scale,top=(rect.top-board.top)/boardCamera.scale;
      const signature=`${left},${top},${scale},${m.style.zIndex},${Boolean(document.fullscreenElement)}`;
      if(strip.dataset.position===signature)continue;
      strip.dataset.position=signature;
      strip.hidden=Boolean(document.fullscreenElement);
      Object.assign(strip.style,{left:`${left}px`,top:`${top+43*scale}px`,transform:`translateX(-100%) scale(${scale})`,transformOrigin:'right top',zIndex:m.style.zIndex});
    }
    if(strips.size)frame=requestAnimationFrame(position);
  }
  function render(m){
    release(m);
    if(!m._tileTabs||m._tileTabs.items.length<2)return;
    const strip=document.createElement('div');strip.className='tile-tab-strip';strip.setAttribute('role','tablist');strip.setAttribute('aria-label','Tile tabs');strip.setAttribute('aria-orientation','vertical');
    m._tileTabs.items.forEach((item,index)=>{
      const row=document.createElement('div');row.className='tile-tab-bookmark';row.style.setProperty('--tab-color',colors[index%colors.length]);
      const button=document.createElement('button');button.type='button';button.className='tile-tab';button.setAttribute('role','tab');button.setAttribute('aria-selected',String(index===m._tileTabs.active));button.textContent=String(index+1);button.title=`${label(item,index)} · Right-click to rename`;button.setAttribute('aria-label',label(item,index));
      button.addEventListener('click',()=>switchTo(m,index));
      button.addEventListener('contextmenu',event=>{event.preventDefault();event.stopPropagation();const current=[...workspace.querySelectorAll('.module')].find(el=>el.dataset.boardObjectId===m.dataset.boardObjectId)||m;const name=window.prompt('Tab name',label(item,index));if(name?.trim()){current._tileTabs.items[index].tabLabel=name.trim().slice(0,40);render(current);notifyBoardChanged('tile-tab-name');}});
      button.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const n=m._tileTabs.items.length;switchTo(m,event.key==='Home'?0:event.key==='End'?n-1:(index+(event.key==='ArrowDown'?1:-1)+n)%n);}});
      const close=document.createElement('button');close.type='button';close.className='tile-tab-close';close.textContent='×';close.title=`Close ${label(item,index)}`;close.setAttribute('aria-label',close.title);close.addEventListener('click',()=>remove(m,index));
      row.append(button,close);strip.append(row);
    });
    strip.addEventListener('pointerdown',event=>event.stopPropagation());
    workspace.append(strip);strips.set(m,strip);if(!frame)frame=requestAnimationFrame(position);
  }
  function restore(m,state){
    if(!state||!Array.isArray(state.items)||state.items.length<2)return;
    // Inactive pages stay as snapshots: they cannot play audio or run timers.
    const style=getComputedStyle(m);
    m._tileTabs={active:Math.max(0,Math.min(state.items.length-1,Number(state.active)||0)),items:state.items.map(bare),minimum:state.minimum||{width:parseFloat(style.minWidth)||220,height:parseFloat(style.minHeight)||180}};
    m.classList.add('is-tabbed-tile');render(m);
    const deactivate=m._deactivate,reactivate=m._reactivate,cleanup=m._cleanup;
    m._deactivate=()=>{release(m);deactivate?.();};
    m._reactivate=()=>{reactivate?.();render(m);};
    m._cleanup=()=>{release(m);cleanup?.();};
  }
  function setup(m){
    if(m.querySelector(':scope>.module-tab-add'))return;
    const button=document.createElement('button');button.type='button';button.className='module-tab-add';button.title='Add a tab · Drop another tile here to combine';button.setAttribute('aria-label','Add tile tab');
    button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 5V3H3v13h2M7 7h6l2 2h6v12H7Z"/><path d="M14 12v6m-3-3h6"/></svg>';
    button.addEventListener('pointerdown',event=>event.stopPropagation());button.addEventListener('click',event=>{event.stopPropagation();add(m);});m.append(button);
  }
  function dropTarget(source,x,y){
    let target=null;
    for(const m of workspace.querySelectorAll('.module')){
      if(m===source||isTilePinned(m))continue;
      const rect=m.querySelector(':scope>.module-tab-add')?.getBoundingClientRect();
      if(rect&&x>=rect.left-12&&x<=rect.right+12&&y>=rect.top-12&&y<=rect.bottom+12&&(!target||Number(m.style.zIndex)>Number(target.style.zIndex)))target=m;
    }
    workspace.querySelectorAll('.is-tab-drop-target').forEach(m=>m.classList.toggle('is-tab-drop-target',m===target));
    target?.classList.add('is-tab-drop-target');return target;
  }
  window.TeacherTilesTabs=Object.freeze({setup,capture,restore,add,switchTo,merge,dropTarget,render});
})();
