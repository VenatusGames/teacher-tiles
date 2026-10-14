function setupBoardPhotoDrop(){
  if(boardPhotoDropReady)return;
  boardPhotoDropReady=true;
  const hasPhoto=event=>Array.from(event.dataTransfer?.types||[]).includes('application/x-teachertiles-photo');
  workspace.addEventListener('dragover',event=>{
    if(!hasPhoto(event))return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect='copy';
  });
  workspace.addEventListener('drop',event=>{
    if(!hasPhoto(event))return;
    event.preventDefault();
    event.stopPropagation();
    const src=event.dataTransfer?.getData('application/x-teachertiles-photo')||'';
    if(!src.startsWith('data:image/'))return;
    const point=screenToBoard(event.clientX,event.clientY);
    const imageTile=createModule('image',point.x,point.y);
    imageTile?._setImageUrl?.(src);
    notifyBoardChanged('photobooth-drop');
  });
}

function releaseCameraStream(stream){
  if(!stream)return;
  stream.getTracks().forEach(track=>track.stop());
  activeCameraStreams.delete(stream);
}

function releaseAllCameraStreams(){
  for(const stream of [...activeCameraStreams.keys()])releaseCameraStream(stream);
}

function deactivateOtherCameraTiles(owner){
  document.querySelectorAll('.photobooth-module,.mirror-module').forEach(tile=>{
    if(tile!==owner)tile._deactivate?.();
  });
  for(const [stream,streamOwner] of [...activeCameraStreams]){
    if(streamOwner!==owner)releaseCameraStream(stream);
  }
}

async function requestFrontCamera(owner){
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('unsupported');
  deactivateOtherCameraTiles(owner);
  const stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
  activeCameraStreams.set(stream,owner);
  const track=stream.getVideoTracks()[0];
  track?.applyConstraints({width:{ideal:1280},height:{ideal:720},facingMode:{ideal:'user'}}).catch(()=>{});
  track?.addEventListener('ended',()=>activeCameraStreams.delete(stream),{once:true});
  return stream;
}

function cameraPreviewError(){
  const error=new Error('camera-preview');
  error.name='CameraPreviewError';
  return error;
}

function cameraAbortError(){
  try{return new DOMException('Camera startup was cancelled.','AbortError')}
  catch{const error=new Error('Camera startup was cancelled.');error.name='AbortError';return error}
}

async function attachCameraPreview(video,stream,signal){
  video.pause();
  video.srcObject=null;
  video.autoplay=true;
  video.muted=true;
  video.playsInline=true;
  video.setAttribute('autoplay','');
  video.setAttribute('muted','');
  video.setAttribute('playsinline','');
  video.srcObject=stream;

  const track=stream.getVideoTracks()[0];
  if(!track||track.readyState!=='live')throw cameraPreviewError();

  const frameReady=new Promise((resolve,reject)=>{
    let settled=false;
    let frameCallback=null;
    const timeout=window.setTimeout(()=>finish(reject,cameraPreviewError()),8000);
    const events=['loadeddata','canplay','playing','resize'];
    const finish=(callback,value)=>{
      if(settled)return;
      settled=true;
      window.clearTimeout(timeout);
      events.forEach(name=>video.removeEventListener(name,onReady));
      track.removeEventListener('ended',onEnded);
      signal?.removeEventListener('abort',onAbort);
      if(frameCallback!==null&&typeof video.cancelVideoFrameCallback==='function')video.cancelVideoFrameCallback(frameCallback);
      callback(value);
    };
    const onFrame=()=>{frameCallback=null;finish(resolve)};
    const onReady=()=>{
      if(video.readyState<2||video.videoWidth<1||video.videoHeight<1)return;
      if(typeof video.requestVideoFrameCallback==='function'){
        if(frameCallback===null)frameCallback=video.requestVideoFrameCallback(onFrame);
      }else finish(resolve);
    };
    const onEnded=()=>finish(reject,cameraPreviewError());
    const onAbort=()=>finish(reject,cameraAbortError());
    events.forEach(name=>video.addEventListener(name,onReady));
    track.addEventListener('ended',onEnded,{once:true});
    signal?.addEventListener('abort',onAbort,{once:true});
    if(signal?.aborted){onAbort();return}
    onReady();
  });

  let playback;
  try{playback=video.play()}
  catch{throw cameraPreviewError()}
  try{await Promise.all([Promise.resolve(playback),frameReady])}
  catch(error){
    if(error?.name==='AbortError')throw error;
    throw cameraPreviewError();
  }
}

function cameraStartMessage(error){
  if(error?.name==='NotAllowedError'||error?.name==='SecurityError')return'Camera permission was not granted. Allow camera access, then try again.';
  if(error?.name==='NotFoundError'||error?.name==='DevicesNotFoundError')return'No camera was found on this device.';
  if(error?.name==='NotReadableError'||error?.name==='TrackStartError')return'The browser found your camera but could not open it. Reload this page to release a stuck camera session, then try again.';
  if(error?.name==='OverconstrainedError'||error?.name==='ConstraintNotSatisfiedError')return'This camera could not use the requested video settings. Reload the page, then try again.';
  if(error?.name==='CameraPreviewError')return'Chrome opened the camera, but no video reached this tile. Reload this tab and try again.';
  if(error?.name==='AbortError')return'The camera stopped while starting. Wait a moment, then try again.';
  if(error?.message==='unsupported')return'Camera access is not supported in this browser.';
  return'The camera could not be started. Reload this page, then try again.';
}
