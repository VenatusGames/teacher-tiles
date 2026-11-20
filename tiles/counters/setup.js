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
  function add(color){
    if(pieces.length>=200)return;
    const piece={color,x:64+(pieces.length%8)*48,y:46+Math.floor(pieces.length%40/8)*42};
    pieces.push(piece);render();return piece;
  }
  function down(e){
    const disc=e.target.closest('.counter-disc');
    if(!disc||drag||e.button!==0)return;
    e.stopPropagation();e.preventDefault();
    const fresh=palette.contains(disc),at=local(e);
    const piece=fresh?add(disc.dataset.color):pieces[[...area.children].indexOf(disc)];
    if(!piece)return;
    const el=area.children[pieces.indexOf(piece)];
    drag={piece,el,id:e.pointerId,fresh,dx:fresh?0:at.x-piece.x,dy:fresh?0:at.y-piece.y,startX:e.clientX,startY:e.clientY,original:{...piece}};
    tile.setPointerCapture(e.pointerId);if(!fresh)trash.show();
  }
  palette.addEventListener('pointerdown',down);area.addEventListener('pointerdown',down);
  tile.addEventListener('pointermove',e=>{
    if(drag?.id!==e.pointerId)return;
    if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<3&&!drag.moved)return;
    const at=local(e);drag.moved=true;
    drag.piece.x=counterClamp(Math.round(at.x-drag.dx),counterMaxX);drag.piece.y=counterClamp(Math.round(at.y-drag.dy),counterMaxY);
    positionCounter(drag.el,drag.piece);trash.move(e);
  });
  function end(e){
    if(drag?.id!==e.pointerId)return;
    const remove=trash.finish(e)&&drag.moved,cancel=e.type==='pointercancel';
    if(remove||(cancel&&drag.fresh))pieces=pieces.filter(p=>p!==drag.piece);
    else if(cancel)Object.assign(drag.piece,drag.original);
    drag=null;render();if(!cancel)notify();
  }
  tile.addEventListener('pointerup',end);tile.addEventListener('pointercancel',end);
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
    pieces=counterLayout(state);
    render();
  };
  render();
}
