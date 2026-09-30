function setupVoiceMemo(m){
  const tileTitle=bindEditableModuleTitle(m,'.voicememo-title','Voice Memos');
  const recordButton=m.querySelector('.voicememo-record');
  const recordLabel=recordButton.querySelector('span');
  const timeEl=m.querySelector('.voicememo-time');
  const message=m.querySelector('.voicememo-message');
  const list=m.querySelector('.voicememo-list');
  const count=m.querySelector('.voicememo-count');
  let memos=[];
  let recorder=null;
  let stream=null;
  let chunks=[];
  let startedAt=0;
  let timerId=0;
  let disposed=false;

  const formatDuration=seconds=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
  const setRecordingUI=recording=>{
    m.classList.toggle('is-recording',recording);
    recordButton.setAttribute('aria-pressed',String(recording));
    recordLabel.textContent=recording?'Stop recording':'Record memo';
  };
  const stopTracks=()=>{stream?.getTracks().forEach(track=>track.stop());stream=null};
  const render=()=>{
    count.textContent=`${memos.length} / 5`;
    list.replaceChildren();
    if(!memos.length){
      const empty=document.createElement('p');
      empty.className='voicememo-empty';
      empty.textContent='Your recordings will appear here.';
      list.appendChild(empty);
      return;
    }
    memos.forEach((memo,index)=>{
      const row=document.createElement('article');
      row.className='voicememo-item';
      const meta=document.createElement('div');
      const title=document.createElement('input');
      const duration=document.createElement('small');
      title.type='text';
      title.className='voicememo-name';
      title.maxLength=40;
      title.value=String(memo.name||`Memo ${index+1}`).slice(0,40);
      title.setAttribute('aria-label',`Rename Memo ${index+1}`);
      title.addEventListener('input',()=>{memo.name=title.value.slice(0,40);notifyBoardChanged('voice-memo-rename')});
      title.addEventListener('blur',()=>{if(!title.value.trim()){memo.name=`Memo ${index+1}`;title.value=memo.name}});
      duration.textContent=formatDuration(memo.duration||0);
      meta.append(title,duration);
      const audio=document.createElement('audio');
      audio.controls=true;
      audio.preload='metadata';
      audio.src=memo.dataUrl;
      audio.setAttribute('controlsList','nodownload');
      audio.setAttribute('aria-label',`Play Memo ${index+1}`);
      audio.addEventListener('play',()=>list.querySelectorAll('audio').forEach(other=>{if(other!==audio)other.pause()}));
      const remove=document.createElement('button');
      remove.type='button';
      remove.className='voicememo-remove';
      remove.setAttribute('aria-label',`Delete Memo ${index+1}`);
      remove.textContent='×';
      remove.addEventListener('click',()=>{memos.splice(index,1);render();message.textContent='Memo deleted.';notifyBoardChanged('voice-memo-delete')});
      row.append(meta,audio,remove);
      list.appendChild(row);
    });
  };
  const finishRecording=()=>{
    clearInterval(timerId);
    timerId=0;
    if(recorder?.state==='recording')recorder.stop();
  };
  const beginRecording=async()=>{
    if(memos.length>=5){message.textContent='Delete a memo before recording another.';return}
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){message.textContent='Audio recording is not supported in this browser.';return}
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true}});
      const preferred=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(type=>MediaRecorder.isTypeSupported?.(type));
      recorder=new MediaRecorder(stream,preferred?{mimeType:preferred,audioBitsPerSecond:32000}:{audioBitsPerSecond:32000});
      chunks=[];
      startedAt=performance.now();
      recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data)};
      recorder.onerror=()=>{message.textContent='Recording stopped because of an audio error.';stopTracks();setRecordingUI(false)};
      recorder.onstop=()=>{
        const duration=Math.min(30,(performance.now()-startedAt)/1000);
        const blob=new Blob(chunks,{type:recorder?.mimeType||chunks[0]?.type||'audio/webm'});
        chunks=[];
        stopTracks();
        if(disposed)return;
        setRecordingUI(false);
        timeEl.textContent='0:00';
        if(!blob.size){message.textContent='No audio was captured.';return}
        const reader=new FileReader();
        reader.onload=()=>{
          memos.push({name:`Memo ${memos.length+1}`,dataUrl:String(reader.result||''),duration});
          render();
          message.textContent='Memo saved and ready to play.';
          notifyBoardChanged('voice-memo-add');
        };
        reader.onerror=()=>{message.textContent='The recording could not be prepared.'};
        reader.readAsDataURL(blob);
      };
      recorder.start(500);
      setRecordingUI(true);
      message.textContent='Recording… tap Stop when finished.';
      timerId=setInterval(()=>{
        const elapsed=Math.min(30,(performance.now()-startedAt)/1000);
        timeEl.textContent=formatDuration(elapsed);
        if(elapsed>=30)finishRecording();
      },200);
    }catch(error){
      stopTracks();
      setRecordingUI(false);
      message.textContent=error?.name==='NotAllowedError'?'Microphone permission was not granted.':'The microphone could not be started.';
    }
  };

  recordButton.addEventListener('click',()=>recorder?.state==='recording'?finishRecording():beginRecording());
  list.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
  m.querySelector('.voicememo-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.voicememo-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.voicememo-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));
  render();
  m._boardGetState=()=>({title:tileTitle.get(),memos:memos.map(memo=>({...memo}))});
  m._boardSetState=state=>{tileTitle.set(state?.title);memos=Array.isArray(state?.memos)?state.memos.filter(memo=>typeof memo?.dataUrl==='string'&&memo.dataUrl.startsWith('data:audio/')).slice(0,5):[];render()};
  const prior=m._cleanup;
  m._cleanup=()=>{prior?.();disposed=true;clearInterval(timerId);try{if(recorder?.state==='recording')recorder.stop()}catch{}stopTracks()};
}
