function setupMoney(m){
  const workspaceEl=m.querySelector('.money-workspace');
  const palette=m.querySelector('.money-palette');
  const totalEl=m.querySelector('.money-total');
  const toggleTotal=m.querySelector('.money-toggle-total');
  const countEl=m.querySelector('.money-count');
  const clearButton=m.querySelector('.money-clear');
  const empty=m.querySelector('.money-workspace-empty');
  const pieceDeleteZone=m.querySelector('.money-piece-delete-zone');

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

  const workspacePoint=(clientX,clientY)=>{
    const rect=workspaceEl.getBoundingClientRect();
    const scaleX=rect.width>0?workspaceEl.clientWidth/rect.width:1;
    const scaleY=rect.height>0?workspaceEl.clientHeight/rect.height:1;
    return{
      x:(clientX-rect.left)*scaleX,
      y:(clientY-rect.top)*scaleY
    };
  };

  const pieceSize=denomId=>denomId==='dollar'?{width:104,height:82}:{width:78,height:78};

  const updateSummary=()=>{
    const cents=pieces.reduce((sum,piece)=>sum+(denom(piece.denom)?.cents||0),0);
    totalEl.textContent=`$${(cents/100).toFixed(2)}`;
    totalEl.classList.toggle('is-hidden',!totalVisible);
    toggleTotal.textContent=totalVisible?'Hide Total':'Show Total';
    countEl.textContent=`${pieces.length} ${pieces.length===1?'piece':'pieces'}`;
    empty.hidden=pieces.length>0;
  };

  const clampPiece=(piece,el)=>{
    const w=el?.offsetWidth||76;
    const h=el?.offsetHeight||76;
    piece.x=Math.max(0,Math.min(workspaceEl.clientWidth-w,piece.x));
    piece.y=Math.max(0,Math.min(workspaceEl.clientHeight-h,piece.y));
  };

  const addPiece=(denomId,x=null,y=null)=>{
    const d=denom(denomId);
    if(!d)return;

    const piece={
      id:++nextId,
      denom:denomId,
      x:x===null?Math.max(8,(workspaceEl.clientWidth-76)/2+(Math.random()-.5)*70):x,
      y:y===null?Math.max(8,(workspaceEl.clientHeight-76)/2+(Math.random()-.5)*50):y
    };
    pieces.push(piece);
    renderPieces();
    playUiSfx('money',1,m);
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
        const point=workspacePoint(event.clientX,event.clientY);
        offsetX=point.x-piece.x;
        offsetY=point.y-piece.y;
        el.setPointerCapture(event.pointerId);
        el.classList.add('is-dragging');
        m.classList.add('is-dragging-money-piece');
      });

      el.addEventListener('pointermove',event=>{
        if(!dragging)return;
        const point=workspacePoint(event.clientX,event.clientY);
        piece.x=point.x-offsetX;
        piece.y=point.y-offsetY;
        clampPiece(piece,el);
        el.style.left=`${piece.x}px`;
        el.style.top=`${piece.y}px`;
        const deleteRect=pieceDeleteZone.getBoundingClientRect();
        const overDelete=event.clientX>=deleteRect.left&&event.clientX<=deleteRect.right&&event.clientY>=deleteRect.top&&event.clientY<=deleteRect.bottom;
        pieceDeleteZone.classList.toggle('is-armed',overDelete);
      });

      const stopDrag=(event,{cancelled=false}={})=>{
        if(!dragging)return;
        dragging=false;
        el.classList.remove('is-dragging');
        try{el.releasePointerCapture(event.pointerId)}catch{}
        const shouldDelete=!cancelled&&pieceDeleteZone.classList.contains('is-armed');
        pieceDeleteZone.classList.remove('is-armed');
        m.classList.remove('is-dragging-money-piece');
        if(shouldDelete){
          pieces=pieces.filter(item=>item.id!==piece.id);
          renderPieces();
        }
      };

      el.addEventListener('pointerup',stopDrag);
      el.addEventListener('pointercancel',event=>stopDrag(event,{cancelled:true}));

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
    button.dataset.denom=d.id;
    button.setAttribute('aria-label',`Add a ${d.label}`);

    const img=document.createElement('img');
    img.src=d.src;
    img.alt='';
    img.className='money-palette-piece';
    img.draggable=true;

    const text=document.createElement('span');
    const label=document.createElement('strong');
    label.textContent=d.label;
    const value=document.createElement('small');
    value.textContent=d.cents>=100?'$1.00':`${d.cents}¢`;
    text.append(label,value);

    button.append(img,text);

    button.addEventListener('click',()=>addPiece(d.id));
    img.addEventListener('dragstart',event=>{
      event.stopPropagation();
      paletteDragId=d.id;
      event.dataTransfer?.clearData();
      event.dataTransfer?.setData('text/plain',d.id);
      if(event.dataTransfer)event.dataTransfer.effectAllowed='copy';
    });
    img.addEventListener('dragend',()=>{paletteDragId='';});

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
    event.stopPropagation();
    workspaceEl.classList.remove('is-drop-target');

    const id=paletteDragId||event.dataTransfer?.getData('text/plain');
    if(!denom(id))return;

    const point=workspacePoint(event.clientX,event.clientY);
    const size=pieceSize(id);
    addPiece(id,point.x-size.width/2,point.y-size.height/2);
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
  m.querySelector('.money-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));

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

  m._boardGetState=()=>({pieces:pieces.map(piece=>({...piece})),totalVisible});
  m._boardSetState=state=>{
    if(!state)return;
    pieces=Array.isArray(state.pieces)?state.pieces.filter(piece=>denom(piece.denom)).map((piece,index)=>({
      id:index+1,
      denom:piece.denom,
      x:Number(piece.x)||0,
      y:Number(piece.y)||0
    })):[];
    nextId=pieces.length;
    totalVisible=state.totalVisible!==false;
    renderPieces();
  };

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    ro.disconnect();
  };

  renderPieces();
}
