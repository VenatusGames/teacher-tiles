import {gradeOptions} from './tile-catalog.js?v=20261017-all-grades';
const menu=window.TeacherTilesTileMenu;
if(menu){
 const trigger=menu.element.querySelector('.context-menu__filter-toggle');
 const panel=document.createElement('div');panel.id='tile-filter-panel';panel.className='tile-filter-panel';panel.setAttribute('popover','auto');panel.setAttribute('aria-label','Filter tiles');
 panel.innerHTML='<header><strong>Filter Tiles</strong><button type="button" data-clear>Clear</button></header><section aria-labelledby="tile-filter-grade-heading"><div class="tile-filter-heading"><h3 id="tile-filter-grade-heading">Grade Level</h3><span data-count aria-live="polite"></span></div><p class="tile-filter-hint">Show tiles for any selected grade.</p><div class="tile-filter-grades" role="group" aria-label="Grade Levels"></div></section><div class="tile-filter-coming"><span>Use-Case</span><small>Coming Soon</small></div>';
 const grades=new Set(),gradeButtons=[];
 const group=panel.querySelector('.tile-filter-grades');
 // All Grades is a tile tag, not a grade users need to select.
 for(const grade of gradeOptions.filter(grade=>grade.id!=='all')){
  const button=document.createElement('button');button.type='button';button.className='tile-filter-grade';button.dataset.grade=grade.id;button.textContent=grade.label;button.setAttribute('aria-pressed','false');
  button.addEventListener('click',()=>{if(grades.has(grade.id))grades.delete(grade.id);else grades.add(grade.id);update();});
  group.append(button);gradeButtons.push(button);
 }
 menu.element.append(panel);
 window.TeacherTilesTileFilters=Object.freeze({get active(){return grades.size>0;},matches(item){return !grades.size||(item.dataset.gradeLevels||'').split(/\s+/).some(grade=>grade==='all'||grades.has(grade));}});
 function position(){const r=trigger.getBoundingClientRect();panel.style.left=Math.max(8,Math.min(r.right-panel.offsetWidth,innerWidth-panel.offsetWidth-8))+'px';panel.style.top=Math.max(8,Math.min(r.bottom+8,innerHeight-panel.offsetHeight-8))+'px';}
 function update(){
  const active=grades.size>0;trigger.classList.toggle('is-active',active);
  trigger.title=active?'Filtering: '+gradeOptions.filter(g=>grades.has(g.id)).map(g=>g.label).join(', '):'Filter tiles';
  panel.querySelector('[data-clear]').disabled=!active;panel.querySelector('[data-count]').textContent=active?grades.size+' selected':'All grades';
  for(const button of gradeButtons)button.setAttribute('aria-pressed',String(grades.has(button.dataset.grade)));
  menu.refresh();
 }
 function close(){if(panel.matches(':popover-open'))panel.hidePopover();}
 trigger.addEventListener('click',event=>{event.stopPropagation();if(panel.matches(':popover-open'))close();else{panel.showPopover();position();gradeButtons[0].focus();}});
 panel.addEventListener('toggle',()=>trigger.setAttribute('aria-expanded',String(panel.matches(':popover-open'))));
 panel.addEventListener('pointerdown',event=>event.stopPropagation());
 panel.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();close();trigger.focus();}});
 panel.querySelector('[data-clear]').onclick=()=>{grades.clear();update();gradeButtons[0].focus();};
 window.addEventListener('resize',()=>{if(panel.matches(':popover-open'))position();});
 new MutationObserver(()=>{if(!menu.element.classList.contains('is-open'))close();}).observe(menu.element,{attributes:true,attributeFilter:['class']});
 menu.element.querySelector('.context-menu__title-row').addEventListener('pointerdown',event=>{if(!event.target.closest('button'))close();});
 update();
}
