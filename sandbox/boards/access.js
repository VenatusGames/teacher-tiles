import './cosmetics-policy.js?v=20260927-board-recovery-2';
const catalog=await fetch(new URL('./cosmetics-catalog.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Cosmetic catalog could not load.');return r.json();});
export const boardCosmetics=globalThis.TeacherTilesCosmeticsPolicy.policy(catalog);

const nextTask=()=>new Promise(resolve=>setTimeout(resolve,0));
const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;

function ensureBoardShopStyles(){
 if(document.getElementById('board-shop-access-styles'))return;
 const style=document.createElement('style');style.id='board-shop-access-styles';style.textContent=`
 .shop-modal.board-access-shop{z-index:61000!important}
 .board-recovery-shop{position:absolute;z-index:45;inset:82px 0 0;background:var(--surface-solid,#fff);overflow:auto;padding:22px 24px 34px}
 .board-recovery-shop__head{position:sticky;z-index:6;top:-22px;display:flex;align-items:flex-start;gap:13px;margin:-22px -24px 22px;padding:22px 24px 17px;background:color-mix(in srgb,var(--surface-solid,#fff) 96%,transparent);border-bottom:1px solid var(--border,#ddd);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
 .board-recovery-shop__back{width:39px;height:39px;flex:0 0 auto;border:1px solid var(--border,#ddd);border-radius:12px;background:var(--surface-soft,#f3f4f6);color:var(--text,#222);font:inherit;font-size:18px;display:grid;place-items:center}
 .board-recovery-shop__head span,.board-recovery-group__head span{display:block;font-size:9px;line-height:1;font-weight:900;letter-spacing:.16em;color:var(--muted,#667085)}
 .board-recovery-shop__head h2{margin:5px 0 0;font-size:28px;letter-spacing:-.035em}.board-recovery-shop__head p{margin:5px 0 0;color:var(--muted,#667085);font-size:12px;line-height:1.45}
 .board-recovery-shop__groups{display:grid;gap:28px}.board-recovery-group{display:grid;gap:12px}.board-recovery-group__head{display:flex;align-items:end;justify-content:space-between;gap:12px}.board-recovery-group__head h3{margin:4px 0 0;font-size:19px;letter-spacing:-.025em}.board-recovery-group__head small{color:var(--muted,#667085);font-size:10px;font-weight:750}
 .board-recovery-group__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.board-recovery-shop__empty{padding:42px 22px;border:1px dashed var(--border,#ddd);border-radius:18px;color:var(--muted,#667085);text-align:center}.board-recovery-shop__empty strong{display:block;margin-bottom:5px;color:var(--text,#222);font-size:16px}
 .shop-membership-card.is-board-renew-target{outline:3px solid color-mix(in srgb,#d9a51d 55%,transparent);outline-offset:5px;box-shadow:0 18px 46px rgba(130,94,10,.16)}
 @media(max-width:780px){.board-recovery-group__grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
 @media(max-width:540px){.board-recovery-shop{padding:18px 14px 28px}.board-recovery-shop__head{margin:-18px -14px 18px;padding:18px 14px 14px}.board-recovery-group__grid{grid-template-columns:1fr}}
 `;document.head.append(style);
}

function shopModal(){return document.getElementById('shop-modal')}
function liftShop(){ensureBoardShopStyles();shopModal()?.classList.add('board-access-shop')}
function releaseShop(){shopModal()?.classList.remove('board-access-shop')}
function closeRecoveryShop(){
 const modal=shopModal();modal?.querySelector('.board-recovery-shop')?.remove();releaseShop();
 if(modal&&!modal.hidden)document.getElementById('shop-close')?.click();
}
function openShopShell(){
 const shop=window.TeacherTilesShop;
 if(shop?.open){shop.open();return true}
 const toggle=document.getElementById('shop-toggle');if(toggle){toggle.click();return true}
 return false;
}
function accountHasSubscription(account={}){return account.subscriptionActive===true||account.subscriptionStatus==='active'||(window.TeacherTilesAdminAccess?.developer===true&&window.TeacherTilesSandbox?.subscriptionEnabled===true)}
function unresolvedRequirements(requirements,account={}){
 if(accountHasSubscription(account))return[];
 const owned=new Set(account.ownedProductIds||[]);
 return requirements.filter(r=>!r.products.some(id=>owned.has(id)));
}

async function openSubscriptionShop(){
 await nextTask();
 liftShop();
 const shop=window.TeacherTilesShop;
 if(shop?.openMembership)shop.openMembership();else if(!openShopShell()){releaseShop();return}
 const modal=shopModal();if(!modal)return;
 modal.querySelector('.board-recovery-shop')?.remove();
 const card=document.getElementById('shop-subscribe-preview')?.closest('.shop-membership-card');
 const button=document.getElementById('shop-subscribe-preview');
 if(card){card.classList.add('is-board-renew-target');card.scrollIntoView({block:'center',behavior:reducedMotion()?'auto':'smooth'});button?.focus({preventScroll:true});setTimeout(()=>card.classList.remove('is-board-renew-target'),1800)}
 const observer=new MutationObserver(()=>{if(modal.hidden){observer.disconnect();releaseShop()}});observer.observe(modal,{attributes:true,attributeFilter:['hidden']});
}

async function openBoardRecoveryShop(){
 const requirements=boardCosmetics.lastMissing?.()||[];
 await nextTask();
 liftShop();
 if(!openShopShell()){releaseShop();return}
 const modal=shopModal(),panel=modal?.querySelector('.shop-panel');if(!modal||!panel){releaseShop();return}
 panel.querySelector('.board-recovery-shop')?.remove();
 const canonicalPages=[['themes','Themes'],['stickers','Sticker Packs'],['tile-skins','Tile Skins'],['cursors','Cursors']];
 const sourceById=new Map(),pageById=new Map();
 for(const [pageName] of canonicalPages){for(const card of modal.querySelectorAll(`[data-shop-page="${pageName}"] [data-shop-product]`)){const id=card.dataset.shopProduct;if(id&&!sourceById.has(id)){sourceById.set(id,card);pageById.set(id,pageName)}}}
 const view=document.createElement('section');view.className='board-recovery-shop';view.setAttribute('aria-label','Cosmetics required for this board');
 const head=document.createElement('header');head.className='board-recovery-shop__head';
 const back=document.createElement('button');back.type='button';back.className='board-recovery-shop__back';back.textContent='←';back.setAttribute('aria-label','Back to board access');back.onclick=closeRecoveryShop;
 const copy=document.createElement('div');copy.innerHTML='<span>UNLOCK THIS BOARD</span><h2>Cosmetics This Board Needs</h2><p>Only the cosmetic packs and items that can restore access to this board are shown here.</p>';head.append(back,copy);
 const groups=document.createElement('div');groups.className='board-recovery-shop__groups';view.append(head,groups);panel.append(view);
 let accountHandler=()=>{};
 function render(){
  const state=window.TeacherTilesAccount?.state||{};
  const unresolved=unresolvedRequirements(requirements,state);
  const neededIds=new Set(unresolved.flatMap(r=>r.products).filter(Boolean));
  groups.replaceChildren();
  if(!neededIds.size){const empty=document.createElement('div');empty.className='board-recovery-shop__empty';empty.innerHTML='<strong>This board is unlocked.</strong>You now have access to every required cosmetic. Close the Shop to return to your board.';groups.append(empty);return}
  for(const [pageName,label] of canonicalPages){
   const ids=[...neededIds].filter(id=>pageById.get(id)===pageName);if(!ids.length)continue;
   const section=document.createElement('section');section.className='board-recovery-group';
   const groupHead=document.createElement('header');groupHead.className='board-recovery-group__head';groupHead.innerHTML=`<div><span>REQUIRED</span><h3>${label}</h3></div><small>${ids.length} ${ids.length===1?'option':'options'}</small>`;
   const grid=document.createElement('div');grid.className='board-recovery-group__grid shop-product-grid';
   for(const id of ids){const source=sourceById.get(id);if(!source)continue;const clone=source.cloneNode(true);clone.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));clone.classList.remove('is-owned','is-purchasing','is-shop-highlighted');clone.hidden=false;clone.removeAttribute('hidden');clone.tabIndex=0;
    const buy=clone.querySelector('[data-shop-buy]');if(buy){buy.disabled=false;buy.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();source.querySelector('[data-shop-buy]')?.click()})}
    const details=()=>window.TeacherTilesShop?.openProduct?.(id);clone.addEventListener('click',event=>{if(!event.target.closest('button,.subscription-access-crown'))details()});clone.addEventListener('keydown',event=>{if(event.target===clone&&['Enter',' '].includes(event.key)){event.preventDefault();details()}});grid.append(clone)}
   section.append(groupHead,grid);groups.append(section);
  }
  const unavailable=[...neededIds].filter(id=>!sourceById.has(id));if(unavailable.length){const section=document.createElement('section');section.className='board-recovery-group';const box=document.createElement('div');box.className='board-recovery-shop__empty';box.innerHTML='<strong>Subscription-only cosmetic</strong>One or more required cosmetics are not sold individually. Renew your subscription to restore them.';section.append(box);groups.append(section)}
 }
 accountHandler=render;window.addEventListener('teachertiles:accountchange',accountHandler);render();back.focus({preventScroll:true});
 const observer=new MutationObserver(()=>{if(modal.hidden){observer.disconnect();window.removeEventListener('teachertiles:accountchange',accountHandler);view.remove();releaseShop()}});observer.observe(modal,{attributes:true,attributeFilter:['hidden']});
}

export function cosmeticAccessDialog({importing=false}={}){
 return new Promise(resolve=>{
  const d=document.createElement('dialog');d.className='template-dialog board-access-dialog';d.setAttribute('aria-labelledby','board-access-title');
  const crown=document.createElement('div');crown.className='board-access-crown';crown.setAttribute('aria-hidden','true');crown.innerHTML='<svg viewBox="0 0 48 48"><use href="assets/ui/subscriber-crown.svg#crown"/></svg>';
  const h=document.createElement('h2');h.id='board-access-title';h.textContent=importing?'A few cosmetics are missing':'Your board needs membership';
  const p=document.createElement('p');p.textContent=importing?'Sorry! You don’t own all of the cosmetics used on this board. Subscribe to unlock them and make this board yours.':'Some cosmetics on this board are no longer unlocked. Renew your membership, shop for the exact cosmetics this board needs, or remove only the items you don’t own. Your other content stays.';
  const actions=document.createElement('div');actions.className='board-access-actions';let settled=false;
  const finish=value=>{if(settled)return;settled=true;resolve(value);d.close()};
  const button=(label,value)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.className='board-access-'+value;b.onclick=event=>{event.preventDefault();event.stopPropagation();finish(value)};actions.append(b)};
  button(importing?'Subscribe':'Renew Subscription','subscribe');if(!importing){button('Shop Cosmetics','shop');button('Remove unowned paid items','remove')}button('Back','back');d.append(crown,h,p,actions);
  d.oncancel=e=>{e.preventDefault();finish('back')};d.onclose=()=>{d.remove();if(!settled){settled=true;resolve('back')}};document.body.append(d);d.showModal();
 });
}
export function openCosmeticShop(action){
 if(action==='subscribe'){void openSubscriptionShop();return}
 if(action==='shop'){void openBoardRecoveryShop();return}
 void nextTask().then(()=>{liftShop();openShopShell()});
}
