// One source of truth: the app's Add Tile menu and its shared catalog parser.
// DOMParser creates an inert document; catalog HTML is never inserted or executed.
let readerPromise;
export async function getReader(){
  return readerPromise ||= import(new URL(document.querySelector('meta[name="tt-catalog-reader"]').content,document.baseURI).href)
    .catch(()=>import('./vendor/tile-catalog.js'));
}
export async function parseCatalog(html){
  const {readTileCatalog,tileKey}=await getReader();
  const doc=new DOMParser().parseFromString(html,'text/html');
  const result=readTileCatalog(doc);
  if(!result.tiles.length)throw new Error('No Add Tile entries found.');
  const classes=new Map();
  for(const node of doc.querySelectorAll('.context-menu__item[data-category]')){
    const icon=node.querySelector('.context-menu__icon');
    classes.set(tileKey(node),[...(icon?.classList||[])].filter(name=>/^context-menu__icon(?:--[a-z0-9-]+)?$/.test(name)));
  }
  result.tiles=result.tiles.filter(tile=>!tile.comingSoon).map(tile=>({...tile,iconClasses:classes.get(tile.id)||[]}));
  const used=new Set(result.tiles.flatMap(tile=>tile.categories));
  result.categories=result.categories.filter(category=>used.has(category.id));
  return result;
}
export async function fetchCatalog({fallback=true}={}){
  try{
    const response=await fetch(document.querySelector('meta[name="tt-catalog-source"]').content,{cache:'no-cache',signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw new Error('Catalog source unavailable.');
    const catalog=await parseCatalog(await response.text());
    return {...catalog,source:'app',checkedAt:Date.now()};
  }catch(error){
    if(!fallback)throw error;
    const response=await fetch(new URL('./catalog-fallback.json',import.meta.url),{cache:'no-cache'});
    if(!response.ok)throw error;
    const catalog=await response.json();
    if(!Array.isArray(catalog.tiles)||!catalog.tiles.length)throw error;
    return {...catalog,source:'fallback',checkedAt:Date.now()};
  }
}
export async function makeIcon(tile){const reader=await getReader();return renderIcon(tile,reader.tileIcon)}
export function renderIcon(tile,tileIcon){
  const wrap=document.createElement('span');wrap.className='native-icon';wrap.setAttribute('aria-hidden','true');
  const icon=tileIcon(tile.icon,tile.iconText);icon.classList.add(...(tile.iconClasses||[]));wrap.append(icon);return wrap;
}
