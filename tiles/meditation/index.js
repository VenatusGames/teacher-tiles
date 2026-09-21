(() => {
  'use strict';
  function setup(m) {
    const scene=m.querySelector('.meditation-scene');
    const cue=m.querySelector('.meditation-cue');
    const count=m.querySelector('.meditation-count');
    const detail=m.querySelector('.meditation-detail');
    const toggle=m.querySelector('.meditation-toggle');
    const reset=m.querySelector('.meditation-reset');
    let running=false,disposed=false,elapsed=0,lastTime=0,raf=0,lastPhase='';
    function render() {
      const position=elapsed%10000;
      const inhale=position<4000;
      const progress=inhale?position/4000:(position-4000)/6000;
      const ease=(1-Math.cos(Math.PI*progress))/2;
      const expansion=inhale?ease:1-ease;
      scene.style.setProperty('--breath-scale',String(.64+expansion*.36));
      scene.style.setProperty('--breath-glow',String(.24+expansion*.42));
      scene.style.setProperty('--breath-turn',`${elapsed/350}deg`);
      const phase=running?(inhale?'Breathe in':'Breathe out'):(elapsed?'Paused':'Find your calm');
      if(phase!==lastPhase){cue.textContent=phase;lastPhase=phase;}
      count.textContent=running?String(Math.max(1,Math.ceil((inhale?4000-position:10000-position)/1000))):'✦';
      const cycles=Math.floor(elapsed/10000);
      detail.textContent=cycles?`${cycles} ${cycles===1?'breath':'breaths'} completed`:'Let your breath follow the light';
      toggle.textContent=running?'Pause':elapsed?'Resume':'Start breathing';
      toggle.setAttribute('aria-pressed',String(running));
      m.dataset.breathing=String(running);
    }
    function tick(now) {
      if(!running||disposed||!m.isConnected){pause();return;}
      elapsed+=Math.max(0,now-lastTime);
      lastTime=now;
      render();
      raf=requestAnimationFrame(tick);
    }
    function pause() {running=false;cancelAnimationFrame(raf);raf=0;render();}
    toggle.addEventListener('click',()=>{
      if(disposed)return;
      if(running){pause();return;}
      running=true;lastTime=performance.now();render();raf=requestAnimationFrame(tick);
    });
    reset.addEventListener('click',()=>{elapsed=0;pause();});
    const onVisibility=()=>{if(document.hidden)pause();};
    document.addEventListener('visibilitychange',onVisibility);
    // Sessions intentionally reopen at rest, never silently running offscreen.
    m._boardGetState=()=>({version:1});
    m._boardSetState=()=>{elapsed=0;pause();};
    const priorDeactivate=m._deactivate;
    m._deactivate=()=>{pause();priorDeactivate?.();};
    const priorCleanup=m._cleanup;
    m._cleanup=()=>{disposed=true;pause();document.removeEventListener('visibilitychange',onVisibility);priorCleanup?.();};
    render();
  }
  window.TeacherTilesMeditation=Object.freeze({setup});
})();
