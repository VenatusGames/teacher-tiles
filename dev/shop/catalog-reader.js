// Read the app document, not the homepage used by deployed builds.
export async function readShopCatalog(){
 for(const name of ['board.html','index.html']){
  const response=await fetch(new URL(`../${name}`,import.meta.url),{cache:'no-cache'});if(!response.ok)continue;
  const doc=new DOMParser().parseFromString(await response.text(),'text/html');
  if(!doc.querySelector('[data-shop-product]'))continue;
  const defaults=new Map([...doc.querySelectorAll('[data-shop-product]')].map(c=>[c.dataset.shopProduct,{name:c.querySelector('h3')?.textContent.trim()||'',description:c.querySelector('p')?.textContent.trim()||'',tags:`${c.dataset.shopHoliday||''} ${c.querySelector('.shop-product__type')?.textContent||''}`}]));
  await Promise.all([import('./tile-effects-catalog.js?v=20261021-autumn'),import('../profile/frames-catalog.js'),import('../tiles/lesson-planner/skins.js?v=20261021-autumn'),import('./sticker-catalog.js?v=20261028-descriptions'),import('../presentations/themes.js'),import('../presentations/catalog.js?v=20261021-thanksgiving-polish2').then(()=>import('../presentations/transitions.js'))]);
  for(const p of [...(window.TeacherTilesTileEffectCatalog?.catalog||[]),...(window.TeacherTilesProfileFrames?.catalog||[]),...(window.TeacherTilesPlannerSkins?.catalog||[]),...(window.TeacherTilesStickerPacks||[]),...(window.TeacherTilesPresentationThemes?.catalog||[]),...(window.TeacherTilesPresentationTransitions?.catalog||[])])defaults.set(p.productId,{name:p.name,description:p.description,tags:`${p.tags||''} ${p.holiday||''}`});
  const banners=[...doc.querySelectorAll('[data-shop-banner]')].map((b,i)=>{
   const art=(b.querySelector('.shop-halloween-art,.shop-thanksgiving-art')||b.querySelector('img'))?.cloneNode(true);
   // Resolve image URLs relative to the app, even when the portal is nested.
   for(const img of art?[...(art.matches('img')?[art]:[]),...art.querySelectorAll('img')]:[]){img.src=new URL(img.getAttribute('src'),response.url||new URL(`../${name}`,import.meta.url)).href;}
   return {id:`default-${b.querySelector('[data-shop-banner-target]')?.dataset.shopBannerTarget||i}`,title:b.querySelector('button')?.getAttribute('aria-label')||`Banner ${i+1}`,art,target:b.querySelector('button')?.dataset.shopBannerTarget};
  });
  return {defaults,banners};
 }
 throw Error('The board shop catalog could not load. Refresh to try again.');
}
