(() => {
  'use strict';

  const AUDIO_SRC='tiles/transition-bell/assets/bell.mp3';

  function setup(moduleElement){
    const stage=moduleElement.querySelector('.transition-bell-stage');
    const button=moduleElement.querySelector('.transition-bell-button');
    const audio=new Audio(AUDIO_SRC);
    audio.preload='auto';
    audio.volume=.9;

    let ringTimer=0;
    let disposed=false;

    const clearRing=()=>{
      clearTimeout(ringTimer);
      ringTimer=0;
      stage.classList.remove('is-ringing');
    };

    const ring=()=>{
      if(disposed)return;
      clearRing();
      void stage.offsetWidth;
      stage.classList.add('is-ringing');
      ringTimer=window.setTimeout(clearRing,1040);
      try{
        audio.pause();
        audio.currentTime=0;
      }catch{}
      audio.play().catch(()=>{});
    };

    button.addEventListener('click',ring);

    const priorCleanup=moduleElement._cleanup;
    moduleElement._cleanup=()=>{
      disposed=true;
      clearRing();
      button.removeEventListener('click',ring);
      audio.pause();
      try{audio.currentTime=0}catch{}
      priorCleanup?.();
    };
  }

  window.TeacherTilesTransitionBell=Object.freeze({setup});
})();
