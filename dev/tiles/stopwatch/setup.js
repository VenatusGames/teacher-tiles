function setupStopwatch(m){
  const display=m.querySelector('.stopwatch-display');
  const start=m.querySelector('.stopwatch-start');
  const lap=m.querySelector('.stopwatch-lap');
  const clear=m.querySelector('.stopwatch-clear');
  const laps=m.querySelector('.stopwatch-laps');
  const bgBtn=m.querySelector('.stopwatch-bg');
  const fontBtn=m.querySelector('.stopwatch-font');
  const textBtn=m.querySelector('.stopwatch-text');
  const modeBtn=m.querySelector('.stopwatch-toggle-mode');
  const analogHand=m.querySelector('.analog-stopwatch-hand');
  const subdialHand=m.querySelector('.analog-stopwatch-subdial-hand');

  let running=false,startedAt=0,elapsed=0,raf=0,lapCount=0;

  const format=ms=>{
    const total=Math.max(0,ms);
    const minutes=Math.floor(total/60000);
    const seconds=Math.floor(total/1000)%60;
    const hundredths=Math.floor(total/10)%100;
    return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${String(hundredths).padStart(2,'0')}`;
  };

  const current=()=>elapsed+(running?performance.now()-startedAt:0);

  const render=()=>{
    const now=current();
    display.textContent=format(now);

    const totalSeconds=now/1000;
    const seconds=totalSeconds%60;
    const minutes=(totalSeconds/60)%30;

    analogHand.style.transform=`translateX(-50%) rotate(${seconds*6}deg)`;
    subdialHand.style.transform=`translateX(-50%) rotate(${minutes*12}deg)`;

    if(running)raf=requestAnimationFrame(render);
  };

  start.addEventListener('click',()=>{
    if(running){
      elapsed=current();
      running=false;
      cancelAnimationFrame(raf);
      start.textContent='Start';
      render();
    }else{
      startedAt=performance.now();
      running=true;
      start.textContent='Pause';
      render();
    }
  });

  lap.addEventListener('click',()=>{
    if(!running&&elapsed<=0)return;
    lapCount++;
    const row=document.createElement('div');
    row.className='stopwatch-lap-row';
    row.innerHTML=`<span>Lap ${lapCount}</span><strong>${format(current())}</strong>`;
    laps.prepend(row);
  });

  clear.addEventListener('click',()=>{
    running=false;
    cancelAnimationFrame(raf);
    startedAt=0;
    elapsed=0;
    lapCount=0;
    display.textContent='00:00.00';
    laps.replaceChildren();
    start.textContent='Start';
    analogHand.style.transform='translateX(-50%) rotate(0deg)';
    subdialHand.style.transform='translateX(-50%) rotate(0deg)';
  });

  bgBtn?.addEventListener('click',()=>{
    cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']);
  });

  fontBtn?.addEventListener('click',()=>{
    cycleData(m,'font',FONT_OPTIONS);
  });

  textBtn?.addEventListener('click',()=>{
    cycleData(m,'text',['dark','soft','blue','rose','white','cream']);
  });

  const syncModeControl=()=>{
    const analog=m.dataset.stopwatchMode==='analog';
    modeBtn?.classList.toggle('is-active',analog);
    const icon=modeBtn?.querySelector('span');
    if(icon)icon.textContent=analog?'◴':'◷';
  };

  modeBtn?.addEventListener('click',()=>{
    const analog=m.dataset.stopwatchMode!=='analog';
    m.dataset.stopwatchMode=analog?'analog':'digital';
    syncModeControl();
    render();
  });

  m._boardGetState=()=>({
    elapsed:current(),
    running,
    laps:[...laps.querySelectorAll('.stopwatch-lap-row')].reverse().map(row=>({
      label:row.querySelector('span')?.textContent||'',
      time:row.querySelector('strong')?.textContent||''
    }))
  });
  m._boardSetState=state=>{
    if(!state)return;
    cancelAnimationFrame(raf);
    running=false;
    elapsed=Math.max(0,Number(state.elapsed)||0);
    startedAt=0;
    lapCount=0;
    laps.replaceChildren();
    for(const item of Array.isArray(state.laps)?state.laps:[]){
      lapCount++;
      const row=document.createElement('div');
      row.className='stopwatch-lap-row';
      row.innerHTML=`<span>${item.label||`Lap ${lapCount}`}</span><strong>${item.time||format(elapsed)}</strong>`;
      laps.prepend(row);
    }
    if(state.running&&elapsed>0){
      startedAt=performance.now();
      running=true;
      start.textContent='Pause';
    }else start.textContent=elapsed>0?'Start':'Start';
    render();
  };

  syncModeControl();
  render();
  m._cleanup=()=>cancelAnimationFrame(raf);
}
