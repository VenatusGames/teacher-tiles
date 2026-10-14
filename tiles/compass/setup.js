function setupCompass(m){
  const tileTitle=bindEditableModuleTitle(m,'.compass-title','Compass Explorer');
  const svg=m.querySelector('.compass-face');
  const ticks=m.querySelector('.compass-ticks');
  const needle=m.querySelector('.compass-needle');
  const output=m.querySelector('.compass-heading');
  const partName=m.querySelector('.compass-part-name');
  const partCopy=m.querySelector('.compass-part-copy');
  let heading=0;
  let part='needle';
  const svgNs='http://www.w3.org/2000/svg';
  for(let degree=0;degree<360;degree+=5){
    const line=document.createElementNS(svgNs,'line');
    const major=degree%45===0;
    line.setAttribute('x1','210');line.setAttribute('x2','210');line.setAttribute('y1',major?'32':'36');line.setAttribute('y2',major?'50':'44');line.setAttribute('transform',`rotate(${degree} 210 210)`);line.classList.toggle('is-major',major);ticks.appendChild(line);
  }
  const directionFor=value=>['North','Northeast','East','Southeast','South','Southwest','West','Northwest'][Math.round(value/45)%8];
  const setHeading=(value,{notify=true}={})=>{
    heading=(Math.round(Number(value))%360+360)%360;
    needle.style.transform=`rotate(${heading}deg)`;
    output.textContent=`${heading}° · ${directionFor(heading)}`;
    if(notify)notifyBoardChanged('compass-heading');
  };
  const setPart=(next,{notify=true}={})=>{
    part=COMPASS_PARTS[next]?next:'needle';
    m.dataset.compassPart=part;
    partName.textContent=COMPASS_PARTS[part].name;
    partCopy.textContent=COMPASS_PARTS[part].copy;
    m.querySelectorAll('[data-compass-part]').forEach(button=>button.classList.toggle('is-active',button.dataset.compassPart===part));
    if(notify)notifyBoardChanged('compass-part');
  };
  m.querySelectorAll('[data-compass-part]').forEach(button=>button.addEventListener('click',()=>setPart(button.dataset.compassPart)));
  const pointerAngle=event=>{
    const rect=svg.getBoundingClientRect();
    const x=event.clientX-(rect.left+rect.width/2);
    const y=event.clientY-(rect.top+rect.height/2);
    return Math.atan2(x,-y)*180/Math.PI;
  };
  let spin=null;
  svg.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    event.preventDefault();
    event.stopPropagation();
    spin={pointerId:event.pointerId,lastAngle:pointerAngle(event)};
    svg.setPointerCapture?.(event.pointerId);
    svg.classList.add('is-spinning');
  });
  svg.addEventListener('pointermove',event=>{
    if(!spin||event.pointerId!==spin.pointerId)return;
    event.preventDefault();
    const angle=pointerAngle(event);
    let delta=angle-spin.lastAngle;
    if(delta>180)delta-=360;
    else if(delta<-180)delta+=360;
    spin.lastAngle=angle;
    setHeading(heading+delta);
  });
  const endSpin=event=>{
    if(!spin||event.pointerId!==spin.pointerId)return;
    try{svg.releasePointerCapture?.(event.pointerId)}catch{}
    spin=null;
    svg.classList.remove('is-spinning');
  };
  svg.addEventListener('pointerup',endSpin);
  svg.addEventListener('pointercancel',endSpin);
  svg.addEventListener('lostpointercapture',()=>{spin=null;svg.classList.remove('is-spinning')});
  svg.addEventListener('keydown',event=>{
    const step=event.shiftKey?15:5;
    if(event.key==='ArrowRight'||event.key==='ArrowUp'){event.preventDefault();setHeading(heading+step)}
    else if(event.key==='ArrowLeft'||event.key==='ArrowDown'){event.preventDefault();setHeading(heading-step)}
    else if(event.key==='Home'){event.preventDefault();setHeading(0)}
  });
  m.querySelector('.compass-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.compass-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.compass-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));
  setHeading(0,{notify:false});setPart('needle',{notify:false});
  m._boardGetState=()=>({title:tileTitle.get(),heading,part});
  m._boardSetState=state=>{tileTitle.set(state?.title);setHeading(state?.heading||0,{notify:false});setPart(state?.part||'needle',{notify:false})};
}
