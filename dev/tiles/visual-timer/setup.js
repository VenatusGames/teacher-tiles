function setupTimerSync(m){
  const toggle=document.createElement('button');toggle.type='button';toggle.className='timer-sync-toggle';toggle.setAttribute('role','switch');
  toggle.classList.add('timer-sync-toggle--labeled');
  toggle.innerHTML='<span>Sync Timers</span><span class="timer-sync-switch" aria-hidden="true"><i></i></span>';
  const refresh=()=>{const enabled=m.dataset.timerSync==='true';toggle.setAttribute('aria-checked',String(enabled));toggle.setAttribute('aria-label',`Sync all ${timerSyncType(m)==='visual'?'Visual':'Interactive'} Timers`);toggle.title=`Sync timers: ${enabled?'On':'Off'}`};
  const syncRow=m.querySelector('.timer-customization,.interactive-customization');
  m._refreshTimerSync=refresh;(syncRow||m).appendChild(toggle);refresh();
  const publish=()=>{
    if(m.dataset.timerSync!=='true')return;
    const state=m._boardTimerGetState();
    for(const peer of timerSyncPeers(m))if(peer!==m&&peer.dataset.timerSync==='true')peer._boardTimerSetState(state);
  };
  toggle.addEventListener('click',()=>{
    const enabled=m.dataset.timerSync!=='true';
    for(const peer of timerSyncPeers(m)){peer.dataset.timerSync=String(enabled);peer._refreshTimerSync?.()}
    if(enabled)publish();notifyBoardChanged('timer-sync');
  });
  m.addEventListener('click',event=>{if(event.target.closest('.timer-start,.timer-reset,.timer-clear,.timer-set,[data-add-seconds]')){publish();notifyBoardChanged('timer-controls')}});
  m.addEventListener('change',event=>{if(event.target instanceof Element&&event.target.closest('.timer-until')){publish();notifyBoardChanged('timer-controls')}});
  queueMicrotask(()=>{
    if(!m.isConnected)return;
    const peer=timerSyncPeers(m).find(tile=>tile!==m&&tile.dataset.timerSync==='true');
    if(peer){m.dataset.timerSync='true';m._boardTimerSetState(peer._boardTimerGetState())}
    else if(m.dataset.timerSync==='true'){for(const tile of timerSyncPeers(m)){tile.dataset.timerSync='true';tile._refreshTimerSync?.()}publish()}
    refresh();
  });
}

function setupTimer(m){
  const stage=m.querySelector('.timer-stage'),visual=m.querySelector('.timer-visual'),readout=m.querySelector('.timer-readout'),controls=m.querySelector('.timer-controls'),clip=m.querySelector('.shape-clip'),clipPath=m.querySelector('.shape-clip path'),outline=m.querySelector('.shape-outline'),highlight=m.querySelector('.shape-highlight'),foreign=m.querySelector('.shape-foreign'),fill=m.querySelector('.shape-fill'),status=m.querySelector('.timer-status'),shapeSelect=m.querySelector('.timer-shape-select');
  const liquid=document.createElement('div');liquid.className='timer-liquid-fill';liquid.setAttribute('aria-hidden','true');
  liquid.innerHTML='<svg class="timer-liquid-wave" viewBox="0 0 200 12" preserveAspectRatio="none"><path d="M0 6 Q25 0 50 6 T100 6 T150 6 T200 6 V12 H0Z"/></svg><i></i><i></i><i></i>';
  fill.append(liquid);
  const clipId=`shape-clip-${++uid}`;
  clip.id=clipId;
  foreign.setAttribute('clip-path',`url(#${clipId})`);

  const setShape=(shape,animate=false)=>{
    const d=shapePaths[shape]||shapePaths.circle;
    m.dataset.timerShape=shape;
    clipPath.setAttribute('d',d);
    outline.setAttribute('d',d);
    highlight?.setAttribute('d',d);
    if(readout&&readout.parentElement!==visual)visual.appendChild(readout);
    requestAnimationFrame(sizeVisual);
    if(animate&&visual?.animate)visual.animate([
      {transform:'scale(1) rotate(0deg)'},
      {transform:'scale(.965) rotate(-.6deg)',offset:.38},
      {transform:'scale(1.012) rotate(.25deg)',offset:.72},
      {transform:'scale(1) rotate(0deg)'}
    ],{duration:330,easing:'cubic-bezier(.2,.8,.2,1)'});
  };

  shapeSelect.addEventListener('change',()=>{setShape(shapeSelect.value,true);notifyBoardChanged('timer-shape')});
  const shapeButton=document.createElement('button');shapeButton.type='button';shapeButton.className='custom-icon timer-shape-toggle';shapeButton.setAttribute('aria-label','Choose timer shape');shapeButton.setAttribute('aria-expanded','false');shapeButton.title='Choose timer shape';
  m.querySelector('.timer-shape-color').after(shapeButton);
  shapeSelect.closest('.timer-shape-setting').hidden=true;
  const shapeShelf=document.createElement('div');shapeShelf.className='timer-shape-shelf';shapeShelf.hidden=true;shapeShelf.setAttribute('role','group');shapeShelf.setAttribute('aria-label','Timer shape');document.body.appendChild(shapeShelf);
  const shapeIcon=shape=>`<svg viewBox="0 0 100 100" aria-hidden="true"><path d="${shapePaths[shape]||shapePaths.circle}"/></svg>`;
  const refreshShape=()=>{shapeButton.innerHTML=shapeIcon(shapeSelect.value);shapeShelf.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.shape===shapeSelect.value)))};
  const colorButton=m.querySelector('.timer-shape-color');colorButton.setAttribute('aria-expanded','false');colorButton.setAttribute('aria-label','Choose timer color');colorButton.title='Choose timer color';
  let shelfAnchor=shapeButton;
  let shapeFrame=0;
  const closeShapes=()=>{shapeShelf.hidden=true;shapeButton.setAttribute('aria-expanded','false');colorButton.setAttribute('aria-expanded','false');cancelAnimationFrame(shapeFrame);m.classList.remove('has-shape-shelf-open')};
  const positionShapes=()=>{
    if(!m.isConnected){closeShapes();return}
    const r=shelfAnchor.getBoundingClientRect(),w=shapeShelf.offsetWidth,h=shapeShelf.offsetHeight;
    shapeShelf.style.left=`${Math.max(8,Math.min(r.left+r.width/2-w/2,innerWidth-w-8))}px`;
    shapeShelf.style.top=`${Math.max(8,Math.min(r.top-h-8,innerHeight-h-8))}px`;
    shapeFrame=requestAnimationFrame(positionShapes);
  };
  for(const option of shapeSelect.options){
    const button=document.createElement('button');button.type='button';button.dataset.shape=option.value;button.innerHTML=shapeIcon(option.value);const label=document.createElement('span');label.textContent=option.textContent;button.appendChild(label);
    button.addEventListener('click',()=>{shapeSelect.value=option.value;shapeSelect.dispatchEvent(new Event('change',{bubbles:true}));refreshShape();closeShapes();shapeButton.focus({preventScroll:true})});shapeShelf.appendChild(button);
  }
  const shapeChoices=[...shapeShelf.children];
  shapeButton.addEventListener('click',()=>{if(!shapeShelf.hidden&&shelfAnchor===shapeButton){closeShapes();return}closeShapes();shelfAnchor=shapeButton;shapeShelf.replaceChildren(...shapeChoices);shapeShelf.setAttribute('aria-label','Timer shape');refreshShape();shapeShelf.hidden=false;shapeButton.setAttribute('aria-expanded','true');m.classList.add('has-shape-shelf-open');positionShapes()});
  const outsideShapes=event=>{if(!shapeShelf.contains(event.target)&&!shapeButton.contains(event.target)&&!colorButton.contains(event.target))closeShapes()};
  const escapeShapes=event=>{if(event.key==='Escape'&&!shapeShelf.hidden){event.stopPropagation();closeShapes();shelfAnchor.focus({preventScroll:true})}};
  document.addEventListener('pointerdown',outsideShapes);document.addEventListener('keydown',escapeShapes,true);
  shapeShelf.addEventListener('pointerdown',event=>event.stopPropagation());
  shapeSelect.addEventListener('change',refreshShape);


  m.querySelector('.timer-font')?.addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.timer-text')?.addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));
  m.querySelector('.timer-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  colorButton.addEventListener('click',()=>{
    if(!shapeShelf.hidden&&shelfAnchor===colorButton){closeShapes();return}
    closeShapes();shelfAnchor=colorButton;shapeShelf.replaceChildren();shapeShelf.setAttribute('aria-label','Timer color');
    for(const [value,color] of Object.entries({blue:'#6f8fb7',green:'#6ea67d',amber:'#d49d45',rose:'#c8798d',purple:'#8c7bc3',teal:'#58a3a0',midnight:'#30343b',creme:'#eadfc6'})){
      const button=document.createElement('button');button.type='button';button.setAttribute('aria-pressed',String((m.dataset.shapeColor||'blue')===value));
      const swatch=document.createElement('i');swatch.className='timer-shelf-swatch';swatch.style.background=color;swatch.setAttribute('aria-hidden','true');
      const label=document.createElement('span');label.textContent=value[0].toUpperCase()+value.slice(1);button.append(swatch,label);
      button.addEventListener('click',()=>{m.dataset.shapeColor=value;notifyBoardChanged('timer-color');closeShapes();colorButton.focus({preventScroll:true})});shapeShelf.appendChild(button);
    }
    shapeShelf.hidden=false;colorButton.setAttribute('aria-expanded','true');m.classList.add('has-shape-shelf-open');positionShapes();
  });

  const sizeVisual=()=>{
    if(!stage)return;
    const stageWidth=stage.clientWidth,stageHeight=stage.clientHeight;
    if(stageWidth<20||stageHeight<20)return;
    const shortest=Math.min(stageWidth,stageHeight);
    const breathingRoom=Math.max(10,Math.min(28,shortest*.055));
    const size=Math.max(0,shortest-(breathingRoom*2));
    visual.style.setProperty('--timer-visual-size',`${size}px`);
  };
  const sizeObserver=new ResizeObserver(sizeVisual);
  if(stage)sizeObserver.observe(stage);
  requestAnimationFrame(sizeVisual);

  let settingsHideTimer=0;
  const keepSettingsOpen=()=>{
    clearTimeout(settingsHideTimer);
    m.classList.add('is-settings-open');
  };
  const releaseSettings=()=>{
    clearTimeout(settingsHideTimer);
    settingsHideTimer=setTimeout(()=>{
      if(m.matches('.is-pointer-over,:has(:focus-visible)')||controls?.matches(':has(:focus-visible)'))return;
      m.classList.remove('is-settings-open');
    },520);
  };
  const releasePointerSettings=()=>{
    if(m.dataset.tileSkin==='timer-freestanding'){
      const active=document.activeElement;
      if(active instanceof HTMLElement&&controls?.contains(active))active.blur();
    }
    releaseSettings();
  };
  m.addEventListener('pointerenter',keepSettingsOpen);
  m.addEventListener('pointerleave',releasePointerSettings);
  m.addEventListener('focusin',keepSettingsOpen);
  m.addEventListener('focusout',releaseSettings);
  controls?.addEventListener('pointerenter',keepSettingsOpen);
  controls?.addEventListener('pointerleave',releaseSettings);

  const initialShape=shapePaths[m.dataset.timerShape]?m.dataset.timerShape:'circle';
  shapeSelect.value=initialShape;refreshShape();
  setShape(initialShape);
  let visualFrame=0;
  const paintProgress=progress=>{
    fill.style.setProperty('--progress',`${progress*360}deg`);
    m.style.setProperty('--timer-progress-ratio',progress.toFixed(6));
    liquid.style.height=(progress*100)+'%';liquid.style.opacity=progress>0?'1':'0';
  };
  const stopTimer=bindTimerControls(m,({progress,running,left,total})=>{
    cancelAnimationFrame(visualFrame);paintProgress(progress);
    if(running&&['timer-solid','timer-liquid'].includes(m.dataset.tileSkin)){
      const started=performance.now();
      const animate=now=>{
        if(!m.isConnected)return;
        paintProgress(total>0?clamp(1-(left-(now-started)/1000)/total,0,1):0);
        visualFrame=requestAnimationFrame(animate);
      };
      visualFrame=requestAnimationFrame(animate);
    }
    const complete=left<=.05;
    const paused=!running&&!complete&&left<total-.05;
    m.classList.toggle('timer-complete',complete);
    m.classList.toggle('timer-paused',paused);
    if(status)status.textContent=complete?'DONE':running?'RUNNING':paused?'PAUSED':'READY';
  },{onFinish:()=>celebrateTimerFinish(m)});

  m._cleanup=()=>{
    clearTimeout(settingsHideTimer);
    closeShapes();shapeShelf.remove();document.removeEventListener('pointerdown',outsideShapes);document.removeEventListener('keydown',escapeShapes,true);
    cancelAnimationFrame(visualFrame);stopTimer();
    sizeObserver.disconnect();
  };
  window.TeacherTilesTimerPointer.attach(m);
}
