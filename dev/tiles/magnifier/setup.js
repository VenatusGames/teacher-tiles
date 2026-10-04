function setupMagnifier(m){
  const lens=m.querySelector('.magnifier-lens');
  const liveView=m.querySelector('.magnifier-live-view');
  const zoomValue=m.querySelector('.magnifier-zoom-value');
  const handleValue=m.querySelector('.magnifier-handle span');
  const zoomOut=m.querySelector('.magnifier-zoom-out');
  const zoomIn=m.querySelector('.magnifier-zoom-in');
  let zoom=clamp(Number(m.dataset.zoom)||2,1.5,3);
  let target=null;
  let clone=null;
  let lastCloneAt=0;
  let raf=0;
  let dead=false;

  const lensCenter=()=>{
    const rect=lens.getBoundingClientRect();
    return screenToBoard(rect.left+rect.width/2,rect.top+rect.height/2);
  };

  const targetUnderLens=()=>{
    const center=lensCenter();
    const candidates=[...workspace.querySelectorAll('.module')].filter(module=>{
      if(module===m||module.dataset.type==='magnifier'||!module.isConnected)return false;
      const left=module.offsetLeft,top=module.offsetTop;
      return center.x>=left&&center.x<=left+module.offsetWidth&&center.y>=top&&center.y<=top+module.offsetHeight;
    });
    return candidates.sort((a,b)=>{
      const z=(Number(a.style.zIndex)||0)-(Number(b.style.zIndex)||0);
      return z||([...workspace.children].indexOf(a)-[...workspace.children].indexOf(b));
    }).at(-1)||null;
  };

  const copyLiveState=(source,next)=>{
    const sourceFields=[...source.querySelectorAll('input,textarea,select')];
    const nextFields=[...next.querySelectorAll('input,textarea,select')];
    sourceFields.forEach((field,index)=>{
      const copy=nextFields[index];
      if(!copy)return;
      copy.value=field.value;
      if('checked'in field)copy.checked=field.checked;
    });
    next.querySelectorAll('[id]').forEach(element=>element.removeAttribute('id'));
    next.removeAttribute('id');
    next.querySelectorAll('button,input,textarea,select,a,[contenteditable]').forEach(control=>{
      control.tabIndex=-1;
      control.setAttribute('aria-hidden','true');
    });
  };

  const rebuildClone=nextTarget=>{
    liveView.replaceChildren();
    clone=null;
    if(!nextTarget)return;
    const next=nextTarget.cloneNode(true);
    next.classList.remove('is-selected','is-dragging','is-over-trash','is-snap-target','snap-pop');
    next.classList.add('magnifier-source-clone');
    next.setAttribute('aria-hidden','true');
    copyLiveState(nextTarget,next);
    next.style.width=`${nextTarget.offsetWidth}px`;
    next.style.height=`${nextTarget.offsetHeight}px`;
    next.style.minWidth='0';
    next.style.minHeight='0';
    next.style.maxWidth='none';
    next.style.maxHeight='none';
    next.style.margin='0';
    next.style.zIndex='1';
    next.style.pointerEvents='none';
    liveView.appendChild(next);
    const sourceCanvases=[...nextTarget.querySelectorAll('canvas')];
    const nextCanvases=[...next.querySelectorAll('canvas')];
    sourceCanvases.forEach((source,index)=>{
      const copy=nextCanvases[index];
      if(!copy)return;
      try{copy.getContext('2d')?.drawImage(source,0,0)}catch{}
    });
    clone=next;
  };

  const syncZoom=()=>{
    zoom=clamp(Math.round(zoom*4)/4,1.5,3);
    m.dataset.zoom=String(zoom);
    const label=`${Number.isInteger(zoom)?zoom:zoom.toFixed(2).replace(/0$/,'')}×`;
    zoomValue.textContent=label;
    m.querySelector('.magnifier-zoom-readout').textContent=label;
    handleValue.textContent=label;
    zoomOut.disabled=zoom<=1.5;
    zoomIn.disabled=zoom>=3;
    notifyBoardChanged('magnifier-zoom');
  };

  const positionClone=()=>{
    if(!clone||!target)return;
    const center=lensCenter();
    clone.style.setProperty('left',`${liveView.offsetWidth/2+(target.offsetLeft-center.x)*zoom}px`,'important');
    clone.style.setProperty('top',`${liveView.offsetHeight/2+(target.offsetTop-center.y)*zoom}px`,'important');
    clone.style.setProperty('transform-origin','0 0','important');
    clone.style.setProperty('transform',`scale(${zoom})`,'important');
  };

  const loop=now=>{
    if(dead||!m.isConnected)return;
    const nextTarget=targetUnderLens();
    if(nextTarget!==target||now-lastCloneAt>220){
      target=nextTarget;
      rebuildClone(target);
      lastCloneAt=now;
      m.classList.toggle('has-magnified-target',Boolean(target));
    }
    positionClone();
    raf=requestAnimationFrame(loop);
  };

  zoomOut.addEventListener('click',()=>{zoom-=.25;syncZoom()});
  zoomIn.addEventListener('click',()=>{zoom+=.25;syncZoom()});
  syncZoom();
  raf=requestAnimationFrame(loop);

  m._boardGetState=()=>({zoom});
  m._boardSetState=state=>{zoom=clamp(Number(state?.zoom)||2,1.5,3);syncZoom()};
  const priorCleanup=m._cleanup;
  m._cleanup=()=>{dead=true;cancelAnimationFrame(raf);priorCleanup?.()};
}
