(() => {
  const frames=window.TeacherTilesProfileFrames,card=document.querySelector('.profile-account-card');
  if(!frames||!card)return;
  const button=document.createElement('button');button.type='button';button.className='profile-frames-button';button.title='Profile Frames';button.setAttribute('aria-label','Choose Profile Frame');button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');
  button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="13" height="13" rx="3"/><path d="M8 20h9a3 3 0 0 0 3-3V8"/><rect x="8" y="8" width="5" height="5" rx="1"/></svg>';card.append(button);
  let uid='',sdk,db,selected='',loading=false,saving=false,generation=0,lastRead=0,closeDrawer=null,message='';
  const cacheKey=id=>'teachertiles.profile-frame.v1.'+id;
  const normalize=id=>frames.find(id)?id:'';
  const account=()=>window.TeacherTilesAccount?.state;
  const accessible=frame=>!frame||Boolean(account()?.ready&&account()?.userId===uid&&(account().ownedProductIds?.includes(frame.productId)||account().subscriptionActive||account().subscriptionOverride));
  const equipped=()=>accessible(frames.find(selected))?selected:'';
  function render(){frames.decorate(card,uid?equipped():'');button.disabled=!uid||loading||saving;}
  async function read(){
    if(!uid||loading||saving)return;const token=generation,user=uid;loading=true;render();
    try{const doc=await sdk.getDoc(sdk.doc(db,'users',user,'private','profileAppearance'));if(token!==generation)return;selected=normalize(doc.exists()?doc.data().frameId:'');try{localStorage.setItem(cacheKey(user),selected);}catch{}message='';lastRead=Date.now();}
    catch{if(token===generation)message='Using your saved frame. Changes will sync when your connection is available.';}
    finally{if(token===generation){loading=false;render();}}
  }
  function setUser(id,firestore,database){
    if(id===uid)return;generation++;closeDrawer?.();uid=id||'';sdk=firestore;db=database;loading=saving=false;message='';lastRead=0;
    selected='';if(uid)try{selected=normalize(localStorage.getItem(cacheKey(uid)));}catch{}
    render();if(uid)void read();
  }
  async function equip(id,status){
    if(saving||loading||!uid||!accessible(frames.find(id)))return;
    const token=generation,user=uid;const previous=selected;saving=true;selected=id;render();status.textContent='Saving frame…';
    try{await sdk.setDoc(sdk.doc(db,'users',user,'private','profileAppearance'),{frameId:id},{merge:true});if(token!==generation)return;try{localStorage.setItem(cacheKey(user),id);}catch{}lastRead=Date.now();closeDrawer?.(true);}
    catch{if(token===generation){selected=previous;status.textContent='Could not save your frame. Check your connection and try again.';}}
    finally{if(token===generation){saving=false;render();}}
  }
  button.addEventListener('click',()=>{
    if(closeDrawer){closeDrawer(true);return;}
    const drawer=document.createElement('section');drawer.className='tile-skins-drawer profile-frames-drawer';drawer.setAttribute('popover','manual');drawer.setAttribute('role','dialog');drawer.setAttribute('aria-label','Profile Frames');
    drawer.innerHTML='<header><strong>Profile Frames</strong><button type="button" aria-label="Close Profile Frames">×</button></header><div class="tile-skins-drawer-grid"></div><p class="profile-frames-status" role="status"></p><button type="button" class="profile-frames-shop">Browse Profile Cosmetics →</button>';
    document.body.append(drawer);drawer.showPopover();button.setAttribute('aria-expanded','true');
    const events=new AbortController(),status=drawer.querySelector('[role=status]');status.textContent=message;
    const close=(focus=false)=>{events.abort();drawer.remove();button.setAttribute('aria-expanded','false');closeDrawer=null;if(focus)button.focus({preventScroll:true});};closeDrawer=close;
    for(const frame of [null,...frames.catalog.filter(accessible)]){
      const choice=document.createElement('button');choice.type='button';choice.className='tile-skins-choice profile-frame-choice';choice.dataset.frameChoice=frame?.id||'';choice.setAttribute('aria-pressed',String(equipped()===(frame?.id||'')));
      const art=document.createElement('span');art.className='tile-skins-choice-preview';art.append(frames.preview(frame?.id||''));
      const name=document.createElement('strong');name.textContent=frame?.name||'Default';const detail=document.createElement('small');detail.textContent=equipped()===(frame?.id||'')?'Applied':'Apply Frame';choice.append(art,name,detail);choice.onclick=()=>void equip(frame?.id||'',status);drawer.querySelector('.tile-skins-drawer-grid').append(choice);
    }
    drawer.querySelector('header button').onclick=()=>close(true);
    drawer.querySelector('.profile-frames-shop').onclick=()=>{close();window.TeacherTilesShop?.openPage('profile-cosmetics');};
    const position=()=>{const r=button.getBoundingClientRect(),d=drawer.getBoundingClientRect();drawer.style.left=Math.max(8,Math.min(innerWidth-d.width-8,r.right-d.width))+'px';drawer.style.top=Math.max(8,Math.min(innerHeight-d.height-8,r.bottom+8))+'px';};
    document.addEventListener('pointerdown',e=>{if(!drawer.contains(e.target)&&!button.contains(e.target))close();},{capture:true,signal:events.signal});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);}},{capture:true,signal:events.signal});
    window.addEventListener('resize',position,{signal:events.signal});document.addEventListener('scroll',position,{capture:true,passive:true,signal:events.signal});
    position();drawer.querySelector('header button').focus({preventScroll:true});
  });
  new MutationObserver(()=>{if(document.getElementById('profile-modal')?.hidden)closeDrawer?.();}).observe(document.getElementById('profile-modal'),{attributes:true,attributeFilter:['hidden']});
  window.addEventListener('teachertiles:accountchange',()=>{closeDrawer?.();render();});
  window.addEventListener('focus',()=>{if(Date.now()-lastRead>300000)void read();});
  window.addEventListener('storage',event=>{if(uid&&event.key===cacheKey(uid)&&!saving){selected=normalize(event.newValue);render();closeDrawer?.();}});
  window.TeacherTilesProfileFrames.setUser=setUser;
  render();
})();
