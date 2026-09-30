function setupLiveCaption(m){
  const tileTitle=bindEditableModuleTitle(m,'.livecaption-title','Live Captions');
  const toggle=m.querySelector('.livecaption-toggle');
  const toggleLabel=toggle.querySelector('span');
  const stateLabel=m.querySelector('.livecaption-state b');
  const message=m.querySelector('.livecaption-message');
  const current=m.querySelector('.livecaption-current-text');
  const historyEl=m.querySelector('.livecaption-history');
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  let recognition=null;
  let wantsListening=false;
  let isListening=false;
  let restartTimer=0;
  let history=[];
  let pendingInterim='';
  let currentFitFrame=0;

  const segmentCaptionText=value=>{
    const normalized=String(value||'').replace(/\s+/g,' ').trim();
    if(!normalized)return[];
    const sentences=normalized.match(/[^.!?]+(?:[.!?]+|$)/g)||[normalized];
    const segments=[];
    for(const sentence of sentences){
      const words=sentence.trim().split(/\s+/).filter(Boolean);
      let chunk=[];
      for(const word of words){
        const candidate=[...chunk,word].join(' ');
        if(chunk.length&&(chunk.length>=14||candidate.length>88)){
          segments.push(chunk.join(' '));
          chunk=[word];
        }else chunk.push(word);
      }
      if(chunk.length)segments.push(chunk.join(' '));
    }
    return segments.filter(Boolean);
  };
  const fitCurrentText=()=>{
    cancelAnimationFrame(currentFitFrame);
    currentFitFrame=requestAnimationFrame(()=>{
      let low=16,high=56,best=16;
      while(high-low>.5){
        const size=(low+high)/2;
        current.style.fontSize=`${size}px`;
        if(current.scrollHeight<=current.clientHeight+1&&current.scrollWidth<=current.clientWidth+1){best=size;low=size}else high=size;
      }
      current.style.fontSize=`${best}px`;
    });
  };
  const displayCurrent=value=>{
    const phrase=segmentCaptionText(value).at(-1)||'Listening…';
    current.textContent=phrase;
    fitCurrentText();
  };

  const renderHistory=()=>{
    historyEl.replaceChildren();
    if(!history.length){
      const empty=document.createElement('p');
      empty.className='livecaption-empty';
      empty.textContent='Your caption history will appear here.';
      historyEl.appendChild(empty);
      return;
    }
    history.forEach((caption,index)=>{
      const row=document.createElement('p');
      const number=document.createElement('span');
      const text=document.createElement('strong');
      number.textContent=String(index+1).padStart(2,'0');
      text.textContent=caption;
      row.append(number,text);
      historyEl.appendChild(row);
    });
    requestAnimationFrame(()=>{historyEl.scrollTop=historyEl.scrollHeight});
  };
  const setListeningUI=listening=>{
    isListening=listening;
    m.classList.toggle('is-listening',listening);
    m.classList.toggle('is-paused',!listening);
    toggle.setAttribute('aria-pressed',String(listening));
    toggleLabel.textContent=listening?'Pause captions':'Start captions';
    stateLabel.textContent=listening?'ON':'OFF';
    if(!listening)renderHistory();
  };
  const addCaption=value=>{
    const segments=segmentCaptionText(value);
    if(!segments.length)return;
    for(const text of segments)if(history[history.length-1]!==text)history.push(text);
    if(history.length>100)history=history.slice(-100);
    displayCurrent(segments.at(-1));
    notifyBoardChanged('live-caption');
  };
  const commitPending=()=>{
    if(!pendingInterim)return;
    addCaption(pendingInterim);
    pendingInterim='';
  };
  const startRecognition=()=>{
    if(!SpeechRecognition||!wantsListening)return;
    clearTimeout(restartTimer);
    recognition=new SpeechRecognition();
    recognition.continuous=true;
    recognition.interimResults=true;
    recognition.maxAlternatives=1;
    recognition.lang=document.documentElement.lang==='es'?'es-US':'en-US';
    recognition.onstart=()=>{
      if(!wantsListening){recognition.stop();return}
      setListeningUI(true);
      message.textContent='Listening clearly…';
      if(!history.length)displayCurrent('Listening… start speaking when you’re ready.');
    };
    recognition.onresult=event=>{
      if(!wantsListening&&!isListening)return;
      let interim='';
      for(let index=event.resultIndex;index<event.results.length;index++){
        const transcript=event.results[index][0]?.transcript||'';
        if(event.results[index].isFinal){addCaption(transcript);pendingInterim=''}
        else interim+=transcript;
      }
      const cleanInterim=interim.replace(/\s+/g,' ').trim();
      if(cleanInterim){pendingInterim=cleanInterim;displayCurrent(cleanInterim)}
    };
    recognition.onerror=event=>{
      if(event.error==='no-speech'){message.textContent='Still listening — no speech detected yet.';return}
      commitPending();
      wantsListening=false;
      const denied=event.error==='not-allowed'||event.error==='service-not-allowed';
      message.textContent=denied?'Microphone permission was not granted.':'Live captions could not continue. Try again.';
      setListeningUI(false);
    };
    recognition.onend=()=>{
      recognition=null;
      if(wantsListening){restartTimer=setTimeout(startRecognition,220);return}
      if(isListening){commitPending();setListeningUI(false)}
    };
    try{recognition.start()}catch{
      wantsListening=false;
      message.textContent='Live captions could not start. Try again.';
      setListeningUI(false);
    }
  };
  const start=()=>{
    if(!SpeechRecognition)return;
    wantsListening=true;
    setListeningUI(true);
    pendingInterim='';
    displayCurrent('Starting microphone…');
    message.textContent='Starting live captions…';
    startRecognition();
  };
  const pause=()=>{
    wantsListening=false;
    clearTimeout(restartTimer);
    commitPending();
    try{recognition?.stop()}catch{}
    setListeningUI(false);
    message.textContent=history.length?'Paused — scroll to review the caption history.':'Captions are paused.';
  };

  if(!SpeechRecognition){
    toggle.disabled=true;
    message.textContent='Live captions are not supported in this browser.';
    displayCurrent('This browser does not provide speech recognition.');
  }else toggle.addEventListener('click',()=>wantsListening||isListening?pause():start());

  historyEl.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
  const captionResizeObserver=new ResizeObserver(fitCurrentText);
  captionResizeObserver.observe(m.querySelector('.livecaption-current'));
  m.querySelector('.livecaption-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.livecaption-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.livecaption-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));
  renderHistory();
  setListeningUI(false);
  m._boardGetState=()=>({title:tileTitle.get(),history:[...history]});
  m._boardSetState=state=>{
    tileTitle.set(state?.title);
    history=Array.isArray(state?.history)?state.history.map(value=>String(value||'').trim()).filter(Boolean).slice(-100):[];
    if(history.length)displayCurrent(history[history.length-1]);
    renderHistory();
    setListeningUI(false);
  };
  const prior=m._cleanup;
  m._cleanup=()=>{prior?.();wantsListening=false;clearTimeout(restartTimer);cancelAnimationFrame(currentFitFrame);captionResizeObserver.disconnect();try{recognition?.abort()}catch{}};
}
