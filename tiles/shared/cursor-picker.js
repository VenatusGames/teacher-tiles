(()=>{'use strict';
function create({panel,catalog,packs,owned,active,apply,unlock}){
  let view='all',query='',ownedOnly=false;
  const closed=new Set();let favorites=new Set();
  try{favorites=new Set(JSON.parse(localStorage.getItem('teacherTilesCursorFavorites')||'[]'))}catch{}
  panel.innerHTML='<div class="cursor-picker"><div class="cursor-picker-views"><button type="button" data-view="all" aria-pressed="true">All cursors</button><button type="button" data-view="favorites" aria-pressed="false">♡ Favorites</button></div><input class="cursor-picker-search" type="search" aria-label="Search cursors" placeholder="Search cursors…"><div class="cursor-picker-filters"><span role="status"></span><label>Owned only <input type="checkbox" role="switch" aria-label="Owned cursors only"><i aria-hidden="true"></i></label></div><div class="cursor-picker-results"></div><footer>Choose a cursor to use across your board.</footer></div>';
  const results=panel.querySelector('.cursor-picker-results'),status=panel.querySelector('[role="status"]');
  const lock=()=>'<img src="assets/ui/lock.svg" alt="">';
  function render(){
    const selected=active();let total=0;const sections=[];
    for(const pack of packs){
      const accessible=owned(pack.productId),choices=catalog.filter(c=>c.productId===pack.productId&&(!ownedOnly||accessible)&&(view!=='favorites'||favorites.has(c.id))&&(!query||(pack.name+' '+c.name).toLowerCase().includes(query)));
      if(!choices.length)continue;total+=choices.length;
      const section=document.createElement('section');section.className='cursor-picker-pack';
      const header=document.createElement('button');header.type='button';header.className='cursor-picker-pack-heading';header.setAttribute('aria-expanded',String(!closed.has(pack.productId)));
      const name=document.createElement('strong');name.textContent=pack.name;header.append(name);
      if(!accessible){const badge=document.createElement('span');badge.className='cursor-picker-lock';badge.innerHTML=lock();header.append(badge)}
      const count=document.createElement('span');count.textContent=String(choices.length);header.append(count);const arrow=document.createElement('span');arrow.className='cursor-picker-chevron';arrow.textContent='⌄';header.append(arrow);
      const body=document.createElement('div');body.className='cursor-picker-pack-body';body.hidden=closed.has(pack.productId);
      const grid=document.createElement('div');grid.className='cursor-picker-grid';
      for(const cursor of choices){
        const cell=document.createElement('div');cell.className='cursor-picker-cell';
        const choice=document.createElement('button');choice.type='button';choice.className='cursor-picker-choice';choice.setAttribute('aria-pressed',String(selected===cursor.id));choice.setAttribute('aria-label',(accessible?'Use ':'Unlock ')+pack.name+' '+cursor.name);choice.dataset.cursorChoice=cursor.id;
        const img=document.createElement('img');img.src=`assets/cursors/${cursor.id==='default'?'default':cursor.id}-normal.png?v=20260926`;img.alt='';img.draggable=false;if(cursor.id.startsWith('pixel-'))img.className='is-pixel-art';choice.append(img);
        const label=document.createElement('span');label.textContent=cursor.name;choice.append(label);
        choice.onclick=()=>accessible?apply(cursor.id):unlock(pack.productId);
        const favorite=document.createElement('button');favorite.type='button';favorite.className='cursor-picker-favorite';favorite.textContent=favorites.has(cursor.id)?'★':'☆';favorite.setAttribute('aria-label',(favorites.has(cursor.id)?'Unfavorite ':'Favorite ')+cursor.name);favorite.setAttribute('aria-pressed',String(favorites.has(cursor.id)));favorite.onclick=()=>{favorites.has(cursor.id)?favorites.delete(cursor.id):favorites.add(cursor.id);try{localStorage.setItem('teacherTilesCursorFavorites',JSON.stringify([...favorites]))}catch{}render()};
        cell.append(choice,favorite);grid.append(cell);
      }
      body.append(grid);
      if(!accessible){grid.inert=true;const cover=document.createElement('button');cover.type='button';cover.className='cursor-picker-unlock';cover.innerHTML='<span>'+lock()+'Unlock pack</span>';cover.onclick=()=>unlock(pack.productId);body.append(cover)}
      header.onclick=()=>{body.hidden=!body.hidden;body.hidden?closed.add(pack.productId):closed.delete(pack.productId);header.setAttribute('aria-expanded',String(!body.hidden))};
      section.append(header,body);sections.push(section);
    }
    results.replaceChildren(...sections);status.textContent=`${total} cursor${total===1?'':'s'}`;
    if(!total){const empty=document.createElement('p');empty.className='cursor-picker-empty';empty.textContent=view==='favorites'?'Star a cursor to keep it here.':'No matching cursors.';results.append(empty)}
  }
  panel.querySelector('.cursor-picker-search').oninput=e=>{query=e.target.value.trim().toLowerCase();render()};
  panel.querySelector('[role="switch"]').onchange=e=>{ownedOnly=e.target.checked;render()};
  panel.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{view=button.dataset.view;panel.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));render()});
  return {render};
}
window.TeacherTilesCursorPicker=Object.freeze({create});})();
