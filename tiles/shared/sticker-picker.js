/* The shelf's existing catalog remains the source of sticker and entitlement data. */
window.createStickerPicker=function({panel,packs,search,clear,status,shell,bindDrag,owns,require:requestAccess,entitlement,place}){
  const storageKey='teachertiles.sticker-favorites.v1';
  const readFavorites=()=>{try{const value=JSON.parse(localStorage.getItem(storageKey)||'[]');return new Set(Array.isArray(value)?value.filter(v=>typeof v==='string'):[])}catch{return new Set()}};
  let favorites=readFavorites(),view='all',category='all',packFilter='',available=false;
  const normalize=value=>String(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
  const categories=[['all','◉','All'],['faces','☺','Faces'],['nature','❀','Nature'],['food','◒','Food'],['hearts','♡','Hearts'],['learning','Aa','School'],['flags','⚑','Flags'],['characters','✦','Characters']];
  const catalog=packs.map(pack=>{
    const drawer=document.getElementById(pack.getAttribute('aria-controls'));
    const id=pack.id,name=pack.querySelector('strong')?.textContent||'Stickers';
    const group=/heart/.test(id)?'hearts':/flag/.test(id)?'flags':/food/.test(id)?'food':/nature|weather|animal/.test(id)?'nature':/face|emoji-sticker/.test(id)?'faces':/critter|character/.test(id)?'characters':'learning';
    return {id,name,category:group,items:[...drawer.querySelectorAll('.sticker-shelf-item')].map(source=>({source,key:source.dataset.stickerSrc||source.dataset.stickerEmoji,name:source.dataset.stickerName||'Sticker',product:entitlement(source),text:normalize([name,source.dataset.stickerName,source.dataset.stickerTags].join(' '))}))};
  });
  panel.querySelector('.asset-shelf__scroll').hidden=true;
  const root=document.createElement('div');root.className='sticker-picker';
  root.innerHTML=`<div class="sticker-picker-views" aria-label="Sticker collection"><button type="button" data-view="all">All stickers</button><button type="button" data-view="favorites">♡ Favorites <span></span></button></div><nav class="sticker-picker-categories" aria-label="Sticker categories"></nav><div class="sticker-picker-filters"><select aria-label="Filter sticker pack"><option value="">Every pack</option></select><label><input type="checkbox"> Owned only</label></div><div class="sticker-picker-results" tabindex="-1" aria-label="Stickers"></div><footer><strong>Make it yours</strong><span>Click to add · Drag to place · ☆ to favorite</span></footer>`;
  panel.append(root);
  const results=root.querySelector('.sticker-picker-results'),select=root.querySelector('select'),footer=root.querySelector('footer strong');
  for(const [id,icon,label] of categories){const button=document.createElement('button');button.type='button';button.dataset.category=id;button.innerHTML=`<span aria-hidden="true">${icon}</span><small>${label}</small>`;button.addEventListener('click',()=>{category=id;packFilter='';select.value='';render();results.scrollTop=0});root.querySelector('nav').append(button)}
  for(const pack of catalog){const option=new Option(pack.name,pack.id);select.add(option)}
  select.addEventListener('change',()=>{packFilter=select.value;category='all';render();results.scrollTop=0});
  root.querySelector('input').addEventListener('change',e=>{available=e.target.checked;render()});
  root.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{view=button.dataset.view;render();results.scrollTop=0}));
  function render(){
    const terms=normalize(search.value).trim().split(/\s+/).filter(Boolean);
    clear.hidden=!search.value;
    root.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
    root.querySelector('[data-view="favorites"] span').textContent=favorites.size||'';
    root.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===category)));
    const fragment=document.createDocumentFragment();let count=0;
    for(const pack of catalog){
      if(category!=='all'&&pack.category!==category||packFilter&&pack.id!==packFilter)continue;
      const items=pack.items.filter(item=>(view!=='favorites'||favorites.has(item.key))&&(!available||owns(item.product))&&terms.every(term=>item.text.includes(term)));
      if(!items.length)continue;
      count+=items.length;
      const section=document.createElement('section'),heading=document.createElement('h3'),grid=document.createElement('div');
      heading.textContent=pack.name;const total=document.createElement('span');total.textContent=items.length;heading.append(total);grid.className='sticker-picker-grid';section.append(heading,grid);
      for(const item of items){
        const cell=document.createElement('div');cell.className='sticker-picker-cell';
        const button=item.source.cloneNode(true);delete button.dataset.stickerDragReady;button.removeAttribute('id');button.classList.remove('is-search-hidden','is-dragging');button.dataset.entitlement=item.product;button.classList.toggle('is-cosmetic-locked',!owns(item.product));button.querySelectorAll('.subscription-crown').forEach(el=>el.remove());button.setAttribute('aria-label',`${owns(item.product)?'Add':'Unlock'} ${item.name}`);button.title=item.name;button.tabIndex=0;
        bindDrag(button,shell);
        button.addEventListener('click',e=>{if(performance.now()<(button._stickerDragUntil||0))return;if(!owns(item.product)){if(e.detail===0)requestAccess(button);return}const image=button.querySelector('img'),rect=shell.getBoundingClientRect();place({src:button.dataset.stickerSrc||'',emoji:button.dataset.stickerEmoji||'',name:item.name,aspect:image?.naturalWidth&&image?.naturalHeight?image.naturalWidth/image.naturalHeight:1},Math.min(innerWidth-80,rect.right+(innerWidth-rect.right)/2),innerHeight/2);footer.textContent=`${item.name} added`});
        button.addEventListener('pointerenter',()=>footer.textContent=item.name);button.addEventListener('focus',()=>footer.textContent=item.name);
        const favorite=document.createElement('button');favorite.type='button';favorite.className='sticker-picker-favorite';
        const sync=()=>{const saved=favorites.has(item.key);favorite.textContent=saved?'★':'☆';favorite.setAttribute('aria-pressed',String(saved));favorite.setAttribute('aria-label',`${saved?'Unfavorite':'Favorite'} ${item.name}`)};sync();
        favorite.addEventListener('click',()=>{favorites.has(item.key)?favorites.delete(item.key):favorites.add(item.key);try{localStorage.setItem(storageKey,JSON.stringify([...favorites]))}catch{}sync();root.querySelector('[data-view="favorites"] span').textContent=favorites.size||'';if(view==='favorites'){render();root.querySelector('[data-view="favorites"]').focus()}});
        cell.append(button,favorite);grid.append(cell);
      }
      fragment.append(section);
    }
    results.replaceChildren(fragment);
    status.textContent=`${count} sticker${count===1?'':'s'}${view==='favorites'?' in favorites':''}`;
    if(!count){const empty=document.createElement('div');empty.className='sticker-picker-empty';const title=document.createElement('strong');title.textContent=view==='favorites'&&!favorites.size?'Your favorites belong here':'No stickers found';const hint=document.createElement('p');hint.textContent=view==='favorites'&&!favorites.size?'Tap the star on any sticker to keep it close.':'Try a different search or clear your filters.';const reset=document.createElement('button');reset.type='button';reset.textContent='Browse all stickers';reset.onclick=()=>{view='all';category='all';packFilter='';available=false;select.value='';search.value='';root.querySelector('input').checked=false;render()};empty.append(title,hint,reset);results.append(empty)}
  }
  results.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)||!e.target.matches('.sticker-shelf-item'))return;const buttons=[...results.querySelectorAll('.sticker-shelf-item')],index=buttons.indexOf(e.target),columns=getComputedStyle(e.target.parentElement.parentElement).gridTemplateColumns.split(' ').length;const offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-columns,ArrowDown:columns}[e.key];buttons[Math.max(0,Math.min(buttons.length-1,index+offset))]?.focus();e.preventDefault()});
  window.addEventListener('storage',e=>{if(e.key===storageKey){favorites=readFavorites();render()}});
  for(const event of ['teachertiles:shopownershipchange','teachertiles:accountchange'])window.addEventListener(event,render);
  render();return {render};
};
