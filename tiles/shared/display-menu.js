(()=>{'use strict';
let pointerInteraction=true;
document.addEventListener('pointerdown',()=>{pointerInteraction=true;},{capture:true,passive:true});
document.addEventListener('keydown',()=>{pointerInteraction=false;},{capture:true});
let sequence=0;
function setup(m,{panel,title,icon}){
  panel.classList.add('tile-display-menu');panel.setAttribute('popover','auto');panel.setAttribute('role','dialog');panel.setAttribute('aria-label',title);panel.id='tile-display-menu-'+(++sequence);
  const heading=document.createElement('strong');heading.className='tile-display-menu-title';heading.textContent=title;panel.prepend(heading);
  const trigger=document.createElement('button');trigger.type='button';trigger.className='tile-display-toggle';trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls',panel.id);trigger.popoverTargetElement=panel;trigger.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+icon+'</svg><span>Display</span>';m.append(trigger);
  const closeButton=document.createElement('button');closeButton.type='button';closeButton.className='tile-display-menu-close';closeButton.setAttribute('aria-label','Close '+title.toLowerCase());closeButton.textContent='×';panel.prepend(closeButton);
  const open=()=>panel.matches(':popover-open');
  const close=()=>{if(open())panel.hidePopover();};
  function position(){if(!open())return;const r=trigger.getBoundingClientRect();panel.style.left=Math.max(8,Math.min(r.right-panel.offsetWidth,innerWidth-panel.offsetWidth-8))+'px';panel.style.top=Math.max(8,Math.min(r.top-panel.offsetHeight-8,innerHeight-panel.offsetHeight-8))+'px';}
  // Let the browser toggle its associated popover, including a second click to close.
  trigger.onclick=e=>e.stopPropagation();
  closeButton.onclick=()=>{close();trigger.focus({preventScroll:true});};
  panel.addEventListener('toggle',()=>{const visible=open();trigger.setAttribute('aria-expanded',String(visible));m.classList.toggle('tile-display-open',visible);if(!visible&&pointerInteraction&&document.activeElement===trigger)trigger.blur();position();});
  panel.addEventListener('pointerdown',e=>e.stopPropagation());panel.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
  panel.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){close();trigger.focus({preventScroll:true});}});
  const observer=new ResizeObserver(position);observer.observe(panel);observer.observe(trigger);
  window.addEventListener('resize',position);window.addEventListener('scroll',position,true);
  const prior=m._cleanup;m._cleanup=()=>{close();observer.disconnect();window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);prior?.();};
  return {trigger,close};
}
window.TeacherTilesDisplayMenu=Object.freeze({setup});
})();
