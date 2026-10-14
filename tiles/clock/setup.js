function setupClock(m){
  const skinMode=m.dataset.tileSkin==='clock-analog-clear'?'analog':m.dataset.tileSkin==='clock-digital'?'digital':null;
  const isAnalog=()=>skinMode?skinMode==='analog':m.dataset.clockMode==='analog';
  const display=m.querySelector('.clock-display');
  const content=m.querySelector('.clock-content');
  const main=m.querySelector('.clock-main');
  const sec=m.querySelector('.clock-seconds');
  const period=m.querySelector('.clock-period');
  const secondsBtn=m.querySelector('.clock-toggle-seconds');
  const periodBtn=m.querySelector('.clock-toggle-period');
  const modeBtn=m.querySelector('.clock-toggle-mode');
  const hourHand=m.querySelector('.analog-hour');
  const minuteHand=m.querySelector('.analog-minute');
  const secondHand=m.querySelector('.analog-second');

  const fit=()=>{
    if(isAnalog())return;
    const aw=Math.max(30,display.clientWidth-12),ah=Math.max(30,display.clientHeight-12);
    let lo=12,hi=1200,best=12;
    for(let n=0;n<18;n++){
      const mid=(lo+hi)/2;
      m.style.setProperty('--clock-size',`${mid}px`);
      const r=content.getBoundingClientRect();
      const renderedScale=moduleViewportScale(m);
      if(r.width/renderedScale<=aw&&r.height/renderedScale<=ah){best=mid;lo=mid}else hi=mid;
    }
    m.style.setProperty('--clock-size',`${Math.max(12,best*.975)}px`);
  };
  let fitFrame=0;
  const refit=()=>{if(!fitFrame)fitFrame=requestAnimationFrame(()=>{fitFrame=0;if(m.isConnected)fit()})};

  m.querySelector('.clock-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.clock-font').addEventListener('click',()=>{cycleData(m,'font',FONT_OPTIONS);refit()});
  m.querySelector('.clock-text').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));

  const modeChoices=[...modeBtn.querySelectorAll('[data-clock-choice]')];
  const syncModeControls=()=>{
    const analog=isAnalog();
    modeBtn.hidden=Boolean(m.dataset.tileSkin);
    modeBtn.dataset.mode=analog?'analog':'digital';
    modeChoices.forEach(button=>{
      const active=button.dataset.clockChoice===(analog?'analog':'digital');
      button.hidden=active;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    secondsBtn.hidden=analog;
    periodBtn.hidden=analog;
  };

  modeChoices.forEach(button=>button.addEventListener('click',()=>{
    m.dataset.clockMode=button.dataset.clockChoice==='analog'?'analog':'digital';
    syncModeControls();
    refit();
  }));

  secondsBtn.addEventListener('click',()=>{
    m.classList.toggle('show-seconds');
    const active=m.classList.contains('show-seconds');
    secondsBtn.classList.toggle('is-active',active);
    secondsBtn.setAttribute('aria-pressed',String(active));
    refit();
  });
  periodBtn.addEventListener('click',()=>{
    m.classList.toggle('hide-period');
    const active=!m.classList.contains('hide-period');
    periodBtn.classList.toggle('is-active',active);
    periodBtn.setAttribute('aria-pressed',String(active));
    refit();
  });

  const formatter=new Intl.DateTimeFormat([],{hour:'numeric',minute:'2-digit',hour12:true});
  let lastMinute=-1,lastSecond=-1;
  const update=()=>{
    if(document.hidden)return;
    const d=new Date(),minuteStamp=Math.floor(d.getTime()/60000),second=d.getSeconds();
    if(minuteStamp!==lastMinute){
      lastMinute=minuteStamp;
      const parts=formatter.formatToParts(d);
      main.textContent=parts.find(p=>p.type==='hour')?.value+':'+parts.find(p=>p.type==='minute')?.value;
      period.textContent=parts.find(p=>p.type==='dayPeriod')?.value||'';
      refit();
    }
    if(second!==lastSecond){lastSecond=second;sec.textContent=':'+String(second).padStart(2,'0')}
    if(isAnalog()){
      const seconds=second+d.getMilliseconds()/1000,minutes=d.getMinutes()+seconds/60,hours=(d.getHours()%12)+minutes/60;
      hourHand.style.transform='translateX(-50%) rotate('+hours*30+'deg)';
      minuteHand.style.transform='translateX(-50%) rotate('+minutes*6+'deg)';
      secondHand.style.transform='translateX(-50%) rotate('+seconds*6+'deg)';
    }
  };

  const ro=new ResizeObserver(refit);
  ro.observe(m);
  ro.observe(display);
  syncModeControls();
  const secondsActive=m.classList.contains('show-seconds');
  const periodActive=!m.classList.contains('hide-period');
  secondsBtn.classList.toggle('is-active',secondsActive);
  secondsBtn.setAttribute('aria-pressed',String(secondsActive));
  periodBtn.classList.toggle('is-active',periodActive);
  periodBtn.setAttribute('aria-pressed',String(periodActive));
  const id=setInterval(update,100);
  update();
  const previousCleanup=m._cleanup;
  m._cleanup=()=>{clearInterval(id);cancelAnimationFrame(fitFrame);ro.disconnect();previousCleanup?.()};
}
