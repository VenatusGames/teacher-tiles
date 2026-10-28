// Keep the select as the panel's value/change source; present a styled menu.
export function createUserSort(select){
 const button=document.createElement('button');button.type='button';button.className='quiet users-sort-toggle';button.setAttribute('aria-haspopup','menu');button.setAttribute('aria-expanded','false');
 button.innerHTML='<svg class="users-sort-symbol" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h11M4 18h6"/></svg><span></span><svg class="users-sort-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4"/></svg>';
 const menu=document.createElement('div');menu.id='users-sort-menu';menu.className='users-sort-menu';menu.setAttribute('popover','auto');menu.setAttribute('role','menu');menu.setAttribute('aria-label','Sort users');
 const heading=document.createElement('p');heading.textContent='Sort Users';menu.append(heading);
 const choices=[...select.options].map(option=>{
  const item=document.createElement('button');item.type='button';item.setAttribute('role','menuitemradio');item.dataset.value=option.value;item.innerHTML='<span></span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 4 4 8-8"/></svg>';item.querySelector('span').textContent=option.textContent;
  item.onclick=()=>{const changed=select.value!==option.value;select.value=option.value;sync();menu.hidePopover();button.focus();if(changed)select.dispatchEvent(new Event('change',{bubbles:true}));};menu.append(item);return item;
 });
 button.popoverTargetElement=menu;select.after(button,menu);
 function sync(){const label=select.selectedOptions[0]?.textContent||'Default Order';button.querySelector('span').textContent=label;button.setAttribute('aria-label','Sort by: '+label);choices.forEach(item=>item.setAttribute('aria-checked',String(item.dataset.value===select.value)));}
 function position(){const r=button.getBoundingClientRect();menu.style.left=Math.max(12,Math.min(r.left,innerWidth-menu.offsetWidth-12))+'px';menu.style.top=Math.max(12,Math.min(r.bottom+8,innerHeight-menu.offsetHeight-12))+'px';}
 const close=()=>{if(menu.matches(':popover-open'))menu.hidePopover();};
 menu.addEventListener('beforetoggle',event=>{if(event.newState==='open')queueMicrotask(()=>{if(menu.matches(':popover-open')){position();choices.find(item=>item.dataset.value===select.value)?.focus();}});});
 menu.addEventListener('toggle',()=>button.setAttribute('aria-expanded',String(menu.matches(':popover-open'))));
 button.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();if(!menu.matches(':popover-open'))button.click();else choices.find(item=>item.dataset.value===select.value)?.focus();}});
 menu.addEventListener('keydown',event=>{const index=choices.indexOf(document.activeElement);let next;if(event.key==='ArrowDown')next=(index+1)%choices.length;else if(event.key==='ArrowUp')next=(index-1+choices.length)%choices.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=choices.length-1;else if(event.key==='Tab'){close();return;}else return;event.preventDefault();choices[next].focus();});
 window.addEventListener('resize',close);window.addEventListener('scroll',event=>{if(!menu.contains(event.target))close();},true);select.addEventListener('change',sync);sync();
 return {reset(){close();sync();}};
}
