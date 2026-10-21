// The Add Tile menu is the source of truth: no separate tile registry to maintain.
export const gradeOptions = [{id:'all',label:'All Grades'},{id:'pre-k',label:'Pre-K'},{id:'k',label:'Kindergarten'},...Array.from({length:12},(_,i)=>({id:String(i+1),label:`Grade ${i+1}`})),{id:'higher-ed',label:'Higher-Ed'}];
export const badgeOptions = [
  {id:'holiday',label:'Holiday',className:'holiday-badge'},
  {id:'pbis',label:'PBIS',className:'context-menu__tracking-badge'},
  {id:'classconnect',label:'Class Connect',className:'context-menu__connect-badge'}
];
export const readTileBadges = node => badgeOptions.filter(badge=>node.querySelector(`.${badge.className}`)).map(badge=>badge.id);
export const tileKey = item => item.dataset.module || item.dataset.catalogId || `coming-soon:${(item.querySelector('strong')?.textContent || '').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}`;
export function readTileCatalog(root, items = root.querySelectorAll('.context-menu__item[data-category]')) {
  const categoryMap=new Map(), tileMap=new Map();
  for(const node of root.querySelectorAll('[data-category-drawer-filter]')){
    const id=node.dataset.categoryDrawerFilter;
    if(['all','favorites','holidays'].includes(id))continue;
    const label=node.textContent.trim().toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
    categoryMap.set(id,{id,label:({pbis:'PBIS',sel:'SEL'})[id]||label});
  }
  ['Christmas','Hanukkah','Halloween',"Valentine’s Day","St. Patrick’s Day",'Thanksgiving'].forEach((label,i)=>categoryMap.set(`holiday:${i}`,{id:`holiday:${i}`,label}));
  for(const node of items){
    const id=tileKey(node),categories=(node.dataset.category||'').split(/\s+/).filter(Boolean);
    if(tileMap.has(id)){const tile=tileMap.get(id);tile.categories=[...new Set([...tile.categories,...categories])];tile.badges=[...new Set([...tile.badges,...readTileBadges(node)])];continue;}
    tileMap.set(id,{id,name:node.querySelector('strong')?.textContent.trim()||id,description:node.querySelector('small')?.textContent.trim()||'',categories,badges:readTileBadges(node),iconText:node.querySelector('.context-menu__icon')?.textContent.trim()||'',comingSoon:node.dataset.comingSoon==='true',icon:node.querySelector('.context-menu__icon svg')?.outerHTML||''});
  }
  return {categories:[...categoryMap.values()],tiles:[...tileMap.values()].sort((a,b)=>a.name.localeCompare(b.name))};
}
export async function loadTileCatalog(){
  for(const name of ['board.html','index.html']){
    const response=await fetch(new URL(`../../${name}`,import.meta.url),{cache:'no-cache'});
    if(!response.ok)continue;
    const template=document.createElement('template');template.innerHTML=await response.text();
    const catalog=readTileCatalog(template.content);
    if(catalog.tiles.length)return catalog;
  }
  throw new Error('The Add Tile catalog could not load. Refresh to try again.');
}
// Rebuild only SVG geometry; HTML from the catalog is never executed.
export function tileIcon(markup,text=''){
  const holder=document.createElement('span');holder.className='tm-icon';holder.setAttribute('aria-hidden','true');
  if(!markup){holder.classList.add('tm-icon--text');holder.textContent=text;return holder;}
  const parsed=new DOMParser().parseFromString(markup||'<svg/>','image/svg+xml');
  const tags=new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','text','tspan']);
  const attrs=new Set(['viewBox','d','x','y','x1','x2','y1','y2','width','height','rx','ry','cx','cy','r','points','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','fill-rule','clip-rule','opacity','transform','text-anchor','font-size','font-weight','font-family','dominant-baseline']);
  function copy(node){if(!tags.has(node.localName))return null;const out=document.createElementNS('http://www.w3.org/2000/svg',node.localName);for(const a of node.attributes)if(attrs.has(a.name)&&!/[<>]|url\s*\(/i.test(a.value))out.setAttribute(a.name,a.value);for(const child of node.childNodes){if(child.nodeType===3){out.append(document.createTextNode(child.textContent));continue;}if(child.nodeType===1){const safe=copy(child);if(safe)out.append(safe);}}return out;}
  const svg=copy(parsed.documentElement);if(svg){svg.setAttribute('width','30');svg.setAttribute('height','30');holder.append(svg);}return holder;
}
