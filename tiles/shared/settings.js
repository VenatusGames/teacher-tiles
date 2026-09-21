(()=>{'use strict';
const cog='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 3-.6 3-2 1-2.8-1-2 3.5 2.2 2v2L1.6 16l2 3.5 2.8-1 2 1L9 22h4l.6-2.5 2-1 2.8 1 2-3.5-2.2-2.5v-2l2.2-2-2-3.5-2.8 1-2-1L13 3Z"/><circle cx="11" cy="12.5" r="3"/></svg>';
function setup(m,button){if(!button)return;button.innerHTML=cog;button.setAttribute('aria-label',button.getAttribute('aria-label')||'Tile settings');
const panel=m.querySelector('.tile-settings-panel,.collection-settings,.classmeter-settings,.highfrequency-settings');if(!panel||panel.dataset.settingsPositioned)return;panel.dataset.settingsPositioned='true';panel.classList.add('tile-settings-floating');panel.setAttribute('popover','manual');let frame=0;
const resetScale=m.querySelector('.tile-reset-scale');if(resetScale){resetScale.innerHTML='<span class="tile-reset-scale-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 3H3v5M3 3l6 6M16 21h5v-5m0 5-6-6M21 8V3h-5m5 0-6 6M3 16v5h5m-5 0 6-6"/></svg></span><span>Reset scale</span>';panel.append(resetScale);}
function hide(){cancelAnimationFrame(frame);if(panel.matches(':popover-open'))panel.hidePopover();}
function close(){panel.hidden=true;button.setAttribute('aria-expanded','false');m.classList.remove('has-tile-settings-open');hide()}
if(resetScale)resetScale.addEventListener('click',close);
function position(){cancelAnimationFrame(frame);if(panel.hidden||!m.isConnected){hide();return}const rect=button.getBoundingClientRect();const width=panel.offsetWidth,height=panel.offsetHeight;panel.style.setProperty('left',`${Math.max(8,Math.min(rect.left,innerWidth-width-8))}px`,'important');panel.style.setProperty('top',`${Math.max(8,Math.min(rect.top-height-8>=8?rect.top-height-8:rect.bottom+8,innerHeight-height-8))}px`,'important');frame=requestAnimationFrame(position)}
function sync(){if(panel.hidden){hide();return}if(!m.isConnected)return;if(!panel.matches(':popover-open'))panel.showPopover();position()}
const observer=new MutationObserver(sync);observer.observe(panel,{attributes:true,attributeFilter:['hidden']});
const outside=e=>{if(!panel.hidden&&!panel.contains(e.target)&&!button.contains(e.target))close()};const key=e=>{if(!panel.hidden&&e.key==='Escape'){e.stopPropagation();close();button.focus({preventScroll:true})}};
document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);panel.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
m._positionTileSettings=sync;sync();const deactivate=m._deactivate;m._deactivate=()=>{close();deactivate?.()};const cleanup=m._cleanup;m._cleanup=()=>{close();observer.disconnect();document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);cleanup?.()};
}
function ensure(m){
    if(m.dataset.type==='sticker')return;
    let settings=m.querySelector('.tile-settings-toggle,.collection-settings-toggle,.classmeter-settings-toggle,.highfrequency-settings-button');
    if(!settings){
      const wrap=document.createElement('div');wrap.className='tile-settings-wrap';
      settings=document.createElement('button');settings.type='button';settings.className='tile-settings-toggle';settings.title='Settings';settings.setAttribute('aria-expanded','false');
      const panel=document.createElement('div');panel.className='tile-settings-panel';panel.hidden=true;
      const heading=document.createElement('strong');heading.textContent='Tile settings';panel.append(heading);
      settings.addEventListener('click',event=>{event.stopPropagation();panel.hidden=!panel.hidden;settings.setAttribute('aria-expanded',String(!panel.hidden));m.classList.toggle('has-tile-settings-open',!panel.hidden);});
      wrap.append(settings,panel);m.append(wrap);
    }
    if(settings){
      if(settings.classList.contains('highfrequency-settings-button')){settings.textContent='⚙';settings.setAttribute('aria-label','Open settings');settings.title='Settings'}
      const anchor=settings.closest('.tile-settings-wrap,.collection-settings-wrap,.classmeter-settings-wrap')||settings;
      anchor.classList.add('tile-settings-beside-brush');m.appendChild(anchor);
      setup(m,settings);
    }

}
window.TeacherTilesSettings={setup,ensure};})();
