(() => {
  'use strict';
  const configs={
    tenframes:{visual:'.tenframes-board',bottom:['.tenframes-controls']},
    timestables:{visual:'.times-grid',top:['.times-summary'],actions:['.times-hide','.times-reveal']},
    shapes:{visual:'.shapes-main',top:['.shapes-picker']},
    patternmaker:{visual:'.pattern-maker-board',top:['.pattern-maker-controls'],bottom:['.pattern-maker-palette','.pattern-maker-footer']},
    numberline:{visual:'.numberline-stage',bottom:['.numberline-controls']},
    hundredschart:{visual:'.hundreds-grid',bottom:['.hundreds-controls']},
    grapher:{visual:'.grapher-stage',bottom:['.grapher-equation-row','.grapher-point-row','.grapher-range-row']}
  };
  function setup(m){
    const config=configs[m.dataset.type];if(!config||m._mathControlsBound)return;
    m._mathControlsBound=true;m.classList.add('math-modern-tile');m.tabIndex=0;
    const visual=m.querySelector(config.visual);visual.classList.add('math-tile-visual');
    function group(selectors,before){
      const elements=selectors.map(selector=>m.querySelector(selector)).filter(Boolean);if(!elements.length)return;
      const row=document.createElement('div'),clip=document.createElement('div'),content=document.createElement('div');
      row.className='math-hover-group';clip.className='math-hover-clip';content.className='math-hover-content';
      m.insertBefore(row,before);row.append(clip);clip.append(content);content.append(...elements);
    }
    if(config.top)group(config.top,visual);
    if(config.bottom)group(config.bottom,visual.nextSibling);
    if(config.actions){
      const actions=document.createElement('div');actions.className='math-action-row';m.insertBefore(actions,visual.nextSibling);
      config.actions.forEach(selector=>actions.append(m.querySelector(selector)));group(['.math-action-row'],actions);
    }
    if(m.dataset.type==='grapher')m.querySelector('.grapher-point-row').append(m.querySelector('.grapher-clear-points'));
    m.querySelectorAll('.math-hover-group .primary').forEach(button=>{button.classList.remove('primary');button.classList.add('math-primary')});
    bindHover(m);
  }
  function bindHover(m,openClass='is-math-controls-open'){
    m.tabIndex=0;
    let hovered=false,dragging=false,keyboard=false;
    const controller=new AbortController(),options={signal:controller.signal};
    const refresh=()=>{
      const focus=document.activeElement,inside=m.contains(focus);
      const editing=inside&&focus.matches('input:not([type=checkbox]):not([type=radio]),textarea,[contenteditable=true]');
      m.classList.toggle(openClass,hovered||dragging||editing||(inside&&(keyboard||focus.matches(':focus-visible'))));
    };
    m.addEventListener('pointerenter',()=>{hovered=true;refresh()},options);
    m.addEventListener('pointerleave',()=>{
      hovered=false;
      const focus=document.activeElement;
      // Pointer-clicked controls must not hold the toolbar open after unhover.
      if(!keyboard&&m.contains(focus)&&focus.matches('button,select'))focus.blur();
      refresh();
    },options);
    m.addEventListener('pointerdown',()=>{keyboard=false;dragging=true;refresh()},{...options,capture:true});
    const release=()=>{if(dragging){dragging=false;refresh()}};
    window.addEventListener('pointerup',release,options);window.addEventListener('pointercancel',release,options);
    m.addEventListener('keydown',()=>{keyboard=true;refresh()},options);
    m.addEventListener('focusin',refresh,options);m.addEventListener('focusout',()=>queueMicrotask(refresh),options);
    document.addEventListener('pointerdown',event=>{
      if(m.contains(event.target))return;
      keyboard=false;if(m.contains(document.activeElement))document.activeElement.blur();refresh();
    },{...options,capture:true});
    const cleanup=m._cleanup;m._cleanup=()=>{controller.abort();cleanup?.()};
  }
  window.TeacherTilesMathControls=Object.freeze({setup,bindHover});
})();
