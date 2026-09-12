(()=>{'use strict';
const cog='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 3-.6 3-2 1-2.8-1-2 3.5 2.2 2v2L1.6 16l2 3.5 2.8-1 2 1L9 22h4l.6-2.5 2-1 2.8 1 2-3.5-2.2-2.5v-2l2.2-2-2-3.5-2.8 1-2-1L13 3Z"/><circle cx="11" cy="12.5" r="3"/></svg>';
function setup(m,button){if(!button)return;button.innerHTML=cog;button.setAttribute('aria-label',button.getAttribute('aria-label')||'Tile settings');
const panel=m.querySelector('.tile-settings-panel,.collection-settings,.classmeter-settings,.highfrequency-settings');if(!panel||panel.dataset.settingsPositioned)return;panel.dataset.settingsPositioned='true';panel.classList.add('tile-settings-floating');panel.setAttribute('popover','manual');let frame=0;
function hide(){cancelAnimationFrame(frame);if(panel.matches(':popover-open'))panel.hidePopover();}
function close(){panel.hidden=true;button.setAttribute('aria-expanded','false');m.classList.remove('has-tile-settings-open');hide()}
function position(){cancelAnimationFrame(frame);if(panel.hidden||!m.isConnected){hide();return}const rect=button.getBoundingClientRect();const width=panel.offsetWidth,height=panel.offsetHeight;panel.style.setProperty('left',`${Math.max(8,Math.min(rect.left,innerWidth-width-8))}px`,'important');panel.style.setProperty('top',`${Math.max(8,Math.min(rect.top-height-8>=8?rect.top-height-8:rect.bottom+8,innerHeight-height-8))}px`,'important');frame=requestAnimationFrame(position)}
function sync(){if(panel.hidden){hide();return}if(!m.isConnected)return;if(!panel.matches(':popover-open'))panel.showPopover();position()}
const observer=new MutationObserver(sync);observer.observe(panel,{attributes:true,attributeFilter:['hidden']});
const outside=e=>{if(!panel.hidden&&!panel.contains(e.target)&&!button.contains(e.target))close()};const key=e=>{if(!panel.hidden&&e.key==='Escape'){e.stopPropagation();close();button.focus({preventScroll:true})}};
document.addEventListener('pointerdown',outside);panel.addEventListener('keydown',key);panel.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
m._positionTileSettings=sync;sync();const deactivate=m._deactivate;m._deactivate=()=>{close();deactivate?.()};const cleanup=m._cleanup;m._cleanup=()=>{close();observer.disconnect();document.removeEventListener('pointerdown',outside);panel.removeEventListener('keydown',key);cleanup?.()};
}
window.TeacherTilesSettings={setup};})();
