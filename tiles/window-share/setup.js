function setupWindowShare(m){
  const video=m.querySelector('.windowshare-video');
  const empty=m.querySelector('.windowshare-empty');
  const startButton=m.querySelector('.windowshare-start');
  const changeButton=m.querySelector('.windowshare-change');
  const stopButton=m.querySelector('.windowshare-stop');
  const audioButton=m.querySelector('.windowshare-audio');
  const bgButton=m.querySelector('.windowshare-bg');
  const liveBadge=m.querySelector('.windowshare-live-badge');
  const message=m.querySelector('.windowshare-message');

  let stream=null;
  let messageTimer=0;

  function showMessage(text,hold=2600){
    clearTimeout(messageTimer);
    message.textContent=text;
    message.classList.add('is-visible');
    if(hold){
      messageTimer=setTimeout(()=>message.classList.remove('is-visible'),hold);
    }
  }

  function setAudioButton(){
    if(!stream){
      audioButton.textContent='🔊';
      audioButton.disabled=true;
      audioButton.title='No shared audio';
      return;
    }
    const tracks=stream.getAudioTracks();
    audioButton.disabled=!tracks.length;
    if(!tracks.length){
      audioButton.textContent='🔇';
      audioButton.title='This source is not sharing audio';
      return;
    }
    const enabled=tracks.some(t=>t.enabled);
    audioButton.textContent=enabled?'🔊':'🔇';
    audioButton.title=enabled?'Mute shared audio':'Unmute shared audio';
    audioButton.setAttribute('aria-label',audioButton.title);
  }

  function clearStreamTracks(){
    if(!stream)return;
    stream.getTracks().forEach(track=>{
      track.onended=null;
      try{track.stop()}catch{}
    });
    stream=null;
  }

  function resetShare({ended=false}={}){
    clearStreamTracks();
    video.pause();
    video.srcObject=null;
    m.classList.remove('is-sharing');
    liveBadge.hidden=true;
    setAudioButton();
    if(ended)showMessage('Sharing ended.',1800);
  }

  async function beginShare(){
    if(!navigator.mediaDevices?.getDisplayMedia){
      showMessage('Window sharing is not supported here. Open TeacherTiles through HTTPS or localhost.',4200);
      return;
    }

    if(!window.isSecureContext){
      showMessage('Window Share requires HTTPS or localhost.',4200);
      return;
    }

    try{
      const nextStream=await navigator.mediaDevices.getDisplayMedia({
        video:{
          frameRate:{ideal:30,max:60},
          cursor:'always'
        },
        audio:true,
        preferCurrentTab:false,
        selfBrowserSurface:'exclude',
        surfaceSwitching:'include',
        systemAudio:'include'
      });

      clearStreamTracks();
      stream=nextStream;

      const videoTrack=stream.getVideoTracks()[0];
      if(!videoTrack){
        resetShare();
        showMessage('No video source was selected.',2600);
        return;
      }

      videoTrack.onended=()=>resetShare({ended:true});
      stream.getAudioTracks().forEach(track=>{
        track.onended=()=>setAudioButton();
      });

      video.srcObject=stream;
      video.muted=false;
      try{await video.play()}catch{}

      m.classList.add('is-sharing');
      liveBadge.hidden=false;
      setAudioButton();

      const settings=videoTrack.getSettings?.()||{};
      const surface=settings.displaySurface;
      if(surface){
        const label=surface==='browser'?'Chrome tab':surface==='window'?'window':surface==='monitor'?'screen':surface;
        showMessage(`Sharing ${label}.`,1400);
      }
    }catch(err){
      if(err?.name==='NotAllowedError'||err?.name==='AbortError'){
        showMessage('Share cancelled.',1600);
      }else{
        console.error('Window Share error:',err);
        showMessage('Could not start sharing. Try selecting the source again.',3200);
      }
    }
  }

  startButton.addEventListener('click',beginShare);
  changeButton.addEventListener('click',beginShare);
  stopButton.addEventListener('click',()=>resetShare());

  audioButton.addEventListener('click',()=>{
    if(!stream)return;
    const tracks=stream.getAudioTracks();
    if(!tracks.length)return;
    const shouldEnable=!tracks.some(t=>t.enabled);
    tracks.forEach(t=>t.enabled=shouldEnable);
    setAudioButton();
  });

  bgButton.addEventListener('click',()=>{
    cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']);
  });

  setAudioButton();

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    clearTimeout(messageTimer);
    clearStreamTracks();
    video.pause();
    video.srcObject=null;
  };
}
