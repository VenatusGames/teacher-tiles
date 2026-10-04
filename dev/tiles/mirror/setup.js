function setupMirror(m){
  const tileTitle=bindEditableModuleTitle(m,'.mirror-title','Mirror');
  const video=m.querySelector('.mirror-video');
  const toggle=m.querySelector('.mirror-toggle');
  const placeholder=m.querySelector('.mirror-placeholder');
  const state=m.querySelector('.mirror-camera-state b');
  const message=m.querySelector('.mirror-message');
  let stream=null;
  let disposed=false;
  let cameraAttempt=0;
  let cameraAbort=null;
  const stop=()=>{
    cameraAttempt++;cameraAbort?.abort();cameraAbort=null;releaseCameraStream(stream);stream=null;video.pause();video.srcObject=null;
    m.classList.remove('has-camera');toggle.textContent='Start mirror';toggle.disabled=false;state.textContent='OFF';message.textContent='Camera is off.';
  };
  const start=async()=>{
    if(stream?.getVideoTracks().some(track=>track.readyState==='live')){stop();return}
    if(stream)stop();
    const attempt=++cameraAttempt;
    const controller=new AbortController();
    cameraAbort=controller;
    toggle.disabled=true;message.textContent='Starting your mirror…';
    let next=null;
    try{
      next=await requestFrontCamera(m);
      if(disposed||!m.isConnected||attempt!==cameraAttempt||controller.signal.aborted){releaseCameraStream(next);return}
      stream=next;await attachCameraPreview(video,stream,controller.signal);
      if(disposed||!m.isConnected||attempt!==cameraAttempt||controller.signal.aborted){releaseCameraStream(next);return}
      m.classList.add('has-camera');toggle.textContent='Stop mirror';state.textContent='ON';message.textContent='Mirror is on. Video stays on this device.';
      stream.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{if(stream===next)stop()},{once:true}));
    }catch(error){
      if(stream===next){releaseCameraStream(next);stream=null;video.pause();video.srcObject=null}
      if(attempt===cameraAttempt&&!disposed){m.classList.remove('has-camera');toggle.textContent='Start mirror';state.textContent='OFF';message.textContent=cameraStartMessage(error)}
    }
    finally{if(attempt===cameraAttempt){cameraAbort=null;toggle.disabled=false}}
  };
  toggle.addEventListener('click',start);
  placeholder?.addEventListener('click',start);
  m.querySelector('.mirror-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.mirror-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.mirror-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));
  m._boardGetState=()=>({title:tileTitle.get()});
  m._boardSetState=saved=>tileTitle.set(saved?.title);
  m._deactivate=stop;
  const prior=m._cleanup;
  m._cleanup=()=>{disposed=true;stop();prior?.()};
}
