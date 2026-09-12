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
    const symbols={hourglass:'⌛',candle:'🕯️',rocket:'🚀',sunflower:'🌻'};
    const typeButton=document.createElement('button');typeButton.type='button';typeButton.className='tile-action interactive-type-toggle';typeButton.setAttribute('aria-label','Choose timer type');typeButton.setAttribute('aria-expanded','false');
    const originalPicker=m.querySelector('.interactive-picker');const typeRow=document.createElement('div');typeRow.className='interactive-type-row';originalPicker.replaceWith(typeRow);typeRow.append(typeButton,m.querySelector('.interactive-customization'));
    const drawer=document.createElement('div');drawer.className='timer-shape-shelf interactive-type-shelf';drawer.hidden=true;drawer.setAttribute('role','group');drawer.setAttribute('aria-label','Timer type');document.body.appendChild(drawer);
    let drawerFrame=0;
    const closeDrawer=()=>{drawer.hidden=true;typeButton.setAttribute('aria-expanded','false');m.classList.remove('has-shape-shelf-open');cancelAnimationFrame(drawerFrame)};
    const positionDrawer=()=>{if(!m.isConnected){closeDrawer();return}const r=typeButton.getBoundingClientRect();drawer.style.left=`${Math.max(8,Math.min(r.left,innerWidth-drawer.offsetWidth-8))}px`;drawer.style.top=`${Math.max(8,Math.min(r.top-drawer.offsetHeight-8,innerHeight-drawer.offsetHeight-8))}px`;drawerFrame=requestAnimationFrame(positionDrawer)};
    modeButtons.forEach(button=>{button.setAttribute('aria-label',button.title);button.textContent=symbols[button.dataset.interactive];drawer.appendChild(button)});
    typeButton.addEventListener('click',()=>{if(!drawer.hidden){closeDrawer();return}drawer.hidden=false;typeButton.setAttribute('aria-expanded','true');m.classList.add('has-shape-shelf-open');positionDrawer()});
    const outside=event=>{if(!drawer.contains(event.target)&&!typeButton.contains(event.target))closeDrawer()};
    const escape=event=>{if(event.key==='Escape'&&!drawer.hidden){event.stopPropagation();closeDrawer();typeButton.focus({preventScroll:true})}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape,true);drawer.addEventListener('pointerdown',event=>event.stopPropagation());

    const setMode=next=>{
      mode=['hourglass','candle','rocket','sunflower'].includes(next)?next:'hourglass';m.dataset.interactiveMode=mode;typeButton.textContent=symbols[mode];typeButton.title='Choose timer type: '+mode;typeButton.setAttribute('aria-label','Choose timer type: '+mode);
      hourStage.hidden=mode!=='hourglass';candleStage.hidden=mode!=='candle';
      rocketStage.hidden=mode!=='rocket';plantStage.hidden=mode!=='sunflower';stories.setMode(mode);
      hourglass.setActive(mode==='hourglass');
      modeButtons.forEach(b=>{b.classList.toggle('is-active',b.dataset.interactive===mode);b.setAttribute('aria-pressed',String(b.dataset.interactive===mode));});
    };
    modeButtons.forEach(b=>b.addEventListener('click',()=>{setMode(b.dataset.interactive);closeDrawer();notifyBoardChanged('timer-type')}));
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
    const priorDeactivate=m._deactivate;m._deactivate=()=>{closeDrawer();priorDeactivate?.()};
    m._cleanup=()=>{closeDrawer();drawer.remove();document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape,true);hourglass.destroy();stories.destroy();cleanup();};
    window.TeacherTilesTimerPointer.attach(m);
  }
  window.TeacherTilesInteractiveTimers=Object.freeze({setup});
})();
