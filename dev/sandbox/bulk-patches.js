import {manualPatchOptions} from '../profile/patch-catalog.js?v=20261020-product-polish';
export function createBulkPatches(root,call,selected,onComplete,startSelection=()=>{}){
 root.innerHTML=`<div><h3>Bulk Patches</h3></div><div class="bulk-patch-controls"><select class="bulk-patch-action" aria-label="Patch action"><option value="add">Add Patches</option><option value="remove">Remove Patches</option></select><select aria-label="Bulk patch"><option value="">Choose a patch…</option>${manualPatchOptions.map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select><select aria-label="Patch audience"><option value="selected">Selected Users</option><option value="all">All Users</option></select><button class="primary" disabled>Review Award</button></div><div class="bulk-selection"><span>0 selected</span><button class="quiet" data-page type="button">Select Loaded Users</button><button class="quiet" data-clear type="button">Clear Selection</button></div>`;
 const menu=document.createElement('div');menu.id='bulk-patch-menu';menu.className='bulk-patch-menu';menu.setAttribute('popover','auto');menu.setAttribute('role','dialog');menu.setAttribute('aria-label','Bulk patch controls');
 menu.append(...root.childNodes);
 const toggle=document.createElement('button');toggle.type='button';toggle.className='quiet';toggle.textContent='Bulk Patches';toggle.setAttribute('aria-label','Bulk Patches');toggle.setAttribute('popovertarget',menu.id);toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-haspopup','dialog');
 root.append(toggle,menu);document.querySelector('.users-toolbar').insertBefore(root,document.getElementById('users-status'));
 const closeMenu=()=>{if(menu.matches(':popover-open'))menu.hidePopover();};
 menu.addEventListener('toggle',event=>{const open=event.newState==='open';toggle.setAttribute('aria-expanded',String(open));if(open){const rect=toggle.getBoundingClientRect();menu.style.left=Math.max(16,Math.min(rect.right-menu.offsetWidth,innerWidth-menu.offsetWidth-16))+'px';menu.style.top=Math.max(16,Math.min(rect.bottom+8,innerHeight-menu.offsetHeight-16))+'px';}});
 window.addEventListener('resize',closeMenu);
 const [action,patch,audience]=root.querySelectorAll('select'),review=root.querySelector('.primary'),count=root.querySelector('.bulk-selection span');
 const dialog=document.createElement('dialog');dialog.className='user-details bulk-confirm';dialog.setAttribute('aria-labelledby','bulk-confirm-title');dialog.innerHTML='<h2 id="bulk-confirm-title">Give Patch in Bulk?</h2><p class="bulk-summary"></p><p class="bulk-explanation"></p><p class="bulk-progress" role="status" aria-live="polite"></p><div class="bulk-confirm-actions"><button class="quiet" data-cancel>Cancel</button><button class="primary" data-confirm>Give Patch</button></div>';document.body.append(dialog);
 let running=false,stop=false;const cancel=dialog.querySelector('[data-cancel]'),confirm=dialog.querySelector('[data-confirm]'),progress=dialog.querySelector('.bulk-progress');
 function update(){toggle.textContent='Bulk Patches'+(selected.size?' ('+selected.size+')':'');count.textContent=selected.size+' selected';review.textContent=action.value==='remove'?'Review Removal':'Review Award';review.disabled=running||!patch.value||audience.value==='selected'&&!selected.size;}
 action.onchange=patch.onchange=audience.onchange=update;
 root.querySelector('[data-page]').onclick=()=>{startSelection();document.querySelectorAll('.user-select:not(:disabled)').forEach(input=>{input.checked=true;input.dispatchEvent(new Event('change'));});};
 root.querySelector('[data-clear]').onclick=()=>{selected.clear();document.querySelectorAll('.user-select').forEach(input=>input.checked=false);update();};
 review.onclick=()=>{closeMenu();const removing=action.value==='remove';dialog.querySelector('h2').textContent=removing?'Remove Patch in Bulk?':'Give Patch in Bulk?';dialog.querySelector('.bulk-summary').textContent=`${removing?'Remove':'Award'} ${patch.selectedOptions[0].textContent} ${removing?'from':'to'} ${audience.value==='all'?'ALL enabled users (including users outside the current filters)':selected.size+' selected users'}?`;dialog.querySelector('.bulk-explanation').textContent=removing?'This removes the selected patch from their collections. Other patches stay unchanged. Disabled accounts are skipped.':'Existing awards keep their original dates. Disabled accounts are skipped.';confirm.textContent=removing?'Remove Patch':'Give Patch';confirm.className=removing?'danger':'primary';progress.textContent='';confirm.hidden=false;confirm.disabled=false;cancel.textContent='Cancel';dialog.showModal();};
 cancel.onclick=()=>{if(running){stop=true;cancel.disabled=true;progress.textContent+=' Stopping after this batch…';}else dialog.close();};
 dialog.addEventListener('cancel',event=>{if(running){event.preventDefault();stop=true;}});
 confirm.onclick=async()=>{
  if(running)return;running=true;stop=false;confirm.disabled=true;cancel.textContent='Stop after Batch';update();
  const scope=audience.value,patchId=patch.value,ids=[...selected],removing=action.value==='remove',verb=removing?'removed':'awarded',unchangedLabel=removing?'not held':'already held';let token,offset=0,changed=0,unchanged=0,skipped=0;
  try{do{
    progress.textContent=`${removing?'Removing':'Awarding'}… ${changed} ${verb} · ${unchanged} ${unchangedLabel} · ${skipped} skipped`;
    const {data}=await call(removing?'bulkRemoveUserPatch':'bulkGiveUserPatch',{scope,patchId,...(scope==='all'?(token?{pageToken:token}:{}):{uids:ids.slice(offset,offset+25)})});
    changed+=removing?data.removed:data.awarded;unchanged+=data.unchanged;skipped+=data.skipped;token=data.nextPageToken;offset+=25;
   }while(!stop&&(scope==='all'?token:offset<ids.length));
   progress.textContent=`${stop?'Stopped':'Complete'}: ${changed} ${verb} · ${unchanged} ${unchangedLabel} · ${skipped} skipped.`;
  }catch(error){progress.textContent=`Confirmed ${changed} ${verb}. The last batch may have partially completed. ${error.message||'Please try again.'} Retrying will skip accounts already updated.`;}
  finally{running=false;confirm.hidden=true;cancel.disabled=false;cancel.textContent='Close';update();onComplete();}
 };
 return {update,reset(){closeMenu();stop=true;dialog.close();selected.clear();update();}};
}
