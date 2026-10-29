(()=>{'use strict';
function create({panel,catalog,packs,owned,active,apply,unlock}){
  let view='all',query='',ownedOnly=false,favorites=new Set();
  const key='teacherTilesCursorFavorites',controls=window.TeacherTilesCollectionControls;
  const readFavorites=()=>{try{favorites=new Set(JSON.parse(localStorage.getItem(key)||'[]'))}catch{favorites=new Set()}};readFavorites();
  panel.innerHTML='<div class="cursor-picker"><div class="cursor-picker-views"><button type="button" data-view="all" aria-pressed="true">All Cursors</button><button type="button" data-view="favorites" aria-pressed="false">Favorites <span></span></button></div><label class="cursor-picker-search-field"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input class="cursor-picker-search" type="search" aria-label="Search cursors" placeholder="Search cursors or packs…"></label><div class="cursor-picker-filters"><span role="status" aria-live="polite"></span><label>Owned Only <input type="checkbox" role="switch" aria-label="Owned cursors only"><i aria-hidden="true"></i></label></div><div class="cursor-picker-results"></div></div>';
  const results=panel.querySelector('.cursor-picker-results'),status=panel.querySelector('[role="status"]');
  const lock=()=>'<img src="assets/ui/lock.svg?v=20260927-gold" alt="">';
  const sections=[];
  for(const pack of packs){
    const section=document.createElement('section');section.className='cursor-picker-pack';
    const header=document.createElement('button');header.type='button';header.className='cursor-picker-pack-heading';header.setAttribute('aria-expanded','true');
    const name=document.createElement('strong');name.textContent=pack.name;header.append(name);
    if(pack.holiday){const holiday=document.createElement('span');holiday.className='holiday-badge';holiday.textContent='Holiday';holiday.title=pack.holiday==='thanksgiving'?'Thanksgiving':'Halloween';header.append(holiday)}
    const badge=document.createElement('span');badge.className='cursor-picker-lock';badge.innerHTML=lock();header.append(badge);
    const count=document.createElement('span');count.className='cursor-picker-pack-count';header.append(count);
    const arrow=document.createElement('span');arrow.className='cursor-picker-chevron';arrow.innerHTML='<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 7.5 5 5 5-5"/></svg>';header.append(arrow);
    const body=document.createElement('div');body.className='cursor-picker-pack-body';
    const grid=document.createElement('div');grid.className='cursor-picker-grid';const cells=[];
    for(const cursor of catalog.filter(c=>c.productId===pack.productId)){
      const cell=document.createElement('div');cell.className='cursor-picker-cell';
      const choice=document.createElement('button');choice.type='button';choice.className='cursor-picker-choice';choice.dataset.cursorChoice=cursor.id;
      const art=document.createElement('span');art.className='cursor-picker-art';
      const img=document.createElement('img');img.src=`assets/cursors/${cursor.id==='default'?'default':cursor.id}-normal.png?v=${cursor.assetVersion||'20260927-packs'}`;img.alt='';img.draggable=false;img.loading='lazy';img.decoding='async';if(cursor.id.startsWith('pixel-'))img.className='is-pixel-art';art.append(img);
      const label=document.createElement('span');label.className='cursor-picker-name';label.textContent=cursor.name;
      const detail=document.createElement('small');choice.append(art,label,detail);
      choice.onclick=()=>owned(pack.productId)?apply(cursor.id):unlock(pack.productId);
      const favorite=controls.favoriteButton(cursor.name,favorites.has(cursor.id),()=>{
        favorites.has(cursor.id)?favorites.delete(cursor.id):favorites.add(cursor.id);
        const value=JSON.stringify([...favorites]);try{if(window.TeacherTilesCollectionPreferences)window.TeacherTilesCollectionPreferences.write(key,value);else localStorage.setItem(key,value)}catch{}
        render();if(cell.hidden)panel.querySelector('[data-view="favorites"]').focus({preventScroll:true});
      });favorite.classList.add('cursor-picker-favorite');
      cell.append(choice,favorite);grid.append(cell);cells.push({cursor,cell,choice,detail,favorite,text:(pack.name+' '+cursor.name+' '+(pack.holiday||'')).toLowerCase()});
    }
    const cover=document.createElement('button');cover.type='button';cover.className='cursor-picker-unlock';cover.innerHTML='<span>'+lock()+'Unlock Pack</span>';cover.setAttribute('aria-label','Unlock '+pack.name);cover.onclick=()=>unlock(pack.productId);
    body.append(grid,cover);header.onclick=()=>{body.hidden=!body.hidden;header.setAttribute('aria-expanded',String(!body.hidden))};
    section.append(header,body);results.append(section);sections.push({pack,section,badge,count,cover,cells});
  }
  const empty=document.createElement('p');empty.className='cursor-picker-empty';results.append(empty);
  function render(){
    panel.querySelector('[data-view="favorites"] span').textContent=favorites.size||'';
    const selected=active();let total=0;
    for(const {pack,section,badge,count,cover,cells} of sections){
      const accessible=owned(pack.productId);let matches=0;badge.hidden=accessible;cover.hidden=accessible;
      for(const {cursor,cell,choice,detail,favorite,text} of cells){
        cell.hidden=(!accessible&&ownedOnly)||(view==='favorites'&&!favorites.has(cursor.id))||(query&&!text.includes(query));if(!cell.hidden)matches++;
        const equipped=selected===cursor.id;choice.setAttribute('aria-pressed',String(equipped));choice.setAttribute('aria-label',(accessible?'Use ':'Unlock ')+pack.name+' '+cursor.name);choice.classList.toggle('is-cosmetic-locked',!accessible);
        const caption=equipped?'Equipped':accessible?'Apply Cursor':'Unlock Pack';if(detail.textContent!==caption)detail.textContent=caption;
        controls.updateFavorite(favorite,cursor.name,favorites.has(cursor.id));
      }
      section.hidden=!matches;count.textContent=String(matches);total+=matches;
    }
    status.textContent=`${total} cursor${total===1?'':'s'}`;empty.hidden=total>0;empty.textContent=view==='favorites'?'Star a cursor to keep it here.':'No matching cursors.';
  }
  panel.querySelector('.cursor-picker-search').oninput=e=>{query=e.target.value.trim().toLowerCase();render()};
  panel.querySelector('[role="switch"]').onchange=e=>{ownedOnly=e.target.checked;render()};
  panel.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{view=button.dataset.view;panel.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));render()});
  window.addEventListener('teachertiles:collectionpreferences',()=>{readFavorites();render()});
  return {render};
}
window.TeacherTilesCursorPicker=Object.freeze({create});})();
