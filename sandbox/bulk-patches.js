export function createBulkPatches(root,call,selected,onComplete){
 root.innerHTML=`<div><h3>Bulk patch awards</h3><p>Give a patch to selected accounts or every enabled account.</p></div><div class="bulk-patch-controls"><select aria-label="Bulk patch"><option value="">Choose a patch…</option><option value="beta">Beta Tester</option><option value="contributor">Contributor</option><option value="stickerer">Stickerer</option><option value="tile-layer">Tile Layer</option></select><select aria-label="Award audience"><option value="selected">Selected users</option><option value="all">All users</option></select><button class="primary" disabled>Review award</button></div><div class="bulk-selection"><span>0 selected</span><button class="quiet" data-page type="button">Select loaded users</button><button class="quiet" data-clear type="button">Clear selection</button></div>`;
 const [patch,audience]=root.querySelectorAll('select'),review=root.querySelector('.primary'),count=root.querySelector('.bulk-selection span');
 const dialog=document.createElement('dialog');dialog.className='user-details bulk-confirm';dialog.setAttribute('aria-labelledby','bulk-confirm-title');dialog.innerHTML='<h2 id="bulk-confirm-title">Give patch in bulk?</h2><p class="bulk-summary"></p><p>Existing awards keep their original dates. Disabled accounts are skipped.</p><p class="bulk-progress" role="status" aria-live="polite"></p><div class="bulk-confirm-actions"><button class="quiet" data-cancel>Cancel</button><button class="primary" data-confirm>Give patch</button></div>';document.body.append(dialog);
 let running=false,stop=false;const cancel=dialog.querySelector('[data-cancel]'),confirm=dialog.querySelector('[data-confirm]'),progress=dialog.querySelector('.bulk-progress');
 function update(){count.textContent=selected.size+' selected';review.disabled=running||!patch.value||audience.value==='selected'&&!selected.size;}
 patch.onchange=audience.onchange=update;
 root.querySelector('[data-page]').onclick=()=>{document.querySelectorAll('.user-select:not(:disabled)').forEach(input=>{input.checked=true;input.dispatchEvent(new Event('change'));});};
 root.querySelector('[data-clear]').onclick=()=>{selected.clear();document.querySelectorAll('.user-select').forEach(input=>input.checked=false);update();};
 review.onclick=()=>{dialog.querySelector('.bulk-summary').textContent=`Award ${patch.selectedOptions[0].textContent} to ${audience.value==='all'?'ALL enabled users (including users outside the current filters)':selected.size+' selected users'}?`;progress.textContent='';confirm.hidden=false;confirm.disabled=false;cancel.textContent='Cancel';dialog.showModal();};
 cancel.onclick=()=>{if(running){stop=true;cancel.disabled=true;progress.textContent+=' Stopping after this batch…';}else dialog.close();};
 dialog.addEventListener('cancel',event=>{if(running){event.preventDefault();stop=true;}});
 confirm.onclick=async()=>{
  if(running)return;running=true;stop=false;confirm.disabled=true;cancel.textContent='Stop after batch';update();
  const scope=audience.value,patchId=patch.value,ids=[...selected];let token,offset=0,awarded=0,unchanged=0,skipped=0;
  try{do{
    progress.textContent=`Awarding… ${awarded} awarded · ${unchanged} already held · ${skipped} skipped`;
    const {data}=await call('bulkGiveUserPatch',{scope,patchId,...(scope==='all'?(token?{pageToken:token}:{}):{uids:ids.slice(offset,offset+25)})});
    awarded+=data.awarded;unchanged+=data.unchanged;skipped+=data.skipped;token=data.nextPageToken;offset+=25;
   }while(!stop&&(scope==='all'?token:offset<ids.length));
   progress.textContent=`${stop?'Stopped':'Complete'}: ${awarded} awarded · ${unchanged} already held · ${skipped} skipped.`;
  }catch(error){progress.textContent=`Confirmed ${awarded} awards. The last batch may have partially completed. ${error.message||'Please try again.'} Retrying will skip awards already given.`;}
  finally{running=false;confirm.hidden=true;cancel.disabled=false;cancel.textContent='Close';update();onComplete();}
 };
 return {update,reset(){stop=true;dialog.close();selected.clear();update();}};
}
