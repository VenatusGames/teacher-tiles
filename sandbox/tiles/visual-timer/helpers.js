function launchConfetti(m){const layer=m.querySelector('.confetti-layer');if(!layer)return;layer.innerHTML='';const colors=['#ff6b7a','#ffd34e','#69c6ff','#7edc8b','#9d7cff','#ff9c5a'];for(let i=0;i<54;i++){const p=document.createElement('i');p.className='confetti-piece';const a=Math.random()*Math.PI*2,d=90+Math.random()*230;p.style.setProperty('--x',`${Math.cos(a)*d}px`);p.style.setProperty('--y',`${Math.sin(a)*d-50}px`);p.style.setProperty('--r',`${Math.round(Math.random()*760-380)}deg`);p.style.setProperty('--confetti',colors[i%colors.length]);p.style.width=`${6+Math.random()*5}px`;p.style.height=`${8+Math.random()*10}px`;p.style.animationDelay=`${Math.random()*.12}s`;layer.appendChild(p)}setTimeout(()=>layer.innerHTML='',1700)}

function timerSyncType(m){return m.classList.contains('interactive-module')?'interactive':'visual'}

function timerSyncPeers(m){return [...workspace.querySelectorAll(timerSyncType(m)==='interactive'?'.interactive-module':'.timer-module')].filter(tile=>typeof tile._boardTimerGetState==='function')}

function celebrateTimerFinish(m){
  if(!m.isConnected)return;
  launchConfetti(m);
  if(m.dataset.timerSync==='true'){
    const key=timerSyncType(m),end=m._boardTimerGetState?.().endAt;
    if(end&&timerSyncSoundEnds.get(key)===end)return;
    if(end)timerSyncSoundEnds.set(key,end);
  }
  playUiSfx('confetti',1,m);
  playUiSfx('timer-tada',1,m);
}

function bindTimerControls(m,onRender,{onFinish}={}){
  const remain=m.querySelector('.timer-remaining, .hourglass-countdown, .candle-countdown');
  const addButtons=[...m.querySelectorAll('[data-add-seconds]')];
  const input=m.querySelector('.timer-custom');
  const untilInput=m.querySelector('.timer-until');
  const set=m.querySelector('.timer-set');
  const untilSet=m.querySelector('.timer-until-set');
  const clear=m.querySelector('.timer-clear');
  const start=m.querySelector('.timer-start');
  const reset=m.querySelector('.timer-reset');
  const initialSeconds=m.dataset.type==='timer'?0:300;
  let total=initialSeconds,left=initialSeconds,running=false,end=0,interval=null,finished=false;

  const renderFinishTime=window.TeacherTilesTimerFinish.setup(m);
  const render=()=>{
    remain.textContent=formatCountdown(left);
    const progress=total>0?1-clamp(left/total,0,1):0;
    onRender({progress,running,left,total});
    renderFinishTime({running,left,total,endAt:end});
  };
  const stop=()=>{if(interval){clearInterval(interval);interval=null}};
  const clearUntil=()=>{if(untilInput)untilInput.value=''};
  const setDurationSeconds=seconds=>{
    const n=Number(seconds);
    if(!Number.isFinite(n)||n<=0)return false;
    running=false;finished=false;stop();
    m.classList.remove('is-running','candle-finished');
    total=Math.max(1,Math.round(n));left=total;end=0;
    start.textContent='Start';
    render();
    return true;
  };
  const setDuration=min=>{
    const n=Number(min);
    if(!Number.isFinite(n)||n<=0)return false;
    clearUntil();
    return setDurationSeconds(n*60);
  };
  const addTime=seconds=>{
    const n=Math.max(1,Math.round(Number(seconds)||0));
    if(!n)return;
    clearUntil();
    finished=false;m.classList.remove('candle-finished');
    if(left<=.05&&!running){
      total=n;left=n;end=0;start.textContent='Start';
    }else{
      total=Math.max(1,total+n);
      left=Math.max(0,left+n);
      if(running&&end>0)end+=n*1000;
    }
    render();
  };
  const secondsUntil=value=>{
    const match=/^(\d{1,2}):(\d{2})$/.exec(String(value||''));
    if(!match)return 0;
    const hours=Number(match[1]),minutes=Number(match[2]);
    if(hours>23||minutes>59)return 0;
    const now=new Date();
    const target=new Date(now);
    target.setHours(hours,minutes,0,0);
    if(target.getTime()<=now.getTime())target.setDate(target.getDate()+1);
    return Math.max(1,Math.round((target.getTime()-now.getTime())/1000));
  };
  const applyUntil=()=>{
    const seconds=secondsUntil(untilInput?.value);
    if(!seconds)return false;
    if(input)input.value='';
    return setDurationSeconds(seconds);
  };

  addButtons.forEach(button=>button.addEventListener('click',()=>addTime(button.dataset.addSeconds)));
  clear?.addEventListener('click',()=>{
    running=false;finished=false;stop();total=0;left=0;end=0;clearUntil();
    if(input)input.value='';
    m.classList.remove('is-running','candle-finished');
    start.textContent='Start';
    render();
  });
  set.addEventListener('click',()=>{if(input.value)setDuration(input.value)});
  input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();set.click()}});
  untilSet?.addEventListener('click',applyUntil);
  untilInput?.addEventListener('keydown',event=>{
    if(event.key!=='Enter')return;
    event.preventDefault();
    untilSet?.click();
  });

  let pointerFocusedField=null;
  const pointerFocus=event=>{pointerFocusedField=event.currentTarget};
  const clearPointerFocus=event=>{if(pointerFocusedField===event.currentTarget)pointerFocusedField=null};
  [input,untilInput].filter(Boolean).forEach(field=>{
    field.addEventListener('pointerdown',pointerFocus);
    field.addEventListener('blur',clearPointerFocus);
  });
  const releasePointerFocusedField=()=>{
    if(pointerFocusedField&&document.activeElement===pointerFocusedField)pointerFocusedField.blur();
    pointerFocusedField=null;
  };
  m.addEventListener('pointerleave',releasePointerFocusedField);

  const tick=()=>{
    if(!m.isConnected){pauseDeletedTimer();return}
    if(!running)return;
    left=Math.max(0,(end-Date.now())/1000);
    render();
    if(left<=0){
      running=false;stop();m.classList.remove('is-running');start.textContent='Start';
      if(!finished){
        finished=true;
        onFinish?.();
        m.animate([{transform:'scale(1)'},{transform:'scale(1.025)'},{transform:'scale(1)'}],{duration:500});
      }
    }
  };

  start.addEventListener('click',()=>{
    if(running){
      left=Math.max(0,(end-Date.now())/1000);
      running=false;stop();m.classList.remove('is-running');start.textContent='Resume';render();
      return;
    }
    if(total<=0)return;
    if(left<=0){left=total;finished=false;m.classList.remove('candle-finished')}
    if(left<=0)return;
    running=true;end=Date.now()+left*1000;m.classList.add('is-running');start.textContent='Pause';
    interval=setInterval(tick,80);tick();
  });
  reset.addEventListener('click',()=>{
    running=false;finished=false;stop();left=total;end=0;clearUntil();m.classList.remove('is-running','candle-finished');start.textContent='Start';render();
  });

  m._boardTimerGetState=()=>({total,left:running?Math.max(0,(end-Date.now())/1000):left,running,finished,endAt:end});
  m._boardTimerSetState=state=>{
    if(!state)return;
    stop();
    const restoredTotal=Number(state.total);
    total=Number.isFinite(restoredTotal)&&restoredTotal>=0?restoredTotal:300;
    const restoredLeft=Number(state.left);
    left=Math.max(0,Math.min(total,Number.isFinite(restoredLeft)?restoredLeft:total));
    finished=Boolean(state.finished);
    running=Boolean(state.running)&&left>0;
    m.classList.toggle('is-running',running);
    start.textContent=running?'Pause':left<total&&left>0?'Resume':'Start';
    if(running){
      end=Number.isFinite(state.endAt)&&state.endAt>0?state.endAt:Date.now()+left*1000;
      interval=setInterval(tick,80);
    }else end=0;
    clearUntil();
    render();
  };

  setupTimerSync(m);
  const priorDeactivate=m._deactivate;
  const pauseDeletedTimer=()=>{
    if(running)left=Math.max(0,(end-Date.now())/1000);
    running=false;stop();end=0;m.classList.remove('is-running');
    start.textContent=left<total?'Resume':'Start';render();
  };
  m._deactivate=()=>{pauseDeletedTimer();priorDeactivate?.()};
  render();
  return()=>{
    stop();
    m.removeEventListener('pointerleave',releasePointerFocusedField);
    [input,untilInput].filter(Boolean).forEach(field=>{
      field.removeEventListener('pointerdown',pointerFocus);
      field.removeEventListener('blur',clearPointerFocus);
    });
    delete m._boardTimerGetState;
    delete m._boardTimerSetState;
  };
}

function cycleData(m,key,values){const choice=m._appearanceChoice;if(choice?.key===key&&(values.includes(choice.value)||(key==='font'&&['dm','space','mono'].includes(choice.value))||(key==='text'&&['cream','red','orange','gold','green','teal','purple','brown'].includes(choice.value)))){m.dataset[key]=choice.value;return}const current=m.dataset[key]||values[0],i=values.indexOf(current);m.dataset[key]=values[(i+1)%values.length]}
