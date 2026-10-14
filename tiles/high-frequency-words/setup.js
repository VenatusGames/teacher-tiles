function setupHighFrequencyWords(m){
  const card=m.querySelector('.highfrequency-card');
  const wordEl=m.querySelector('.highfrequency-word');
  const gradeLabel=m.querySelector('.highfrequency-grade-label');
  const gradeSelect=m.querySelector('.highfrequency-grade');
  const nextButton=m.querySelector('.highfrequency-next');
  const settingsButton=m.querySelector('.highfrequency-settings-button');
  const settings=m.querySelector('.highfrequency-settings');
  const settingsClose=m.querySelector('.highfrequency-settings-close');
  const settingsTitle=m.querySelector('.highfrequency-settings-title');
  const wordOptions=m.querySelector('.highfrequency-word-options');
  const enableAll=m.querySelector('.highfrequency-enable-all');
  const disableAll=m.querySelector('.highfrequency-disable-all');
  const enabledCount=m.querySelector('.highfrequency-enabled-count');

  const gradeNames={
    k:'Kindergarten',
    1:'Grade 1',
    2:'Grade 2',
    '3plus':'Grade 3+'
  };

  const enabledByGrade={};
  Object.entries(HIGH_FREQUENCY_WORD_SETS).forEach(([grade,words])=>{
    enabledByGrade[grade]=new Set(words);
  });

  let currentWord='';
  let remainingWords=[];
  let completed=false;
  let animating=false;
  let resizeFrame=0;

  const measurer=document.createElement('span');
  measurer.className='highfrequency-word highfrequency-measurer';
  measurer.setAttribute('aria-hidden','true');
  card.appendChild(measurer);

  const completion=createFlashcardCompletePopup(card,()=>resetDeck({animate:true}));

  const measureWordSize=word=>{
    const cardRect=card.getBoundingClientRect();
    const maxWidth=Math.max(90,cardRect.width-36);
    const maxHeight=Math.max(54,cardRect.height-40);

    measurer.textContent=word;
    const computed=getComputedStyle(wordEl);
    measurer.style.fontFamily=computed.fontFamily;
    measurer.style.fontWeight=computed.fontWeight;
    measurer.style.letterSpacing=computed.letterSpacing;

    let low=18;
    let high=Math.max(24,Math.min(240,Math.floor(maxHeight*.9)));
    let best=low;

    while(low<=high){
      const mid=Math.floor((low+high)/2);
      measurer.style.fontSize=`${mid}px`;

      const rect=measurer.getBoundingClientRect();
      if(rect.width<=maxWidth+1&&rect.height<=maxHeight+1){
        best=mid;
        low=mid+1;
      }else{
        high=mid-1;
      }
    }

    return best;
  };

  const enabledWords=grade=>HIGH_FREQUENCY_WORD_SETS[grade].filter(word=>enabledByGrade[grade].has(word));

  const applyWord=(word,size)=>{
    currentWord=word;
    completed=false;
    completion.hide();
    wordEl.classList.add('is-fitting');
    wordEl.textContent=word;
    wordEl.style.fontSize=`${size}px`;
    card.classList.remove('is-empty');
    card.setAttribute('aria-label',`${word}. Click for another high frequency word.`);
    requestAnimationFrame(()=>wordEl.classList.remove('is-fitting'));
  };

  const fitCurrentWord=()=>{
    cancelAnimationFrame(resizeFrame);
    resizeFrame=requestAnimationFrame(()=>{
      if(!currentWord)return;
      wordEl.style.fontSize=`${measureWordSize(currentWord)}px`;
      wordEl.classList.remove('is-fitting');
    });
  };

  const showEmpty=()=>{
    completion.hide();
    completed=false;
    remainingWords=[];
    currentWord='';
    wordEl.classList.remove('is-fitting');
    wordEl.style.fontSize='';
    wordEl.textContent='No words enabled';
    card.classList.add('is-empty');
    card.setAttribute('aria-label','No high frequency words enabled.');
  };

  const showComplete=()=>{
    completed=true;
    completion.show();
    card.setAttribute('aria-label','Complete. Shuffle to begin the high frequency word set again.');
  };

  const showNext=({animate=true}={})=>{
    if(animating||completed)return;
    const grade=m.dataset.hfwGrade||'k';

    if(!enabledWords(grade).length){
      showEmpty();
      return;
    }

    if(!remainingWords.length){
      if(currentWord)showComplete();
      else resetDeck({animate});
      return;
    }

    const next=remainingWords.shift();
    const size=measureWordSize(next);
    if(!animate){
      applyWord(next,size);
      return;
    }

    animating=true;
    card.classList.remove('is-empty','is-flipping');
    void card.offsetWidth;
    card.classList.add('is-flipping');

    window.setTimeout(()=>applyWord(next,size),180);

    window.setTimeout(()=>{
      card.classList.remove('is-flipping');
      animating=false;
    },430);
  };

  function resetDeck({animate=false}={}){
    const grade=m.dataset.hfwGrade||'k';
    completion.hide();
    completed=false;
    currentWord='';
    remainingWords=shuffleFlashcardDeck(enabledWords(grade));
    if(!remainingWords.length){
      showEmpty();
      return;
    }
    showNext({animate});
  }

  const renderSettings=()=>{
    const grade=m.dataset.hfwGrade||'k';
    const words=HIGH_FREQUENCY_WORD_SETS[grade];
    const enabled=enabledByGrade[grade];

    settingsTitle.textContent=gradeNames[grade];
    enabledCount.textContent=`${enabled.size} of ${words.length} enabled`;
    wordOptions.replaceChildren();

    words.forEach(word=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='highfrequency-word-option';
      button.textContent=word;
      button.classList.toggle('is-enabled',enabled.has(word));
      button.setAttribute('aria-pressed',String(enabled.has(word)));

      button.addEventListener('click',()=>{
        if(enabled.has(word))enabled.delete(word);
        else enabled.add(word);

        renderSettings();
        resetDeck({animate:false});
      });

      wordOptions.appendChild(button);
    });
  };

  const setGrade=grade=>{
    const next=grade in gradeNames?grade:'k';
    m.dataset.hfwGrade=next;
    gradeSelect.value=next;
    gradeLabel.textContent=gradeNames[next];
    renderSettings();
    resetDeck({animate:false});
  };

  card.addEventListener('click',()=>showNext());
  nextButton.addEventListener('click',()=>showNext());

  gradeSelect.addEventListener('change',()=>setGrade(gradeSelect.value));

  settingsButton.addEventListener('click',()=>{
    renderSettings();
    settings.hidden=false;
  });

  settingsClose.addEventListener('click',()=>{settings.hidden=true;});
  settings.addEventListener('pointerdown',event=>{
    if(event.target===settings)settings.hidden=true;
  });

  enableAll.addEventListener('click',()=>{
    const grade=m.dataset.hfwGrade||'k';
    enabledByGrade[grade]=new Set(HIGH_FREQUENCY_WORD_SETS[grade]);
    renderSettings();
    resetDeck({animate:false});
  });

  disableAll.addEventListener('click',()=>{
    const grade=m.dataset.hfwGrade||'k';
    enabledByGrade[grade].clear();
    renderSettings();
    resetDeck({animate:false});
  });

  m.querySelector('.highfrequency-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.highfrequency-font').addEventListener('click',()=>{
    cycleData(m,'font',FONT_OPTIONS);
    fitCurrentWord();
  });
  m.querySelector('.highfrequency-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));

  const detachAutoFit=bindFlashcardAutoFit(m,card,()=>{
    if(currentWord)fitCurrentWord();
  });

  setGrade('k');

  m._boardGetState=()=>({
    grade:m.dataset.hfwGrade||'k',
    currentWord,
    remainingWords:[...remainingWords],
    completed,
    enabledByGrade:Object.fromEntries(Object.entries(enabledByGrade).map(([grade,set])=>[grade,[...set]]))
  });
  m._boardSetState=state=>{
    if(!state)return;
    const savedEnabled=state.enabledByGrade&&typeof state.enabledByGrade==='object'?state.enabledByGrade:{};
    for(const [grade,words] of Object.entries(HIGH_FREQUENCY_WORD_SETS)){
      const allowed=new Set(words);
      const saved=Array.isArray(savedEnabled[grade])?savedEnabled[grade].filter(word=>allowed.has(word)):words;
      enabledByGrade[grade]=new Set(saved);
    }
    const grade=state.grade in gradeNames?state.grade:'k';
    m.dataset.hfwGrade=grade;
    gradeSelect.value=grade;
    gradeLabel.textContent=gradeNames[grade];
    renderSettings();
    const pool=enabledWords(grade);
    const allowed=new Set(pool);
    const savedWord=String(state.currentWord||'');
    if(savedWord&&allowed.has(savedWord)){
      applyWord(savedWord,measureWordSize(savedWord));
      if(Array.isArray(state.remainingWords)){
        const seen=new Set([savedWord]);
        remainingWords=state.remainingWords.filter(word=>{
          if(!allowed.has(word)||seen.has(word))return false;
          seen.add(word);
          return true;
        });
      }else{
        remainingWords=shuffleFlashcardDeck(pool.filter(word=>word!==savedWord));
      }
      if(state.completed){
        remainingWords=[];
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
