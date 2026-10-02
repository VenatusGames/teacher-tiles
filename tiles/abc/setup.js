function setupABC(m){
  const card=m.querySelector('.abc-card');
  const letterEl=m.querySelector('.abc-letter');
  const modeLabel=m.querySelector('.abc-mode-label');
  const modeSelect=m.querySelector('.abc-mode');
  const nextButton=m.querySelector('.abc-next');

  const uppercase='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const lowercase='abcdefghijklmnopqrstuvwxyz'.split('');
  const settings=document.createElement('div');settings.className='tile-settings-wrap';
  settings.innerHTML='<button type="button" class="custom-icon tile-settings-toggle" aria-label="ABC Settings" aria-expanded="false">⚙</button><div class="tile-settings-panel" hidden><strong>ABC Settings</strong><label class="tile-setting">Red Vowels<input type="checkbox" role="switch" class="abc-red-vowels" checked></label></div>';
  m.querySelector('.customization-bar').append(settings);
  const vowelToggle=settings.querySelector('input');
  vowelToggle.checked=m.dataset.redVowels!=='false';
  vowelToggle.addEventListener('change',()=>{m.dataset.redVowels=String(vowelToggle.checked);letterEl.classList.toggle('is-vowel',vowelToggle.checked&&vowels.has(current.toLowerCase()));notifyBoardChanged('abc-vowels')});
  const vowels=new Set(['a','e','i','o','u','y']);

  const modeNames={
    uppercase:'Uppercase Letters',
    lowercase:'Lowercase Letters',
    both:'Uppercase + Lowercase'
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

  const measureLetterSize=letter=>{
    const rect=card.getBoundingClientRect();
    const maxWidth=Math.max(80,rect.width-12);
    const maxHeight=Math.max(80,rect.height-14);

    measurer.textContent=letter;

    let low=28;
    let high=Math.max(36,Math.min(720,Math.floor(maxHeight*1.35)));
    let best=low;

    while(low<=high){
      const mid=Math.floor((low+high)/2);
      measurer.style.fontSize=`${mid}px`;
      const measured=measurer.getBoundingClientRect();

      if(measured.width<=maxWidth+1&&measured.height<=maxHeight+1){
        best=mid;
        low=mid+1;
      }else{
        high=mid-1;
      }
    }

    return best;
  };

  const poolForMode=mode=>{
    if(mode==='lowercase')return lowercase;
    if(mode==='both')return [...uppercase,...lowercase];
    return uppercase;
  };

  const applyLetter=(letter,size)=>{
    current=letter;
    completed=false;
    completion.hide();
    letterEl.classList.add('is-fitting');
    letterEl.classList.toggle('is-vowel',m.dataset.redVowels!=='false'&&vowels.has(letter.toLowerCase()));
    letterEl.textContent=letter;
    letterEl.style.fontSize=`${size}px`;
    card.setAttribute('aria-label',`${letter}. Click for another letter.`);
    requestAnimationFrame(()=>letterEl.classList.remove('is-fitting'));
  };

  const fitCurrent=()=>{
    cancelAnimationFrame(resizeFrame);
    resizeFrame=requestAnimationFrame(()=>{
      if(!current)return;
      letterEl.style.fontSize=`${measureLetterSize(current)}px`;
      letterEl.classList.remove('is-fitting');
    });
  };

  const showComplete=()=>{
    completed=true;
    completion.show();
    card.setAttribute('aria-label','Complete. Shuffle to begin the alphabet set again.');
  };

  const showNext=({animate=true}={})=>{
    if(animating||completed)return;
    if(!remaining.length){
      if(current)showComplete();
      return;
    }

    const next=remaining.shift();
    const size=measureLetterSize(next);
    if(!animate){
      applyLetter(next,size);
      return;
    }

    animating=true;
    card.classList.remove('is-flipping');
    void card.offsetWidth;
    card.classList.add('is-flipping');

    window.setTimeout(()=>applyLetter(next,size),180);
    window.setTimeout(()=>{
      card.classList.remove('is-flipping');
      animating=false;
    },430);
  };

  function resetDeck({animate=false}={}){
    completion.hide();
    completed=false;
    current='';
    remaining=shuffleFlashcardDeck(poolForMode(m.dataset.abcMode||'uppercase'));
    showNext({animate});
  }

  const setMode=mode=>{
    const next=mode in modeNames?mode:'uppercase';
    m.dataset.abcMode=next;
    modeSelect.value=next;
    modeLabel.textContent=modeNames[next];
    resetDeck({animate:false});
  };

  card.addEventListener('click',()=>showNext());
  nextButton.addEventListener('click',()=>showNext());
  modeSelect.addEventListener('change',()=>setMode(modeSelect.value));

  m.querySelector('.abc-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.abc-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));

  const detachAutoFit=bindFlashcardAutoFit(m,card,()=>{
    if(current)fitCurrent();
  });

  setMode('uppercase');

  m._boardGetState=()=>({
    redVowels:m.dataset.redVowels!=='false',
    mode:m.dataset.abcMode||'uppercase',
    current,
    remaining:[...remaining],
    completed
  });
  m._boardSetState=state=>{
    if(!state)return;
    m.dataset.redVowels=String(state.redVowels??(m.dataset.redVowels!=='false'));vowelToggle.checked=m.dataset.redVowels!=='false';
    const mode=state.mode in modeNames?state.mode:'uppercase';
    m.dataset.abcMode=mode;
    modeSelect.value=mode;
    modeLabel.textContent=modeNames[mode];
    const pool=poolForMode(mode);
    const allowed=new Set(pool);
    const saved=String(state.current||'');
    if(saved&&allowed.has(saved)){
      applyLetter(saved,measureLetterSize(saved));
      if(Array.isArray(state.remaining)){
        const seen=new Set([saved]);
        remaining=state.remaining.filter(letter=>{
          if(!allowed.has(letter)||seen.has(letter))return false;
          seen.add(letter);
          return true;
        });
      }else{
        remaining=shuffleFlashcardDeck(pool.filter(letter=>letter!==saved));
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
