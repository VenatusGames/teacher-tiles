export function createUserDetails(call,onDeleted) {
  const dialog=document.createElement('dialog');dialog.className='user-details';dialog.setAttribute('aria-labelledby','user-detail-title');
  dialog.innerHTML=`<button class="user-details-close quiet" aria-label="Close user details">×</button><p class="eyebrow">USER ACCOUNT</p><h2 id="user-detail-title">User details</h2><p class="user-detail-email"></p><dl class="user-detail-facts"></dl>
    <section class="user-patch-tools"><h3>Manage Patches</h3><p>Give or remove a patch. New awards use today’s date. Employee and Subscriber patches are managed automatically.</p><div class="user-patch-choices"></div></section>
    <section class="user-delete-tools"><h3>Delete account</h3><p>Permanently removes the sign-in account, saved boards, private account data, and organization memberships. This cannot be undone. Billing records are retained.</p><button class="user-delete-open danger" type="button">Delete account…</button><form class="user-delete-confirm" hidden><label>Type <strong></strong> to confirm<input autocomplete="off" spellcheck="false" aria-label="Confirm account email or ID"></label><div><button class="quiet" type="button">Cancel</button><button class="danger" type="submit" disabled>Permanently delete account</button></div></form></section><p class="user-detail-status" role="status" aria-live="polite"></p>`;
  document.body.append(dialog);
  const status=dialog.querySelector('.user-detail-status'),facts=dialog.querySelector('dl'),choices=dialog.querySelector('.user-patch-choices');
  const confirm=dialog.querySelector('form'),input=confirm.querySelector('input'),submit=confirm.querySelector('[type=submit]'),remove=dialog.querySelector('.user-delete-open');
  let user=null,generation=0,deleting=false;
  const close=()=>{if(!deleting){generation++;dialog.close();}};
  dialog.querySelector('.user-details-close').onclick=close;
  dialog.addEventListener('cancel',event=>{if(deleting)event.preventDefault();else generation++;});
  dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
  const date=value=>value?new Date(value).toLocaleString():'Not available';
  function render(){
    dialog.querySelector('h2').textContent=user.displayName||'User details';dialog.querySelector('.user-detail-email').textContent=user.email||user.uid;facts.replaceChildren();
    for(const [label,value] of [['User ID',user.uid],['Created',date(user.createdAt)],['Last sign-in',date(user.lastSignIn)],['Last activity',date(user.lastSeen)],['Account',user.disabled?'Disabled':'Enabled'],['Email verified',user.emailVerified?'Yes':'No'],['Subscriber',user.subscriber?'Yes':user.subscriptionPreview?'Dev console preview':'No'],['Beta access',user.developer?'Developer':user.betaAccess?'Enabled':'Off'],['Coins',String(user.coinBalance)]]){const term=document.createElement('dt'),detail=document.createElement('dd');term.textContent=label;detail.textContent=value;facts.append(term,detail);}
    choices.innerHTML='<label for="award-patch-select">Patch</label><div class="patch-award-row"><select id="award-patch-select" aria-label="Choose a patch"><option value="">Choose a patch…</option></select><button class="primary" type="button" disabled>Give Patch</button></div>';
    const select=choices.querySelector('select'),give=choices.querySelector('button');
    const isAwarded=id=>!user.patchAwards?.[id]?.revoked&&(!!user.patchAwards?.[id]||id==='beta'&&user.legacyBeta);
    for(const [id,name] of [['beta','Beta Tester'],['contributor','Contributor'],['stickerer','Stickerer'],['tile-layer','Tile Layer']]){
      const option=document.createElement('option'),awarded=isAwarded(id);option.value=id;option.textContent=name+(awarded?' · Awarded':'');select.append(option);
    }
    select.disabled=user.disabled;select.onchange=()=>{give.disabled=!select.value||user.disabled;give.textContent=isAwarded(select.value)?'Remove Patch':'Give Patch';give.className=isAwarded(select.value)?'danger':'primary';};
    give.onclick=async()=>{const attempt=generation,patchId=select.value,name=select.selectedOptions[0].textContent.replace(' · Awarded',''),enabled=!isAwarded(patchId);if(!patchId)return;give.disabled=select.disabled=true;status.textContent=enabled?'Awarding patch…':'Removing patch…';try{const response=await call('giveUserPatch',{uid:user.uid,patchId,enabled});if(attempt!==generation)return;user.patchAwards=response.data.patchAwards;render();status.textContent=name+(enabled?' awarded.':' removed.')+' The collection updates when the user reloads TeacherTiles.';}catch(error){if(attempt===generation){give.disabled=select.disabled=false;status.textContent=error.message||'Could not update patch.';}}};
    remove.disabled=user.developer||user.subscriber;remove.title=user.developer?'Developer accounts cannot be deleted here.':user.subscriber?'End the subscription before deleting this account.':'';
  }
  remove.onclick=()=>{confirm.hidden=false;remove.hidden=true;confirm.querySelector('strong').textContent=user.email||user.uid;input.value='';submit.disabled=true;input.focus();};
  confirm.querySelector('[type=button]').onclick=()=>{confirm.hidden=true;remove.hidden=false;};
  input.oninput=()=>{submit.disabled=input.value!==(user?.email||user?.uid);};
  confirm.onsubmit=async event=>{event.preventDefault();if(deleting||input.value!==(user?.email||user?.uid))return;deleting=true;dialog.querySelectorAll('button,input').forEach(el=>el.disabled=true);status.textContent='Deleting account and saved data. Please wait…';try{await call('deleteDeveloperUser',{uid:user.uid,confirmation:input.value});deleting=false;close();onDeleted();}catch(error){status.textContent=error.message||'Deletion failed. Reload details before retrying.';deleting=false;dialog.querySelectorAll('button,input').forEach(el=>el.disabled=false);render();}};
  async function open(uid){const attempt=++generation;user=null;dialog.querySelectorAll('button,input').forEach(el=>el.disabled=false);status.textContent='Loading user…';facts.replaceChildren();choices.replaceChildren();dialog.querySelector('h2').textContent='User details';dialog.querySelector('.user-detail-email').textContent='';confirm.hidden=true;remove.hidden=false;remove.disabled=true;if(!dialog.open)dialog.showModal();try{const response=await call('getDeveloperUser',{uid});if(attempt!==generation)return;user=response.data;render();status.textContent='';}catch(error){if(attempt===generation)status.textContent=error.message||'Could not load user.';}}
  return {open,close};
}
