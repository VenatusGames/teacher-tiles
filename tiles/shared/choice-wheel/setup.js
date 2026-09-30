function setupChoiceWheel(m,{items}){
  const face=m.querySelector('.choicewheel-face');
  const options=m.querySelector('.choicewheel-options');
  const pointer=m.querySelector('.choicewheel-pointer');
  const selectionDisplay=m.querySelector('.choicewheel-selection-display');
  const selectionIcon=m.querySelector('.choicewheel-selection-icon');
  const selectionName=m.querySelector('.choicewheel-selection-name');
  const hint=m.querySelector('.choicewheel-hint');
  const sector=360/items.length;
  let selected=0;
  let resizeFrame=0;

  const syncWheelSize=()=>{
    resizeFrame=0;
    const style=getComputedStyle(m);
    const number=value=>Number.parseFloat(value)||0;
    const width=m.clientWidth-number(style.paddingLeft)-number(style.paddingRight);
    const reservedHeight=selectionDisplay.offsetHeight+hint.offsetHeight+(number(style.rowGap)||number(style.gap)||5)*2;
    const height=m.clientHeight-number(style.paddingTop)-number(style.paddingBottom)-reservedHeight;
    const size=Math.max(160,Math.min(560,width,height));
    m.style.setProperty('--choicewheel-size',`${Math.floor(size)}px`);
  };
  const scheduleWheelSize=()=>{
    if(resizeFrame)return;
    resizeFrame=requestAnimationFrame(syncWheelSize);
  };
  const wheelResizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(scheduleWheelSize):null;
  wheelResizeObserver?.observe(m);
  queueMicrotask(scheduleWheelSize);

  m.style.setProperty('--choicewheel-count',String(items.length));
  m.style.setProperty('--choicewheel-offset',`${-sector/2}deg`);
  m.style.setProperty('--choicewheel-colors',items.map((item,index)=>`${item.color} ${index*sector}deg ${(index+1)*sector}deg`).join(','));

  const renderSelection=(index,{angle=index*sector,notify=false}={})=>{
    selected=(Math.round(Number(index))%items.length+items.length)%items.length;
    pointer.style.setProperty('--pointer-angle',`${angle}deg`);
    pointer.setAttribute('aria-valuenow',String(selected));
    pointer.setAttribute('aria-valuetext',items[selected].name);
    options.querySelectorAll('.choicewheel-option').forEach((option,optionIndex)=>option.classList.toggle('is-active',optionIndex===selected));
    selectionIcon.textContent=items[selected].icon;
    selectionName.textContent=items[selected].name;
    if(notify)notifyBoardChanged(`${m.dataset.type}-selection`);
  };

  items.forEach((item,index)=>{
    const angle=index*sector*Math.PI/180;
    const button=document.createElement('button');
    button.type='button';
    button.className='choicewheel-option';
    button.style.left=`${50+Math.sin(angle)*35}%`;
    button.style.top=`${50-Math.cos(angle)*35}%`;
    button.style.setProperty('--choice-color',item.color);
    button.setAttribute('aria-label',`Point to ${item.name}`);
    const icon=document.createElement('span');icon.textContent=item.icon;icon.setAttribute('aria-hidden','true');
    const label=document.createElement('strong');label.textContent=item.name;
    button.append(icon,label);
    button.addEventListener('click',event=>{event.stopPropagation();renderSelection(index,{notify:true})});
    options.appendChild(button);
  });

  const indexFromPointer=event=>{
    const rect=face.getBoundingClientRect();
    const dx=event.clientX-(rect.left+rect.width/2);
    const dy=event.clientY-(rect.top+rect.height/2);
    const angle=(Math.atan2(dy,dx)*180/Math.PI+90+360)%360;
    return{angle,index:Math.round(angle/sector)%items.length};
  };
  face.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.target.closest('.choicewheel-option'))return;
    event.preventDefault();event.stopPropagation();
    pointer.focus({preventScroll:true});
    const pointerId=event.pointerId;
    face.setPointerCapture?.(pointerId);
    m.classList.add('is-wheel-dragging');
    const move=moveEvent=>{
      if(moveEvent.pointerId!==pointerId)return;
      moveEvent.preventDefault();moveEvent.stopPropagation();
      const next=indexFromPointer(moveEvent);
      renderSelection(next.index,{angle:next.angle});
    };
    const end=endEvent=>{
      if(endEvent.pointerId!==pointerId)return;
      face.removeEventListener('pointermove',move);
      face.removeEventListener('pointerup',end);
      face.removeEventListener('pointercancel',end);
      m.classList.remove('is-wheel-dragging');
      renderSelection(selected,{notify:true});
    };
    move(event);
    face.addEventListener('pointermove',move);
    face.addEventListener('pointerup',end);
    face.addEventListener('pointercancel',end);
  });
  pointer.addEventListener('keydown',event=>{
    let next=null;
    if(event.key==='ArrowRight'||event.key==='ArrowDown')next=selected+1;
    if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=selected-1;
    if(event.key==='Home')next=0;
    if(event.key==='End')next=items.length-1;
    if(next===null)return;
    event.preventDefault();event.stopPropagation();
    renderSelection(next,{notify:true});
  });
  m.querySelector('.choicewheel-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.choicewheel-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.choicewheel-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));
  renderSelection(0);
  const prior=m._cleanup;
  m._cleanup=()=>{wheelResizeObserver?.disconnect();if(resizeFrame)cancelAnimationFrame(resizeFrame);prior?.()};
  return{
    getState:()=>({selected}),
    setState(saved){selected=clamp(Math.round(Number(saved?.selected)||0),0,items.length-1);renderSelection(selected)}
  };
}
