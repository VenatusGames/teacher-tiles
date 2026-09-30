function setupClassMeter(m){
  const importView=m.querySelector('.classmeter-import');
  const dashboard=m.querySelector('.classmeter-dashboard');
  const className=m.querySelector('.classmeter-class-name');
  const classLogo=m.querySelector('.classmeter-class-logo');
  const changeClass=m.querySelector('.classmeter-change-class');
  const meter=m.querySelector('.classmeter-meter');
  const percent=m.querySelector('.classmeter-percent');
  const winCount=m.querySelector('.classmeter-win-count b');
  const headerActions=document.createElement('div');headerActions.className='pbis-header-actions';changeClass.before(headerActions);headerActions.append(m.querySelector('.classmeter-win-count'),changeClass);
  const fillButton=m.querySelector('.classmeter-fill');
  const decreaseButton=m.querySelector('.classmeter-decrease');
  const orientationButton=m.querySelector('.classmeter-orientation');
  const orientationIcon=orientationButton.querySelector('span');
  const orientationLabel=orientationButton.querySelector('strong');
  const settingsToggle=m.querySelector('.classmeter-settings-toggle');
  const settings=m.querySelector('.classmeter-settings');
  const removeWin=m.querySelector('.classmeter-remove-win');
  const resetWins=m.querySelector('.classmeter-reset-wins');

  const resetProgress=m.querySelector('.classmeter-reset-progress');
  m.querySelector('.classmeter-hover-tools').insertBefore(resetProgress,m.querySelector('.classmeter-orientation'));resetProgress.textContent='Reset';resetProgress.title='Reset current meter; keep earned fills';
  const popup=m.querySelector('.classmeter-win-popup');
  let activeClassId='';
  let pendingClassId='';
  let roster=null;
  let progress=normalizeClassMeterProgress(null);
  let holding=false;
  let holdFrame=0;
  let lastFrameAt=0;
  let celebrationTimer=0;
  let celebrating=false;
  let stopFillSfx=null;

  const currentRoster=()=>readClassRosters().find(item=>item.id===activeClassId)||null;
  const renderProgress=()=>{
    const fill=Math.max(0,Math.min(100,Number(progress.fill)||0));
    m.style.setProperty('--classmeter-fill',`${fill}%`);
    m.classList.toggle('has-meter-fill',fill>0);
    meter.setAttribute('aria-valuenow',String(Math.round(fill)));
    percent.textContent=`${Math.round(fill)}%`;
    winCount.textContent=String(normalizeStarChartCount(progress.wins));
    decreaseButton.disabled=fill<=0||celebrating;

    resetProgress.disabled=fill<=0||celebrating;
    removeWin.disabled=progress.wins<=0;
    resetWins.disabled=progress.wins<=0;
  };

  const render=()=>{
    const hasClass=Boolean(roster&&activeClassId);
    importView.hidden=hasClass;
    dashboard.hidden=!hasClass;
    if(!hasClass)return;
    className.textContent=roster.name;
    classLogo.textContent=normalizeClassLogo(roster.logo);
    renderProgress();
  };

  const persistProgress=()=>{
    const saved=writeClassMeter(activeClassId,progress);
    if(saved)progress=saved;
    renderProgress();
  };

  const setSettingsOpen=open=>{
    const show=Boolean(open);
    settings.hidden=!show;
    settingsToggle.setAttribute('aria-expanded',String(show));
  };

  const setOrientation=(orientation,{resize=false,notify=false}={})=>{
    const horizontal=orientation==='horizontal';
    m.dataset.orientation=horizontal?'horizontal':'vertical';
    orientationIcon.textContent=horizontal?'↕':'↔';
    orientationLabel.textContent=horizontal?'Vertical':'Horizontal';
    orientationButton.setAttribute('aria-label',`Switch to ${horizontal?'vertical':'horizontal'} meter`);
    if(resize){
      const width=horizontal?680:420;
      const height=horizontal?360:610;
      m.style.width=`${width}px`;
      m.style.height=`${height}px`;
      m.style.left=`${clamp(m.offsetLeft,0,BOARD_WIDTH-width)}px`;
      m.style.top=`${clamp(m.offsetTop,0,BOARD_HEIGHT-height)}px`;
    }
    if(notify)notifyBoardChanged('class-meter-orientation');
  };

  const stopHolding=({persist=true}={})=>{
    stopFillSfx?.();
    stopFillSfx=null;
    if(!holding)return;
    holding=false;
    m.classList.remove('is-meter-filling');
    if(holdFrame)cancelAnimationFrame(holdFrame);
    holdFrame=0;
    if(persist&&activeClassId&&!celebrating)persistProgress();
  };

  const celebrateFilledMeter=()=>{
    stopHolding({persist:false});
    celebrating=true;
    const saved=writeClassMeter(activeClassId,{fill:0,wins:normalizeStarChartCount(progress.wins+1)})||normalizeClassMeterProgress({fill:0,wins:progress.wins+1});
    progress={...saved,fill:100};
    renderProgress();
    m.classList.add('is-meter-filled');
    popup.hidden=false;
    launchConfetti(m);
    playUiSfx('confetti',1,m);
    clearTimeout(celebrationTimer);
    celebrationTimer=setTimeout(()=>{
      celebrating=false;
      progress=normalizeClassMeterProgress(saved);
      m.classList.remove('is-meter-filled');
      popup.hidden=true;
      renderProgress();
    },1500);
  };

  const fillTick=timestamp=>{
    if(!holding||celebrating)return;
    if(!lastFrameAt)lastFrameAt=timestamp;
    const elapsed=Math.min(50,Math.max(0,timestamp-lastFrameAt));
    lastFrameAt=timestamp;
    progress.fill=Math.min(100,progress.fill+elapsed*.022);
    renderProgress();
    if(progress.fill>=100){celebrateFilledMeter();return}
    holdFrame=requestAnimationFrame(fillTick);
  };

  const startHolding=()=>{
    if(holding||celebrating||!activeClassId)return;
    holding=true;
    lastFrameAt=performance.now();
    m.classList.add('is-meter-filling');
    stopFillSfx=startClassMeterFillSfx(m);
    holdFrame=requestAnimationFrame(fillTick);
  };

  const loadClass=(classId,{notify=false}={})=>{
    stopHolding({persist:false});
    clearTimeout(celebrationTimer);celebrating=false;m.classList.remove('is-meter-filled');popup.hidden=true;
    const next=readClassRosters().find(item=>item.id===classId);
    if(!next){activeClassId='';roster=null;progress=normalizeClassMeterProgress(null);render();return false}
    activeClassId=next.id;pendingClassId='';roster=next;progress=normalizeClassMeterProgress(next.classMeter);
    localStorage.setItem(classMeterLastClassStorageKey(),activeClassId);
    render();
    if(notify)notifyBoardChanged('class-meter-class');
    return true;
  };

  fillButton.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    event.preventDefault();
    try{fillButton.setPointerCapture(event.pointerId)}catch{}
    startHolding();
  });
  fillButton.addEventListener('pointerup',event=>{try{fillButton.releasePointerCapture(event.pointerId)}catch{}stopHolding()});
  fillButton.addEventListener('pointercancel',()=>stopHolding());
  fillButton.addEventListener('lostpointercapture',()=>stopHolding());
  fillButton.addEventListener('keydown',event=>{
    if((event.key===' '||event.key==='Enter')&&!event.repeat){event.preventDefault();startHolding()}
  });
  fillButton.addEventListener('keyup',event=>{
    if(event.key===' '||event.key==='Enter'){event.preventDefault();stopHolding()}
  });
  fillButton.addEventListener('blur',()=>stopHolding());

  settingsToggle.addEventListener('click',()=>setSettingsOpen(settings.hidden));
  orientationButton.addEventListener('click',()=>setOrientation(m.dataset.orientation==='horizontal'?'vertical':'horizontal',{resize:true,notify:true}));
  m.addEventListener('pointerdown',event=>{if(!settings.hidden&&!event.target.closest('.classmeter-settings-wrap'))setSettingsOpen(false)});
  m.addEventListener('pointerleave',()=>{
    if(holding)stopHolding();
    setSettingsOpen(false);
  });
  const decreaseProgress=()=>{if(!activeClassId||celebrating||progress.fill<=0)return;stopHolding({persist:false});progress.fill=Math.max(0,(Number(progress.fill)||0)-5);persistProgress()};
  decreaseButton.addEventListener('click',decreaseProgress);

  resetProgress.addEventListener('click',()=>{if(!activeClassId||celebrating||progress.fill<=0)return;stopHolding({persist:false});progress.fill=0;persistProgress();setSettingsOpen(false)});
  removeWin.addEventListener('click',()=>{if(!activeClassId||!progress.wins)return;progress.wins=normalizeStarChartCount(progress.wins-1);persistProgress()});
  resetWins.addEventListener('click',()=>{if(!activeClassId||!progress.wins)return;progress.wins=0;persistProgress();flushPbisCloudSave();setSettingsOpen(false)});
  changeClass.addEventListener('click',()=>{
    stopHolding();activeClassId='';pendingClassId='';roster=null;progress=normalizeClassMeterProgress(null);localStorage.removeItem(classMeterLastClassStorageKey());setSettingsOpen(false);render();notifyBoardChanged('class-meter-class');
  });

  m.querySelector('.classmeter-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.classmeter-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.classmeter-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));

  const detachRosterLoader=attachClassRosterLoader(m.querySelector('.classmeter-loader-anchor'),(_names,selectedRoster)=>loadClass(selectedRoster.id,{notify:true}));
  const handleClassesChange=()=>{
    if(!activeClassId){if(pendingClassId)loadClass(pendingClassId);return}
    const next=currentRoster();
    if(!next){activeClassId='';roster=null;progress=normalizeClassMeterProgress(null);localStorage.removeItem(classMeterLastClassStorageKey());render();return}
    roster=next;
    if(!holding&&!celebrating)progress=normalizeClassMeterProgress(next.classMeter);
    render();
  };
  const handleMeterChange=event=>{
    if(event.detail?.classId!==activeClassId||celebrating||holding)return;
    const next=currentRoster();if(!next)return;
    roster=next;progress=normalizeClassMeterProgress(next.classMeter);render();
  };
  window.addEventListener('teachertiles:classeschange',handleClassesChange);
  window.addEventListener('teachertiles:classmeterchange',handleMeterChange);

  m._boardGetState=()=>({classId:activeClassId,orientation:m.dataset.orientation==='horizontal'?'horizontal':'vertical'});
  m._boardSetState=state=>{
    setOrientation(state?.orientation==='horizontal'?'horizontal':'vertical');
    const classId=String(state?.classId||'');
    if(classId&&!loadClass(classId))pendingClassId=classId;
  };
  setOrientation(m.dataset.orientation);
  const lastClassId=localStorage.getItem(classMeterLastClassStorageKey())||'';
  if(!lastClassId||!loadClass(lastClassId))render();

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();stopHolding();clearTimeout(celebrationTimer);detachRosterLoader();
    window.removeEventListener('teachertiles:classeschange',handleClassesChange);
    window.removeEventListener('teachertiles:classmeterchange',handleMeterChange);
  };
}
