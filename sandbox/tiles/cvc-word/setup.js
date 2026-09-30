function setupCVCWord(m){
  const card=m.querySelector('.cvcword-card');
  const wordEl=m.querySelector('.cvcword-word');
  const vowelLabel=m.querySelector('.cvcword-vowel-label');
  const categoryLabel=m.querySelector('.cvcword-category-label');
  const categorySelect=m.querySelector('.cvcword-category');
  const nextButton=m.querySelector('.cvcword-next');

  const categoryNames={
    all:'All Short Vowels',
    a:'Short A',
    e:'Short E',
    i:'Short I',
    o:'Short O',
    u:'Short U'
  };

  let currentWord='';
  let currentCategory='a';
  let remainingWords=[];
  let completed=false;
  let animating=false;
  let resizeFrame=0;

  const measurer=document.createElement('span');
  measurer.className='cvcword-word cvcword-measurer';
  measurer.setAttribute('aria-hidden','true');
  card.appendChild(measurer);

  const completion=createFlashcardCompletePopup(card,()=>resetDeck({animate:true}));

  const getAvailableSpace=()=>{
    const cardRect=card.getBoundingClientRect();
    const labelRect=vowelLabel.getBoundingClientRect();

    return {
      maxWidth:Math.max(80,cardRect.width-34),
      maxHeight:Math.max(48,cardRect.height-38)
    };
  };

  const measureWordSize=word=>{
    const {maxWidth,maxHeight}=getAvailableSpace();

    measurer.textContent=word;
    measurer.style.fontFamily=getComputedStyle(wordEl).fontFamily;
    measurer.style.fontWeight=getComputedStyle(wordEl).fontWeight;
    measurer.style.letterSpacing=getComputedStyle(wordEl).letterSpacing;

    let low=18;
    let high=Math.max(24,Math.min(240,Math.floor(maxHeight*.9)));
    let best=low;

    while(low<=high){
      const mid=Math.floor((low+high)/2);
      measurer.style.fontSize=`${mid}px`;

      const rect=measurer.getBoundingClientRect();
      const fitsWidth=rect.width<=maxWidth+1;
      const fitsHeight=rect.height<=maxHeight+1;

      if(fitsWidth&&fitsHeight){
        best=mid;
        low=mid+1;
      }else{
        high=mid-1;
      }
    }

    return best;
  };

  const fitCurrentWord=()=>{
    cancelAnimationFrame(resizeFrame);
    resizeFrame=requestAnimationFrame(()=>{
      if(!currentWord)return;
      const size=measureWordSize(currentWord);
      wordEl.style.fontSize=`${size}px`;
      wordEl.classList.remove('is-fitting');
    });
  };

  const getPool=category=>{
    if(category!=='all'){
      return CVC_WORD_SETS[category].map(word=>({word,category}));
    }

    return Object.entries(CVC_WORD_SETS).flatMap(([key,words])=>
      words.map(word=>({word,category:key}))
    );
  };

  const itemKey=item=>`${item.category}:${item.word}`;

  const prepareWord=item=>{
    if(!item)return null;
    return {
      ...item,
      fontSize:measureWordSize(item.word)
    };
  };

  const applyPreparedWord=prepared=>{
    if(!prepared)return;

    currentWord=prepared.word;
    currentCategory=prepared.category;
    completed=false;
    completion.hide();

    wordEl.classList.add('is-fitting');
    wordEl.textContent=prepared.word;
    wordEl.style.fontSize=`${prepared.fontSize}px`;

    vowelLabel.textContent=`short ${prepared.category}`;
    card.dataset.vowel=prepared.category;
    card.setAttribute('aria-label',`${prepared.word}. Click for another CVC word.`);

    requestAnimationFrame(()=>{
      wordEl.classList.remove('is-fitting');
    });
  };

  const showComplete=()=>{
    completed=true;
    completion.show();
    card.setAttribute('aria-label','Complete. Shuffle to begin the CVC set again.');
  };

  const showNext=({animate=true}={})=>{
    if(animating||completed)return;

    if(!remainingWords.length){
      if(currentWord)showComplete();
      return;
    }

    const next=remainingWords.shift();
    const prepared=prepareWord(next);
    if(!animate){
      applyPreparedWord(prepared);
      return;
    }

    animating=true;
    card.classList.remove('is-flipping');
    void card.offsetWidth;
    card.classList.add('is-flipping');

    window.setTimeout(()=>{
      applyPreparedWord(prepared);
    },180);

    window.setTimeout(()=>{
      card.classList.remove('is-flipping');
      animating=false;
    },430);
  };

  function resetDeck({animate=false}={}){
    completion.hide();
    completed=false;
    currentWord='';
    remainingWords=shuffleFlashcardDeck(getPool(m.dataset.cvcCategory||'all'));
    showNext({animate});
  }

  const setCategory=category=>{
    const next=category in categoryNames?category:'all';
    m.dataset.cvcCategory=next;
    categorySelect.value=next;
    categoryLabel.textContent=categoryNames[next];
    resetDeck({animate:false});
  };

  card.addEventListener('click',()=>showNext());
  nextButton.addEventListener('click',()=>showNext());

  categorySelect.addEventListener('change',()=>{
    setCategory(categorySelect.value);
  });

  m.querySelector('.cvcword-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.cvcword-font').addEventListener('click',()=>{
    cycleData(m,'font',FONT_OPTIONS);
    fitCurrentWord();
  });
  m.querySelector('.cvcword-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));

  const detachAutoFit=bindFlashcardAutoFit(m,card,()=>{
    if(currentWord)fitCurrentWord();
  });

  setCategory('all');

  m._boardGetState=()=>({
    category:m.dataset.cvcCategory||'all',
    currentWord,
    currentCategory,
    remainingWords:remainingWords.map(item=>({word:item.word,category:item.category})),
    completed
  });
  m._boardSetState=state=>{
    if(!state)return;
    const category=state.category in categoryNames?state.category:'all';
    m.dataset.cvcCategory=category;
    categorySelect.value=category;
    categoryLabel.textContent=categoryNames[category];
    const allowed=getPool(category);
    const byKey=new Map(allowed.map(item=>[itemKey(item),item]));
    const saved=String(state.currentWord||'');
    const savedCategory=String(state.currentCategory||'');
    const currentMatch=byKey.get(`${savedCategory}:${saved}`)||allowed.find(item=>item.word===saved);
    if(currentMatch){
      applyPreparedWord(prepareWord(currentMatch));
      const currentKey=itemKey(currentMatch);
      if(Array.isArray(state.remainingWords)){
        const seen=new Set([currentKey]);
        remainingWords=state.remainingWords
          .map(item=>byKey.get(itemKey(item||{})))
          .filter(item=>{
            if(!item)return false;
            const key=itemKey(item);
            if(seen.has(key))return false;
            seen.add(key);
            return true;
          });
      }else{
        remainingWords=shuffleFlashcardDeck(allowed.filter(item=>itemKey(item)!==currentKey));
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
