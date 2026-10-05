(function(root){
 'use strict';
 function policy(catalog){
  const stickerKey=s=>String(s?.src||s?.emoji||'').split('?')[0];
  let latestMissing=[];
  function requirements(snapshot){const found=[];const add=(products,kind)=>{if(products?.length&&!products.includes(''))found.push({products:[...products],kind});};const theme=String(snapshot?.theme||'');const prefix=Object.keys(catalog.themes).find(p=>(theme===p||theme.startsWith(p+'-')));if(prefix)add([catalog.themes[prefix]],'theme');
   function tile(o){if(!o)return;const typeProduct=catalog.tiles[o.type];if(typeProduct)add([typeProduct],'tile');const skin=o.dataset?.tileSkin;if(skin&&skin!=='default')add([catalog.skins[skin]||'tile-skin-'+skin],'skin');if(o.type==='sticker'){const products=catalog.stickers[stickerKey(o.sticker)];if(products)add(products,'sticker');}for(const segment of o.special?.segments||[]){const products=catalog.stickers[String(segment.iconSrc||'').split('?')[0]];if(products)add(products,'sticker');}for(const t of o.tabs?.items||[])tile(t);}for(const o of snapshot?.objects||[])tile(o);return found;}
  const devSubscription=()=>root.TeacherTilesAdminAccess?.developer===true&&root.TeacherTilesSandbox?.subscriptionEnabled===true;
  const allowed=(r,account={})=>devSubscription()||account.subscriptionActive===true||account.subscriptionStatus==='active'||r.products.some(p=>(account.ownedProductIds||[]).includes(p));
  const missing=(snapshot,account={})=>{latestMissing=requirements(snapshot).filter(r=>!allowed(r,account)).map(r=>({kind:r.kind,products:[...r.products]}));return latestMissing.map(r=>({kind:r.kind,products:[...r.products]}));};
  const lastMissing=()=>latestMissing.map(r=>({kind:r.kind,products:[...r.products]}));
  function strip(snapshot,account={}){const copy=JSON.parse(JSON.stringify(snapshot));function clean(o,tab=false){if(!tab&&o.tabs?.items){const activeIndex=o.tabs.active||0,pages=o.tabs.items.map((t,i)=>({item:clean(t,true),i})).filter(p=>p.item),kept=pages.map(p=>p.item);if(!kept.length)return null;const next=pages.findIndex(p=>p.i===activeIndex),selected=kept[Math.max(0,next)];o={...selected,id:o.id,transform:o.transform,zIndex:o.zIndex};if(kept.length>1)o.tabs={items:kept,active:Math.max(0,next)};return o;}if(catalog.tiles[o.type]&&!allowed({products:[catalog.tiles[o.type]]},account))return null;if(o.type==='sticker'){const products=catalog.stickers[stickerKey(o.sticker)];if(products&&!products.includes('')&&!allowed({products},account))return null;}const skin=o.dataset?.tileSkin;if(skin&&skin!=='default'&&!allowed({products:[catalog.skins[skin]||'tile-skin-'+skin]},account)){delete o.dataset.tileSkin;if(o.classes)o.classes=o.classes.filter(c=>!c.startsWith('tile-skin-'));}for(const segment of o.special?.segments||[]){const products=catalog.stickers[String(segment.iconSrc||'').split('?')[0]];if(products&&!products.includes('')&&!allowed({products},account))segment.iconSrc='';}return o;}
   copy.objects=(copy.objects||[]).map(o=>clean(o)).filter(Boolean);if(requirements({...copy,objects:[]}).some(r=>!allowed(r,account)))copy.theme='light';copy.preview=[];return copy;}
  return {requirements,missing,lastMissing,strip};
 }
 const api={policy};if(typeof module!=='undefined')module.exports=api;else root.TeacherTilesCosmeticsPolicy=api;
})(globalThis);
