const counterColors=['red','blue','yellow','green'];
function counterDisc(color,label){
  const button=document.createElement('button');
  button.type='button';button.className='counter-disc';button.dataset.color=color;
  button.setAttribute('aria-label',label);return button;
}
function renderCounterPreview(tile,state){
  const area=tile.querySelector('.counter-pieces'),palette=tile.querySelector('.counter-palette');
  palette.replaceChildren(...counterColors.map(color=>counterDisc(color,'Add '+color+' counter')));
  area.replaceChildren();
  for(const piece of state?.pieces||[]){
    if(!counterColors.includes(piece?.color))continue;
    const disc=counterDisc(piece.color,piece.color+' counter');
    disc.style.left=piece.x+'px';disc.style.top=piece.y+'px';area.append(disc);
  }
}
function setupCounters(tile){
  const area=tile.querySelector('.counter-pieces'),palette=tile.querySelector('.counter-palette');
  const trash=manipulativeTrash(tile);
  let pieces=[],drag=null;
  const notify=()=>notifyBoardChanged('counters');
  function render(){renderCounterPreview(tile,{pieces});}
  function local(event){
    const rect=area.getBoundingClientRect();
    return {x:(event.clientX-rect.left)*area.clientWidth/rect.width,y:(event.clientY-rect.top)*area.clientHeight/rect.height};
  }
  function add(color){
    if(pieces.length>=200)return;
    const piece={color,x:25+(pieces.length%5)*44,y:area.clientHeight+26+Math.floor(pieces.length%25/5)*41};
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
    drag.piece.x=Math.round(at.x-drag.dx);drag.piece.y=Math.round(at.y-drag.dy);
    drag.el.style.left=drag.piece.x+'px';drag.el.style.top=drag.piece.y+'px';trash.move(e);
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
    if(delta){pieces[index].x+=delta[0];pieces[index].y+=delta[1];}
    else if(['Backspace','Delete'].includes(e.key))pieces.splice(index,1);else return;
    e.preventDefault();e.stopPropagation();render();(area.children[index]||palette.firstElementChild)?.focus();notify();
  });
  tile._boardGetState=()=>({pieces:pieces.map(p=>({...p}))});
  tile._boardSetState=state=>{
    pieces=(Array.isArray(state?.pieces)?state.pieces:[]).slice(0,200).filter(p=>counterColors.includes(p?.color)&&Number.isFinite(p.x)&&Number.isFinite(p.y)).map(({color,x,y})=>({color,x,y}));
    render();
  };
  render();
}
