function setupDraw(m){
  const toggle=m.querySelector('.draw-toggle');
  const toggleLabel=m.querySelector('.draw-toggle-label');
  const color=m.querySelector('.draw-color');
  const swatch=m.querySelector('.draw-color-swatch');
  const size=m.querySelector('.draw-size');
  const clear=m.querySelector('.draw-clear');
  const undo=m.querySelector('.draw-undo');
  const redo=m.querySelector('.draw-redo');
  const toolButtons=[...m.querySelectorAll('.draw-tool')];

  const canvas=document.createElement('canvas');
  canvas.className='board-drawing-canvas';
  const drawScale=Math.min(1,4800/BOARD_WIDTH,3200/BOARD_HEIGHT);
  canvas.width=Math.max(1,Math.round(BOARD_WIDTH*drawScale));
  canvas.height=Math.max(1,Math.round(BOARD_HEIGHT*drawScale));
  canvas.style.width=`${BOARD_WIDTH}px`;
  canvas.style.height=`${BOARD_HEIGHT}px`;
  workspace.appendChild(canvas);

  const ctx=canvas.getContext('2d',{alpha:true,desynchronized:true})||canvas.getContext('2d');
  const dpr=drawScale;
  ctx.scale(dpr,dpr);
  ctx.lineCap='round';
  ctx.lineJoin='round';

  const baseCanvas=document.createElement('canvas');
  baseCanvas.width=canvas.width;
  baseCanvas.height=canvas.height;
  const baseCtx=baseCanvas.getContext('2d',{alpha:true})||baseCanvas.getContext('2d');

  let enabled=false;
  let tool='brush';
  let drawing=false;
  let currentStroke=null;
  let drawActions=[];
  let drawCursor=0;
  let baseImageData='';
  let pendingPoints=[];
  let drawFrame=0;
  let imageLoadToken=0;

  const updatePointerMode=()=>{
    canvas.classList.toggle('is-active',enabled);
    canvas.style.pointerEvents=enabled?'auto':'none';
    toggle.classList.toggle('is-on',enabled);
    toggle.setAttribute('aria-pressed',String(enabled));
    toggleLabel.textContent=enabled?'ON':'OFF';
    canvas.dataset.tool=tool;
  };

  const updateSwatch=()=>{swatch.style.background=color.value};
  updateSwatch();

  const updateHistoryButtons=()=>{
    undo.disabled=drawCursor<=0;
    redo.disabled=drawCursor>=drawActions.length;
  };

  toggle.addEventListener('click',()=>{enabled=!enabled;updatePointerMode()});
  color.addEventListener('input',updateSwatch);

  toolButtons.forEach(b=>b.addEventListener('click',()=>{
    tool=b.dataset.drawTool;
    toolButtons.forEach(x=>x.classList.toggle('is-active',x===b));
    canvas.dataset.tool=tool;
  }));

  const drawSegment=(action,from,to)=>{
    const dx=to.x-from.x,dy=to.y-from.y;
    const distance=Math.hypot(dx,dy);
    const dt=Math.max(1,(to.time||0)-(from.time||0));
    const speed=distance/dt;
    const baseSize=Number(action.size)||10;
    ctx.save();

    if(action.tool==='eraser'){
      ctx.globalCompositeOperation='destination-out';
      ctx.globalAlpha=1;
      ctx.strokeStyle='#000';
      ctx.lineWidth=Math.max(4,baseSize*1.6);
      ctx.lineCap='round';
      ctx.beginPath();
      ctx.moveTo(from.x,from.y);
      ctx.lineTo(to.x,to.y);
      ctx.stroke();
    }else if(action.tool==='pencil'){
      ctx.globalCompositeOperation='source-over';
      ctx.globalAlpha=.9;
      ctx.strokeStyle=action.color;
      ctx.lineWidth=Math.max(1,baseSize*.28);
      ctx.lineCap='round';
      ctx.beginPath();
      ctx.moveTo(from.x,from.y);
      ctx.lineTo(to.x,to.y);
      ctx.stroke();
    }else{
      const speedFactor=clamp(1.15-speed*.18,.58,1.15);
      const brushWidth=Math.max(2,baseSize*speedFactor);
      ctx.globalCompositeOperation='source-over';
      ctx.globalAlpha=.72;
      ctx.strokeStyle=action.color;
      ctx.lineWidth=brushWidth;
      ctx.lineCap='round';
      ctx.shadowColor=action.color;
      ctx.shadowBlur=Math.max(.5,brushWidth*.16);
      ctx.beginPath();
      ctx.moveTo(from.x,from.y);
      ctx.quadraticCurveTo(from.x,from.y,to.x,to.y);
      ctx.stroke();
      ctx.globalAlpha=.18;
      ctx.lineWidth=brushWidth*1.35;
      ctx.shadowBlur=0;
      ctx.beginPath();
      ctx.moveTo(from.x,from.y);
      ctx.lineTo(to.x,to.y);
      ctx.stroke();
    }
    ctx.restore();
  };

  const renderAction=action=>{
    if(action.type==='clear'){
      ctx.clearRect(0,0,BOARD_WIDTH,BOARD_HEIGHT);
      return;
    }
    const points=Array.isArray(action.points)?action.points:[];
    if(points.length===1)drawSegment(action,points[0],{...points[0],x:points[0].x+.01,y:points[0].y+.01,time:points[0].time+1});
    for(let index=1;index<points.length;index++)drawSegment(action,points[index-1],points[index]);
  };

  const redraw=()=>{
    ctx.save();
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,BOARD_WIDTH,BOARD_HEIGHT);
    if(baseCanvas.width&&baseCanvas.height)ctx.drawImage(baseCanvas,0,0,BOARD_WIDTH,BOARD_HEIGHT);
    for(let index=0;index<drawCursor;index++)renderAction(drawActions[index]);
    ctx.restore();
    updateHistoryButtons();
  };

  const setHistoryCursor=next=>{
    drawCursor=clamp(Math.round(Number(next)||0),0,drawActions.length);
    redraw();
  };

  const changeHistory=(next,reason)=>{
    const before=drawCursor;
    const after=clamp(next,0,drawActions.length);
    if(before===after)return;
    setHistoryCursor(after);
    recordHistory({type:'drawing',el:m,before,after,reason});
  };

  const pushAction=action=>{
    if(drawCursor<drawActions.length)drawActions.splice(drawCursor);
    const before=drawCursor;
    drawActions.push(action);
    drawCursor=drawActions.length;
    updateHistoryButtons();
    recordHistory({type:'drawing',el:m,before,after:drawCursor});
  };

  undo.addEventListener('click',()=>changeHistory(drawCursor-1,'draw-undo'));
  redo.addEventListener('click',()=>changeHistory(drawCursor+1,'draw-redo'));
  clear.addEventListener('click',()=>{
    const action={type:'clear'};
    renderAction(action);
    pushAction(action);
  });

  const point=e=>screenToBoard(e.clientX,e.clientY);

  const appendPendingPoint=()=>{
    drawFrame=0;
    if(!pendingPoints.length||!drawing||!currentStroke){pendingPoints=[];return}
    const points=pendingPoints;
    pendingPoints=[];
    for(const next of points){
      const prior=currentStroke.points.at(-1);
      if(Math.hypot(next.x-prior.x,next.y-prior.y)<.18)continue;
      currentStroke.points.push(next);
      drawSegment(currentStroke,prior,next);
    }
  };

  const flushPendingPoint=()=>{
    if(drawFrame){cancelAnimationFrame(drawFrame);drawFrame=0}
    appendPendingPoint();
  };

  const down=e=>{
    if(!enabled||e.button!==0)return;
    pendingPoints=[];
    drawing=true;
    const p=point(e);
    currentStroke={type:'stroke',tool,color:color.value,size:Number(size.value),points:[{x:p.x,y:p.y,time:performance.now()}]};
    canvas.setPointerCapture?.(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };

  const move=e=>{
    if(!drawing||!enabled||!currentStroke)return;
    const events=typeof e.getCoalescedEvents==='function'?e.getCoalescedEvents():[e];
    for(const event of events){
      const p=point(event);
      pendingPoints.push({x:p.x,y:p.y,time:Number(event.timeStamp)||performance.now()});
    }
    if(!drawFrame)drawFrame=requestAnimationFrame(appendPendingPoint);
    e.preventDefault();
  };

  const up=()=>{
    if(drawing&&currentStroke){
      flushPendingPoint();
      if(currentStroke.points.length===1)renderAction(currentStroke);
      pushAction(currentStroke);
    }
    drawing=false;
    currentStroke=null;
  };

  canvas.addEventListener('pointerdown',down);
  canvas.addEventListener('pointermove',move);
  canvas.addEventListener('pointerup',up);
  canvas.addEventListener('pointercancel',up);

  updatePointerMode();
  updateHistoryButtons();
  m._setDrawHistoryCursor=setHistoryCursor;
  m._deactivate=()=>{enabled=false;updatePointerMode();canvas.hidden=true};
  m._reactivate=()=>{canvas.hidden=false;updatePointerMode()};

  const compactAction=action=>{
    if(action.type==='clear')return{t:'c'};
    let priorTime=0;
    return{
      t:'s',
      k:action.tool,
      c:action.color,
      z:Number(action.size)||10,
      p:(action.points||[]).map((p,index)=>{
        const time=Number(p.time)||0;
        const delta=index?clamp(Math.round(time-priorTime),1,80):0;
        priorTime=time;
        return[Math.round(Number(p.x)*10)/10,Math.round(Number(p.y)*10)/10,delta];
      })
    };
  };

  const expandAction=action=>{
    if(action?.t==='c'||action?.type==='clear')return{type:'clear'};
    if(action?.t!=='s'&&action?.type!=='stroke')return null;
    let time=0;
    const points=(Array.isArray(action.p)?action.p:action.points||[]).map(point=>{
      if(Array.isArray(point)){
        time+=Number(point[2])||0;
        return{x:Number(point[0])||0,y:Number(point[1])||0,time};
      }
      time=Number(point.time)||time+16;
      return{x:Number(point.x)||0,y:Number(point.y)||0,time};
    });
    if(!points.length)return null;
    return{
      type:'stroke',
      tool:action.k||action.tool||'brush',
      color:action.c||action.color||'#17191d',
      size:Number(action.z??action.size)||10,
      points
    };
  };

  m._boardGetState=()=>({
    image:baseImageData,
    actions:drawActions.slice(0,drawCursor).map(compactAction),
    tool,
    color:color.value,
    size:size.value
  });
  m._boardSetState=state=>{
    if(!state)return;
    if(state.color){color.value=state.color;updateSwatch()}
    if(state.size)size.value=String(state.size);
    if(state.tool){
      tool=state.tool;
      toolButtons.forEach(button=>button.classList.toggle('is-active',button.dataset.drawTool===tool));
      canvas.dataset.tool=tool;
    }
    drawActions=(Array.isArray(state.actions)?state.actions:[]).map(expandAction).filter(Boolean);
    drawCursor=drawActions.length;
    baseImageData=typeof state.image==='string'?state.image:'';
    const loadToken=++imageLoadToken;
    if(state.image){
      const image=new Image();
      image.onload=()=>{
        if(loadToken!==imageLoadToken)return;
        baseCtx.clearRect(0,0,baseCanvas.width,baseCanvas.height);
        baseCtx.drawImage(image,0,0,baseCanvas.width,baseCanvas.height);
        redraw();
      };
      image.onerror=()=>{
        if(loadToken!==imageLoadToken)return;
        baseCtx.clearRect(0,0,baseCanvas.width,baseCanvas.height);
        redraw();
      };
      image.src=state.image;
    }else{
      baseCtx.clearRect(0,0,baseCanvas.width,baseCanvas.height);
      redraw();
    }
  };

  const priorCleanup=m._cleanup;
  m._cleanup=()=>{
    if(drawFrame)cancelAnimationFrame(drawFrame);
    imageLoadToken++;
    canvas.remove();
    priorCleanup?.();
  };
}
