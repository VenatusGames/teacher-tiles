/* Shared editor artwork and menu previews; commands remain in each editor. */
(()=>{'use strict';
const paths={
 color:'<path d="m6 17 6-13 6 13M8 13h8"/>',
 highlight:'<path d="m9 15 8-10 4 4-10 8-2-2ZM9 15l-3 3 2 2 3-3M4 21h8"/>',
 clearHighlight:'<path d="m9 15 8-10 4 4-10 8-2-2M9 15l-3 3 2 2 3-3M3 3l18 18"/>',
 fill:'<path d="m4 12 8-8 8 8-8 8zM9 3l5 5M20 16s3 3 0 4c-3-1 0-4 0-4Z"/>',
 justifyLeft:'<path d="M4 5h16M4 10h10M4 15h16M4 20h10"/>',
 justifyCenter:'<path d="M4 5h16M7 10h10M4 15h16M7 20h10"/>',
 justifyRight:'<path d="M4 5h16M10 10h10M4 15h16M10 20h10"/>',
 justifyFull:'<path d="M4 5h16M4 10h16M4 15h16M4 20h16"/>',
 insertUnorderedList:'<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>',
 insertOrderedList:'<path d="M10 6h10M10 12h10M10 18h10M3 4h1v5M3 9h3M3 13c3-2 4 1 1 3l-1 2h3"/>',
 indent:'<path d="M4 5h16M11 10h9M11 15h9M4 20h16m0-11 4 3-4 3"/>',
 outdent:'<path d="M4 5h16M11 10h9M11 15h9M4 20h16M8 9l-4 3 4 3"/>',
 undo:'<path d="M4 5v6h6M4 11l4-4a7 7 0 1 1 1 12"/>',
 redo:'<path d="M20 5v6h-6M20 11l-4-4a7 7 0 1 0-1 12"/>',
 removeFormat:'<path d="M4 5h13M10 5l-3 14M4 19h5m5-5 6 6m0-6-6 6"/>',
 chevron:'<path d="m7 10 5 5 5-5"/>'
};
const icon=name=>'<svg class="tt-format-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||'')+'</svg>';
function optionPreview(button,kind,value){
 button.classList.add('tt-format-option');button.dataset.previewKind=kind;
 if(kind==='font')button.style.fontFamily='"'+value.replace(/["\\]/g,'')+'", sans-serif';
 if(kind==='block'){button.dataset.textStyle=value;button.style.setProperty('--preview-size',({p:14,h1:28,h2:23,h3:18,blockquote:16}[value]||14)+'px');}
}
function enhance(toolbar){
 toolbar.classList.add('tt-format-toolbar');toolbar.dataset.preserveTextEdit='true';
 toolbar.querySelectorAll('[data-format],[data-rich-command]').forEach(b=>{const key=b.dataset.format||b.dataset.richCommand;if(paths[key]){b.innerHTML=icon(key);b.classList.add('tt-format-button');}});
 for(const [selector,name]of [['.richtext-color','color'],['.richtext-highlight','highlight']]){const b=toolbar.querySelector(selector);if(!b)continue;b.querySelector('svg')?.remove();b.insertAdjacentHTML('afterbegin',icon(name));b.insertAdjacentHTML('beforeend',icon('chevron'));b.classList.add('tt-format-color');}
}
function sync(toolbar){
 for(const input of toolbar.querySelectorAll('.pres-object-color,.pres-highlight'))input.parentElement.style.setProperty('--format-color',input.value);
 toolbar.querySelectorAll('select').forEach(s=>s._formatControl?.sync());
}
function selectMenu(select,{kind,beforeOpen=()=>{},preview=()=>{}}={}){
 select.style.display='none';const trigger=document.createElement('button');trigger.type='button';trigger.className='tt-format-select pres-text-control';trigger.dataset.selectKind=kind;trigger.setAttribute('aria-label',select.getAttribute('aria-label'));trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
 const label=document.createElement('span');trigger.append(label);trigger.insertAdjacentHTML('beforeend',icon('chevron'));select.after(trigger);
 const menu=document.createElement('div');menu.className='tt-format-menu';menu.setAttribute('popover','auto');menu.dataset.menuKind=kind;menu.setAttribute('aria-label',select.getAttribute('aria-label'));select.parentElement.append(menu);
 const list=document.createElement('div');list.setAttribute('role','listbox');list.setAttribute('aria-label',select.getAttribute('aria-label'));
 let search=null;if(kind==='font'){search=document.createElement('input');search.type='search';search.placeholder='Search fonts';search.setAttribute('aria-label','Search fonts');menu.append(search);}menu.append(list);
 const sync=()=>{label.textContent=select.selectedOptions[0]?.textContent||'';list.querySelectorAll('[role=option]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.value===select.value)));};
 function render(){list.replaceChildren();const query=search?.value.trim().toLowerCase()||'';for(const child of select.children){const group=child.tagName==='OPTGROUP'?child:null,options=group?[...group.children]:[child],matches=options.filter(o=>o.textContent.toLowerCase().includes(query));if(!matches.length)continue;if(group){const h=document.createElement('div');h.className='tt-format-menu-label';h.textContent=group.label;list.append(h);}for(const option of matches){const b=document.createElement('button');b.type='button';b.textContent=option.textContent;b.dataset.value=option.value;b.setAttribute('role','option');optionPreview(b,kind,option.value);b.onpointerdown=e=>e.preventDefault();b.onpointerenter=()=>preview(option.value);b.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));sync();menu.hidePopover();};list.append(b);}}sync();}
 if(search)search.oninput=render;
 trigger.onclick=()=>{if(menu.matches(':popover-open')){menu.hidePopover();return;}beforeOpen();if(search)search.value='';render();menu.showPopover();const r=trigger.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(r.left,innerWidth-menu.offsetWidth-8))+'px';menu.style.top=Math.max(8,Math.min(r.bottom+6,innerHeight-menu.offsetHeight-8))+'px';(search||list.querySelector('[aria-selected=true]')||list.querySelector('button'))?.focus({preventScroll:true});};
 menu.addEventListener('toggle',()=>trigger.setAttribute('aria-expanded',String(menu.matches(':popover-open'))));
 menu.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();menu.hidePopover();trigger.focus();}if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const buttons=[...list.querySelectorAll('button')],i=buttons.indexOf(document.activeElement),next=e.key==='Home'?0:e.key==='End'?buttons.length-1:Math.max(0,Math.min(buttons.length-1,i+(e.key==='ArrowDown'?1:-1)));buttons[next]?.focus();}});
 select._formatControl={sync,close:()=>{if(menu.matches(':popover-open'))menu.hidePopover();}};sync();return select._formatControl;
}
window.TeacherTilesFormattingToolbar=Object.freeze({icon,enhance,sync,optionPreview,selectMenu});
})();
