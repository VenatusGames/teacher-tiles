import {firebaseConfig} from '../firebase-config.js';
export function setupManagedShop({modal,products,catalogProducts,bindProduct,sync,openProduct,replaceBanners,getPage=()=>'home'}){
 const originals=new Map(catalogProducts.map(c=>[c.dataset.shopProduct,{price:Number(c.dataset.shopPrice),description:c.querySelector('p')?.textContent||''}]));
 const originalBanners=[...modal.querySelectorAll('[data-shop-banner]')].map((node,i)=>({node:node.cloneNode(true),id:`default-${node.querySelector('[data-shop-banner-target]')?.dataset.shopBannerTarget||i}`}));
 let settings=null,lastFetch=0,pending=null,expiry=0,offset=0,bannerRevision=-1;
 const saleSection=document.createElement('section');saleSection.className='shop-managed-deals';saleSection.hidden=true;saleSection.innerHTML='<header><h2>Sales & Bundles</h2><nav aria-label="Browse sales and bundles"><button type="button" data-deal-step="-1" aria-label="Previous offers"><svg viewBox="0 0 24 24"><path d="m14 6-6 6 6 6"/></svg></button><button type="button" data-deal-step="1" aria-label="Next offers"><svg viewBox="0 0 24 24"><path d="m10 6 6 6-6 6"/></svg></button></nav></header><div class="shop-product-grid"></div>';
 const homeAnchor=document.createComment('Sales and bundles home position');modal.querySelector('.shop-featured-library').before(homeAnchor,saleSection);
 const dealsButton=modal.querySelector('.shop-deals-trigger'),dealsMount=modal.querySelector('[data-deals-mount]'),empty=modal.querySelector('[data-deals-empty]');
 function setPage(name){if(name==='sales-bundles'&&dealsMount)dealsMount.append(saleSection);else homeAnchor.after(saleSection);saleSection.querySelector('header').hidden=false;requestAnimationFrame(updateArrows)}

 const deals=saleSection.querySelector('.shop-product-grid');let managed=[],appliedSignature='';
 function updateArrows(){const max=deals.scrollWidth-deals.clientWidth;saleSection.querySelector('[data-deal-step="-1"]').disabled=deals.scrollLeft<2;saleSection.querySelector('[data-deal-step="1"]').disabled=deals.scrollLeft>=max-2;}
 saleSection.querySelectorAll('[data-deal-step]').forEach(b=>b.onclick=()=>deals.scrollBy({left:Number(b.dataset.dealStep)*deals.clientWidth*.85,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
 deals.addEventListener('scroll',updateArrows,{passive:true});new ResizeObserver(updateArrows).observe(deals);setPage(getPage());
 const now=()=>Date.now()+offset;
 const active=p=>p.sale&&p.sale.startsAt<=now()&&now()<p.sale.endsAt;
 const price=p=>active(p)?p.sale.price:p.price;
 function decorate(card,p){
  card.dataset.shopPrice=price(p);if(p.description!==null&&p.description!==undefined&&card.querySelector('p'))card.querySelector('p').textContent=p.description;
  card.querySelectorAll('.managed-sale-label').forEach(n=>n.remove());
  if(active(p)){const label=document.createElement('div');label.className='managed-sale-label';const old=document.createElement('s');old.textContent=`${p.price} coins`;const end=document.createElement('span');end.textContent=`Sale Ends ${new Date(p.sale.endsAt).toLocaleDateString()}`;label.append(old,end);card.querySelector('.shop-product__body')?.prepend(label)}
 }
 function apply(){
  if(!settings)return;
  const signature=JSON.stringify([settings.revision,Object.entries({...settings.products,...settings.bundles}).map(([id,p])=>[id,!!active(p)])]);
  if(signature===appliedSignature){sync();return;}appliedSignature=signature;clearTimeout(expiry);
  for(const c of managed){let i=products.indexOf(c);if(i>=0)products.splice(i,1);i=catalogProducts.indexOf(c);if(i>=0)catalogProducts.splice(i,1);c.remove()}managed=[];deals.replaceChildren();
  for(const card of products){const base=originals.get(card.dataset.shopProduct);if(base)decorate(card,{...base,...settings.products[card.dataset.shopProduct],description:settings.products[card.dataset.shopProduct]?.description??base.description})}
  const saleCards=document.createDocumentFragment();
  for(const source of catalogProducts){const base=originals.get(source.dataset.shopProduct);if(!base)continue;const p={...base,...settings.products[source.dataset.shopProduct]};if(!active(p))continue;const card=source.cloneNode(true);card.hidden=false;card.classList.remove('shop-filter-hidden');bindProduct(card);products.push(card);managed.push(card);saleCards.append(card)}
  for(const [id,p] of Object.entries(settings.bundles||{})){
   if(!p.active)continue;const card=document.createElement('article');card.className='shop-product';card.dataset.shopProduct=id;card.dataset.bundleItems=JSON.stringify(p.items);
   card.innerHTML='<div class="shop-product__preview shop-bundle-preview"></div><div class="shop-product__body"><div><span class="shop-product__type">COSMETIC BUNDLE</span><h3></h3><p></p><small class="shop-bundle-includes"></small></div><button class="shop-buy" type="button" data-shop-buy></button></div>';
   card.querySelector('h3').textContent=p.name;card.querySelector('p').textContent=p.description;
   card.querySelector('small').textContent=`Includes ${p.items.map(id=>catalogProducts.find(c=>c.dataset.shopProduct===id)?.querySelector('h3')?.textContent||id).join(', ')}. Fixed bundle price; owned items are not discounted.`;
   for(const item of p.items.slice(0,4)){const art=catalogProducts.find(c=>c.dataset.shopProduct===item)?.querySelector('.shop-product__preview')?.cloneNode(true);if(art){art.removeAttribute('aria-hidden');card.querySelector('.shop-bundle-preview').append(art)}}
   decorate(card,p);bindProduct(card);products.push(card);catalogProducts.push(card);managed.push(card);deals.append(card);
  }
  deals.append(saleCards);
  saleSection.hidden=!deals.children.length;
  if(empty)empty.hidden=!!deals.children.length;
  if(dealsButton)dealsButton.hidden=![...Object.values(settings.products||{}),...Object.values(settings.bundles||{}).filter(b=>b.active)].some(active);
  const next=Object.values({...settings.products,...settings.bundles}).flatMap(p=>p.sale?[p.sale.startsAt,p.sale.endsAt]:[]).filter(t=>t>now()).sort((a,b)=>a-b)[0];
  if(next)expiry=setTimeout(apply,Math.min(next-now()+50,2147483647));
  if(bannerRevision!==settings.revision){
   const slides=originalBanners.filter(b=>!settings.banners.hidden.includes(b.id)&&!(settings.banners.removed||[]).includes(b.id)).map(b=>b.node.cloneNode(true));
   for(const b of settings.banners.custom){if(b.active===false)continue;const slide=document.createElement('article');slide.className='shop-banner__slide';slide.dataset.shopBanner='';const button=document.createElement('button');button.type='button';button.className='shop-banner-link';button.dataset.shopBannerTarget=b.target;button.setAttribute('aria-label',b.title);const img=document.createElement('img');img.src=b.url.startsWith('banners/')?new URL('../'+b.url,import.meta.url).href:b.url;img.alt=b.title;slide.append(button,img);slides.push(slide)}
   replaceBanners(slides);bannerRevision=settings.revision;
  }
  sync();requestAnimationFrame(updateArrows);
 }
 async function refresh(force=false){
  if(pending)return pending;if(!force&&Date.now()-lastFetch<30000){apply();return}
  pending=(async()=>{try{const response=await fetch(`https://us-central1-${firebaseConfig.projectId}.cloudfunctions.net/shopManagement`,{signal:AbortSignal.timeout(10000),cache:'no-cache'});if(!response.ok)throw Error('Shop management unavailable');const data=await response.json();if(!Number.isSafeInteger(data.revision)||!data.products||!data.bundles||!data.banners)throw Error('Invalid shop configuration');settings=data;offset=Number(data.serverTime)-Date.now()||0;lastFetch=Date.now();apply()}catch(e){console.warn('Live shop settings could not load',e)}finally{pending=null}})();return pending;
 }
 return {refresh,setPage};
}

