import './cosmetics-policy.js?v=20260927-dev-subscription-access';
const catalog=await fetch(new URL('./cosmetics-catalog.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Cosmetic catalog could not load.');return r.json();});
export const boardCosmetics=globalThis.TeacherTilesCosmeticsPolicy.policy(catalog);

const waitFrames=(count=2)=>new Promise(resolve=>{const next=()=>count--<=0?resolve():requestAnimationFrame(next);next();});

function ensureBoardShopStyles(){
 if(document.getElementById('board-shop-access-styles'))return;
 const style=document.createElement('style');style.id='board-shop-access-styles';style.textContent=`
 .board-unowned-shop{position:absolute;z-index:45;inset:82px 0 0;background:var(--surface-solid,#fff);overflow:auto;padding:22px 24px 34px}
 .board-unowned-shop__head{position:sticky;z-index:4;top:-22px;display:flex;align-items:flex-start;gap:13px;margin:-22px -24px 20px;padding:22px 24px 17px;background:color-mix(in srgb,var(--surface-solid,#fff) 96%,transparent);border-bottom:1px solid var(--border,#ddd);backdrop-filter:blur(12px)}
 .board-unowned-shop__back{width:39px;height:39px;flex:0 0 auto;border:1px solid var(--border,#ddd);border-radius:12px;background:var(--surface-soft,#f3f4f6);color:var(--text,#222);font:inherit;font-size:18px}
 .board-unowned-shop__head span{display:block;font-size:9px;line-height:1;font-weight:900;letter-spacing:.16em;color:var(--muted,#667085)}
 .board-unowned-shop__head h2{margin:5px 0 0;font-size:28px;letter-spacing:-.035em}
 .board-unowned-shop__head p{margin:5px 0 0;color:var(--muted,#667085);font-size:12px}
 .board-unowned-shop__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
 .board-unowned-shop__empty{grid-column:1/-1;padding:34px;border:1px dashed var(--border,#ddd);border-radius:18px;color:var(--muted,#667085);text-align:center}
 .shop-membership-card.is-board-renew-target{outline:3px solid color-mix(in srgb,#d9a51d 55%,transparent);outline-offset:5px;box-shadow:0 18px 46px rgba(130,94,10,.16)}
 @media(max-width:780px){.board-unowned-shop__grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
 @media(max-width:540px){.board-unowned-shop{padding:18px 14px 28px}.board-unowned-shop__head{margin:-18px -14px 16px;padding:18px 14px 14px}.board-unowned-shop__grid{grid-template-columns:1fr}}
 `;document.head.append(style);
}

function openShopShell(){
 const shop=window.TeacherTilesShop;
 if(shop?.open){shop.open();return true;}
 const toggle=document.getElementById('shop-toggle');
 if(toggle){toggle.click();return true;}
 return false;
}

async function openSubscriptionShop(){
 ensureBoardShopStyles();
 const shop=window.TeacherTilesShop;
 if(shop?.openMembership)shop.openMembership();else if(!openShopShell())return;
 await waitFrames(2);
 const card=document.getElementById('shop-subscribe-preview')?.closest('.shop-membership-card');
 const button=document.getElementById('shop-subscribe-preview');
 if(!card)return;
 card.classList.add('is-board-renew-target');
 card.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 button?.focus({preventScroll:true});
 window.setTimeout(()=>card.classList.remove('is-board-renew-target'),1800);
}

async function openUnownedCosmetics(){
 ensureBoardShopStyles();
 if(!openShopShell())return;
 await waitFrames(2);
 const modal=document.getElementById('shop-modal'),panel=modal?.querySelector('.shop-panel');
 if(!modal||!panel)return;
 panel.querySelector('.board-unowned-shop')?.remove();
 const state=window.TeacherTilesAccount?.state||{};
 const owned=new Set(Array.isArray(state.ownedProductIds)?state.ownedProductIds:[]);
 const canonicalPages=['themes','stickers','tile-skins','cursors'];
 const byId=new Map();
 for(const pageName of canonicalPages){
  for(const card of modal.querySelectorAll(`[data-shop-page="${pageName}"] [data-shop-product]`)){
   const id=card.dataset.shopProduct;if(id&&!byId.has(id))byId.set(id,card);
  }
 }
 const sources=[...byId.values()].filter(card=>!owned.has(card.dataset.shopProduct));
 const view=document.createElement('section');view.className='board-unowned-shop';view.setAttribute('aria-label','Unowned cosmetics');
 const head=document.createElement('header');head.className='board-unowned-shop__head';
 const back=document.createElement('button');back.type='button';back.className='board-unowned-shop__back';back.textContent='←';back.setAttribute('aria-label','Back to Shop');
 const copy=document.createElement('div');copy.innerHTML='<span>SHOP COSMETICS</span><h2>Cosmetics You Don’t Own</h2><p>Everything below can be purchased individually with coins.</p>';head.append(back,copy);
 const grid=document.createElement('div');grid.className='board-unowned-shop__grid shop-product-grid';
 const cleanup=()=>{observer.disconnect();view.remove()};
 back.onclick=cleanup;
 if(!sources.length){const empty=document.createElement('p');empty.className='board-unowned-shop__empty';empty.textContent='You already own every individually purchasable cosmetic.';grid.append(empty)}
 for(const source of sources){
  const clone=source.cloneNode(true);clone.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));clone.classList.remove('is-owned','is-purchasing','is-shop-highlighted');clone.hidden=false;clone.removeAttribute('hidden');
  const id=source.dataset.shopProduct;clone.tabIndex=0;
  const buy=clone.querySelector('[data-shop-buy]');
  if(buy){buy.disabled=false;buy.addEventListener('click',event=>{event.stopPropagation();source.querySelector('[data-shop-buy]')?.click()})}
  const details=()=>{cleanup();window.TeacherTilesShop?.openProduct?.(id)};
  clone.addEventListener('click',event=>{if(!event.target.closest('button,.subscription-access-crown'))details()});
  clone.addEventListener('keydown',event=>{if(event.target===clone&&['Enter',' '].includes(event.key)){event.preventDefault();details()}});
  grid.append(clone);
 }
 view.append(head,grid);panel.append(view);back.focus({preventScroll:true});
 const rerender=()=>{if(!view.isConnected)return;const nextOwned=new Set(window.TeacherTilesAccount?.state?.ownedProductIds||[]);for(const card of [...grid.querySelectorAll('[data-shop-product]')])if(nextOwned.has(card.dataset.shopProduct))card.remove();if(!grid.querySelector('[data-shop-product]')&&!grid.querySelector('.board-unowned-shop__empty')){const empty=document.createElement('p');empty.className='board-unowned-shop__empty';empty.textContent='You now own every individually purchasable cosmetic.';grid.append(empty)}};
 window.addEventListener('teachertiles:accountchange',rerender,{signal:AbortSignal.timeout(30*60*1000)});
 const observer=new MutationObserver(()=>{if(modal.hidden)cleanup()});observer.observe(modal,{attributes:true,attributeFilter:['hidden']});
}

export function cosmeticAccessDialog({importing=false}={}){
 return new Promise(resolve=>{
  const d=document.createElement('dialog');d.className='template-dialog board-access-dialog';d.setAttribute('aria-labelledby','board-access-title');
  const crown=document.createElement('div');crown.className='board-access-crown';crown.setAttribute('aria-hidden','true');crown.innerHTML='<svg viewBox="0 0 48 48"><use href="assets/ui/subscriber-crown.svg#crown"/></svg>';
  const h=document.createElement('h2');h.id='board-access-title';h.textContent=importing?'A few cosmetics are missing':'Your board needs membership';
  const p=document.createElement('p');p.textContent=importing?"Sorry! You don’t own all of the cosmetics used on this board. Subscribe to unlock them and make this board yours.":'Some cosmetics on this board are no longer unlocked. Renew your membership, shop for them, or remove only the items you don’t own. Your other content stays.';
  const actions=document.createElement('div');actions.className='board-access-actions';
  const finish=value=>{resolve(value);d.close();};
  const button=(label,value)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.className='board-access-'+value;b.onclick=()=>finish(value);actions.append(b);};
  button(importing?'Subscribe':'Renew Subscription','subscribe');
  if(!importing){button('Shop Cosmetics','shop');button('Remove unowned paid items','remove');}
  button('Back','back');d.append(crown,h,p,actions);
  d.oncancel=e=>{e.preventDefault();finish('back');};d.onclose=()=>{d.remove();resolve('back');};document.body.append(d);d.showModal();
 });
}
export function openCosmeticShop(action){
 if(action==='subscribe'){void openSubscriptionShop();return;}
 if(action==='shop'){void openUnownedCosmetics();return;}
 openShopShell();
}
