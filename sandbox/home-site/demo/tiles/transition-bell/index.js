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

    const syncAudioVolume=()=>{
      const level=window.TeacherTilesTileAudio?.level?.(moduleElement);
      window.TeacherTilesTileAudio.mediaVolume(audio,0.9*(Number.isFinite(Number(level))?Math.max(0,Number(level)):1));
    };
    moduleElement.addEventListener('teachertiles:tileaudiochange',syncAudioVolume);
    window.addEventListener('teachertiles:audiopreferenceschange',syncAudioVolume);
    syncAudioVolume();

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
      syncAudioVolume();
      if(audio.volume>0)audio.play().catch(()=>{});
    };

    button.addEventListener('click',ring);

    const stopAudio=()=>{
      clearRing();
      audio.pause();
      try{audio.currentTime=0}catch{}
    };
    const priorDeactivate=moduleElement._deactivate;
    moduleElement._deactivate=()=>{stopAudio();priorDeactivate?.()};

    const priorCleanup=moduleElement._cleanup;
    moduleElement._cleanup=()=>{
      disposed=true;window.TeacherTilesTileAudio.release(audio);
      stopAudio();
      button.removeEventListener('click',ring);
      moduleElement.removeEventListener('teachertiles:tileaudiochange',syncAudioVolume);
      window.removeEventListener('teachertiles:audiopreferenceschange',syncAudioVolume);
      priorCleanup?.();
    };
  }

  window.TeacherTilesTransitionBell=Object.freeze({setup});
})();
