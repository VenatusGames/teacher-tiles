import {gradeOptions} from './tile-catalog.js?v=20261012-badges';
const menu=window.TeacherTilesTileMenu;
if(menu){
 const trigger=menu.element.querySelector('.context-menu__filter-toggle');
 const panel=document.createElement('div');panel.id='tile-filter-panel';panel.className='tile-filter-panel';panel.setAttribute('popover','auto');panel.setAttribute('aria-label','Filter tiles');
 panel.innerHTML='<header><strong>Filter Tiles</strong><button type="button" data-clear>Clear</button></header><label>Grade Level<select aria-label="Grade Level"></select></label><div class="tile-filter-coming"><span>Use-Case</span><small>Coming Soon</small></div>';
 const select=panel.querySelector('select');select.add(new Option('All Grade Levels',''));for(const grade of gradeOptions)select.add(new Option(grade.label,grade.id));
 menu.element.append(panel);let grade='';
 window.TeacherTilesTileFilters=Object.freeze({get active(){return Boolean(grade);},matches(item){return !grade||(item.dataset.gradeLevels||'').split(/\s+/).includes(grade);}});
 function position(){const r=trigger.getBoundingClientRect();panel.style.left=Math.max(8,Math.min(r.right-panel.offsetWidth,innerWidth-panel.offsetWidth-8))+'px';panel.style.top=Math.max(8,Math.min(r.bottom+8,innerHeight-panel.offsetHeight-8))+'px';}
 function update(){grade=select.value;trigger.classList.toggle('is-active',Boolean(grade));trigger.title=grade?'Filter: '+gradeOptions.find(g=>g.id===grade).label:'Filter tiles';panel.querySelector('[data-clear]').disabled=!grade;menu.refresh();}
 function close(){if(panel.matches(':popover-open'))panel.hidePopover();}
 trigger.addEventListener('click',event=>{event.stopPropagation();if(panel.matches(':popover-open'))close();else{panel.showPopover();position();select.focus();}});
 panel.addEventListener('toggle',()=>trigger.setAttribute('aria-expanded',String(panel.matches(':popover-open'))));
 panel.addEventListener('pointerdown',event=>event.stopPropagation());
 panel.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();close();trigger.focus();}});
 select.addEventListener('change',update);panel.querySelector('[data-clear]').onclick=()=>{select.value='';update();select.focus();};
 window.addEventListener('resize',()=>{if(panel.matches(':popover-open'))position();});
 new MutationObserver(()=>{if(!menu.element.classList.contains('is-open'))close();}).observe(menu.element,{attributes:true,attributeFilter:['class']});
 menu.element.querySelector('.context-menu__title-row').addEventListener('pointerdown',event=>{if(!event.target.closest('button'))close();});
 update();
}
