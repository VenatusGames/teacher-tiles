function setupPhotobooth(m){
  setupBoardPhotoDrop();
  const tileTitle=bindEditableModuleTitle(m,'.photobooth-title','Photobooth');
  const video=m.querySelector('.photobooth-video');
  const toggle=m.querySelector('.photobooth-camera-toggle');
  const shutter=m.querySelector('.photobooth-shutter');
  const state=m.querySelector('.photobooth-camera-state b');
  const message=m.querySelector('.photobooth-message');
  const list=m.querySelector('.photobooth-photo-list');
  const count=m.querySelector('.photobooth-photo-count');
  const drawerToggle=m.querySelector('.photobooth-drawer-toggle');
  const placeholder=m.querySelector('.photobooth-placeholder');
  const flash=m.querySelector('.photobooth-flash');
  let stream=null;
  let filter='normal';
  let photos=[];
  let disposed=false;
  let cameraAttempt=0;
  let cameraAbort=null;

  const stopCamera=()=>{
    cameraAttempt++;
    cameraAbort?.abort();
    cameraAbort=null;
    releaseCameraStream(stream);
    stream=null;
    video.pause();
    video.srcObject=null;
    m.classList.remove('has-camera');
    toggle.textContent='Start camera';
    toggle.disabled=false;
    shutter.disabled=true;
    state.textContent='OFF';
  };
  const startCamera=async()=>{
    if(stream?.getVideoTracks().some(track=>track.readyState==='live')){stopCamera();message.textContent='Camera is off.';return}
    if(stream)stopCamera();
    const attempt=++cameraAttempt;
    const controller=new AbortController();
    cameraAbort=controller;
    toggle.disabled=true;
    message.textContent='Starting the camera…';
    let next=null;
    try{
      next=await requestFrontCamera(m);
      if(disposed||!m.isConnected||attempt!==cameraAttempt||controller.signal.aborted){releaseCameraStream(next);return}
      stream=next;
      await attachCameraPreview(video,stream,controller.signal);
      if(disposed||!m.isConnected||attempt!==cameraAttempt||controller.signal.aborted){releaseCameraStream(next);return}
      m.classList.add('has-camera');
      toggle.textContent='Stop camera';
      shutter.disabled=false;
      state.textContent='ON';
      message.textContent='Choose a filter, then take a photo.';
      stream.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{if(stream===next)stopCamera()},{once:true}));
    }catch(error){
      if(stream===next){releaseCameraStream(next);stream=null;video.pause();video.srcObject=null}
      if(attempt===cameraAttempt&&!disposed){
        m.classList.remove('has-camera');toggle.textContent='Start camera';shutter.disabled=true;state.textContent='OFF';message.textContent=cameraStartMessage(error);
      }
    }finally{if(attempt===cameraAttempt){cameraAbort=null;toggle.disabled=false}}
  };
  const setFilter=value=>{
    filter=PHOTOBOOTH_FILTERS[value]?value:'normal';
    m.dataset.photoFilter=filter;
    video.style.filter=PHOTOBOOTH_FILTERS[filter];
    m.querySelectorAll('[data-photo-filter-choice]').forEach(button=>button.classList.toggle('is-active',button.dataset.photoFilterChoice===filter));
  };
  const renderPhotos=()=>{
    count.textContent=String(photos.length);
    list.replaceChildren();
    if(!photos.length){
      const empty=document.createElement('p');
      empty.className='photobooth-photo-empty';
      empty.textContent='Your photos will appear here.';
      list.appendChild(empty);
      return;
    }
    photos.forEach((photo,index)=>{
      const card=document.createElement('div');
      card.className='photobooth-photo-card';
      card.draggable=true;
      card.tabIndex=0;
      card.setAttribute('role','img');
      card.setAttribute('aria-label',`Photo ${index+1}. Drag onto the board.`);
      const img=document.createElement('img');
      img.src=photo;
      img.alt='';
      img.draggable=false;
      const actions=document.createElement('div');
      actions.className='photobooth-photo-actions';
      const download=document.createElement('button');
      download.type='button';download.className='photobooth-photo-download';download.textContent='↓';download.title='Download photo';download.setAttribute('aria-label',`Download photo ${index+1}`);
      download.addEventListener('pointerdown',event=>event.stopPropagation());
      download.addEventListener('click',event=>{
        event.stopPropagation();
        const link=document.createElement('a');
        link.href=photo;link.download=`teachertiles-photo-${index+1}.jpg`;link.click();
      });
      const remove=document.createElement('button');
      remove.type='button';remove.className='photobooth-photo-delete';
      remove.textContent='×';
      remove.setAttribute('aria-label',`Delete photo ${index+1}`);
      remove.addEventListener('pointerdown',event=>event.stopPropagation());
      remove.addEventListener('click',event=>{event.stopPropagation();photos.splice(index,1);renderPhotos();notifyBoardChanged('photobooth-delete')});
      actions.append(download,remove);
      card.addEventListener('dragstart',event=>{
        event.stopPropagation();
        event.dataTransfer?.setData('application/x-teachertiles-photo',photo);
        if(event.dataTransfer)event.dataTransfer.effectAllowed='copy';
        card.classList.add('is-dragging');
      });
      card.addEventListener('dragend',()=>card.classList.remove('is-dragging'));
      card.append(img,actions);
      list.appendChild(card);
    });
  };
  const takePhoto=()=>{
    if(!stream||!video.videoWidth||photos.length>=8){message.textContent=photos.length>=8?'The drawer holds up to 8 photos. Delete one to take another.':'The camera is still getting ready.';return}
    const sourceW=video.videoWidth,sourceH=video.videoHeight;
    const scale=Math.min(1,960/Math.max(sourceW,sourceH));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(sourceW*scale));
    canvas.height=Math.max(1,Math.round(sourceH*scale));
    const ctx=canvas.getContext('2d');
    ctx.save();
    ctx.filter=PHOTOBOOTH_FILTERS[filter];
    ctx.translate(canvas.width,0);
    ctx.scale(-1,1);
    ctx.drawImage(video,0,0,canvas.width,canvas.height);
    ctx.restore();
    photos.unshift(canvas.toDataURL('image/jpeg',.8));
    renderPhotos();
    m.classList.add('is-drawer-open');
    drawerToggle.setAttribute('aria-expanded','true');
    flash.classList.remove('is-flashing');void flash.offsetWidth;flash.classList.add('is-flashing');
    message.textContent='Photo saved. Drag it from the drawer onto the board.';
    notifyBoardChanged('photobooth-photo');
  };

  toggle.addEventListener('click',startCamera);
  placeholder?.addEventListener('click',startCamera);
  shutter.addEventListener('click',takePhoto);
  drawerToggle.addEventListener('click',()=>{const open=m.classList.toggle('is-drawer-open');drawerToggle.setAttribute('aria-expanded',String(open))});
  m.querySelectorAll('[data-photo-filter-choice]').forEach(button=>button.addEventListener('click',()=>setFilter(button.dataset.photoFilterChoice)));
  list.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
  m.querySelector('.photobooth-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.photobooth-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.photobooth-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));
  setFilter(filter);renderPhotos();
  m._boardGetState=()=>({title:tileTitle.get(),filter,photos:[...photos]});
  m._boardSetState=saved=>{tileTitle.set(saved?.title);photos=Array.isArray(saved?.photos)?saved.photos.filter(src=>typeof src==='string'&&src.startsWith('data:image/')).slice(0,8):[];setFilter(saved?.filter);renderPhotos()};
  m._deactivate=stopCamera;
  const prior=m._cleanup;
  m._cleanup=()=>{disposed=true;stopCamera();prior?.()};
}
