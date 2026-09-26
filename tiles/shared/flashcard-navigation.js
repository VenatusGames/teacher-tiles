(()=>{'use strict';
function setup(m){
  const type=m.dataset.type,config={abc:['.abc-card','.abc-next','current','remaining'],numberflashcards:['.number-flashcards-card','.number-flashcards-next','current','remaining'],cvcword:['.cvcword-card','.cvcword-next','currentWord','remainingWords'],highfrequency:['.highfrequency-card','.highfrequency-next','currentWord','remainingWords'],customflashcards:['.customflashcards-card','.customflashcards-next','currentCardId','remainingCardIds']}[type];if(!config)return;
  const [cardSelector,nextSelector,currentKey,remainingKey]=config,card=m.querySelector(cardSelector),next=m.querySelector(nextSelector),get=m._boardGetState,set=m._boardSetState;if(!card||!next||!get||!set)return;
  let items=[],index=0,timer=0,animation=null;
  const signature=state=>JSON.stringify([current(state),state[remainingKey]]);
  let deckSignature='';
  const controls=document.createElement('div');controls.className='flashcard-navigation';controls.setAttribute('aria-label','Flashcard navigation');const previous=document.createElement('button');previous.type='button';previous.className='flashcard-back';previous.innerHTML='&#8592;';previous.setAttribute('aria-label','Previous card');previous.title='Previous card';next.className='flashcard-forward';next.innerHTML='&#8594;';next.setAttribute('aria-label','Next card');next.title='Next card';controls.append(previous,next);m.append(controls);
  const counter=document.createElement('span');counter.className='flashcard-counter';counter.setAttribute('aria-live','polite');m.append(counter);
  const current=s=>type==='cvcword'?{word:s.currentWord,category:s.currentCategory}:s[currentKey];
  const valid=v=>type==='cvcword'?Boolean(v?.word):Boolean(v);
  function update(){counter.textContent=items.length?`${index+1}/${items.length}`:'0/0';counter.title=`${Math.max(0,items.length-index-1)} cards remaining`;counter.setAttribute('aria-label',`Card ${items.length?index+1:0} of ${items.length}; ${Math.max(0,items.length-index-1)} remaining`);previous.disabled=index<=0;next.disabled=!items.length||index>=items.length-1}
  function rebuild(){const state=get();items=[current(state),...(state[remainingKey]||[])].filter(valid);index=0;deckSignature=signature(state);update()}
  function sync(){if(valid(current(get()))&&signature(get())!==deckSignature)rebuild()}
  function show(delta){sync();const at=index+delta;if(at<0||at>=items.length)return;index=at;const state=get();state.completed=false;state[remainingKey]=items.slice(index+1);if(type==='cvcword'){state.currentWord=items[index].word;state.currentCategory=items[index].category}else state[currentKey]=items[index];set(state);deckSignature=signature(get());update();animation?.cancel();if(!matchMedia('(prefers-reduced-motion: reduce)').matches)animation=card.animate([{opacity:.55,transform:'translateY(5px)'},{opacity:1,transform:'none'}],{duration:180,easing:'ease-out'});notifyBoardChanged('flashcard-navigation')}
  previous.onclick=()=>show(-1);
  next.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();show(1)},true);
  card.addEventListener('click',e=>{if(!items.length||e.target.closest('.flashcard-shuffle'))return;e.preventDefault();e.stopImmediatePropagation();show(1)},true);
  const changed=e=>{if(e.target.closest('.flashcard-navigation'))return;clearTimeout(timer);timer=setTimeout(()=>{if(signature(get())!==deckSignature)rebuild()},460)};
  m.addEventListener('change',changed);m.addEventListener('input',changed);m.addEventListener('click',changed);
  m._boardGetState=()=>{sync();return {...get(),cardNavigation:{items:structuredClone(items),index}}};
  m._boardSetState=state=>{set(state);const saved=state?.cardNavigation;if(saved&&Array.isArray(saved.items)&&saved.items.length<=1000){items=saved.items.filter(valid);index=Math.max(0,Math.min(items.length-1,Number(saved.index)||0));deckSignature=signature(get());update()}else rebuild()};
  const cleanup=m._cleanup;m._cleanup=()=>{clearTimeout(timer);animation?.cancel();cleanup?.()};rebuild();
}
window.TeacherTilesFlashcardNavigation=Object.freeze({setup});})();
