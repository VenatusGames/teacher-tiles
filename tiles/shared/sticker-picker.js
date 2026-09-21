/* The shelf's existing catalog remains the source of sticker and entitlement data. */
window.createStickerPicker=function({panel,packs,search,clear,status,shell,bindDrag,owns,require:requestAccess,entitlement,place}){
  const storageKey='teachertiles.sticker-favorites.v1';
  const readFavorites=()=>{try{const value=JSON.parse(localStorage.getItem(storageKey)||'[]');return new Set(Array.isArray(value)?value.filter(v=>typeof v==='string'):[])}catch{return new Set()}};
  let favorites=readFavorites(),view='all',available=false;
  const collapsed=new Set();
  const packCache=new Map();
  let scheduledRender=0;
  const usageKey='teachertiles.sticker-usage.v1';
  const readUsage=()=>{try{const data=JSON.parse(localStorage.getItem(usageKey)||'{}');return Object.fromEntries(Object.entries(data||{}).filter(([key,value])=>typeof key==='string'&&Number.isSafeInteger(value)&&value>0))}catch{return {}}};
  let usage=readUsage();
  const normalize=value=>String(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
  const catalog=packs.map(pack=>{
    const drawer=document.getElementById(pack.getAttribute('aria-controls'));
    const id=pack.id,name=pack.querySelector('strong')?.textContent||'Stickers';
    return {id,name,items:[...drawer.querySelectorAll('.sticker-shelf-item')].map(source=>({source,key:source.dataset.stickerSrc||source.dataset.stickerEmoji,name:source.dataset.stickerName||'Sticker',product:entitlement(source),text:normalize([name,source.dataset.stickerName,source.dataset.stickerTags].join(' '))}))};
  });
  panel.querySelector('.asset-shelf__scroll').hidden=true;
  const root=document.createElement('div');root.className='sticker-picker';
  root.innerHTML=`<div class="sticker-picker-views" aria-label="Sticker collection"><button type="button" data-view="all">All stickers</button><button type="button" data-view="favorites">♡ Favorites <span></span></button></div><div class="sticker-picker-filters"><label class="sticker-picker-owned"><span>Owned only</span><input type="checkbox" role="switch" aria-label="Owned only"><i aria-hidden="true"></i></label></div><div class="sticker-picker-results" tabindex="-1" aria-label="Stickers"></div><footer><strong>Make it yours</strong><span>Click to add · Drag to place · ☆ to favorite</span></footer>`;
  panel.append(root);
  const views=root.querySelector('.sticker-picker-views'),filters=root.querySelector('.sticker-picker-filters'),ownedInput=filters.querySelector('input');
  const searchBox=search.closest('.sticker-shelf-search');
  searchBox.before(views);searchBox.after(filters);filters.prepend(status);
  const results=root.querySelector('.sticker-picker-results'),footer=root.querySelector('footer strong');
  ownedInput.addEventListener('change',e=>{available=e.target.checked;render()});
  views.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{view=button.dataset.view;render();results.scrollTop=0}));
  function render(){
    const access=new Map();
    const accessible=product=>{if(!access.has(product))access.set(product,owns(product));return access.get(product)};
    const terms=normalize(search.value).trim().split(/\s+/).filter(Boolean);
    clear.hidden=!search.value;
    views.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
    views.querySelector('[data-view="favorites"] span').textContent=favorites.size||'';
    const sections=[];let count=0;
    const seen=new Set();
    const mostUsed=catalog.flatMap(pack=>pack.items).filter(item=>{if(seen.has(item.key)||!usage[item.key]||!accessible(item.product))return false;seen.add(item.key);return true}).sort((a,b)=>usage[b.key]-usage[a.key]||a.name.localeCompare(b.name)).slice(0,10);
    const displayed=view==='all'?[{id:'most-used',name:'Most used',items:mostUsed},...catalog]:catalog;
    for(const pack of displayed){
      const items=pack.items.filter(item=>(view!=='favorites'||favorites.has(item.key))&&(!available||accessible(item.product))&&terms.every(term=>item.text.includes(term)));
      if(!items.length&&(pack.id!=='most-used'||terms.length))continue;
      if(pack.id!=='most-used')count+=items.length;
      const signature=JSON.stringify(items.map(item=>[item.key,favorites.has(item.key),accessible(item.product)]));
      const cached=packCache.get(pack.id);
      if(cached?.signature===signature){sections.push(cached.section);continue}
      const section=document.createElement('section'),heading=document.createElement('h3'),grid=document.createElement('div');
      section.className='sticker-picker-pack';
      const toggle=document.createElement('button'),name=document.createElement('span'),total=document.createElement('span'),chevron=document.createElement('span'),body=document.createElement('div'),clip=document.createElement('div');
      toggle.type='button';toggle.className='sticker-picker-pack-toggle';name.textContent=pack.name;total.textContent=items.length;total.className='sticker-picker-pack-count';chevron.textContent='⌄';chevron.className='sticker-picker-chevron';chevron.setAttribute('aria-hidden','true');toggle.append(name,total,chevron);heading.append(toggle);
      grid.className='sticker-picker-grid';body.className='sticker-picker-pack-body';body.id='picker-'+pack.id;clip.className='sticker-picker-pack-clip';clip.append(grid);body.append(clip);section.append(heading,body);toggle.setAttribute('aria-controls',body.id);
      const syncExpanded=()=>{const open=!collapsed.has(pack.id);toggle.setAttribute('aria-expanded',String(open));section.classList.toggle('is-collapsed',!open);body.inert=!open};syncExpanded();
      toggle.addEventListener('click',()=>{collapsed.has(pack.id)?collapsed.delete(pack.id):collapsed.add(pack.id);syncExpanded()});
      for(const item of items){
        const cell=document.createElement('div');cell.className='sticker-picker-cell';
        const button=item.source.cloneNode(true);delete button.dataset.stickerDragReady;button.removeAttribute('id');button.classList.remove('is-search-hidden','is-dragging','is-cosmetic-locked');button.dataset.entitlement=item.product;button.querySelectorAll('.subscription-crown,.subscription-access-crown').forEach(el=>el.remove());button.setAttribute('aria-label',`${accessible(item.product)?'Add':'Unlock'} ${item.name}`);button.title=item.name;button.tabIndex=0;
        bindDrag(button,shell);
        button.addEventListener('click',e=>{if(performance.now()<(button._stickerDragUntil||0))return;if(!owns(item.product)){if(e.detail===0)requestAccess(button);return}const image=button.querySelector('img'),rect=shell.getBoundingClientRect();place({src:button.dataset.stickerSrc||'',emoji:button.dataset.stickerEmoji||'',name:item.name,aspect:image?.naturalWidth&&image?.naturalHeight?image.naturalWidth/image.naturalHeight:1},Math.min(innerWidth-80,rect.right+(innerWidth-rect.right)/2),innerHeight/2,{previewSize:button.dataset.stickerEmoji?132:146});footer.textContent=`${item.name} added`});
        button.addEventListener('pointerenter',()=>footer.textContent=item.name);button.addEventListener('focus',()=>footer.textContent=item.name);
        const favorite=document.createElement('button');favorite.type='button';favorite.className='sticker-picker-favorite';
        const sync=()=>{const saved=favorites.has(item.key);favorite.textContent=saved?'★':'☆';favorite.setAttribute('aria-pressed',String(saved));favorite.setAttribute('aria-label',`${saved?'Unfavorite':'Favorite'} ${item.name}`)};sync();
        favorite.addEventListener('click',()=>{favorites.has(item.key)?favorites.delete(item.key):favorites.add(item.key);try{localStorage.setItem(storageKey,JSON.stringify([...favorites]))}catch{}sync();scheduleRender();views.querySelector('[data-view="favorites"] span').textContent=favorites.size||'';if(view==='favorites'){render();views.querySelector('[data-view="favorites"]').focus()}});
        cell.append(button,favorite);grid.append(cell);
      }
      if(pack.id==='most-used'){
        section.classList.add('sticker-picker-most-used');
        if(!items.length){const hint=document.createElement('p');hint.className='sticker-picker-usage-hint';hint.textContent='Your ten most-used stickers will appear here as you add them.';grid.append(hint)}
      }
      const locked=items.length>0&&items.every(item=>!accessible(item.product));
      if(locked){
        section.classList.add('is-pack-locked');grid.inert=true;
        const lock=document.createElement('button');lock.type='button';lock.className='sticker-picker-pack-lock';lock.dataset.entitlement=items[0].product;lock.setAttribute('aria-label','Unlock '+pack.name+' sticker pack');lock.innerHTML='<span>🔒 Unlock pack</span>';lock.addEventListener('click',()=>requestAccess(lock));section.append(lock);
        const badge=document.createElement('span');badge.className='sticker-picker-pack-lock-mark';badge.textContent='🔒';badge.setAttribute('aria-hidden','true');toggle.insertBefore(badge,total);
      }
      packCache.set(pack.id,{signature,section});
      sections.push(section);
    }
    // Reconcile in place: placement usually changes just the ten-item Most used pack.
    const wanted=new Set(sections);
    for(const child of [...results.children])if(!wanted.has(child))child.remove();
    sections.forEach((section,index)=>{if(results.children[index]!==section)results.insertBefore(section,results.children[index]||null)});
    status.textContent=`${count} sticker${count===1?'':'s'}${view==='favorites'?' in favorites':''}`;
    if(!count){const empty=document.createElement('div');empty.className='sticker-picker-empty';const title=document.createElement('strong');title.textContent=view==='favorites'&&!favorites.size?'Your favorites belong here':'No stickers found';const hint=document.createElement('p');hint.textContent=view==='favorites'&&!favorites.size?'Tap the star on any sticker to keep it close.':'Try a different search or clear your filters.';const reset=document.createElement('button');reset.type='button';reset.textContent='Browse all stickers';reset.onclick=()=>{view='all';available=false;search.value='';ownedInput.checked=false;render()};empty.append(title,hint,reset);results.append(empty)}
  }
  results.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)||!e.target.matches('.sticker-shelf-item'))return;const buttons=[...results.querySelectorAll('.sticker-picker-pack:not(.is-collapsed):not(.is-pack-locked) .sticker-shelf-item')],index=buttons.indexOf(e.target),columns=getComputedStyle(e.target.parentElement.parentElement).gridTemplateColumns.split(' ').length;const offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-columns,ArrowDown:columns}[e.key];buttons[Math.max(0,Math.min(buttons.length-1,index+offset))]?.focus();e.preventDefault()});
  window.addEventListener('storage',e=>{if(e.key===storageKey||e.key===usageKey){favorites=readFavorites();usage=readUsage();render()}});
  window.addEventListener('teachertiles:stickerplaced',e=>{
    const key=e.detail?.key;if(!key)return;
    usage=readUsage();usage[key]=Math.min(Number.MAX_SAFE_INTEGER,(usage[key]||0)+1);
    try{localStorage.setItem(usageKey,JSON.stringify(usage))}catch{}
    scheduleRender();
  });
  function scheduleRender(){
    if(scheduledRender)return;
    scheduledRender=requestAnimationFrame(()=>{scheduledRender=requestAnimationFrame(()=>{scheduledRender=0;if(!panel.hidden)render()})});
  }
  for(const event of ['teachertiles:shopownershipchange','teachertiles:accountchange'])window.addEventListener(event,scheduleRender);
  render();return {render};
};
