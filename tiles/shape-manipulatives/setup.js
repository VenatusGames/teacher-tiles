function setupShapeManipulatives(m){
  const workspaceEl=m.querySelector('.shape-manipulatives-workspace');
  const palette=m.querySelector('.shape-manipulatives-palette');
  const countEl=m.querySelector('.shape-manipulatives-count');
  const empty=m.querySelector('.shape-manipulatives-empty');
  const rotateButton=m.querySelector('.shape-manipulatives-rotate');
  const deleteButton=m.querySelector('.shape-manipulatives-delete');
  const clearButton=m.querySelector('.shape-manipulatives-clear');
  const SIDE=64;
  const TRI_HEIGHT=Math.sqrt(3)*SIDE/2;
  const TAN_WIDTH=2*SIDE*Math.cos(Math.PI/12);
  const TAN_HEIGHT=2*SIDE*Math.sin(Math.PI/12);
  // Every polygon is derived from the same 64px edge. This is what lets a
  // triangle, rhombus, trapezoid, and hexagon meet without visible gaps.
  const definitions=[
    {id:'triangle',label:'Triangle',color:'#15966f',width:SIDE,height:TRI_HEIGHT,vertices:[[SIDE/2,0],[SIDE,TRI_HEIGHT],[0,TRI_HEIGHT]]},
    {id:'square',label:'Square',color:'#ef6547',width:SIDE,height:SIDE,vertices:[[0,0],[SIDE,0],[SIDE,SIDE],[0,SIDE]]},
    {id:'hexagon',label:'Hexagon',color:'#f0ca35',width:SIDE*2,height:TRI_HEIGHT*2,vertices:[[SIDE/2,0],[SIDE*1.5,0],[SIDE*2,TRI_HEIGHT],[SIDE*1.5,TRI_HEIGHT*2],[SIDE/2,TRI_HEIGHT*2],[0,TRI_HEIGHT]]},
    {id:'trapezoid',label:'Trapezoid',color:'#ed463d',width:SIDE*2,height:TRI_HEIGHT,vertices:[[SIDE/2,0],[SIDE*1.5,0],[SIDE*2,TRI_HEIGHT],[0,TRI_HEIGHT]]},
    {id:'rhombus-blue',label:'Blue rhombus',color:'#315fae',width:SIDE*1.5,height:TRI_HEIGHT,vertices:[[SIDE/2,0],[SIDE*1.5,0],[SIDE,TRI_HEIGHT],[0,TRI_HEIGHT]]},
    {id:'rhombus-tan',label:'Tan rhombus',color:'#d4ae6c',width:TAN_WIDTH,height:TAN_HEIGHT,vertices:[[TAN_WIDTH/2,0],[TAN_WIDTH,TAN_HEIGHT/2],[TAN_WIDTH/2,TAN_HEIGHT],[0,TAN_HEIGHT/2]]}
  ];
  let pieces=[];
  let nextId=0;
  let selectedId=0;
  let paletteDragType='';
  let paletteDragImage=null;
  const definition=id=>definitions.find(item=>item.id===id);
  const clearPaletteDragImage=()=>{paletteDragImage?.remove();paletteDragImage=null};
  const createPaletteDragImage=def=>{
    const padding=10;
    const canvas=document.createElement('canvas');
    canvas.width=Math.ceil(def.width+padding*2);canvas.height=Math.ceil(def.height+padding*2);
    canvas.style.position='fixed';canvas.style.left='-10000px';canvas.style.top='-10000px';canvas.style.pointerEvents='none';
    const ctx=canvas.getContext('2d');if(!ctx)return canvas;
    const traceShape=()=>{
      ctx.beginPath();def.vertices.forEach(([x,y],index)=>index?ctx.lineTo(x+padding,y+padding):ctx.moveTo(x+padding,y+padding));ctx.closePath();
    };
    ctx.save();ctx.shadowColor='rgba(15,23,42,.3)';ctx.shadowBlur=8;ctx.shadowOffsetY=4;traceShape();ctx.fillStyle=def.color;ctx.fill();ctx.restore();
    const gradient=ctx.createLinearGradient(padding,padding,padding+def.width,padding+def.height);
    gradient.addColorStop(0,'rgba(255,255,255,.38)');gradient.addColorStop(.42,'rgba(255,255,255,.04)');gradient.addColorStop(1,'rgba(0,0,0,.22)');
    traceShape();ctx.fillStyle=def.color;ctx.fill();ctx.fillStyle=gradient;ctx.fill();
    return canvas;
  };
  const selectedPiece=()=>pieces.find(piece=>piece.id===selectedId);
  const notify=reason=>notifyBoardChanged(`shape-manipulatives-${reason}`);
  const workspacePoint=(clientX,clientY)=>{
    const rect=workspaceEl.getBoundingClientRect();
    return{x:(clientX-rect.left)*(workspaceEl.clientWidth/Math.max(1,rect.width)),y:(clientY-rect.top)*(workspaceEl.clientHeight/Math.max(1,rect.height))};
  };
  const clampPiece=piece=>{
    const def=definition(piece.type);if(!def)return;
    piece.x=clamp(Number(piece.x)||0,0,Math.max(0,workspaceEl.clientWidth-def.width));
    piece.y=clamp(Number(piece.y)||0,0,Math.max(0,workspaceEl.clientHeight-def.height));
  };
  const worldVertices=(piece,def=definition(piece.type))=>{
    if(!def)return[];
    const radians=(Number(piece.rotation)||0)*Math.PI/180;
    const cosine=Math.cos(radians),sine=Math.sin(radians),cx=def.width/2,cy=def.height/2;
    return def.vertices.map(([x,y])=>({
      x:piece.x+cx+(x-cx)*cosine-(y-cy)*sine,
      y:piece.y+cy+(x-cx)*sine+(y-cy)*cosine
    }));
  };
  const polygonEdges=piece=>{
    const vertices=worldVertices(piece);const edges=[];
    vertices.forEach((start,index)=>{
      const end=vertices[(index+1)%vertices.length];
      const length=Math.hypot(end.x-start.x,end.y-start.y);
      const sections=Math.max(1,Math.round(length/SIDE));
      for(let part=0;part<sections;part++)edges.push({
        a:{x:start.x+(end.x-start.x)*part/sections,y:start.y+(end.y-start.y)*part/sections},
        b:{x:start.x+(end.x-start.x)*(part+1)/sections,y:start.y+(end.y-start.y)*(part+1)/sections},
        length:length/sections
      });
    });
    return edges;
  };
  const snapTranslation=piece=>{
    let best=null;
    const movingEdges=polygonEdges(piece);
    pieces.filter(other=>other.id!==piece.id).forEach(other=>{
      polygonEdges(other).forEach(target=>movingEdges.forEach(moving=>{
        if(Math.abs(moving.length-target.length)>1.5)return;
        const movingDx=(moving.b.x-moving.a.x)/moving.length,movingDy=(moving.b.y-moving.a.y)/moving.length;
        const targetDx=(target.b.x-target.a.x)/target.length,targetDy=(target.b.y-target.a.y)/target.length;
        if(movingDx*targetDx+movingDy*targetDy>-.965)return;
        const dx=((target.b.x-moving.a.x)+(target.a.x-moving.b.x))/2;
        const dy=((target.b.y-moving.a.y)+(target.a.y-moving.b.y))/2;
        const distance=Math.hypot(dx,dy);if(distance>22)return;
        const residual=Math.hypot(moving.a.x+dx-target.b.x,moving.a.y+dy-target.b.y)+Math.hypot(moving.b.x+dx-target.a.x,moving.b.y+dy-target.a.y);
        if(residual>3)return;
        const translated=worldVertices(piece).map(point=>({x:point.x+dx,y:point.y+dy}));
        if(translated.some(point=>point.x<-.5||point.y<-.5||point.x>workspaceEl.clientWidth+.5||point.y>workspaceEl.clientHeight+.5))return;
        const score=distance+residual*2;
        if(!best||score<best.score)best={dx,dy,score};
      }));
    });
    return best;
  };
  const snapPiece=piece=>{
    const translation=snapTranslation(piece);if(!translation)return false;
    piece.x+=translation.dx;piece.y+=translation.dy;return true;
  };
  const syncPieceElement=(piece,el)=>{
    if(!el)return;
    el.style.left=`${piece.x}px`;el.style.top=`${piece.y}px`;el.style.transform=`rotate(${Number(piece.rotation)||0}deg)`;
  };
  const pulseSnap=el=>{
    if(!el)return;el.classList.remove('is-snapping');void el.offsetWidth;el.classList.add('is-snapping');
    setTimeout(()=>el.classList.remove('is-snapping'),240);
  };
  const updateSummary=()=>{
    countEl.textContent=`${pieces.length} ${pieces.length===1?'piece':'pieces'}`;
    empty.hidden=pieces.length>0;
    const hasSelection=Boolean(selectedPiece());
    rotateButton.disabled=!hasSelection;
    deleteButton.disabled=!hasSelection;
  };
  const selectPiece=id=>{
    selectedId=pieces.some(piece=>piece.id===id)?id:0;
    workspaceEl.querySelectorAll('.shape-manipulative-piece').forEach(el=>el.classList.toggle('is-selected',Number(el.dataset.shapePiece)===selectedId));
    updateSummary();
  };
  const rotateSelected=(amount=30)=>{
    const piece=selectedPiece();if(!piece)return;
    piece.rotation=((Number(piece.rotation)||0)+amount)%360;
    const el=workspaceEl.querySelector(`[data-shape-piece="${piece.id}"]`);
    const snapped=snapPiece(piece);syncPieceElement(piece,el);if(snapped)pulseSnap(el);
    notify('rotate');
  };
  const removeSelected=()=>{
    if(!selectedId)return;
    pieces=pieces.filter(piece=>piece.id!==selectedId);selectedId=0;renderPieces();notify('delete');
  };

  const renderPieces=()=>{
    workspaceEl.querySelectorAll('.shape-manipulative-piece').forEach(el=>el.remove());
    pieces.forEach(piece=>{
      const def=definition(piece.type);if(!def)return;
      clampPiece(piece);
      const el=document.createElement('button');
      el.type='button';
      el.className=`shape-manipulative-piece shape-manipulative-piece--${piece.type}`;
      el.dataset.shapePiece=String(piece.id);
      el.style.left=`${piece.x}px`;el.style.top=`${piece.y}px`;
      el.style.width=`${def.width}px`;el.style.height=`${def.height}px`;
      el.style.transform=`rotate(${Number(piece.rotation)||0}deg)`;
      el.style.setProperty('--pattern-block-color',def.color);
      el.title=`${def.label} · drag to move · double-click to rotate`;
      el.setAttribute('aria-label',`${def.label}. Drag to move. Double click to rotate.`);
      const art=document.createElement('span');art.className='pattern-block-art';
      const rotateHandle=document.createElement('span');rotateHandle.className='shape-manipulative-rotate-handle';rotateHandle.textContent='↻';rotateHandle.setAttribute('aria-hidden','true');
      el.append(art,rotateHandle);
      el.classList.toggle('is-selected',piece.id===selectedId);
      let dragging=false,offsetX=0,offsetY=0;
      el.addEventListener('pointerdown',event=>{
        if(event.button!==0||event.target.closest('.shape-manipulative-rotate-handle'))return;
        event.preventDefault();event.stopPropagation();selectPiece(piece.id);dragging=true;
        const point=workspacePoint(event.clientX,event.clientY);offsetX=point.x-piece.x;offsetY=point.y-piece.y;
        try{el.setPointerCapture(event.pointerId)}catch{}el.classList.add('is-dragging');
      });
      el.addEventListener('pointermove',event=>{
        if(!dragging)return;
        const point=workspacePoint(event.clientX,event.clientY);
        piece.x=Math.round((point.x-offsetX)/4)*4;piece.y=Math.round((point.y-offsetY)/4)*4;clampPiece(piece);
        syncPieceElement(piece,el);
      });
      const stop=event=>{if(!dragging)return;dragging=false;el.classList.remove('is-dragging');try{el.releasePointerCapture(event.pointerId)}catch{}const snapped=snapPiece(piece);syncPieceElement(piece,el);if(snapped)pulseSnap(el);notify('move')};
      el.addEventListener('pointerup',stop);el.addEventListener('pointercancel',stop);
      let rotating=false,startPointerAngle=0,startRotation=0;
      rotateHandle.addEventListener('pointerdown',event=>{
        if(event.button!==0)return;event.preventDefault();event.stopPropagation();selectPiece(piece.id);rotating=true;
        const rect=el.getBoundingClientRect();startPointerAngle=Math.atan2(event.clientY-(rect.top+rect.height/2),event.clientX-(rect.left+rect.width/2));startRotation=Number(piece.rotation)||0;
        try{rotateHandle.setPointerCapture(event.pointerId)}catch{}
      });
      rotateHandle.addEventListener('pointermove',event=>{
        if(!rotating)return;event.preventDefault();event.stopPropagation();
        const rect=el.getBoundingClientRect();const angle=Math.atan2(event.clientY-(rect.top+rect.height/2),event.clientX-(rect.left+rect.width/2));
        piece.rotation=Math.round((startRotation+(angle-startPointerAngle)*180/Math.PI)/15)*15;syncPieceElement(piece,el);
      });
      const stopRotating=event=>{if(!rotating)return;rotating=false;try{rotateHandle.releasePointerCapture(event.pointerId)}catch{}const snapped=snapPiece(piece);syncPieceElement(piece,el);if(snapped)pulseSnap(el);notify('rotate')};
      rotateHandle.addEventListener('pointerup',stopRotating);rotateHandle.addEventListener('pointercancel',stopRotating);
      el.addEventListener('dblclick',event=>{event.preventDefault();event.stopPropagation();selectPiece(piece.id);rotateSelected()});
      el.addEventListener('keydown',event=>{
        if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();removeSelected();return}
        if(event.key.toLowerCase()==='r'){event.preventDefault();rotateSelected();return}
        const moves={ArrowLeft:[-4,0],ArrowRight:[4,0],ArrowUp:[0,-4],ArrowDown:[0,4]};
        if(moves[event.key]){event.preventDefault();piece.x+=moves[event.key][0];piece.y+=moves[event.key][1];clampPiece(piece);syncPieceElement(piece,el);notify('move')}
      });
      workspaceEl.appendChild(el);
    });
    updateSummary();
  };
  const addPiece=(type,x=null,y=null)=>{
    const def=definition(type);if(!def)return;
    const piece={id:++nextId,type,x:x??Math.max(8,(workspaceEl.clientWidth-def.width)/2+(Math.random()-.5)*70),y:y??Math.max(8,(workspaceEl.clientHeight-def.height)/2+(Math.random()-.5)*45),rotation:0};
    clampPiece(piece);pieces.push(piece);selectedId=piece.id;renderPieces();playUiSfx('click',1,m);notify('add');
  };

  definitions.forEach(def=>{
    const button=document.createElement('button');button.type='button';button.className='shape-manipulatives-palette-item';button.draggable=true;button.dataset.shapeType=def.id;button.setAttribute('aria-label',`Add ${def.label}`);
    const art=document.createElement('span');art.className=`pattern-block-art pattern-block-art--${def.id}`;art.draggable=false;art.style.setProperty('--pattern-block-color',def.color);
    const label=document.createElement('small');label.textContent=def.label.replace(/ rhombus/i,'');button.append(art,label);
    button.addEventListener('click',()=>addPiece(def.id));
    button.addEventListener('dragstart',event=>{
      event.stopPropagation();paletteDragType=def.id;clearPaletteDragImage();paletteDragImage=createPaletteDragImage(def);document.body.appendChild(paletteDragImage);
      event.dataTransfer?.setData('text/plain',def.id);
      if(event.dataTransfer){event.dataTransfer.effectAllowed='copy';event.dataTransfer.setDragImage(paletteDragImage,paletteDragImage.width/2,paletteDragImage.height/2)}
    });
    button.addEventListener('dragend',()=>{paletteDragType='';clearPaletteDragImage()});palette.appendChild(button);
  });
  workspaceEl.addEventListener('pointerdown',event=>{if(event.target===workspaceEl||event.target===empty)selectPiece(0)});
  workspaceEl.addEventListener('dragover',event=>{event.preventDefault();workspaceEl.classList.add('is-drop-target');if(event.dataTransfer)event.dataTransfer.dropEffect='copy'});
  workspaceEl.addEventListener('dragleave',event=>{if(!workspaceEl.contains(event.relatedTarget))workspaceEl.classList.remove('is-drop-target')});
  workspaceEl.addEventListener('drop',event=>{
    event.preventDefault();event.stopPropagation();workspaceEl.classList.remove('is-drop-target');
    const type=paletteDragType||event.dataTransfer?.getData('text/plain');const def=definition(type);if(!def)return;
    const point=workspacePoint(event.clientX,event.clientY);addPiece(type,point.x-def.width/2,point.y-def.height/2);
  });
  rotateButton.addEventListener('click',()=>rotateSelected());deleteButton.addEventListener('click',removeSelected);
  clearButton.addEventListener('click',()=>{pieces=[];selectedId=0;renderPieces();notify('clear')});
  m.querySelector('.shape-manipulatives-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.shape-manipulatives-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.shape-manipulatives-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));
  const ro=new ResizeObserver(()=>{pieces.forEach(clampPiece);renderPieces()});ro.observe(workspaceEl);
  m._boardGetState=()=>({pieces:pieces.map(piece=>({...piece}))});
  m._boardSetState=state=>{
    pieces=Array.isArray(state?.pieces)?state.pieces.filter(piece=>definition(piece.type)).slice(0,80).map((piece,index)=>({id:index+1,type:piece.type,x:Number(piece.x)||0,y:Number(piece.y)||0,rotation:Number(piece.rotation)||0})):[];
    nextId=pieces.length;selectedId=0;renderPieces();
  };
  const prior=m._cleanup;m._cleanup=()=>{prior?.();ro.disconnect();clearPaletteDragImage()};renderPieces();
}
