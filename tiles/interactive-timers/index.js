(() => {
  'use strict';
  function setup(m) {
    const hourStage=m.querySelector('.hourglass-stage'), candleStage=m.querySelector('.candle-stage');
    const countdownHour=m.querySelector('.hourglass-countdown'), countdownCandle=m.querySelector('.candle-countdown');
    const candleScene=m.querySelector('.candle-scene'), modeButtons=[...m.querySelectorAll('[data-interactive]')];
    const hourglass=window.TeacherTilesHourglass.create(m.querySelector('.hourglass-canvas'));
    const rocketStage=m.querySelector('.rocket-stage'),plantStage=m.querySelector('.sunflower-stage');
    const stories=window.TeacherTilesGardenRocket.create(rocketStage,plantStage);
    let mode='hourglass';
    const setMode=next=>{
      mode=['hourglass','candle','rocket','sunflower'].includes(next)?next:'hourglass';m.dataset.interactiveMode=mode;
      hourStage.hidden=mode!=='hourglass';candleStage.hidden=mode!=='candle';
      rocketStage.hidden=mode!=='rocket';plantStage.hidden=mode!=='sunflower';stories.setMode(mode);
      hourglass.setActive(mode==='hourglass');
      modeButtons.forEach(b=>{b.classList.toggle('is-active',b.dataset.interactive===mode);b.setAttribute('aria-pressed',String(b.dataset.interactive===mode));});
    };
    modeButtons.forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.interactive)));
    m.querySelector('.interactive-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
    m.querySelector('.candle-color-control').addEventListener('click',()=>cycleData(m,'candleColor',['cream','blush','sage','sky','lavender','charcoal']));
    const cleanup=bindTimerControls(m,state=>{
      const {progress,left}=state,text=formatCountdown(left);
      countdownHour.textContent=text;countdownCandle.textContent=text;
      rocketStage.querySelector('.scene-countdown').textContent=text;plantStage.querySelector('.scene-countdown').textContent=text;
      stories.update(state);
      hourglass.update(state);
      candleScene.style.setProperty('--candle-height',`${Math.max(8,78-70*progress)}%`);
      m.classList.toggle('candle-finished',mode==='candle'&&left<=0);
    },{onFinish:()=>{stories.finish();if(mode==='candle')m.classList.add('candle-finished');celebrateTimerFinish(m)}});
    setMode(m.dataset.interactiveMode);
    m._boardGetState=()=>({mode});
    m._boardSetState=state=>setMode(state?.mode||m.dataset.interactiveMode);
    m._cleanup=()=>{hourglass.destroy();stories.destroy();cleanup();};
  }
  window.TeacherTilesInteractiveTimers=Object.freeze({setup});
})();
