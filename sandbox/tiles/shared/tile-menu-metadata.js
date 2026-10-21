import {readTileCatalog,tileKey,readTileBadges,badgeOptions} from './tile-catalog.js?v=20261012-badges';
import {cachedTileMetadata,fetchTileMetadata} from './tile-metadata-client.js';
const menu=window.TeacherTilesTileMenu;
if(menu){
  const catalog=readTileCatalog(document,menu.items),known=new Set(catalog.categories.map(c=>c.id));
  const defaults=new Map(menu.items.map(item=>[item,item.dataset.category]));let revision=-1;
  const defaultDescriptions=new Map(menu.items.map(item=>[item,item.querySelector('small')?.textContent||'']));
  const defaultBadges=new Map(menu.items.map(item=>[item,readTileBadges(item)]));
  const badgeSelector=badgeOptions.map(badge=>`.${badge.className}`).join(',');
  function apply(data){
    if(!data || data.revision<=revision)return;
    let changed=false;
    for(const item of menu.items){
      const metadata=data.tiles[tileKey(item)];
      const disabled=String(metadata?.disabled===true);if(item.dataset.tileDisabled!==disabled){item.dataset.tileDisabled=disabled;changed=true;}
      const description=typeof metadata?.description==='string'?metadata.description:defaultDescriptions.get(item);
      let summary=item.querySelector('small');
      if((summary?.textContent||'')!==description){
        if(!summary){summary=document.createElement('small');(item.querySelector('strong')?.parentElement||item).append(summary);}
        summary.textContent=description;changed=true;
      }
      const categories=Array.isArray(metadata?.categories)?metadata.categories.filter(c=>known.has(c)):null;
      const next=categories?.length?categories.join(' '):defaults.get(item);
      if(item.dataset.category!==next){item.dataset.category=next;changed=true;}
      const badges=Array.isArray(metadata?.badges)?badgeOptions.filter(b=>metadata.badges.includes(b.id)).map(b=>b.id):defaultBadges.get(item);
      if(JSON.stringify(readTileBadges(item))!==JSON.stringify(badges)){
        item.querySelectorAll(badgeSelector).forEach(node=>node.remove());
        item.querySelector('.context-menu__managed-badges')?.remove();
        if(badges.length){
          const group=document.createElement('div');group.className='context-menu__managed-badges';
          for(const id of badges){const option=badgeOptions.find(b=>b.id===id),badge=document.createElement('span');badge.className=option.className;badge.textContent=option.label;group.append(badge);}
          item.append(group);
        }
        // Badges are display labels; entitlement and PBIS tracking attributes stay intact.
        changed=true;
      }
      const grades=Array.isArray(metadata?.grades)?metadata.grades.join(' '):'';if(item.dataset.gradeLevels!==grades){item.dataset.gradeLevels=grades;changed=true;}
    }
    revision=data.revision;if(changed)menu.refresh();
  }
  apply(cachedTileMetadata());void fetchTileMetadata().then(apply);
  window.addEventListener('teachertiles:tilemetadata',event=>apply(event.detail));
  const refresh=()=>{if(!document.hidden)void fetchTileMetadata().then(apply);};
  window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  new MutationObserver(()=>{if(menu.element.classList.contains('is-open'))refresh();}).observe(menu.element,{attributes:true,attributeFilter:['class']});
  setInterval(()=>{if(menu.element.classList.contains('is-open'))refresh();},60000);
}
