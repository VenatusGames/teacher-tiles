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

    const syncAudioVolume=()=>{
      const level=window.TeacherTilesTileAudio?.level?.(moduleElement);
      window.TeacherTilesTileAudio.mediaVolume(audio,0.72*(Number.isFinite(Number(level))?Math.max(0,Number(level)):1));
    };
    moduleElement.addEventListener('teachertiles:tileaudiochange',syncAudioVolume);
    window.addEventListener('teachertiles:audiopreferenceschange',syncAudioVolume);
    syncAudioVolume();

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
      syncAudioVolume();
      if(audio.volume>0)audio.play().catch(()=>{});
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
      disposed=true;window.TeacherTilesTileAudio.release(audio);
      stopAudio();
      strikeButton.removeEventListener('click',strike);
      moduleElement.removeEventListener('teachertiles:tileaudiochange',syncAudioVolume);
      window.removeEventListener('teachertiles:audiopreferenceschange',syncAudioVolume);
      priorCleanup?.();
    };
  }

  window.TeacherTilesChime=Object.freeze({setup});
})();
