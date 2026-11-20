const counterColors=['red','blue','yellow','green'];
function counterDisc(color,label){
  const button=document.createElement('button');
  button.type='button';button.className='counter-disc';button.dataset.color=color;
  button.setAttribute('aria-label',label);return button;
}
const counterMaxX=480,counterMaxY=260;
const counterClamp=(n,max)=>Math.max(0,Math.min(max,n));
function counterLayout(state){
  const pieces=(Array.isArray(state?.pieces)?state.pieces:[]).slice(0,200)
    .filter(p=>counterColors.includes(p?.color)&&Number.isFinite(p.x)&&Number.isFinite(p.y))
    .map(({color,x,y})=>({color,x,y}));
  if(!pieces.length)return [];
  // Older boards stored unrestricted offsets from the palette. Fit the whole group into the work area.
  if(state.layoutVersion!==2){
    const xs=pieces.map(p=>p.x),ys=pieces.map(p=>p.y);
    const left=Math.min(...xs),top=Math.min(...ys),width=Math.max(...xs)-left,height=Math.max(...ys)-top;
    const scale=Math.min(1,counterMaxX/(width||1),counterMaxY/(height||1));
    for(const p of pieces){
      p.x=(counterMaxX-width*scale)/2+(p.x-left)*scale;
      p.y=(counterMaxY-height*scale)/2+(p.y-top)*scale;
    }
  }
  for(const p of pieces){p.x=counterClamp(p.x,counterMaxX);p.y=counterClamp(p.y,counterMaxY);}
  return pieces;
}
function positionCounter(disc,piece){
  disc.style.left=(piece.x/counterMaxX*100)+'%';
  disc.style.top=(piece.y/counterMaxY*100)+'%';
}
function renderCounterPreview(tile,state){
  const area=tile.querySelector('.counter-pieces'),palette=tile.querySelector('.counter-palette');
  if(!palette.childElementCount)palette.replaceChildren(...counterColors.map(color=>counterDisc(color,'Add '+color+' counter')));
  area.replaceChildren();
  for(const piece of counterLayout(state)){
    const disc=counterDisc(piece.color,piece.color+' counter');
    positionCounter(disc,piece);area.append(disc);
  }
}
function setupCounters(tile){
  const area=tile.querySelector('.counter-pieces'),palette=tile.querySelector('.counter-palette');
  const stage=tile.querySelector('.counter-stage'),trash=manipulativeTrash(stage);
  stage.addEventListener('pointerdown',event=>event.stopPropagation());
  let pieces=[],drag=null;
  const notify=()=>notifyBoardChanged('counters');
  function render(){renderCounterPreview(tile,{layoutVersion:2,pieces});}
  function local(event){
    const rect=area.getBoundingClientRect();
    return {x:(event.clientX-rect.left)*counterMaxX/rect.width,y:(event.clientY-rect.top)*counterMaxY/rect.height};
  }
  function add(color,point){
    if(pieces.length>=200)return;
    const slot=pieces.length%40;
    pieces.push({color,...(point||{x:64+(slot%8)*48,y:46+Math.floor(slot/8)*42})});
    render();return true;
  }
  function dropPoint(e,dx=0,dy=0){
    const at=local(e);
    return {x:counterClamp(Math.round(at.x-dx),counterMaxX),y:counterClamp(Math.round(at.y-dy),counterMaxY)};
  }
  function follow(preview,e){
    preview.style.left=e.clientX+'px';
    preview.style.top=e.clientY+'px';
  }
  function down(e){
    const disc=e.target.closest('.counter-disc');
    if(!disc||drag||e.button!==0)return;
    e.stopPropagation();e.preventDefault();
    if(palette.contains(disc)){
      if(pieces.length>=200)return;
      const preview=document.createElement('span'),size=disc.getBoundingClientRect();
      preview.className='counter-disc counter-drag-preview';
      preview.dataset.color=disc.dataset.color;
      preview.setAttribute('aria-hidden','true');
      preview.setAttribute('popover','manual');
      preview.style.width=size.width+'px';preview.style.height=size.height+'px';
      follow(preview,e);
      (document.fullscreenElement||document.body).append(preview);
      preview.showPopover?.();
      drag={id:e.pointerId,preview,color:disc.dataset.color,startX:e.clientX,startY:e.clientY,moved:false};
    }else{
      const piece=pieces[[...area.children].indexOf(disc)];
      if(!piece)return;
      const at=local(e);
      drag={id:e.pointerId,piece,disc,dx:at.x-piece.x,dy:at.y-piece.y,startX:e.clientX,startY:e.clientY,moved:false};
      trash.show();
    }
    tile.setPointerCapture(e.pointerId);
  }
  palette.addEventListener('pointerdown',down);area.addEventListener('pointerdown',down);
  tile.addEventListener('pointermove',e=>{
    if(drag?.id!==e.pointerId)return;
    if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>=3)drag.moved=true;
    if(drag.preview){
      follow(drag.preview,e);
    }else{
      positionCounter(drag.disc,dropPoint(e,drag.dx,drag.dy));trash.move(e);
    }
  });
  function clearDrag(){
    if(!drag)return;
    const current=drag;drag=null;
    current.preview?.remove();
    trash.close();
    if(tile.hasPointerCapture(current.id))tile.releasePointerCapture(current.id);
    if(current.piece)positionCounter(current.disc,current.piece);
  }
  tile.addEventListener('pointerup',e=>{
    if(drag?.id!==e.pointerId)return;
    const current=drag;
    if(current.preview){
      const rect=stage.getBoundingClientRect();
      const inside=e.clientX>=rect.left&&e.clientX<=rect.right&&e.clientY>=rect.top&&e.clientY<=rect.bottom;
      const tap=!current.moved&&Math.hypot(e.clientX-current.startX,e.clientY-current.startY)<3;
      clearDrag();
      if((inside||tap)&&add(current.color,inside?dropPoint(e):null))notify();
    }else{
      const remove=trash.finish(e)&&current.moved,point=dropPoint(e,current.dx,current.dy);
      clearDrag();
      if(remove){pieces=pieces.filter(p=>p!==current.piece);render();}
      else{Object.assign(current.piece,point);positionCounter(current.disc,current.piece);}
      notify();
    }
  });
  for(const type of ['pointercancel','lostpointercapture']){
    tile.addEventListener(type,e=>{if(drag?.id===e.pointerId)clearDrag();});
  }
  palette.addEventListener('click',e=>{if(!e.detail&&e.target.matches('.counter-disc')&&add(e.target.dataset.color))notify();});
  area.addEventListener('keydown',e=>{
    const index=[...area.children].indexOf(e.target);if(index<0)return;
    const delta={ArrowLeft:[-5,0],ArrowRight:[5,0],ArrowUp:[0,-5],ArrowDown:[0,5]}[e.key];
    if(delta){pieces[index].x=counterClamp(pieces[index].x+delta[0],counterMaxX);pieces[index].y=counterClamp(pieces[index].y+delta[1],counterMaxY);}
    else if(['Backspace','Delete'].includes(e.key))pieces.splice(index,1);else return;
    e.preventDefault();e.stopPropagation();render();(area.children[index]||palette.firstElementChild)?.focus();notify();
  });
  tile._boardGetState=()=>({layoutVersion:2,pieces:pieces.map(p=>({...p}))});
  tile._boardSetState=state=>{
    clearDrag();pieces=counterLayout(state);
    render();
  };
  const cleanup=tile._cleanup;
  tile._cleanup=()=>{clearDrag();cleanup?.();};
  render();
}
