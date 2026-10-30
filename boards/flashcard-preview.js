/* Static flashcard previews reuse the live skin and type styles without starting a deck. */
export function renderFlashcardPreview(module,state){
 const selectors={abc:'.abc-letter',numberflashcards:'.number-flashcards-value',cvcword:'.cvcword-word',highfrequency:'.highfrequency-word',customflashcards:'.customflashcards-text'};
 const selector=selectors[state.type];if(!selector)return;
 const special=state.special||{},card=module.querySelector('.flashcard-surface'),text=module.querySelector(selector);
 if(!card||!text)return;
 module.classList.add('flashcard-preview');
 const customSet=special.sets?.find(s=>s.id===special.activeSetId)||special.sets?.[0];
 const customCard=customSet?.cards?.find(c=>c.id===special.currentCardId)||customSet?.cards?.[0];
 const value=state.type==='customflashcards'?(customCard?.text||''):(special.currentWord||special.current||'');
 text.textContent=special.completed?'Complete!':value;text.classList.remove('is-fitting');
 card.classList.remove('is-empty');
 const select=module.querySelector('select'),label=module.querySelector('.abc-mode-label,.cvcword-category-label,.highfrequency-grade-label,.customflashcards-set-label');
 if(label)label.textContent=customSet?.name||select?.selectedOptions?.[0]?.textContent||label.textContent;
 if(state.type==='abc')text.classList.toggle('is-vowel',state.dataset?.redVowels!=='false'&&/^[aeiouy]$/i.test(value));
 if(state.type==='cvcword'){
  const category=special.currentCategory||'a';card.dataset.vowel=category;
  const vowel=module.querySelector('.cvcword-vowel-label');if(vowel)vowel.textContent='Short '+category.toUpperCase();
 }
 const image=module.querySelector('.customflashcards-image');
 const hasImage=Boolean(image&&customCard?.imageSrc&&!special.completed);
 if(hasImage){image.src=customCard.imageSrc;image.alt=String(value||'Flashcard image');image.hidden=false;}
 card.classList.toggle('has-image',hasImage);card.classList.toggle('has-text',Boolean(text.textContent));
 const header=module.querySelector('header');header?.classList.add('has-flashcard-counter');
 const counter=document.createElement('span');counter.className='flashcard-counter';
 const nav=special.cardNavigation,count=nav?.items?.length||(value?1+(special.remaining||special.remainingWords||special.remainingCardIds||[]).length:0);
 counter.textContent=count?`${(nav?.index||0)+1}/${count}`:'0/0';header?.append(counter);
 function fit(){
  if(!module.isConnected||!text.textContent)return;
  const style=getComputedStyle(card),width=card.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),height=(card.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom))*(hasImage ? .25 : .85);
  const measure=text.cloneNode(true);measure.classList.remove('is-fitting');measure.setAttribute('aria-hidden','true');
  measure.style.cssText='position:absolute!important;left:-10000px!important;top:0!important;visibility:hidden!important;width:auto!important;max-width:none!important;white-space:nowrap!important;';card.append(measure);
  let lo=12,hi=state.type==='abc'||state.type==='numberflashcards'?720:240,best=12;
  while(lo<=hi){const mid=(lo+hi)>>1;measure.style.fontSize=mid+'px';if(measure.offsetWidth<=width&&measure.offsetHeight<=height){best=mid;lo=mid+1;}else hi=mid-1;}
  text.style.fontSize=best+'px';measure.remove();
 }
 requestAnimationFrame(fit);document.fonts?.ready?.then(fit);
}
