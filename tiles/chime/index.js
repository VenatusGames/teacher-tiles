(() => {
  'use strict';

  const AUDIO_SRC='tiles/chime/assets/chime.mp3';

  function setup(moduleElement){
    const stage=moduleElement.querySelector('.chime-stage');
    const strikeButton=moduleElement.querySelector('.chime-strike');
    const audio=new Audio(AUDIO_SRC);
    audio.preload='auto';
    audio.volume=.72;

    let strikeTimer=0;
    let disposed=false;

    function clearStrike(){
      clearTimeout(strikeTimer);
      strikeTimer=0;
      stage.classList.remove('is-striking');
    }

    function strike(){
      if(disposed)return;

      clearStrike();
      // Force a clean animation restart even on quick repeated strikes.
      void stage.offsetWidth;
      stage.classList.add('is-striking');
      strikeTimer=window.setTimeout(()=>{
        strikeTimer=0;
        stage.classList.remove('is-striking');
      },820);

      try{
        audio.pause();
        audio.currentTime=0;
      }catch{}
      audio.play().catch(()=>{});
    }

    strikeButton.addEventListener('click',strike);

    const stopAudio=()=>{
      clearStrike();
      audio.pause();
      try{audio.currentTime=0}catch{}
    };
    const priorDeactivate=moduleElement._deactivate;
    moduleElement._deactivate=()=>{stopAudio();priorDeactivate?.()};

    const priorCleanup=moduleElement._cleanup;
    moduleElement._cleanup=()=>{
      disposed=true;
      stopAudio();
      strikeButton.removeEventListener('click',strike);
      priorCleanup?.();
    };
  }

  window.TeacherTilesChime=Object.freeze({setup});
})();
