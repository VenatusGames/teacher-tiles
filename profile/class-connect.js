(() => {
  let dialog,body,activeClass='',uid='',entry=null,loaded=false,busy=false,error='',confirmation='',linkView=false,generation=0;
  const make=(tag,cls='',text='')=>{const node=document.createElement(tag);node.className=cls;node.textContent=text;return node;};
  const symbols={back:'<path d="m14 6-6 6 6 6"/>',board:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v4M8 21h8M10 7.5l6 3-6 3Z"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',link:'<path d="m10 13 4-4m-6 1-2 2a4 4 0 0 0 6 6l2-2m2-2 2-2a4 4 0 0 0-6-6l-2 2"/>',copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1"/>'};
  function button(label,action,cls='',symbol='') {
    const node=make('button',`cs-button ${cls}`);node.type='button';
    if(symbol){const icon=make('span','cs-icon');icon.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${symbols[symbol]}</svg>`;node.append(icon);}
    node.append(make('span','',label));node.addEventListener('click',action);return node;
  }
  const current=()=>readClassRosters().find(c=>c.id===activeClass);
  function service(){if(!window.TeacherTilesClassConnect)throw new Error('ClassConnect is still loading. Try again in a moment.');return window.TeacherTilesClassConnect;}
  function url(){const link=new URL('class-connect.html',document.baseURI);link.search='';link.hash=entry.token;return link.href;}
  function safeError(e){return String(e?.message || 'Unable to update ClassConnect. Please try again.').replace(/^Firebase:\s*/,'');}
  function ensureDialog() {
    if(dialog)return;
    dialog=make('dialog','cs-modal cc-panel');dialog.setAttribute('aria-labelledby','cc-title');
    const header=make('header','cs-modal-header'),title=make('h2','','ClassConnect');title.id='cc-title';
    const close=button('',()=>dialog.close(),'cs-close profile-panel__close','close');close.setAttribute('aria-label','Close ClassConnect');
    header.append(title,close);body=make('div','cc-panel-body');dialog.append(header,body);document.body.append(dialog);
    dialog.addEventListener('close',()=>{generation++;activeClass='';entry=null;body.replaceChildren();});
    dialog.addEventListener('keydown',event=>event.stopPropagation());
    dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
    document.getElementById('profile-classes-panel')?.addEventListener('close',()=>dialog.close());
    window.addEventListener('teachertiles:authchange',()=>{if(dialog.open && uid!==(window.TeacherTilesAuth?.user?.uid || ''))dialog.close();});
    window.addEventListener('teachertiles:classeschange',()=>{if(dialog.open){if(!current())dialog.close();else if(!busy)render();}});
    window.addEventListener('teachertiles:classconnectsync',event=>{
      if(!dialog.open || uid!==event.detail?.userId)return;
      const status=body.querySelector('.cc-sync');if(status)status.textContent=event.detail.status==='error'?event.detail.message:event.detail.status==='saving'?'Updating student view…':event.detail.status==='stale'?'A newer class save is available. Reopen Class View to refresh.':'Student view up to date';
    });
  }
  async function refresh() {
    const ticket=generation;busy=true;error='';render();
    try {
      await service().retry();
      const result=await service().list();if(ticket!==generation)return;
      entry=result.links.find(link=>link.classId===activeClass) || null;loaded=true;
    } catch(e){if(ticket===generation)error=safeError(e);}
    finally{if(ticket===generation){busy=false;render();}}
  }
  async function change(action) {
    const roster=current();if(!roster)return dialog.close();
    const ticket=generation;busy=true;error='';confirmation='';render();
    try {
      if(action!=='disable'){
        // Drain earlier private saves before publishing a newly created class link.
        await queueEncryptedClassSave(readClassRosters());
        if(ticket!==generation)return;
        if(localStorage.getItem(pbisDirtyStorageKey()))throw new Error('Your class is still waiting to save. Check your connection and try again.');
      }
      const latest=current();if(!latest)return dialog.close();
      const result=await service().change(action,latest,entry?.revision || 0);
      if(ticket!==generation)return;entry=result.link;loaded=true;
    } catch(e) {
      if(ticket!==generation)return;error=safeError(e);
      // A lost response must not leave an obsolete reset link visible or repeat a reset.
      try{const result=await service().list();if(ticket===generation){entry=result.links.find(link=>link.classId===activeClass) || null;loaded=true;}}catch{if(ticket===generation){loaded=false;entry=null;}}
    } finally{if(ticket===generation){busy=false;render();}}
  }
  function render() {
    const roster=current();if(!roster)return;
    body.replaceChildren();dialog.setAttribute('aria-busy',String(busy));
    const identity=make('div','cc-identity'),avatar=make('div','cc-class-avatar');
    if(roster.logoImage){const img=make('img');img.src=roster.logoImage;img.alt='';avatar.append(img);}else avatar.textContent=roster.logo || '👥';
    const info=make('div','cc-identity-info'),nameRow=make('div','cc-identity-heading');nameRow.append(make('h3','',roster.name));info.append(nameRow,make('p','cs-muted',`${roster.students.length} student${roster.students.length===1?'':'s'}`));identity.append(avatar,info);body.append(identity);
    if(!linkView){
      const tools=make('div','cc-tool-grid');
      const link=button('Student Link',()=>{linkView=true;render();body.querySelector('.cc-link-back')?.focus({preventScroll:true});},'cc-open-link','link');
      nameRow.append(link);
      const start=button('',async()=>{start.disabled=true;try{if(!entry?.active)await change('create');if(entry?.active)await window.TeacherTilesBoardSessions.teacher({classId:activeClass,name:roster.name,roster:{name:roster.name,gradeLevel:roster.gradeLevel,students:roster.students.map(name=>{const visual=roster.studentProfiles?.[starChartStudentKey(name)]||{};return {name,emoji:visual.emoji||'',image:visual.image||''};})}});}catch(e){error=safeError(e);linkView=true;render();}finally{start.disabled=false;}},'cc-tool-card cc-start-session','board');start.lastElementChild.remove();const startCopy=make('span','cc-tool-copy');startCopy.append(make('strong','','Start Board Session'),make('small','','Controlled or Free Session'));start.append(startCopy);
      tools.append(start);body.append(tools);return;
    }
    const back=button('ClassConnect',()=>{linkView=false;confirmation='';render();body.querySelector('.cc-open-link')?.focus({preventScroll:true});},'cc-link-back','back');back.setAttribute('aria-label','Back to ClassConnect');body.prepend(back);
    const card=make('section','cc-link-card'),cardHead=make('div','cc-section-heading');cardHead.append(make('h3','','Student Link'));card.append(cardHead,make('p','cs-muted','Keep this link private and only share with trusted members of your classroom community.'));
    if(!loaded){const status=make('p','cc-loading',busy?'Loading ClassConnect…':'ClassConnect is unavailable');status.setAttribute('role','status');card.append(status);if(!busy)card.append(button('Try Again',refresh));}
    else if(entry?.active) {
      cardHead.append(make('span','cc-active','Link active'));
      const row=make('div','cc-link-row'),input=make('input','cc-link-input');input.readOnly=true;input.value=url();input.setAttribute('aria-label','Student link');input.addEventListener('click',()=>input.select());
      const copy=button('Copy Link',async()=>{
        try{await navigator.clipboard.writeText(input.value);copy.lastElementChild.textContent='Copied!';setTimeout(()=>{if(copy.isConnected)copy.lastElementChild.textContent='Copy Link';},1800);}
        catch{input.focus();input.select();copy.lastElementChild.textContent='Select and copy link';}
      },'cs-primary','copy');row.append(input,copy);card.append(row);
      card.append(make('p','cc-link-hint','This link stays the same until you disable or reset it.'));
      const actions=make('div','cc-actions'),preview=make('a','cs-button','Open Student View');preview.href=url();preview.target='_blank';preview.rel='noopener noreferrer';
      actions.append(preview,button('Reset Link',()=>{confirmation='reset';render();},'','refresh'),button('Disable Link',()=>{confirmation='disable';render();},'cs-danger'));card.append(actions);
      const sync=make('p','cc-sync','Class and student changes update here after saving.');sync.setAttribute('role','status');card.append(sync);
    } else {
      card.append(make('p','cc-no-link',entry?'Student link disabled. Create a new link when you’re ready to share again.':'Create one link to share with your students. They can open it without an account.'));
      card.append(button('Create Student Link',()=>change('create'),'cs-primary','link'));
    }
    body.append(card);
    if(confirmation){
      const confirm=make('section','cc-confirm');confirm.setAttribute('role','alert');
      confirm.append(make('h3','',confirmation==='reset'?'Replace the student link?':'Disable the student link?'),make('p','',confirmation==='reset'?'The old link will stop working. Share the new link with your students.':'Students will no longer be able to open this link. Your class and students will stay saved.'));
      const actions=make('div','cc-actions');actions.append(button('Cancel',()=>{confirmation='';render();}),button(confirmation==='reset'?'Reset Link Now':'Disable Link Now',()=>change(confirmation),'cs-danger'));confirm.append(actions);body.append(confirm);
    }
    if(error){const alert=make('p','cc-error',error);alert.setAttribute('role','alert');body.append(alert);if(loaded)body.append(button('Refresh Link Status',refresh));}
    if(busy){body.querySelectorAll('button').forEach(b=>b.disabled=true);const status=make('p','cc-loading','Please wait…');status.setAttribute('role','status');if(loaded)body.append(status);}
  }
  window.TeacherTilesClassConnectUI={async ensureLink(classId){
    await service().retry();const result=await service().list(),existing=result.links.find(link=>link.classId===classId);if(existing?.active)return existing;
    await queueEncryptedClassSave(readClassRosters());if(localStorage.getItem(pbisDirtyStorageKey()))throw Error('Your class is still waiting to save. Check your connection and try again.');
    const roster=readClassRosters().find(c=>c.id===classId);if(!roster)throw Error('This class no longer exists.');
    return (await service().change('create',roster,existing?.revision||0)).link;
  },open(classId){ensureDialog();generation++;activeClass=classId;uid=window.TeacherTilesAuth?.user?.uid || '';entry=null;loaded=false;confirmation='';linkView=false;error='';if(!dialog.open)dialog.showModal();refresh();}};
})();
