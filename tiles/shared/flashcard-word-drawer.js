(() => {
  'use strict';let serial=0;
  window.setupFlashcardWordDrawer=(m,{button,drawer,closeButton,options,render})=>{
    const life=new AbortController(),events={signal:life.signal};
    const settings=document.createElement('div');settings.className='tile-settings-panel';settings.hidden=true;
    const title=document.createElement('strong');title.textContent='Tile Settings';
    const launch=document.createElement('button');launch.type='button';launch.className='flashcard-words-open';
    launch.innerHTML='<span>Choose Words</span><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m7 4 6 6-6 6"/></svg>';
    launch.setAttribute('aria-expanded','false');launch.setAttribute('aria-haspopup','dialog');
    settings.append(title,launch);drawer.before(settings);
    button.classList.add('tile-settings-toggle');button.setAttribute('aria-expanded','false');
    drawer.classList.add('flashcard-word-drawer');drawer.setAttribute('popover','manual');drawer.setAttribute('role','dialog');drawer.setAttribute('aria-label','Choose Words');drawer.id=`flashcard-word-drawer-${++serial}`;launch.setAttribute('aria-controls',drawer.id);
    const content=drawer.firstElementChild;content.classList.add('flashcard-word-drawer__content');
    const header=content.firstElementChild;header.classList.add('flashcard-word-drawer__header');header.querySelector('span').textContent='Choose Words';
    closeButton.setAttribute('aria-label','Close Choose Words');closeButton.classList.add('flashcard-word-drawer__close');
    const back=document.createElement('button');back.type='button';back.className='flashcard-word-drawer__back';back.setAttribute('aria-label','Back to Tile Settings');back.title='Back to Tile Settings';back.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg>';header.prepend(back);
    const actions=content.querySelector('[class$="-settings-actions"]');actions.classList.add('flashcard-word-drawer__actions');
    const search=document.createElement('input');search.type='search';search.className='flashcard-word-drawer__search';search.placeholder='Find a word…';search.setAttribute('aria-label','Find a word');options.before(search);
    options.classList.add('flashcard-word-drawer__options');
    const empty=document.createElement('p');empty.className='flashcard-word-drawer__empty';empty.textContent='No matching words';empty.hidden=true;options.after(empty);
    const filter=()=>{const term=search.value.trim().toLocaleLowerCase();let found=0;for(const word of options.children){word.hidden=!word.textContent.toLocaleLowerCase().includes(term);if(!word.hidden)found++}empty.hidden=found>0};
    const observer=new MutationObserver(filter);observer.observe(options,{childList:true});search.addEventListener('input',filter,events);
    function close(focus=false){if(drawer.matches(':popover-open'))drawer.hidePopover();drawer.hidden=true;launch.setAttribute('aria-expanded','false');if(focus&&m.isConnected)button.focus({preventScroll:true})}
    function openSettings(){close();settings.hidden=false;button.setAttribute('aria-expanded','true');m.classList.add('has-tile-settings-open');m._positionTileSettings?.()}
    button.addEventListener('click',()=>{if(settings.hidden)openSettings();else{settings.hidden=true;button.setAttribute('aria-expanded','false');m.classList.remove('has-tile-settings-open')}},events);
    launch.addEventListener('click',()=>{
      settings.hidden=true;button.setAttribute('aria-expanded','false');m.classList.remove('has-tile-settings-open');
      document.dispatchEvent(new CustomEvent('teachertiles:word-drawer-open',{detail:m}));
      render();search.value='';filter();options.scrollTop=0;drawer.hidden=false;drawer.showPopover();launch.setAttribute('aria-expanded','true');search.focus({preventScroll:true});
    },events);
    back.addEventListener('click',()=>{openSettings();launch.focus({preventScroll:true})},events);
    closeButton.addEventListener('click',()=>close(true),events);
    drawer.addEventListener('wheel',e=>e.stopPropagation(),{...events,passive:true});
    drawer.addEventListener('pointerdown',e=>e.stopPropagation(),events);
    drawer.addEventListener('click',e=>{
      const word=e.target.closest('[aria-pressed]'),bulk=e.target.closest('[class$="-enable-all"],[class$="-disable-all"]');
      if(!word&&!bulk)return;const name=word?.textContent;
      queueMicrotask(()=>{filter();if(word&&e.detail===0)[...options.children].find(el=>el.textContent===name)?.focus({preventScroll:true});notifyBoardChanged('flashcard-word-selection')});
    },events);
    document.addEventListener('pointerdown',e=>{if(!drawer.hidden&&!drawer.contains(e.target)&&!launch.contains(e.target))close()},events);
    document.addEventListener('keydown',e=>{if(!drawer.hidden&&e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true)}},events);
    document.addEventListener('teachertiles:word-drawer-open',e=>{if(e.detail!==m)close()},events);
    const deactivate=m._deactivate;m._deactivate=()=>{close();deactivate?.()};
    const cleanup=m._cleanup;m._cleanup=()=>{close();life.abort();observer.disconnect();cleanup?.()};
  };
})();
