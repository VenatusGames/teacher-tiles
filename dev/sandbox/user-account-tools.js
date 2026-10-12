export function createAccountTools(host,call,onUpdate=()=>{}) {
  let uid='',identity='',data=null,generation=0,busy=false,pending=null;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  host.className='user-account-tools';
  host.innerHTML=`<div class="account-tools-heading"><h3>Manage Account</h3><button type="button" class="quiet" data-refresh>Refresh</button></div>
    <p data-feedback role="status" aria-live="polite"></p><div data-content hidden>
    <section class="account-membership"><div><span class="eyebrow">MEMBERSHIP</span><strong data-membership></strong><p data-billing></p></div><button type="button" class="danger" data-end>End Membership Now</button></section>
    <section><div class="account-coins-heading"><h3>Coins</h3><strong data-balance></strong></div><form data-coins class="account-coins-form"><label>Amount<input type="number" name="amount" min="1" max="1000000" step="1" required placeholder="100"></label><button type="submit" class="primary" value="add">Add Coins</button><button type="submit" class="quiet" value="remove">Remove Coins</button></form></section>
    <section><div class="account-tools-heading"><h3>Cosmetics</h3><span data-count></span></div><p>Permanent ownership only. Membership access does not grant permanent ownership; removing an item does not block access provided by an active membership.</p><div class="account-cosmetic-filters"><input type="search" data-search placeholder="Search cosmetics…" aria-label="Search Cosmetics"><select data-filter aria-label="Filter Cosmetics"><option value="all">All Cosmetics</option><option value="owned">Owned Only</option></select></div><div class="account-cosmetics-list" data-cosmetics></div></section>
    </div><form class="account-change-confirm" data-confirm hidden><h4>Confirm Change</h4><p data-summary></p><label>Reason<input name="reason" required maxlength="300" placeholder="Testing or support request"></label><label data-identity-label hidden>Type <strong data-identity></strong> to confirm<input name="identity" autocomplete="off" spellcheck="false"></label><div class="account-confirm-actions"><button type="button" class="quiet" data-cancel>Back</button><button type="submit" class="primary" data-apply>Confirm Change</button></div></form>`;
  const q=selector=>host.querySelector(selector),feedback=q('[data-feedback]'),confirm=q('[data-confirm]');
  function paintCosmetics(){
    if(!data)return;
    const owned=new Set(data.ownedProductIds||[]),catalog=new Map((data.catalog||[]).map(item=>[item.id,item]));
    for(const id of owned)if(!catalog.has(id))catalog.set(id,{id,name:id,retired:true});
    const words=q('[data-search]').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const items=[...catalog.values()].filter(item=>(q('[data-filter]').value!=='owned'||owned.has(item.id))&&words.every(word=>(item.name+' '+item.id).toLowerCase().includes(word))).sort((a,b)=>a.name.localeCompare(b.name));
    q('[data-count]').textContent=`${owned.size} Owned`;
    q('[data-cosmetics]').innerHTML=items.map(item=>`<div class="account-cosmetic-row"><span><strong>${escape(item.name)}</strong><small>${item.retired?'Retired Cosmetic':item.id.startsWith('tile-skin-')?'Tile Skin':item.id.startsWith('theme-')?'Theme':'Cosmetic Pack'}${owned.has(item.id)?' · Owned':''}</small></span><button type="button" class="${owned.has(item.id)?'quiet':'primary'}" data-product="${escape(item.id)}">${owned.has(item.id)?'Remove':'Add'}</button></div>`).join('')||'<p>No matching cosmetics.</p>';
  }
  function paint(){
    q('[data-content]').hidden=false;
    q('[data-balance]').textContent=Number(data.coinBalance).toLocaleString();
    const subs=data.billing?.subscriptions||[];
    q('[data-membership]').textContent=data.subscriptionPreview?'Developer Preview':data.subscriptionType==='trial'&&data.subscriber?'Trial Membership':data.subscriber?'Subscriber':'Free Account';
    q('[data-billing]').textContent=data.billingError|| (data.billing?.accessWithoutBilling?'Access is active but no current Stripe subscription was found. Review billing before making changes.':subs.length?subs.map(sub=>sub.status==='trialing'?'Trial active':sub.status==='canceled'?'Cancelled':'Subscription: '+sub.status).join(' · '):'No active Stripe subscription.');
    q('[data-end]').disabled=!!data.billingError||!!data.billing?.accessWithoutBilling||subs.some(sub=>!sub.canEndNow)||(!subs.length&&!data.subscriptionPreview);
    paintCosmetics();onUpdate(data);
  }
  async function load(){
    const attempt=++generation;feedback.textContent='Loading account tools…';q('[data-refresh]').disabled=true;
    try{const response=await call('developerAccount',{action:'details',uid});if(attempt!==generation)return;data=response.data;paint();feedback.textContent='';}
    catch(error){if(attempt===generation)feedback.textContent=error.message||'Could not load account tools.';}
    finally{if(attempt===generation)q('[data-refresh]').disabled=false;}
  }
  function review(payload,summary){
    if(busy)return;
    pending={payload};confirm.reset();q('[data-summary]').textContent=summary;
    const ending=payload.action==='end-membership';q('[data-identity-label]').hidden=!ending;confirm.elements.identity.required=ending;q('[data-identity]').textContent=identity;
    q('[data-apply]').className=ending?'danger':'primary';q('[data-apply]').textContent=ending?'End Membership Now':'Confirm Change';
    confirm.hidden=false;confirm.scrollIntoView({block:'nearest',behavior:'smooth'});confirm.elements.reason.focus();
  }
  q('[data-coins]').onsubmit=event=>{event.preventDefault();if(!data)return;const amount=Number(event.currentTarget.elements.amount.value),delta=event.submitter?.value==='remove'?-amount:amount;if(!Number.isSafeInteger(amount)||amount<=0||amount>1000000)return;
    if(data.coinBalance+delta<0){feedback.textContent='This account does not have that many coins.';return;}
    review({action:'coins',delta},`${delta>0?'Add':'Remove'} ${amount.toLocaleString()} coins for ${identity}. Current balance: ${Number(data.coinBalance).toLocaleString()}.`);
  };
  q('[data-cosmetics]').onclick=event=>{const button=event.target.closest('[data-product]');if(!button||!data)return;const productId=button.dataset.product,owned=!data.ownedProductIds.includes(productId);const name=data.catalog.find(item=>item.id===productId)?.name||productId;review({action:'cosmetic',productId,owned},`${owned?'Give':'Remove'} ${name} ${owned?'to':'from'} ${identity}. This will not charge or refund coins.`);};
  q('[data-end]').onclick=()=>review({action:'end-membership',subscriptionIds:(data.billing?.subscriptions||[]).map(sub=>sub.id)},`End all current subscriptions or trials for ${identity} immediately and turn off developer subscription preview. Future renewal stops. No refund or proration is issued. Access is removed when Stripe confirms cancellation.`);
  q('[data-search]').oninput=q('[data-filter]').onchange=paintCosmetics;
  q('[data-cancel]').onclick=()=>{if(!busy){pending=null;confirm.hidden=true;}};
  q('[data-refresh]').onclick=()=>{confirm.hidden=true;pending=null;void load();};
  confirm.onsubmit=async event=>{
    event.preventDefault();if(busy||!pending||!confirm.reportValidity())return;
    const payload={...pending.payload,uid,reason:confirm.elements.reason.value.trim(),...(pending.payload.action==='end-membership'?{confirmation:confirm.elements.identity.value}:{})};
    if(payload.action==='end-membership'&&payload.confirmation!==identity){feedback.textContent='Type the account email or ID exactly.';return;}
    const fingerprint=JSON.stringify(payload);if(pending.fingerprint!==fingerprint){pending.fingerprint=fingerprint;pending.requestId=crypto.randomUUID();}
    const requestId=pending.requestId,attempt=generation;busy=true;feedback.textContent='Saving change…';
    const controls=[...host.closest('dialog').querySelectorAll('button,input,select')].map(node=>[node,node.disabled]);controls.forEach(([node])=>node.disabled=true);
    try{
      const response=await call('developerAccount',{...payload,requestId});if(attempt!==generation)return;
      confirm.hidden=true;pending=null;
      if(payload.action==='end-membership'){
        data.subscriptionPreview=false;
        feedback.textContent=response.data.pending?'Cancellation sent to Stripe. Use Refresh to confirm the account has returned to free access.':'Developer preview removed. The account has free access.';
        q('[data-end]').disabled=true;onUpdate({...data,subscriptionPreview:false});
      }else{Object.assign(data,response.data);paint();feedback.textContent='Saved. The user’s balance and access update when they refresh TeacherTiles.';}
    }catch(error){if(attempt===generation)feedback.textContent=(error.message||'Could not save the change.')+' You can retry safely.';}
    finally{busy=false;controls.forEach(([node,disabled])=>{if(node.isConnected)node.disabled=disabled;});if(data&&pending===null&&payload.action==='end-membership')q('[data-end]').disabled=true;}
  };
  return {get busy(){return busy;},open(user){generation++;uid=user.uid;identity=user.email||user.uid;data=null;pending=null;confirm.hidden=true;q('[data-content]').hidden=true;q('[data-search]').value='';q('[data-filter]').value='all';void load();},reset(){generation++;data=null;pending=null;confirm.hidden=true;q('[data-content]').hidden=true;feedback.textContent='';}};
}
