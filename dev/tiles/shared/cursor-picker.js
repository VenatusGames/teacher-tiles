(()=>{'use strict';
function create({panel,catalog,packs,owned,active,apply,unlock}){
  let view='all',query='',ownedOnly=false,favorites=new Set(),opened=null;
  const key='teacherTilesCursorFavorites',controls=window.TeacherTilesCollectionControls;
  const readFavorites=()=>{try{favorites=new Set(JSON.parse(localStorage.getItem(key)||'[]'))}catch{favorites=new Set()}};readFavorites();
  const lock='<img src="assets/ui/lock.svg?v=20260927-gold" alt="">';
  panel.innerHTML='<div class="cursor-picker"><div class="cursor-picker-views"><button type="button" data-view="all" aria-pressed="true">All Cursors</button><button type="button" data-view="favorites" aria-pressed="false">Favorites</button></div><label class="cursor-picker-search-field"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input class="cursor-picker-search" type="search" aria-label="Search cursors" placeholder="Search cursors or packs…"></label><div class="cursor-picker-filters"><span role="status" aria-live="polite"></span><label>Owned Only <input type="checkbox" role="switch" aria-label="Owned cursors only"><i aria-hidden="true"></i></label></div><div class="cursor-picker-results"><div class="cursor-pack-grid"></div><div class="cursor-favorites-grid" hidden></div><p class="cursor-picker-empty" hidden></p></div></div>';
  const root=panel.querySelector('.cursor-picker'),results=root.querySelector('.cursor-picker-results'),status=root.querySelector('[role="status"]');
  const packGrid=root.querySelector('.cursor-pack-grid'),favoriteGrid=root.querySelector('.cursor-favorites-grid'),empty=root.querySelector('.cursor-picker-empty');
  const fan=document.createElement('div');fan.className='cursor-pack-fan';fan.id='cursor-pack-options';fan.setAttribute('popover','manual');fan.setAttribute('role','dialog');fan.setAttribute('aria-labelledby','cursor-pack-title');
  fan.innerHTML='<header><div><small>EXPLORE THE PACK</small><h3 id="cursor-pack-title"></h3></div><button type="button" class="cursor-pack-close" aria-label="Close cursor pack"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><div class="cursor-pack-options"></div><button type="button" class="cursor-pack-unlock" hidden>'+lock+'Unlock Pack</button>';
  root.append(fan);const stage=fan.querySelector('.cursor-pack-options'),unlockButton=fan.querySelector('.cursor-pack-unlock');
  function syncChildren(parent,children){for(const child of [...parent.children])if(!children.includes(child))child.remove();children.forEach((node,i)=>{if(parent.children[i]!==node)parent.insertBefore(node,parent.children[i]||null)})}
  function close(restoreFocus=false){if(!opened)return;const heading=opened.heading;heading.setAttribute('aria-expanded','false');opened=null;fan.hidePopover();stage.replaceChildren();if(restoreFocus)heading.focus({preventScroll:true})}
  function position(){
    if(!opened)return;
    const shelf=panel.closest('.asset-shelf__shell').getBoundingClientRect(),anchor=opened.heading.getBoundingClientRect(),right=innerWidth-shelf.right-28;
    const beside=right>=300,width=Math.min(480,beside?right:innerWidth-32);
    fan.style.width=width+'px';fan.style.left=(beside?shelf.right+14:Math.max(16,(innerWidth-width)/2))+'px';
    fan.style.top=Math.max(16,Math.min(beside?anchor.top:72,innerHeight-fan.offsetHeight-16))+'px';
  }
  function open(group){if(opened===group){close(true);return}close();opened=group;group.heading.setAttribute('aria-expanded','true');fan.querySelector('h3').textContent=group.pack.name;render();fan.showPopover();position();stage.querySelector('button')?.focus({preventScroll:true})}
  fan.querySelector('.cursor-pack-close').onclick=()=>close(true);unlockButton.onclick=()=>{if(opened)unlock(opened.pack.productId)};
  const groups=packs.map(pack=>{
    const section=document.createElement('section');section.className='cursor-picker-pack';
    const heading=document.createElement('button');heading.type='button';heading.className='cursor-picker-pack-heading';heading.setAttribute('aria-expanded','false');heading.setAttribute('aria-controls',fan.id);
    heading.innerHTML='<span class="cursor-pack-preview" aria-hidden="true"></span><span class="cursor-pack-label"><strong></strong><small></small></span><span class="cursor-picker-lock" aria-hidden="true"><span>'+lock+'Unlock</span></span>';
    heading.querySelector('strong').textContent=pack.name;
    if(pack.holiday){const holiday=document.createElement('span');holiday.className='holiday-badge';holiday.textContent='Holiday';holiday.title=pack.holiday==='thanksgiving'?'Thanksgiving':'Halloween';heading.querySelector('.cursor-pack-label').append(holiday)}
    const members=catalog.filter(c=>c.productId===pack.productId),preview=heading.querySelector('.cursor-pack-preview');
    // Reuse the shop's actual cursor artwork, without cloning shop controls or animation layers.
    const source=pack.productId?document.querySelector(`[data-shop-product="${CSS.escape(pack.productId)}"] .shop-product__preview`):null;
    const sources=source?[...source.querySelectorAll('img')]:[];
    if(source){
      const art=source.cloneNode(false);art.removeAttribute('id');art.classList.add('cursor-shop-preview');
      for(const original of sources){const image=original.cloneNode(true);image.removeAttribute('id');image.loading='lazy';image.decoding='async';image.draggable=false;art.append(image)}
      preview.append(art);
      const resize=new ResizeObserver(()=>preview.style.setProperty('--pack-art-scale',String(preview.clientWidth/300)));resize.observe(preview);
    }else{
      const image=document.createElement('img');image.src='assets/cursors/default-normal.png';image.alt='';image.style.setProperty('--sample',0);preview.append(image);
    }
    const cells=members.map(cursor=>{
      const cell=document.createElement('div');cell.className='cursor-picker-cell';
      const choice=document.createElement('button');choice.type='button';choice.className='cursor-picker-choice';choice.dataset.cursorChoice=cursor.id;
      const art=document.createElement('span');art.className='cursor-picker-art';const img=document.createElement('img');const display=sources.find(image=>{const name=image.getAttribute('src').split('/').pop().split('?')[0];return name===cursor.id+'-normal-preview.png'||name===cursor.id+'-preview.png'||name===cursor.id+'-normal.png'});
      img.src=pack.productId==='cursor-color-pack'?`assets/cursors/display/${cursor.id}-normal.svg?v=20261029`:display?.getAttribute('src')||`assets/cursors/${cursor.id}-normal.png?v=${cursor.assetVersion||'20260927-packs'}`;img.alt='';img.draggable=false;img.loading='lazy';img.decoding='async';if(cursor.id.startsWith('pixel-'))img.className='is-pixel-art';art.append(img);
      const label=document.createElement('span');label.className='cursor-picker-name';label.textContent=cursor.name;
      const detail=document.createElement('small');choice.append(art,label,detail);choice.onclick=()=>owned(pack.productId)?apply(cursor.id):unlock(pack.productId);
      const favorite=controls.favoriteButton(cursor.name,favorites.has(cursor.id),()=>{
        favorites.has(cursor.id)?favorites.delete(cursor.id):favorites.add(cursor.id);
        const value=JSON.stringify([...favorites]);try{if(window.TeacherTilesCollectionPreferences)window.TeacherTilesCollectionPreferences.write(key,value);else localStorage.setItem(key,value)}catch{}
        render();if(!cell.isConnected)root.querySelector('[data-view="favorites"]').focus({preventScroll:true});
      });favorite.classList.add('cursor-picker-favorite');cell.append(choice,favorite);
      return {cursor,cell,choice,detail,favorite,text:(pack.name+' '+cursor.name+' '+(pack.holiday||'')).toLowerCase(),show:true};
    });
    section.append(heading);packGrid.append(section);const group={pack,section,heading,cells,count:heading.querySelector('small')};heading.onclick=()=>open(group);return group;
  });
  function render(){
    const selected=active(),visibleFavorites=[];let total=0,packCount=0;
    for(const group of groups){
      const {pack,section,heading,count,cells}=group,accessible=owned(pack.productId);let matches=0;
      for(const item of cells){
        const {cursor,choice,detail,favorite,text}=item;
        item.show=(!ownedOnly||accessible)&&(!query||text.includes(query));if(item.show)matches++;
        if(item.show&&favorites.has(cursor.id))visibleFavorites.push(item.cell);
        const equipped=selected===cursor.id;choice.setAttribute('aria-pressed',String(equipped));choice.setAttribute('aria-label',(accessible?'Use ':'Unlock ')+pack.name+' '+cursor.name);choice.classList.toggle('is-cosmetic-locked',!accessible);
        detail.textContent=equipped?'Equipped':accessible?'Apply Cursor':'Unlock Pack';controls.updateFavorite(favorite,cursor.name,favorites.has(cursor.id));
      }
      section.hidden=!matches;if(matches)packCount++;total+=matches;count.textContent=matches+(matches===1?' cursor':' cursors');
      heading.classList.toggle('is-cursor-pack-locked',!accessible);heading.classList.toggle('has-selected-cursor',cells.some(item=>item.cursor.id===selected));heading.setAttribute('aria-label','Open '+pack.name+' pack'+(accessible?'':' (locked)'));
    }
    packGrid.hidden=view!=='all';favoriteGrid.hidden=view!=='favorites';
    if(opened&&(view!=='all'||opened.section.hidden))close();
    syncChildren(favoriteGrid,view==='favorites'?visibleFavorites:[]);
    if(opened){syncChildren(stage,opened.cells.filter(item=>item.show).map(item=>item.cell));unlockButton.hidden=owned(opened.pack.productId);position()}
    const shown=view==='favorites'?visibleFavorites.length:total;status.textContent=view==='favorites'?`${shown} favorite${shown===1?'':'s'}`:`${packCount} pack${packCount===1?'':'s'} · ${total} cursor${total===1?'':'s'}`;
    empty.hidden=shown>0;empty.textContent=view==='favorites'?'Favorite a cursor inside a pack to keep it here.':'No matching cursors.';
  }
  root.querySelector('.cursor-picker-search').oninput=e=>{query=e.target.value.trim().toLowerCase();render()};root.querySelector('[role="switch"]').onchange=e=>{ownedOnly=e.target.checked;render()};
  root.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{close();view=button.dataset.view;root.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));render();results.scrollTop=0});
  document.addEventListener('pointerdown',event=>{if(opened&&!fan.contains(event.target)&&!opened.heading.contains(event.target))close()});
  fan.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();close(true)}});
  results.addEventListener('scroll',()=>close(),{passive:true});window.addEventListener('resize',position);
  window.addEventListener('teachertiles:collectionpreferences',()=>{readFavorites();render()});
  return {render,close};
}
window.TeacherTilesCursorPicker=Object.freeze({create});})();
