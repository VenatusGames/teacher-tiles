import {readTileCatalog,tileKey} from './tile-catalog.js';
import {cachedTileMetadata,fetchTileMetadata} from './tile-metadata-client.js';
const menu=window.TeacherTilesTileMenu;
if(menu){
  const catalog=readTileCatalog(document,menu.items),known=new Set(catalog.categories.map(c=>c.id));
  const defaults=new Map(menu.items.map(item=>[item,item.dataset.category]));let revision=-1;
  function apply(data){
    if(!data || data.revision<=revision)return;
    let changed=false;
    for(const item of menu.items){
      const metadata=data.tiles[tileKey(item)];
      const categories=Array.isArray(metadata?.categories)?metadata.categories.filter(c=>known.has(c)):null;
      const next=categories?.length?categories.join(' '):defaults.get(item);
      if(item.dataset.category!==next){item.dataset.category=next;changed=true;}
      item.dataset.gradeLevels=Array.isArray(metadata?.grades)?metadata.grades.join(' '):'';
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
