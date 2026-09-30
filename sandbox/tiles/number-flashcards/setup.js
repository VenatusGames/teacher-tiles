function setupNumberFlashcards(m){
  const card=m.querySelector('.number-flashcards-card');
  const valueEl=m.querySelector('.number-flashcards-value');
  const modeLabel=m.querySelector('.number-flashcards-mode-label');
  const modeSelect=m.querySelector('.number-flashcards-mode');
  const nextButton=m.querySelector('.number-flashcards-next');
  const modes={
    '10':{max:10,label:'Numbers 1–10'},
    '25':{max:25,label:'Numbers 1–25'},
    '100':{max:100,label:'Numbers 1–100'}
  };
  let current='';
  let remaining=[];
  let completed=false;
  let animating=false;
  let resizeFrame=0;

  const measurer=document.createElement('span');
  measurer.className='abc-letter abc-measurer';
  measurer.setAttribute('aria-hidden','true');
  card.appendChild(measurer);

  const completion=createFlashcardCompletePopup(card,()=>resetDeck({animate:true}));

  const measureValueSize=value=>{
    const rect=card.getBoundingClientRect();
    const maxWidth=Math.max(80,rect.width-18);
    const maxHeight=Math.max(80,rect.height-18);
    measurer.textContent=value;
    let low=28;
    let high=Math.max(36,Math.min(720,Math.floor(maxHeight*1.35)));
    let best=low;
    while(low<=high){
      const mid=Math.floor((low+high)/2);
      measurer.style.fontSize=`${mid}px`;
      const measured=measurer.getBoundingClientRect();
      if(measured.width<=maxWidth+1&&measured.height<=maxHeight+1){best=mid;low=mid+1}
      else high=mid-1;
    }
    return best;
  };

  const poolForMode=mode=>{
    const max=modes[mode]?.max||10;
    return Array.from({length:max},(_,index)=>String(index+1));
  };

  const applyValue=(value,size)=>{
    current=value;
    completed=false;
    completion.hide();
    valueEl.classList.add('is-fitting');
    valueEl.textContent=value;
    valueEl.style.fontSize=`${size}px`;
    card.setAttribute('aria-label',`${value}. Click for another number.`);
    requestAnimationFrame(()=>valueEl.classList.remove('is-fitting'));
  };

  const fitCurrent=()=>{
    cancelAnimationFrame(resizeFrame);
    resizeFrame=requestAnimationFrame(()=>{
      if(!current)return;
      valueEl.style.fontSize=`${measureValueSize(current)}px`;
      valueEl.classList.remove('is-fitting');
    });
  };

  const showComplete=()=>{
    completed=true;
    completion.show();
    card.setAttribute('aria-label','Complete. Shuffle to begin the number set again.');
  };

  const showNext=({animate=true}={})=>{
    if(animating||completed)return;
    if(!remaining.length){
      if(current)showComplete();
      return;
    }

    const next=remaining.shift();
    const size=measureValueSize(next);
    if(!animate){
      applyValue(next,size);
      return;
    }

    animating=true;
    card.classList.remove('is-flipping');
    void card.offsetWidth;
    card.classList.add('is-flipping');
    window.setTimeout(()=>applyValue(next,size),180);
    window.setTimeout(()=>{card.classList.remove('is-flipping');animating=false},430);
  };

  function resetDeck({animate=false}={}){
    completion.hide();
    completed=false;
    current='';
    remaining=shuffleFlashcardDeck(poolForMode(m.dataset.numberFlashcardsMode||'10'));
    showNext({animate});
  }

  const setMode=mode=>{
    const next=mode in modes?mode:'10';
    m.dataset.numberFlashcardsMode=next;
    modeSelect.value=next;
    modeLabel.textContent=modes[next].label;
    resetDeck({animate:false});
  };

  card.addEventListener('click',()=>showNext());
  nextButton.addEventListener('click',()=>showNext());
  modeSelect.addEventListener('change',()=>setMode(modeSelect.value));
  m.querySelector('.number-flashcards-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.number-flashcards-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));

  const detachAutoFit=bindFlashcardAutoFit(m,card,()=>{
    if(current)fitCurrent();
  });
  setMode('10');

  m._boardGetState=()=>({
    mode:m.dataset.numberFlashcardsMode||'10',
    current,
    remaining:[...remaining],
    completed
  });
  m._boardSetState=state=>{
    if(!state)return;
    const mode=state.mode in modes?state.mode:'10';
    m.dataset.numberFlashcardsMode=mode;
    modeSelect.value=mode;
    modeLabel.textContent=modes[mode].label;
    const pool=poolForMode(mode);
    const allowed=new Set(pool);
    const saved=String(state.current||'');
    if(allowed.has(saved)){
      applyValue(saved,measureValueSize(saved));
      if(Array.isArray(state.remaining)){
        const seen=new Set([saved]);
        remaining=state.remaining.map(String).filter(value=>{
          if(!allowed.has(value)||seen.has(value))return false;
          seen.add(value);
          return true;
        });
      }else{
        remaining=shuffleFlashcardDeck(pool.filter(value=>value!==saved));
      }
      if(state.completed){
        remaining=[];
        showComplete();
      }
    }else{
      resetDeck({animate:false});
    }
  };
  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    detachAutoFit();
    cancelAnimationFrame(resizeFrame);
    measurer.remove();
    completion.remove();
  };
}
