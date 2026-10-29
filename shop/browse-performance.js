/* Suspend hover-only work during a scroll gesture, then restore it at rest. */
(() => {
  const selector='.sticker-picker-results,.theme-picker-results,.shop-content';
  const timers=new WeakMap();
  document.addEventListener('scroll',event=>{
    const scroller=event.target;
    if(!(scroller instanceof Element)||!scroller.matches(selector))return;
    if(!timers.has(scroller))scroller.classList.add('is-browse-scrolling');
    clearTimeout(timers.get(scroller));
    timers.set(scroller,setTimeout(()=>{
      timers.delete(scroller);
      scroller.classList.remove('is-browse-scrolling');
    },160));
  },{capture:true,passive:true});
})();
