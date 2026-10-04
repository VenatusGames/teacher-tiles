function setupCustomFlashcards(m){
  const card=m.querySelector('.customflashcards-card');
  const image=m.querySelector('.customflashcards-image');
  const textEl=m.querySelector('.customflashcards-text');
  const setLabel=m.querySelector('.customflashcards-set-label');
  const setSelect=m.querySelector('.customflashcards-set-select');
  const nextButton=m.querySelector('.customflashcards-next');
  const manageButton=m.querySelector('.customflashcards-manage');
  const editor=m.querySelector('.customflashcards-editor');
  const editorClose=m.querySelector('.customflashcards-editor-close');
  const setList=m.querySelector('.customflashcards-set-list');
  const addSetButton=m.querySelector('.customflashcards-add-set');
  const setNameInput=m.querySelector('.customflashcards-set-name');
  const deleteSetButton=m.querySelector('.customflashcards-delete-set');
  const cardList=m.querySelector('.customflashcards-card-list');
  const addCardButton=m.querySelector('.customflashcards-add-card');
  const imageInput=m.querySelector('.customflashcards-image-input');
  const status=m.querySelector('.customflashcards-editor-status');

  let serial=0;
  const makeId=prefix=>`${prefix}-${Date.now().toString(36)}-${(++serial).toString(36)}`;
  const makeSet=(name='My Cards')=>({id:makeId('set'),name,cards:[]});
  const makeCard=()=>({id:makeId('card'),text:'',imageSrc:'',imageName:''});

  let sets=[makeSet()];
  let activeSetId=sets[0].id;
  let currentCardId='';
  let remainingCardIds=[];
  let completed=false;
  let uploadTargetId='';
  let animating=false;
  let resizeFrame=0;
  let flipTimer=0;
  let finishTimer=0;
  let statusTimer=0;

  const measurer=document.createElement('span');
  measurer.className='customflashcards-text customflashcards-measurer';
  measurer.setAttribute('aria-hidden','true');
  card.appendChild(measurer);

  const completion=createFlashcardCompletePopup(card,()=>resetDeck({animate:true}));

  const activeSet=()=>sets.find(set=>set.id===activeSetId)||sets[0];
  const currentCard=()=>activeSet()?.cards.find(item=>item.id===currentCardId)||null;

  const setStatus=(message='',isError=false)=>{
    clearTimeout(statusTimer);
    status.textContent=message;
    status.classList.toggle('is-error',isError);
    if(message)statusTimer=window.setTimeout(()=>{
      status.textContent='';
      status.classList.remove('is-error');
    },2600);
  };

  const measureTextSize=(value,hasImage)=>{
    const rect=card.getBoundingClientRect();
    const maxWidth=Math.max(100,rect.width-48);
    const maxHeight=Math.max(44,hasImage?rect.height*.28:rect.height-48);
    const computed=getComputedStyle(textEl);
    measurer.textContent=value||' ';
    measurer.style.width=`${maxWidth}px`;
    measurer.style.fontFamily=computed.fontFamily;
    measurer.style.fontWeight=computed.fontWeight;
    measurer.style.letterSpacing=computed.letterSpacing;

    let low=16;
    let high=Math.max(24,Math.min(150,Math.floor(maxHeight*.92)));
    let best=low;
    while(low<=high){
      const mid=Math.floor((low+high)/2);
      measurer.style.fontSize=`${mid}px`;
      const measured=measurer.getBoundingClientRect();
      if(measured.width<=maxWidth+1&&measured.height<=maxHeight+1){
        best=mid;
        low=mid+1;
      }else high=mid-1;
    }
    return best;
  };

  const applyCardContent=item=>{
    currentCardId=item?.id||'';
    const hasCard=Boolean(item);
    const hasImage=Boolean(item?.imageSrc);
    const value=String(item?.text||'').trim();
    card.classList.toggle('is-empty',!hasCard);
    card.classList.toggle('has-image',hasImage);
    card.classList.toggle('has-text',Boolean(value));

    if(hasImage){
      image.src=item.imageSrc;
      image.alt=value?`${value} flashcard image`:'Flashcard image';
      image.hidden=false;
    }else{
      image.removeAttribute('src');
      image.alt='';
      image.hidden=true;
    }

    textEl.textContent=hasCard?(value||'Untitled card'):'Add your first card';
    textEl.style.fontSize=hasCard?`${measureTextSize(textEl.textContent,hasImage)}px`:'';
    card.setAttribute('aria-label',hasCard
      ?`${value||'Image flashcard'}. Click for another card.`
      :'Open the set editor to add a flashcard.');
  };

  const displayCard=(item,{animate=true}={})=>{
    clearTimeout(flipTimer);
    clearTimeout(finishTimer);
    if(!animate){
      animating=false;
      card.classList.remove('is-flipping');
      applyCardContent(item);
      return;
    }
    if(animating)return;
    animating=true;
    card.classList.remove('is-flipping');
    void card.offsetWidth;
    card.classList.add('is-flipping');
    flipTimer=window.setTimeout(()=>applyCardContent(item),180);
    finishTimer=window.setTimeout(()=>{
      card.classList.remove('is-flipping');
      animating=false;
    },430);
  };

  const showComplete=()=>{
    completed=true;
    completion.show();
    card.setAttribute('aria-label','Complete. Shuffle to begin this flashcard set again.');
  };

  const showNext=({animate=true}={})=>{
    if(animating||completed)return;
    const pool=activeSet()?.cards||[];
    if(!pool.length){
      remainingCardIds=[];
      currentCardId='';
      completion.hide();
      completed=false;
      displayCard(null,{animate:false});
      return;
    }

    const byId=new Map(pool.map(item=>[item.id,item]));
    const seen=new Set();
    remainingCardIds=remainingCardIds.filter(id=>{
      if(!byId.has(id)||id===currentCardId||seen.has(id))return false;
      seen.add(id);
      return true;
    });

    if(!remainingCardIds.length){
      if(currentCardId&&byId.has(currentCardId))showComplete();
      else resetDeck({animate});
      return;
    }

    completion.hide();
    completed=false;
    const next=byId.get(remainingCardIds.shift());
    if(next)displayCard(next,{animate});
  };

  function resetDeck({animate=false,focusId=''}={}){
    const pool=activeSet()?.cards||[];
    completion.hide();
    completed=false;
    if(!pool.length){
      remainingCardIds=[];
      currentCardId='';
      displayCard(null,{animate:false});
      return;
    }

    const focused=focusId&&pool.find(item=>item.id===focusId);
    if(focused){
      remainingCardIds=shuffleFlashcardDeck(pool.filter(item=>item.id!==focusId).map(item=>item.id));
      displayCard(focused,{animate});
      return;
    }

    currentCardId='';
    remainingCardIds=shuffleFlashcardDeck(pool.map(item=>item.id));
    showNext({animate});
  }

  const updateSetControls=()=>{
    const selected=activeSet();
    setSelect.replaceChildren();
    sets.forEach(set=>{
      const option=document.createElement('option');
      option.value=set.id;
      option.textContent=set.name;
      setSelect.appendChild(option);
    });
    if(selected){
      setSelect.value=selected.id;
      setLabel.textContent=selected.name;
      m.dataset.customFlashcardSet=selected.id;
    }
  };

  const renderSetList=()=>{
    setList.replaceChildren();
    sets.forEach(set=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='customflashcards-set-item';
      button.classList.toggle('is-active',set.id===activeSetId);
      button.innerHTML='<span></span><small></small>';
      button.querySelector('span').textContent=set.name;
      button.querySelector('small').textContent=`${set.cards.length} ${set.cards.length===1?'card':'cards'}`;
      button.addEventListener('click',()=>{
        if(set.id===activeSetId)return;
        activeSetId=set.id;
        updateSetControls();
        renderEditor();
        resetDeck({animate:false});
      });
      setList.appendChild(button);
    });
  };

  const totalImageLength=(exceptId='')=>sets.reduce((total,set)=>total+set.cards.reduce((sum,item)=>
    sum+(item.id===exceptId?0:String(item.imageSrc||'').length),0),0);

  const renderCardList=()=>{
    cardList.replaceChildren();
    const selected=activeSet();
    if(!selected?.cards.length){
      const empty=document.createElement('div');
      empty.className='customflashcards-editor-empty';
      empty.innerHTML='<strong>No cards yet</strong><span>Add a flashcard, then type text or upload an image.</span>';
      cardList.appendChild(empty);
      return;
    }

    selected.cards.forEach((item,index)=>{
      const row=document.createElement('article');
      row.className='customflashcards-card-row';
      row.dataset.cardId=item.id;

      const number=document.createElement('span');
      number.className='customflashcards-card-number';
      number.textContent=String(index+1);

      const media=document.createElement('button');
      media.type='button';
      media.className='customflashcards-card-media';
      media.title=item.imageSrc?'Replace image':'Upload image';
      media.setAttribute('aria-label',item.imageSrc?'Replace card image':'Upload a card image');
      if(item.imageSrc){
        const preview=document.createElement('img');
        preview.src=item.imageSrc;
        preview.alt='';
        media.appendChild(preview);
      }else media.innerHTML='<span aria-hidden="true">＋</span><small>Image</small>';
      media.addEventListener('click',()=>{
        uploadTargetId=item.id;
        imageInput.click();
      });

      const field=document.createElement('textarea');
      field.className='customflashcards-card-text-input';
      field.maxLength=180;
      field.rows=2;
      field.placeholder='Type the word, question, or answer shown on this card';
      field.value=item.text;
      field.setAttribute('aria-label',`Flashcard ${index+1} text`);
      field.addEventListener('input',()=>{
        item.text=field.value;
        if(item.id===currentCardId)applyCardContent(item);
      });

      const actions=document.createElement('div');
      actions.className='customflashcards-card-row-actions';
      if(item.imageSrc){
        const removeImage=document.createElement('button');
        removeImage.type='button';
        removeImage.textContent='Remove image';
        removeImage.addEventListener('click',()=>{
          item.imageSrc='';
          item.imageName='';
          if(item.id===currentCardId)applyCardContent(item);
          renderCardList();
          notifyBoardChanged('custom-flashcard-image');
        });
        actions.appendChild(removeImage);
      }

      const remove=document.createElement('button');
      remove.type='button';
      remove.className='customflashcards-remove-card';
      remove.textContent='Delete';
      remove.addEventListener('click',()=>{
        selected.cards=selected.cards.filter(cardItem=>cardItem.id!==item.id);
        updateSetControls();
        renderEditor();
        resetDeck({animate:false});
      });
      actions.appendChild(remove);

      row.append(number,media,field,actions);
      cardList.appendChild(row);
    });
  };

  function renderEditor(){
    const selected=activeSet();
    updateSetControls();
    renderSetList();
    setNameInput.value=selected?.name||'';
    deleteSetButton.disabled=sets.length<=1;
    renderCardList();
  }

  const openEditor=()=>{
    renderEditor();
    editor.hidden=false;
  };

  const closeEditor=()=>{
    editor.hidden=true;
    setStatus('');
  };

  card.addEventListener('click',()=>{
    if(activeSet()?.cards.length)showNext();
    else openEditor();
  });
  nextButton.addEventListener('click',()=>{
    if(activeSet()?.cards.length)showNext();
    else openEditor();
  });
  manageButton.addEventListener('click',openEditor);
  editorClose.addEventListener('click',closeEditor);
  editor.addEventListener('pointerdown',event=>{if(event.target===editor)closeEditor();});
  editor.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});

  setSelect.addEventListener('change',()=>{
    if(!sets.some(set=>set.id===setSelect.value))return;
    activeSetId=setSelect.value;
    updateSetControls();
    resetDeck({animate:true});
  });

  addSetButton.addEventListener('click',()=>{
    const set=makeSet(`Card Set ${sets.length+1}`);
    sets.push(set);
    activeSetId=set.id;
    renderEditor();
    resetDeck({animate:false});
    requestAnimationFrame(()=>{
      setNameInput.focus({preventScroll:true});
      setNameInput.select();
    });
  });

  setNameInput.addEventListener('input',()=>{
    const selected=activeSet();
    if(!selected)return;
    selected.name=setNameInput.value.replace(/\s+/g,' ').slice(0,40)||'Untitled Set';
    updateSetControls();
    renderSetList();
  });
  setNameInput.addEventListener('blur',()=>{
    const selected=activeSet();
    if(!selected)return;
    selected.name=setNameInput.value.trim().replace(/\s+/g,' ')||'Untitled Set';
    setNameInput.value=selected.name;
    updateSetControls();
    renderSetList();
  });

  deleteSetButton.addEventListener('click',()=>{
    if(sets.length<=1)return;
    const index=Math.max(0,sets.findIndex(set=>set.id===activeSetId));
    sets=sets.filter(set=>set.id!==activeSetId);
    activeSetId=sets[Math.min(index,sets.length-1)].id;
    renderEditor();
    resetDeck({animate:false});
  });

  addCardButton.addEventListener('click',()=>{
    const selected=activeSet();
    if(!selected||selected.cards.length>=60){
      setStatus('Each set can hold up to 60 cards.',true);
      return;
    }
    const item=makeCard();
    selected.cards.push(item);
    renderEditor();
    resetDeck({animate:false,focusId:item.id});
    requestAnimationFrame(()=>cardList.querySelector(`[data-card-id="${item.id}"] textarea`)?.focus({preventScroll:true}));
  });

  imageInput.addEventListener('change',async()=>{
    const file=imageInput.files?.[0];
    const targetId=uploadTargetId;
    imageInput.value='';
    uploadTargetId='';
    if(!file||!targetId)return;
    setStatus('Preparing image…');
    const data=await fileToBoardImageData(file,{maxSide:720,maxLength:85000,quality:.72,minSide:200});
    const item=sets.flatMap(set=>set.cards).find(cardItem=>cardItem.id===targetId);
    if(!item)return;
    if(!data){
      setStatus('That image could not be prepared. Try a smaller file.',true);
      return;
    }
    if(totalImageLength(targetId)+data.length>620000){
      setStatus('This tile has reached its image storage limit. Remove an image first.',true);
      return;
    }
    item.imageSrc=data;
    item.imageName=file.name||'Flashcard image';
    if(item.id===currentCardId)applyCardContent(item);
    renderCardList();
    setStatus('Image added.');
    notifyBoardChanged('custom-flashcard-image');
  });

  m.querySelector('.customflashcards-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.customflashcards-font').addEventListener('click',()=>{
    cycleData(m,'font',FONT_OPTIONS);
    if(currentCard())applyCardContent(currentCard());
  });
  m.querySelector('.customflashcards-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));

  const detachAutoFit=bindFlashcardAutoFit(m,card,()=>{
    cancelAnimationFrame(resizeFrame);
    resizeFrame=requestAnimationFrame(()=>{
      const item=currentCard();
      if(item)applyCardContent(item);
    });
  });

  updateSetControls();
  resetDeck({animate:false});

  m._boardGetState=()=>(
    {
      activeSetId,
      currentCardId,
      remainingCardIds:[...remainingCardIds],
      completed,
      sets:sets.map(set=>({
        id:set.id,
        name:set.name,
        cards:set.cards.map(item=>({id:item.id,text:item.text,imageSrc:item.imageSrc,imageName:item.imageName}))
      }))
    }
  );
  m._boardSetState=state=>{
    if(!state)return;
    const usedIds=new Set();
    const restored=[];
    for(const savedSet of Array.isArray(state.sets)?state.sets.slice(0,20):[]){
      const setId=String(savedSet?.id||makeId('set'));
      const uniqueSetId=usedIds.has(setId)?makeId('set'):setId;
      usedIds.add(uniqueSetId);
      const restoredSet={
        id:uniqueSetId,
        name:String(savedSet?.name||'Untitled Set').trim().slice(0,40)||'Untitled Set',
        cards:[]
      };
      for(const savedCard of Array.isArray(savedSet?.cards)?savedSet.cards.slice(0,60):[]){
        const cardId=String(savedCard?.id||makeId('card'));
        const uniqueCardId=usedIds.has(cardId)?makeId('card'):cardId;
        usedIds.add(uniqueCardId);
        const imageSrc=String(savedCard?.imageSrc||'');
        restoredSet.cards.push({
          id:uniqueCardId,
          text:String(savedCard?.text||'').slice(0,180),
          imageSrc:/^data:image\//i.test(imageSrc)?imageSrc:'',
          imageName:String(savedCard?.imageName||'').slice(0,120)
        });
      }
      restored.push(restoredSet);
    }
    sets=restored.length?restored:[makeSet()];
    activeSetId=sets.some(set=>set.id===state.activeSetId)?state.activeSetId:sets[0].id;
    const selected=activeSet();
    const savedCurrent=String(state.currentCardId||'');
    const item=selected.cards.find(cardItem=>cardItem.id===savedCurrent)||null;
    renderEditor();
    completion.hide();
    completed=false;
    if(item){
      currentCardId=item.id;
      const allowed=new Set(selected.cards.map(cardItem=>cardItem.id));
      if(Array.isArray(state.remainingCardIds)){
        const seen=new Set([item.id]);
        remainingCardIds=state.remainingCardIds.filter(id=>{
          if(!allowed.has(id)||seen.has(id))return false;
          seen.add(id);
          return true;
        });
      }else{
        remainingCardIds=shuffleFlashcardDeck(selected.cards.filter(cardItem=>cardItem.id!==item.id).map(cardItem=>cardItem.id));
      }
      displayCard(item,{animate:false});
      if(state.completed){
        remainingCardIds=[];
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
    clearTimeout(flipTimer);
    clearTimeout(finishTimer);
    clearTimeout(statusTimer);
    measurer.remove();
    completion.remove();
  };
}
