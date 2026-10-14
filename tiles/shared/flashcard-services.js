function shuffleFlashcardDeck(values){
  const deck=[...values];
  for(let index=deck.length-1;index>0;index--){
    const swap=Math.floor(Math.random()*(index+1));
    [deck[index],deck[swap]]=[deck[swap],deck[index]];
  }
  return deck;
}

function bindFlashcardAutoFit(m,card,fit){
  let settleFrame=0;
  let finalFrame=0;
  const queue=()=>{
    cancelAnimationFrame(settleFrame);
    cancelAnimationFrame(finalFrame);
    settleFrame=requestAnimationFrame(()=>{
      finalFrame=requestAnimationFrame(()=>{
        settleFrame=0;
        finalFrame=0;
        if(m.isConnected)fit();
      });
    });
  };
  const ro=new ResizeObserver(queue);
  ro.observe(card);
  const onFontsLoaded=()=>queue();
  document.fonts?.addEventListener?.('loadingdone',onFontsLoaded);
  document.fonts?.ready?.then(()=>{if(m.isConnected)queue()});
  const priorAfterResize=m._afterModuleResize;
  m._afterModuleResize=()=>{priorAfterResize?.();queue()};
  queue();
  return()=>{
    ro.disconnect();
    cancelAnimationFrame(settleFrame);
    cancelAnimationFrame(finalFrame);
    document.fonts?.removeEventListener?.('loadingdone',onFontsLoaded);
  };
}

function createFlashcardCompletePopup(card,onShuffle){
  const popup=document.createElement('span');
  popup.className='flashcard-complete';
  popup.hidden=true;
  popup.setAttribute('aria-live','polite');
  popup.innerHTML='<strong>Complete!</strong><span class="flashcard-shuffle" role="button" tabindex="0">Shuffle</span>';
  const shuffleButton=popup.querySelector('.flashcard-shuffle');
  const shuffle=event=>{
    event?.preventDefault();
    event?.stopPropagation();
    onShuffle();
  };
  popup.addEventListener('pointerdown',event=>event.stopPropagation());
  popup.addEventListener('click',event=>event.stopPropagation());
  shuffleButton.addEventListener('click',shuffle);
  shuffleButton.addEventListener('keydown',event=>{
    if(event.key==='Enter'||event.key===' '){
      shuffle(event);
    }
  });
  card.appendChild(popup);
  return{
    show(){
      popup.hidden=false;
      card.classList.add('is-complete');
    },
    hide(){
      popup.hidden=true;
      card.classList.remove('is-complete');
    },
    remove(){popup.remove()}
  };
}
