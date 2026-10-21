(() => {
  const catalog = Object.freeze([
    Object.freeze({id:'floral',productId:'planner-skin-floral',name:'Garden Bloom',description:'Pastel botanical flowers, golden rings, and a framed plaque for your planner title.',price:250}),
    Object.freeze({id:'leather',productId:'planner-skin-leather',name:'Classic Leather',description:'Warm textured leather, fine stitching, an embossed title, and a matching clasp.',price:250}),
    Object.freeze({id:'striped',productId:'planner-skin-striped',name:'Ribbon Stripes',description:'Burgundy and blush stripes, golden corners, and a mint title plaque.',price:250}),
    Object.freeze({id:'open',productId:'planner-skin-open',name:'Open Planner',description:'An open weekly spread with center rings, ruled pages, and colorful divider tabs.',price:250}),
    Object.freeze({id:'seabirds',productId:'planner-skin-seabirds',name:'Seabirds',description:'White seabirds across a soft blue cover with a golden title plate.',price:250}),
    Object.freeze({id:'space',productId:'planner-skin-space',name:'Outer Space',description:'A midnight sky with distant stars, colorful planets, and delicate orbital paths.',price:250}),
    Object.freeze({id:'notebook',productId:'planner-skin-notebook',name:'Composition Notebook',description:'A classic marbled notebook with a cloth spine and ruled title label.',price:250}),
    Object.freeze({id:'hardcover',productId:'planner-skin-hardcover',name:'Cloth Hardcover',description:'A ring-free clothbound book with a recessed spine groove and embossed lettering.',price:250})
  ]);
  const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9 19h8a2 2 0 0 0 2-2V9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
  const normalize = id => catalog.some(skin=>skin.id===id)?id:'';
  const accessible = skin => !skin || cosmeticIsAccessible(skin.productId);
  const equipped = id => {const skin=catalog.find(item=>item.id===id);return skin&&accessible(skin)?skin.id:'';};
  let closeActive = null;
  function preview(id,title='My Planner',color=null) {
    const host=document.createElement('span');host.className='planner-skin-preview';host.dataset.plannerSkin=id||'';host.setAttribute('aria-hidden','true');
    host.innerHTML='<span class="planner-book-art"><span class="planner-book-loop"></span><span class="planner-book-cover"><span class="planner-book-cover-label"><b class="planner-book-embossed-title"></b><small>LESSON PLANNER</small></span><span class="planner-book-elastic"></span></span><span class="planner-book-binding">'+'<span></span>'.repeat(12)+'</span></span>';
    host.dataset.plannerColor=color?.id||'default';
    if(color){host.style.setProperty('--planner-book-color',color.value);host.style.setProperty('--planner-book-ink',color.ink);}
    host.querySelector('b').textContent=title;return host;
  }
  function mount(card,planner,{save,render,openShop,colorForSkin}) {
    card.dataset.plannerSkin=equipped(planner.skin);
    const button=document.createElement('button');button.type='button';button.className='planner-book-tool-button planner-book-skins';button.innerHTML=icon;button.title='Planner Skins';button.setAttribute('aria-label',`Change ${planner.name} skin`);button.setAttribute('aria-expanded','false');button.setAttribute('aria-haspopup','dialog');card.append(button);
    // Top-right tools share a hover zone; the skin control has its own corner.
    const controls=[...card.querySelectorAll('.planner-book-tool-button')];
    const topTools=controls.filter(control=>control.matches('.planner-book-customize,.planner-book-settings'));
    const hoverRadius=64;
    card.addEventListener('pointermove',event=>{
      if(event.pointerType==='touch')return;
      const nearby=control=>{
        const r=control.getBoundingClientRect();
        const dx=Math.max(r.left-event.clientX,0,event.clientX-r.right);
        const dy=Math.max(r.top-event.clientY,0,event.clientY-r.bottom);
        return Math.hypot(dx,dy)<(control===button?108:hoverRadius);
      };
      const nearTop=topTools.some(nearby);
      topTools.forEach(control=>control.classList.toggle('is-near-pointer',nearTop));
      button.classList.toggle('is-near-pointer',nearby(button));
    });
    card.addEventListener('pointerleave',()=>controls.forEach(control=>control.classList.remove('is-near-pointer')));
    button.addEventListener('click',event=>{
      event.stopPropagation();if(button.getAttribute('aria-expanded')==='true'){closeActive?.();return;}closeActive?.();
      card.querySelectorAll('.planner-book-popover').forEach(el=>el.hidden=true);controls.forEach(el=>el.setAttribute('aria-expanded','false'));
      const drawer=document.createElement('section');drawer.className='tile-skins-drawer planner-skins-drawer';drawer.setAttribute('popover','manual');drawer.setAttribute('role','dialog');drawer.setAttribute('aria-label','Planner Skins');
      drawer.innerHTML='<header><strong>Planner Skins</strong><button type="button" aria-label="Close Planner Skins">×</button></header><div class="tile-skins-drawer-grid"></div>';
      document.body.append(drawer);drawer.showPopover();button.setAttribute('aria-expanded','true');
      const events=new AbortController();
      const close=(focus=false)=>{events.abort();drawer.remove();button.setAttribute('aria-expanded','false');if(closeActive===close)closeActive=null;if(focus&&button.isConnected)button.focus({preventScroll:true});};closeActive=close;
      const position=()=>{if(!card.isConnected){close();return;}const r=button.getBoundingClientRect(),d=drawer.getBoundingClientRect();drawer.style.left=Math.max(8,Math.min(innerWidth-d.width-8,r.left))+'px';drawer.style.top=Math.max(8,Math.min(innerHeight-d.height-8,r.top-d.height-8))+'px';};
      for(const skin of [null,...catalog]){
        const id=skin?.id||'',locked=!accessible(skin),selected=equipped(planner.skin)===id;
        const choice=document.createElement('button');choice.type='button';choice.className='tile-skins-choice';choice.dataset.plannerSkinChoice=id;choice.classList.toggle('is-locked',locked);choice.setAttribute('aria-pressed',String(selected));
        const art=document.createElement('span');art.className='tile-skins-choice-preview';art.append(preview(id,planner.name,colorForSkin?.(id)));
        const name=document.createElement('strong');name.textContent=skin?.name||'Default';const status=document.createElement('small');status.textContent=locked?'Locked · 250 Coins':selected?'Applied':'Apply Skin';choice.append(art,name,status);
        choice.addEventListener('click',()=>{close();if(locked){openShop(skin.productId);return;}planner.skin=id;save();render();document.querySelector(`[data-planner-id="${CSS.escape(planner.id)}"] .planner-book-skins`)?.focus({preventScroll:true});});
        drawer.querySelector('.tile-skins-drawer-grid').append(choice);if(skin)markSubscriptionAccess(choice,skin.productId);
      }
      drawer.querySelector('header button').onclick=()=>close(true);
      document.addEventListener('pointerdown',event=>{if(!drawer.contains(event.target)&&!button.contains(event.target))close();},{capture:true,signal:events.signal});
      document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}},{capture:true,signal:events.signal});
      window.addEventListener('resize',position,{signal:events.signal});document.addEventListener('scroll',position,{capture:true,passive:true,signal:events.signal});
      position();drawer.querySelector('header button').focus({preventScroll:true});
    });
  }
  window.TeacherTilesPlannerSkins={catalog,normalize,equipped,preview,mount,close:()=>closeActive?.()};
})();
