const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
export const productCategory=id=>id.startsWith('bundle-')?'Bundles':id.startsWith('profile-frame')?'Profile Cosmetics':id.startsWith('planner-')?'Planner Skins':id.startsWith('theme-')?'Themes':id.startsWith('sticker-')?'Stickers':id.startsWith('cursor-')?'Cursors':'Tile Skins';
const paths={Themes:'M4 4h16v16H4zM4 15l5-5 4 4 3-2 4 5',Stickers:'M14 21H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v7l-7 7Zm0 0v-7h7',Cursors:'m5 3 14 11-7 1-3 7-4-19Z','Tile Skins':'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z','Planner Skins':'M6 3h13v18H6zM3 7h5M3 12h5M3 17h5M11 7h5M11 11h5','Profile Cosmetics':'M3 3h18v18H3zM8 18c0-5 8-5 8 0M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6',Bundles:'m3 7 9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10M7 5l10 4'};
const normalize=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function createProductPicker({products,selected,sale=false,onChange,limit=sale?200:30}){
 const element=el('section','pm-picker');element.setAttribute('aria-label','Choose Products');
 element.innerHTML='<div class="pm-picker-heading"><h3>Choose Products</h3><span class="pm-picker-total"></span></div><div class="pm-picker-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><input type="search" placeholder="Search names, descriptions, or keywords…" aria-label="Search Products to Include"></div><div class="pm-picker-filters"><select aria-label="Filter Products by Category"><option value="">All Categories</option></select><button type="button" class="quiet" data-clear>Clear Filters</button></div><div class="pm-picker-views"><button type="button" data-view="all">Browse All</button><button type="button" data-view="selected"></button></div><p class="pm-picker-status" role="status" aria-live="polite"></p><div class="pm-picker-results"></div><div class="pm-picker-pagination"><button type="button" class="quiet" data-prev>← Previous</button><span></span><button type="button" class="quiet" data-next>Next →</button></div>';
 const search=element.querySelector('input'),category=element.querySelector('select'),results=element.querySelector('.pm-picker-results'),status=element.querySelector('.pm-picker-status'),total=element.querySelector('.pm-picker-total'),pager=element.querySelector('.pm-picker-pagination'),prev=element.querySelector('[data-prev]'),next=element.querySelector('[data-next]'),clear=element.querySelector('[data-clear]');
 const rows=products.map(p=>({...p,category:productCategory(p.id),keywords:normalize(`${p.name} ${p.id} ${p.description} ${p.tags||''} ${productCategory(p.id)}`)}));
 for(const name of [...new Set(rows.map(p=>p.category))].sort()){const option=el('option','',name);option.value=name;category.append(option)}
 let view='all',page=0;const pageSize=8;
 function summary(){total.textContent=`${selected.size} / ${limit} Selected`;element.querySelector('[data-view=selected]').textContent=`Selected (${selected.size})`;onChange?.(selected)}
 function draw(focusId){
  const terms=normalize(search.value).split(' ').filter(Boolean),matches=rows.filter(p=>(view!=='selected'||selected.has(p.id))&&(!category.value||category.value===p.category)&&terms.every(term=>p.keywords.includes(term)));
  const pages=Math.max(1,Math.ceil(matches.length/pageSize));page=Math.min(page,pages-1);const visible=matches.slice(page*pageSize,(page+1)*pageSize);
  results.replaceChildren();results.scrollTop=0;
  element.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
  clear.disabled=!search.value&&!category.value;
  status.textContent=matches.length?`${page*pageSize+1}–${page*pageSize+visible.length} of ${matches.length} ${view==='selected'?'Selected Products':'Products'}`:view==='selected'&&!selected.size?'No products selected. Browse or search to add products.':'No matching products. Try another search or clear your filters.';
  for(const p of visible){
   const chosen=selected.has(p.id),card=el('article','pm-pick-card');card.classList.toggle('is-selected',chosen);card.dataset.pickId=p.id;
   const top=el('div','pm-pick-top'),icon=el('span','pm-pick-icon');icon.dataset.category=p.category;icon.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="${paths[p.category]}"/></svg>`;
   const text=el('div','pm-pick-name');text.append(el('small','',p.category),el('strong','',p.name));top.append(icon,text);
   const description=el('p','pm-pick-description',p.description||p.name);description.title=p.description||p.name;
   const bottom=el('div','pm-pick-bottom'),toggle=el('button','pm-pick-add',chosen?'✓ Added':'+ Add');toggle.type='button';toggle.setAttribute('aria-pressed',String(chosen));toggle.setAttribute('aria-label',`${chosen?'Remove':'Add'} ${p.name}`);toggle.disabled=!chosen&&selected.size>=limit;
   toggle.onclick=()=>{if(chosen)selected.delete(p.id);else if(selected.size<limit)selected.set(p.id,sale?Math.max(1,Math.floor(p.price*.8)):true);summary();draw(p.id)};
   bottom.append(el('span','pm-pick-price',`${p.price.toLocaleString()} Coins`),toggle);card.append(top,description,bottom);
   if(sale&&chosen){const label=el('label','pm-pick-sale','Sale Price'),price=el('input');price.type='number';price.min=1;price.max=p.price-1;price.step=1;price.required=true;price.value=selected.get(p.id)||'';price.setAttribute('aria-label',`Sale Price: ${p.name}`);price.oninput=()=>{selected.set(p.id,Number(price.value));onChange?.(selected)};label.append(price,el('span','','Coins'));card.append(label)}
   results.append(card);
  }
  if(!visible.length)results.append(el('div','pm-picker-empty',view==='selected'&&!selected.size?'Your selected products will appear here.':'No Products Found'));
  prev.disabled=page===0;next.disabled=page===pages-1;pager.querySelector('span').textContent=`Page ${page+1} of ${pages}`;
  if(focusId){const card=[...results.children].find(c=>c.dataset.pickId===focusId);(card?.querySelector('button')||results.querySelector('button')||search).focus({preventScroll:true})}
 }
 search.oninput=category.onchange=()=>{page=0;draw()};
 search.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();page=0;draw()}};
 clear.onclick=()=>{search.value='';category.value='';page=0;draw();search.focus()};
 element.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;search.value='';category.value='';page=0;draw()});
 prev.onclick=()=>{page--;draw()};next.onclick=()=>{page++;draw()};summary();draw();
 return element;
}
