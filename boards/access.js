import './cosmetics-policy.js';
const catalog=await fetch(new URL('./cosmetics-catalog.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Cosmetic catalog could not load.');return r.json();});
export const boardCosmetics=globalThis.TeacherTilesCosmeticsPolicy.policy(catalog);
export function cosmeticAccessDialog({importing=false}={}){
 return new Promise(resolve=>{
  const d=document.createElement('dialog');d.className='template-dialog board-access-dialog';d.setAttribute('aria-labelledby','board-access-title');
  const crown=document.createElement('div');crown.className='board-access-crown';crown.setAttribute('aria-hidden','true');crown.innerHTML='<svg viewBox="0 0 48 48"><use href="assets/ui/subscriber-crown.svg#crown"/></svg>';
  const h=document.createElement('h2');h.id='board-access-title';h.textContent=importing?'A few cosmetics are missing':'Your board needs membership';
  const p=document.createElement('p');p.textContent=importing?"Sorry! You don’t own all of the cosmetics used on this board. Subscribe to unlock them and make this board yours.":'Some cosmetics on this board are no longer unlocked. Renew your membership, shop for them, or remove only the items you don’t own. Your other content stays.';
  const actions=document.createElement('div');actions.className='board-access-actions';
  const finish=value=>{resolve(value);d.close();};
  const button=(label,value)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.className='board-access-'+value;b.onclick=()=>finish(value);actions.append(b);};
  button(importing?'Subscribe':'Reactivate membership','subscribe');
  if(!importing){button('Shop cosmetics','shop');button('Remove unowned paid items','remove');}
  button('Back','back');d.append(crown,h,p,actions);
  d.oncancel=e=>{e.preventDefault();finish('back');};d.onclose=()=>{d.remove();resolve('back');};document.body.append(d);d.showModal();
 });
}
export function openCosmeticShop(action){if(action==='subscribe')window.TeacherTilesShop?.openMembership();else window.TeacherTilesShop?.open();}
