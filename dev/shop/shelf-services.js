function updateThemeControls(theme){
  const current=TEACHERTILES_THEMES.has(theme)?theme:'light';
  document.querySelectorAll('[data-theme-choice]').forEach(card=>{
    const selected=card.dataset.themeChoice===current;
    card.classList.toggle('is-selected',selected);
    card.setAttribute('aria-pressed',String(selected));
  });
}

function themeEntitlement(theme){
  return THEME_ENTITLEMENT_PREFIXES.find(([prefix])=>String(theme||'').startsWith(prefix))?.[1]||'';
}

function shelfEntitlement(element){
  if(!element)return'';
  if(element.dataset?.entitlement)return element.dataset.entitlement;
  const owner=element.closest?.('[data-entitlement],.theme-fan,.sticker-pack-drawer,[data-theme-pack],[data-sticker-pack]');
  const pack=owner?.matches('.sticker-pack-drawer')?document.querySelector(`[data-sticker-pack][aria-controls="${owner.id}"]`):owner;
  return owner?.dataset?.entitlement||COLLECTION_PACK_PRODUCTS[pack?.id]||SHELF_ENTITLEMENTS[owner?.id]||SHELF_ENTITLEMENTS[element.id]||'';
}

function ownsCosmetic(productId){return cosmeticIsAccessible(productId)}

function requestCosmeticPurchase(productId){
  if(productId)window.dispatchEvent(new CustomEvent('teachertiles:shoprequest',{detail:{productId}}));
}

function requireCosmetic(element){
  const productId=shelfEntitlement(element);
  if(ownsCosmetic(productId))return true;
  requestCosmeticPurchase(productId);
  return false;
}

function syncCosmeticEntitlements(){
  Object.entries(SHELF_ENTITLEMENTS).forEach(([id,productId])=>{
    const element=document.getElementById(id);
    if(!element)return;
    element.dataset.entitlement=productId;
    if(element.matches('.theme-fan')){
      element.querySelector(':scope > .subscription-access-crown')?.remove();
      element.querySelectorAll('.theme-card').forEach(card=>markSubscriptionAccess(card,productId));
    }else markSubscriptionAccess(element,productId);
    const locked=!ownsCosmetic(productId);
    element.classList.toggle('is-cosmetic-locked',locked);
    if(element.matches('button')){
      if(!element.dataset.unlockedLabel)element.dataset.unlockedLabel=element.getAttribute('aria-label')||'';
      element.setAttribute('aria-label',locked?`${element.dataset.unlockedLabel} — locked; purchase in Shop`:element.dataset.unlockedLabel);
    }
  });
  document.querySelectorAll('.sticker-pack-drawer').forEach(drawer=>{
    const productId=shelfEntitlement(drawer);
    drawer.querySelectorAll('[data-sticker-src],[data-sticker-emoji]').forEach(item=>{
      if(productId)item.dataset.entitlement=productId;
      item.classList.toggle('is-cosmetic-locked',Boolean(productId)&&!ownsCosmetic(productId));
    });
  });

  const state=window.TeacherTilesAccount?.state;
  if(state?.ready&&!state.loading){
    const activeTheme=window.TeacherTilesTheme?.selected||'light';
    const required=themeEntitlement(activeTheme);
    if(required&&!ownsCosmetic(required))applyTeacherTheme('light');
  }
}

function applyMaterialThemeArtwork(){
  // Artwork is shared with the shelf and board previews through theme CSS.
  // Clear older inline artwork when switching themes or restoring a board.
  for(const property of ['background-image','background-size','background-repeat','background-position']){
    workspace.style.removeProperty(property);
  }
}

function applyTeacherTheme(theme,{persist=true,presentation=false}={}){
  const requested=TEACHERTILES_THEMES.has(theme)?theme:'light';
  let next=themeChoiceIsOwned(requested)?requested:'light';if(!presentation)activeBoardTheme=next;if(document.body.classList.contains('boards-screen-open'))next='light';
  document.body.classList.remove(...THEME_BODY_CLASSES);
  if(next==='dark')document.body.classList.add('dark');
  else if(next==='gray')document.body.classList.add('theme-gray');
  else if(next!=='light')document.body.classList.add(`theme-${next}`);
  document.body.dataset.theme=next;
  const darkTheme=next==='outer-space'||next==='frosted-window'||next==='underwater-ocean'||next==='rainy-window'||next==='dark'||next.startsWith('programmer-')||next.startsWith('cosmos-')||next.startsWith('metal-');
  if(darkTheme&&next!=='dark')document.body.classList.add('dark');
  document.documentElement.style.colorScheme=darkTheme?'dark':'light';
  applyMaterialThemeArtwork(next);

  updateThemeControls(next);
  window.dispatchEvent(new CustomEvent('teachertiles:themechange'));
  if(persist)notifyBoardChanged('theme');
}

function createStickerModule({src='',emoji='',name='Sticker',aspect=1},clientX,clientY,{record=true,animate=true,objectId='',previewSize=0}={}){
  if(!src&&!emoji)return null;
  const isFlag=/flagcdn\.io\/flags\//i.test(src);
  const isTextSticker=Boolean(emoji&&/^[A-Za-z0-9]+$/.test(emoji));
  const p=screenToBoard(clientX,clientY);
  const ratio=emoji?1:(Number.isFinite(aspect)&&aspect>0?aspect:1);
  let width=180,height=180;
  if(ratio>=1){width=ratio>2?230:180;height=width/ratio}else{height=180;width=height*ratio}
  if(previewSize>0){
    const extent=previewSize/boardCamera.scale;
    width=ratio>=1?extent:extent*ratio;
    height=ratio>=1?extent/ratio:extent;
  }
  width=Math.max(60,width);
  height=Math.max(60,height);
  const m=document.createElement('section');
  m.className=`module sticker-module${isFlag?' sticker-module--flag':''}${isTextSticker?' sticker-module--text':''}${animate?' sticker-placed':''}`;
  m.dataset.type='sticker';
  m.dataset.stickerSrc=src;
  m.dataset.stickerEmoji=emoji;
  m.dataset.stickerName=name||'Sticker';
  m.dataset.stickerAspect=String(ratio);
  if(objectId)m.dataset.boardObjectId=objectId;
  m.dataset.stickerRotation='0';
  m._stickerRatio=ratio;
  m.setAttribute('aria-label',`${name||'Sticker'} sticker`);
  m.style.width=`${width}px`;
  m.style.height=`${height}px`;
  m.style.left=`${clamp(p.x-width/2,0,BOARD_WIDTH-width)}px`;
  m.style.top=`${clamp(p.y-height/2,0,BOARD_HEIGHT-height)}px`;

  const drag=document.createElement('div');
  drag.className='module-drag-handle';
  drag.setAttribute('aria-hidden','true');
  const del=document.createElement('button');
  del.className='module-delete';del.type='button';del.setAttribute('aria-label','Delete sticker');del.textContent='×';
  const art=document.createElement('div');art.className='sticker-art';
  const visual=document.createElement('div');visual.className=`sticker-visual${emoji?' sticker-visual--emoji':''}${isFlag?' sticker-visual--flag':''}${isTextSticker?' sticker-visual--text':''}`;
  if(emoji){
    const glyph=document.createElement('span');
    glyph.className=`sticker-emoji${isTextSticker?' sticker-emoji--text':''}`;glyph.setAttribute('aria-hidden','true');glyph.textContent=emoji;
    visual.appendChild(glyph);
  }else{
    const img=document.createElement('img');img.src=src;img.alt=name||'Sticker';img.draggable=false;
    visual.appendChild(img);
  }
  art.appendChild(visual);
  const pop=document.createElement('span');pop.className='sticker-stick-pop';pop.setAttribute('aria-hidden','true');
  m.append(drag,del,art,pop);
  workspace.appendChild(m);
  bringToFront(m);
  setupCommon(m);
  setupStickerTransformControls(m);
  if(record)recordHistory({type:'add',elements:[m]});
  if(record&&previewSize>0)window.dispatchEvent(new CustomEvent('teachertiles:stickerplaced',{detail:{key:src||emoji}}));
  if(animate){
    playUiSfx('sticker-place');
    setTimeout(()=>m.classList.remove('sticker-placed'),620);
  }
  return m;
}

function setupShelfStickerDrag(item,shelfShell){
  if(!item||item.dataset.stickerDragReady)return;
  item.dataset.stickerDragReady='true';
  item.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    if(!requireCosmetic(item)){
      e.preventDefault();e.stopPropagation();return;
    }
    const src=item.dataset.stickerSrc||'';
    const emoji=item.dataset.stickerEmoji||'';
    const isTextSticker=Boolean(emoji&&/^[A-Za-z0-9]+$/.test(emoji));
    const isFlag=/flagcdn\.io\/flags\//i.test(src);
    const name=item.dataset.stickerName||'Sticker';
    const preview=item.querySelector('img');
    const aspect=emoji?1:(preview?.naturalWidth&&preview?.naturalHeight?preview.naturalWidth/preview.naturalHeight:1);
    if(!src&&!emoji)return;
    e.preventDefault();
    e.stopPropagation();
    item.setPointerCapture(e.pointerId);
    const startX=e.clientX,startY=e.clientY;
    let dragging=false;
    let ghost=null;
    let canDrop=false;
    let ghostFrame=0,pendingPointer=null;
    const shellRect=shelfShell.getBoundingClientRect();

    const ensureGhost=()=>{
      if(ghost)return;
      ghost=document.createElement('div');
      ghost.className=`sticker-drag-ghost${emoji?' sticker-drag-ghost--emoji':''}${isFlag?' sticker-drag-ghost--flag':''}${isTextSticker?' sticker-drag-ghost--text':''}`;
      if(emoji){
        const glyph=document.createElement('span');glyph.className=`sticker-emoji sticker-emoji--ghost${isTextSticker?' sticker-emoji--text':''}`;glyph.textContent=emoji;ghost.appendChild(glyph);
      }else{
        const img=document.createElement('img');img.src=src;img.alt='';img.draggable=false;ghost.appendChild(img);
      }
      document.body.appendChild(ghost);
    };
    const updateGhost=ev=>{
      ensureGhost();
      ghost.style.left=`${ev.clientX}px`;
      ghost.style.top=`${ev.clientY}px`;
      const insideShelf=ev.clientX>=shellRect.left&&ev.clientX<=shellRect.right&&ev.clientY>=shellRect.top&&ev.clientY<=shellRect.bottom;
      const blocked=document.elementsFromPoint(ev.clientX,ev.clientY).some(el=>el.closest?.('.workspace-controls,.workspace-upcoming-controls,.context-menu'));
      canDrop=!insideShelf&&!blocked&&ev.clientX>=0&&ev.clientX<=innerWidth&&ev.clientY>=0&&ev.clientY<=innerHeight;
      ghost.classList.toggle('can-drop',canDrop);
    };
    const move=ev=>{
      if(!dragging&&Math.hypot(ev.clientX-startX,ev.clientY-startY)<5)return;
      if(!dragging){
        dragging=true;
        item.classList.add('is-dragging');
        document.body.classList.add('is-dragging-shelf-sticker');
      }
      pendingPointer=ev;
      if(!ghostFrame)ghostFrame=requestAnimationFrame(()=>{ghostFrame=0;updateGhost(pendingPointer)});
    };
    const cleanup=()=>{
      cancelAnimationFrame(ghostFrame);
      item.classList.remove('is-dragging');
      document.body.classList.remove('is-dragging-shelf-sticker');
      ghost?.remove();
      item.removeEventListener('pointermove',move);
      item.removeEventListener('pointerup',end);
      item.removeEventListener('pointercancel',cancel);
    };
    const end=ev=>{
      if(dragging){updateGhost(ev);item._stickerDragUntil=performance.now()+500}
      if(dragging&&canDrop)createStickerModule({src,emoji,name,aspect},ev.clientX,ev.clientY,{previewSize:emoji?132:146});
      cleanup();
    };
    const cancel=()=>cleanup();
    item.addEventListener('pointermove',move);
    item.addEventListener('pointerup',end);
    item.addEventListener('pointercancel',cancel);
  });
}

function setupCollectionShelf(){
  const shelf=document.getElementById('asset-shelf');
  const title=document.getElementById('asset-shelf-title');
  const closeButton=document.getElementById('asset-shelf-close');
  const themeButton=document.getElementById('theme-shelf-toggle');
  const stickerButton=document.getElementById('sticker-shelf-toggle');
  const cursorsButton=document.getElementById('cursors-shelf-toggle');
  const themePanel=document.getElementById('theme-shelf-content');
  const stickerPanel=document.getElementById('sticker-shelf-content');
  const cursorsPanel=document.getElementById('cursors-shelf-content');
  const cursorsGrid=document.getElementById('cursors-shelf-grid');
  const cursorsStatus=document.getElementById('cursors-shelf-status');
  const stickerSearch=document.getElementById('sticker-shelf-search');
  const stickerSearchClear=document.getElementById('sticker-shelf-search-clear');
  const stickerSearchStatus=document.getElementById('sticker-shelf-search-status');
  const packs=[...document.querySelectorAll('[data-theme-pack]')];
  const stickerPacks=[...document.querySelectorAll('[data-sticker-pack]')];
  const stickerItems=[...document.querySelectorAll('[data-sticker-src],[data-sticker-emoji]')];
  const stickerPackTags={
    'default-sticker-drawer':'classroom teacher school sticker stickers',
    'emoji-sticker-drawer':'emoji emojis face faces reaction reactions expression expressions celebration',
    'nature-emojis-sticker-drawer':'nature outdoors plant plants botanical botanicals weather sky',
    'weather-emojis-sticker-drawer':'weather forecast climate sun sunny cloud cloudy rain rainy storm thunder lightning snow snowy fog foggy wind windy tornado rainbow',
    'animal-emojis-sticker-drawer':'animal animals pet pets wildlife insect insects critter critters',
    'more-faces-sticker-drawer':'emoji emojis face faces reaction reactions expression expressions emotion emotions',
    'symbols-sticker-drawer':'symbol symbols classroom math mark marks sign signs',
    'food-sticker-drawer':'food foods snack snacks meal meals lunch dessert desserts treat treats',
    'colored-hearts-sticker-drawer':'heart hearts love color colors colored',
    'decorative-hearts-sticker-drawer':'heart hearts love decorative decoration decorations',
    'country-flags-sticker-drawer':'country countries nation nations flag flags geography world international'
  };
  stickerItems.forEach(item=>{
    const drawerId=item.closest('.sticker-pack-drawer')?.id||'';
    item.dataset.stickerTags=[item.dataset.stickerTags||'',stickerPackTags[drawerId]||''].join(' ').trim();
  });
  const bottomTray=document.querySelector('.workspace-upcoming-controls');
  const shelfScroll=themePanel?.querySelector('.asset-shelf__scroll');
  const stickerScroll=stickerPanel?.querySelector('.asset-shelf__scroll');
  stickerPanel?.querySelectorAll('.sticker-pack-drawer').forEach(drawer=>drawer.style.setProperty('--sticker-count',String(drawer.querySelectorAll('.sticker-shelf-item').length)));
  const shelfShell=shelf.querySelector('.asset-shelf__shell');
  if(!shelf||!title||!closeButton||!themeButton||!stickerButton||!cursorsButton||!themePanel||!stickerPanel||!cursorsPanel||!shelfShell||!packs.length)return;

  let stickerPicker=null;
  let themePicker=null;
  let activeShelf=null;
  let activePack=null;
  let activeFan=null;
  let activeStickerPack=null;
  let activeStickerDrawer=null;

  const syncCollectionOwnership=()=>{
    [...packs,...stickerPacks].forEach(pack=>{
      const owned=collectionPackIsOwned(pack);
      markSubscriptionAccess(pack,COLLECTION_PACK_PRODUCTS[pack.id]);
      const wrapper=pack.closest('.theme-pack-wrap,.sticker-pack-wrap');
      pack.dataset.shopLocked=String(!owned);
      pack.setAttribute('aria-disabled',String(!owned));
      wrapper?.classList.toggle('is-shop-locked',!owned);
      const drawerId=pack.getAttribute('aria-controls');
      document.getElementById(drawerId)?.classList.toggle('is-shop-locked',!owned);
      let badge=wrapper?.querySelector(':scope > .collection-pack-lock');
      if(!badge&&wrapper){
        badge=document.createElement('span');badge.className='collection-pack-lock';badge.setAttribute('aria-hidden','true');wrapper.appendChild(badge);
      }
      if(badge){badge.innerHTML=owned?'✓ Owned':'<img src="assets/ui/lock.svg?v=20260927-gold" alt="">Shop';badge.hidden=owned}
    });
    if(!themeChoiceIsOwned(document.body.dataset.theme||'light'))applyTeacherTheme('light');
  };

  const openLockedCollection=pack=>{
    closeShelf();
    window.TeacherTilesShop?.openProduct(COLLECTION_PACK_PRODUCTS[pack.id]||shelfEntitlement(pack));
  };

  const cursorPicker=window.TeacherTilesCursorPicker.create({panel:cursorsPanel,catalog:CURSOR_CATALOG,packs:[{name:'Default',productId:''},{name:'Colored Cursors',productId:CURSOR_COLOR_PACK_PRODUCT_ID},...window.TeacherTilesCursorPacks],owned:cosmeticIsAccessible,active:()=>cursorById(localStorage.getItem(ACTIVE_CURSOR_KEY)||'default').id,apply:applyAppCursor,unlock:product=>{closeShelf();window.TeacherTilesShop?.openProduct(product)}});
  const renderCursorShelf=()=>cursorPicker.render();

  const positionThemeFan=()=>{
    if(!activePack||!activeFan||!activeFan.classList.contains('is-open'))return;
    const packRect=activePack.getBoundingClientRect();
    const fanRect=activeFan.getBoundingClientRect();
    const width=fanRect.width||98;
    const height=fanRect.height||318;
    const left=clamp(packRect.left+(packRect.width-width)/2,10,Math.max(10,innerWidth-width-10));
    const top=Math.max(10,packRect.top-height-11);
    activeFan.style.left=`${left}px`;
    activeFan.style.top=`${top}px`;
  };

  const closeThemeFan=()=>{
    if(activePack){
      activePack.classList.remove('is-open');
      activePack.setAttribute('aria-expanded','false');
    }
    if(activeFan){
      activeFan.classList.remove('is-open');
      activeFan.setAttribute('aria-hidden','true');
    }
    activePack=null;
    activeFan=null;
  };

  const toggleThemeFan=pack=>{
    if(pack.dataset.shopLocked==='true'){openLockedCollection(pack);return}
    const fanId=pack.getAttribute('aria-controls');
    const fan=fanId?document.getElementById(fanId):null;
    if(!fan)return;
    if(activePack===pack&&fan.classList.contains('is-open')){
      closeThemeFan();
      return;
    }
    closeThemeFan();
    activePack=pack;
    activeFan=fan;
    pack.classList.add('is-open');
    pack.setAttribute('aria-expanded','true');
    fan.classList.add('is-open');
    fan.setAttribute('aria-hidden','false');
    positionThemeFan();
    requestAnimationFrame(positionThemeFan);
  };

  const closeStickerPack=()=>{
    if(activeStickerPack){
      activeStickerPack.classList.remove('is-open');
      activeStickerPack.setAttribute('aria-expanded','false');
    }
    if(activeStickerDrawer){
      activeStickerDrawer.classList.remove('is-open');
      activeStickerDrawer.setAttribute('aria-hidden','true');
    }
    activeStickerPack=null;
    activeStickerDrawer=null;
  };

  const normalizeStickerSearch=value=>String(value||'').toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim();
  const updateStickerSearch=()=>{
    if(stickerPicker){stickerPicker.render();return}
    const query=normalizeStickerSearch(stickerSearch?.value);
    const terms=query.split(/\s+/).filter(Boolean);
    const searching=terms.length>0;
    if(searching)closeStickerPack();
    stickerPanel.classList.toggle('is-searching',searching);
    let resultCount=0;
    stickerPacks.forEach(pack=>{
      const drawerId=pack.getAttribute('aria-controls');
      const drawer=drawerId?document.getElementById(drawerId):null;
      const wrapper=pack.closest('.sticker-pack-wrap');
      const items=drawer?[...drawer.querySelectorAll('.sticker-shelf-item')]:[];
      let packMatches=0;
      items.forEach(item=>{
        const haystack=normalizeStickerSearch(`${item.dataset.stickerName||''} ${item.dataset.stickerTags||''}`);
        const matches=!searching||terms.every(term=>haystack.includes(term));
        item.classList.toggle('is-search-hidden',!matches);
        if(searching&&matches){packMatches++;resultCount++}
      });
      const show=!searching||packMatches>0;
      wrapper?.classList.toggle('is-search-hidden',!show);
      drawer?.classList.toggle('is-search-hidden',!show);
      drawer?.classList.toggle('is-search-open',searching&&show);
      if(drawer)drawer.setAttribute('aria-hidden',searching?String(!show):String(!(drawer===activeStickerDrawer&&drawer.classList.contains('is-open'))));
    });
    if(stickerSearchClear)stickerSearchClear.hidden=!searching;
    if(stickerSearchStatus)stickerSearchStatus.textContent=searching?(resultCount?`${resultCount} ${resultCount===1?'sticker':'stickers'} found`:'No stickers found'):'Search every sticker pack';
    if(searching)requestAnimationFrame(()=>{if(stickerScroll)stickerScroll.scrollLeft=0});
  };

  const clearStickerSearch=({focus=false}={})=>{
    if(stickerSearch)stickerSearch.value='';
    updateStickerSearch();
    if(focus)stickerSearch?.focus();
  };

  const toggleStickerPack=pack=>{
    if(pack.dataset.shopLocked==='true'){openLockedCollection(pack);return}
    if(stickerPanel.classList.contains('is-searching'))return;
    const drawerId=pack.getAttribute('aria-controls');
    const drawer=drawerId?document.getElementById(drawerId):null;
    if(!drawer)return;
    if(activeStickerPack===pack&&drawer.classList.contains('is-open')){
      closeStickerPack();
      return;
    }
    closeStickerPack();
    activeStickerPack=pack;
    activeStickerDrawer=drawer;
    pack.classList.add('is-open');
    pack.setAttribute('aria-expanded','true');
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden','false');
    requestAnimationFrame(()=>{
      const left=Math.max(0,pack.parentElement.offsetLeft-12);
      stickerScroll?.scrollTo({left,behavior:'smooth'});
    });
  };

  const syncShelfButtons=()=>{
    themeButton.classList.toggle('is-active',activeShelf==='themes');
    stickerButton.classList.toggle('is-active',activeShelf==='stickers');
    cursorsButton.classList.toggle('is-active',activeShelf==='cursors');
    themeButton.setAttribute('aria-expanded',String(activeShelf==='themes'));
    stickerButton.setAttribute('aria-expanded',String(activeShelf==='stickers'));
    cursorsButton.setAttribute('aria-expanded',String(activeShelf==='cursors'));
    bottomTray?.classList.toggle('has-shelf-open',Boolean(activeShelf));
    const customize=document.getElementById('customize-toggle');customize?.setAttribute('aria-expanded',String(Boolean(activeShelf)&&activeShelf!=='stickers'));customize?.classList.toggle('is-active',Boolean(activeShelf)&&activeShelf!=='stickers');
  };

  const closeShelf=()=>{
    themePicker?.close();
    if(!activeShelf)return;
    activeShelf=null;
    closeThemeFan();
    closeStickerPack();
    clearStickerSearch();
    shelf.classList.remove('is-open');
    shelf.inert=true;
    shelf.setAttribute('aria-hidden','true');
    syncShelfButtons();
  };

  const openShelf=type=>{
    if(activeShelf===type)return;
    themePicker?.close();
    activeShelf=type;
    closeThemeFan();
    if(type!=='stickers')closeStickerPack();
    const themes=type==='themes';
    const stickers=type==='stickers';
    const cursors=type==='cursors';
    themePanel.hidden=!themes;
    stickerPanel.hidden=!stickers;
    cursorsPanel.hidden=!cursors;
    themePanel.classList.toggle('is-active',themes);
    stickerPanel.classList.toggle('is-active',stickers);
    cursorsPanel.classList.toggle('is-active',cursors);
    shelf.classList.toggle('is-sticker-mode',stickers);
    shelf.classList.toggle('is-theme-mode',themes);
    shelf.classList.toggle('is-cursors-mode',cursors);
    if(cursors)renderCursorShelf();
    title.textContent=themes?(window.TeacherTilesI18n?.t('top.themes')||'Themes'):stickers?(window.TeacherTilesI18n?.t('top.stickers')||'Stickers'):'Cursors';
    shelf.inert=false;
    shelf.classList.add('is-open');
    shelf.setAttribute('aria-hidden','false');
    if(themes)themePicker?.open();
    if(stickers){stickerPicker?.render();stickerSearch?.focus({preventScroll:true})}
    syncShelfButtons();
  };

  themeButton.addEventListener('click',e=>{e.stopPropagation();openShelf('themes')});
  stickerButton.addEventListener('click',e=>{e.stopPropagation();if(activeShelf==='stickers')closeShelf();else openShelf('stickers')});
  cursorsButton.addEventListener('click',e=>{e.stopPropagation();openShelf('cursors')});
  closeButton.addEventListener('click',closeShelf);
  packs.forEach(pack=>pack.addEventListener('click',e=>{e.stopPropagation();if(requireCosmetic(pack))toggleThemeFan(pack)}));
  stickerPacks.forEach(pack=>pack.addEventListener('click',e=>{e.stopPropagation();if(requireCosmetic(pack))toggleStickerPack(pack)}));
  stickerItems.forEach(item=>setupShelfStickerDrag(item,shelfShell));
  stickerSearch?.addEventListener('input',updateStickerSearch);
  stickerSearch?.addEventListener('keydown',e=>{if(e.key==='Escape'&&stickerSearch.value){e.stopPropagation();clearStickerSearch({focus:true})}});
  stickerSearchClear?.addEventListener('click',()=>clearStickerSearch({focus:true}));
  window.addEventListener('teachertiles:shopownershipchange',()=>{
    syncCollectionOwnership();
    if(!cursorIsOwned(cursorById(localStorage.getItem(ACTIVE_CURSOR_KEY)||'default')))applyAppCursor('default');
    renderCursorShelf();
  });
  window.addEventListener('teachertiles:accountchange',()=>{
    syncCollectionOwnership();
    syncCosmeticEntitlements();
    if(!cursorIsOwned(cursorById(localStorage.getItem(ACTIVE_CURSOR_KEY)||'default')))applyAppCursor('default');
    renderCursorShelf();
  });
  window.addEventListener('teachertiles:cursorchange',renderCursorShelf);

  document.querySelectorAll('.theme-fan [data-theme-choice]').forEach(card=>{
    card.addEventListener('click',()=>{if(requireCosmetic(card))applyTeacherTheme(card.dataset.themeChoice)});
  });

  shelfScroll?.addEventListener('scroll',positionThemeFan,{passive:true});
  shelfScroll?.addEventListener('wheel',e=>{
    if(shelfScroll.scrollWidth<=shelfScroll.clientWidth)return;
    if(Math.abs(e.deltaY)<=Math.abs(e.deltaX))return;
    shelfScroll.scrollLeft+=e.deltaY*(appPreferences.scrollSpeed/100);
    e.preventDefault();
  },{passive:false});

  stickerScroll?.addEventListener('wheel',e=>{
    if(stickerScroll.scrollWidth<=stickerScroll.clientWidth)return;
    if(Math.abs(e.deltaY)<=Math.abs(e.deltaX))return;
    stickerScroll.scrollLeft+=e.deltaY*(appPreferences.scrollSpeed/100);
    e.preventDefault();
  },{passive:false});

  window.addEventListener('resize',positionThemeFan,{passive:true});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&activeShelf){closeShelf();document.getElementById('customize-toggle')?.focus()}});
  document.addEventListener('pointerdown',e=>{
    if(!activeShelf||['stickers','themes','cursors'].includes(activeShelf))return;
    const target=e.target;
    if(!(target instanceof Element))return;
    if(target.closest('#asset-shelf,.theme-fan,.workspace-upcoming-controls'))return;
    closeShelf();
  });

  updateThemeControls(document.body.dataset.theme||'light');
  syncCollectionOwnership();
  syncCosmeticEntitlements();
  renderCursorShelf();
  themePicker=window.createThemePicker({panel:themePanel,packs,owns:ownsCosmetic,entitlement:shelfEntitlement,requestAccess:requireCosmetic,apply:applyTeacherTheme,crown:markSubscriptionAccess});
  stickerPicker=window.createStickerPicker({panel:stickerPanel,packs:stickerPacks,search:stickerSearch,clear:stickerSearchClear,status:stickerSearchStatus,shell:shelfShell,bindDrag:setupShelfStickerDrag,owns:ownsCosmetic,require:requireCosmetic,entitlement:shelfEntitlement,place:createStickerModule});
  shelf.inert=true;
}

function createAdditionalStickerPackUi(){
  const shelfRow=document.querySelector('#sticker-shelf-content .sticker-shelf__row');
  const shopGrid=document.querySelector('[data-shop-page="stickers"] .shop-product-grid');
  const sampleClasses=['one','two','three','four'];
  ADDITIONAL_STICKER_PACKS.forEach(pack=>{
    const isImagePack=pack.items.some(item=>Boolean(item.src));
    if(shelfRow&&!document.getElementById(`${pack.id}-sticker-pack`)){
      const wrap=document.createElement('div');
      wrap.className='sticker-pack-wrap';
      const button=document.createElement('button');
      button.id=`${pack.id}-sticker-pack`;
      button.className=`theme-pack sticker-pack ${isImagePack?'sticker-pack--image-collection':'sticker-pack--emoji sticker-pack--emoji-collection'}${pack.category==='learning'?' sticker-pack--text':''}`;
      button.type='button';
      button.dataset.stickerPack='';
      button.setAttribute('aria-expanded','false');
      button.setAttribute('aria-controls',`${pack.id}-sticker-drawer`);
      const stack=document.createElement('span');
      stack.className=`sticker-pack__stack ${isImagePack?'sticker-pack__stack--image':'sticker-pack__stack--emoji'}`;
      stack.setAttribute('aria-hidden','true');
      pack.items.slice(0,4).forEach((item,index)=>{
        const sample=document.createElement(isImagePack?'img':'span');
        sample.className=`${isImagePack?'sticker-pack__image-sample':'sticker-pack__emoji-sample'} ${isImagePack?'sticker-pack__image-sample':'sticker-pack__emoji-sample'}--${sampleClasses[index]}`;
        if(isImagePack){sample.src=item.src;sample.alt='';sample.draggable=false}else sample.textContent=item.emoji;
        stack.appendChild(sample);
      });
      const meta=document.createElement('span');
      meta.className='theme-pack__meta';
      const name=document.createElement('strong');
      name.textContent=pack.name;
      const count=document.createElement('small');
      count.dataset.generatedStickerCount=pack.id;
      count.textContent=`${pack.items.length} stickers`;
      meta.append(name,count);
      const chevron=document.createElement('span');
      chevron.className='theme-pack__chevron';
      chevron.setAttribute('aria-hidden','true');
      chevron.textContent='⌃';
      button.append(stack,meta,chevron);
      wrap.appendChild(button);
      const drawer=document.createElement('div');
      drawer.id=`${pack.id}-sticker-drawer`;
      drawer.className=`sticker-pack-drawer${pack.items.length>8?' sticker-pack-drawer--scrollable':''}${pack.category==='learning'?' sticker-pack-drawer--text':''}`;
      drawer.setAttribute('aria-hidden','true');
      drawer.setAttribute('role','group');
      drawer.setAttribute('aria-label',`${pack.name} sticker pack`);
      const track=document.createElement('div');
      track.className='sticker-pack-drawer__track';
      track.dataset.generatedStickers=pack.id;
      const hint=document.createElement('span');
      hint.className='sticker-pack-drawer__hint';
      hint.textContent='Drag a sticker onto the board';
      drawer.append(track,hint);
      const anchorId=pack.category==='faces'?'symbols-sticker-pack':'colored-hearts-sticker-pack';
      const anchor=document.getElementById(anchorId)?.closest('.sticker-pack-wrap');
      if(anchor)anchor.before(wrap,drawer);else shelfRow.append(wrap,drawer);
    }
    if(shopGrid&&!shopGrid.querySelector(`[data-shop-product="${pack.productId}"]`)){
      const article=document.createElement('article');
      article.className='shop-product';
      article.dataset.shopProduct=pack.productId;
      article.dataset.shopPrice=String(pack.price);
      const preview=document.createElement('div');
      preview.className=`shop-product__preview ${isImagePack?'shop-product__preview--image-stickers':'shop-product__preview--emoji'}${pack.category==='learning'?' shop-product__preview--text-stickers':''}`;
      preview.setAttribute('aria-hidden','true');
      pack.items.slice(0,4).forEach(item=>{
        const sample=document.createElement(isImagePack?'img':'span');
        if(isImagePack){sample.src=item.src;sample.alt='';sample.draggable=false}else sample.textContent=item.emoji;
        preview.appendChild(sample);
      });
      const body=document.createElement('div');
      body.className='shop-product__body';
      const copy=document.createElement('div');
      const type=document.createElement('span');
      type.className='shop-product__type';
      type.textContent='STICKER PACK';
      const title=document.createElement('h3');
      title.textContent=pack.name;
      const description=document.createElement('p');
      description.textContent=pack.description;
      copy.append(type,title,description);
      const buy=document.createElement('button');
      buy.className='shop-buy';
      buy.type='button';
      buy.dataset.shopBuy='';
      const coin=document.createElement('span');
      coin.className='shop-coin-icon shop-coin-icon--small';
      coin.setAttribute('aria-hidden','true');
      const coinImage=document.createElement('img');
      coinImage.src='assets/shop/coin.png';
      coinImage.alt='';
      coin.appendChild(coinImage);
      const price=document.createElement('strong');
      price.textContent=String(pack.price);
      buy.append(coin,price);
      body.append(copy,buy);
      article.append(preview,body);
      const anchorProduct=pack.category==='faces'?'sticker-symbols':'sticker-colored-hearts';
      const anchor=shopGrid.querySelector(`[data-shop-product="${anchorProduct}"]`);
      if(anchor)anchor.before(article);else shopGrid.appendChild(article);
    }
  });
}

function syncStickerShopPackCounts(){
  const productToPack=new Map(Object.entries(COLLECTION_PACK_PRODUCTS).map(([packId,productId])=>[productId,packId]));
  document.querySelectorAll('.shop-product[data-shop-product^="sticker-"]').forEach(product=>{
    const packId=productToPack.get(product.dataset.shopProduct||'');
    const packButton=packId?document.getElementById(packId):null;
    const drawerId=packButton?.getAttribute('aria-controls')||'';
    const stickerCount=drawerId?document.getElementById(drawerId)?.querySelectorAll('.sticker-shelf-item').length:0;
    const preview=product.querySelector('.shop-product__preview');
    if(!preview||!stickerCount)return;
    let badge=preview.querySelector('.shop-sticker-count');
    if(!badge){badge=document.createElement('span');badge.className='shop-sticker-count';preview.appendChild(badge)}
    badge.textContent=String(stickerCount);
    badge.title=`${stickerCount} stickers in this pack`;
  });
}

function populateGeneratedStickerPacks(){
  createAdditionalStickerPackUi();
  const makeStickerButton=({emoji='',src='',name,tags=''})=>{
    const button=document.createElement('button');
    const isText=!src&&/^[A-Za-z0-9]+$/.test(emoji);
    const isFlag=/flagcdn\.io\/flags\//i.test(src);
    button.className=`sticker-shelf-item ${src?(isFlag?'sticker-shelf-item--flag':'sticker-shelf-item--image'):'sticker-shelf-item--emoji'}${isText?' sticker-shelf-item--text':''}`;
    button.type='button';
    if(src)button.dataset.stickerSrc=src;
    else button.dataset.stickerEmoji=emoji;
    button.dataset.stickerName=name;
    if(tags)button.dataset.stickerTags=tags;
    button.setAttribute('aria-label',`Drag ${name} sticker onto the board`);
    if(src){
      const image=document.createElement('img');
      image.src=src;
      image.alt='';
      image.draggable=false;
      button.appendChild(image);
    }else{
      const glyph=document.createElement('span');
      glyph.className=`sticker-shelf-emoji${isText?' sticker-shelf-emoji--text':''}`;
      glyph.setAttribute('aria-hidden','true');
      glyph.textContent=emoji;
      button.appendChild(glyph);
    }
    return button;
  };
  const fill=(key,items)=>{
    const track=document.querySelector(`[data-generated-stickers="${key}"]`);
    if(!track||track.childElementCount)return;
    track.append(...items.map(makeStickerButton));
    const count=document.querySelector(`[data-generated-sticker-count="${key}"]`);
    if(count)count.textContent=`${items.length} stickers`;
  };

  const coloredHearts=[
    ['❤️','Red heart'],['🧡','Orange heart'],['💛','Yellow heart'],['💚','Green heart'],['💙','Blue heart'],['💜','Purple heart'],
    ['🤎','Brown heart'],['🖤','Black heart'],['🤍','White heart'],['🩷','Pink heart'],['🩵','Light blue heart'],['🩶','Gray heart']
  ].map(([emoji,name])=>({emoji,name}));
  const decorativeHearts=[
    ['💖','Sparkling heart'],['💗','Growing heart'],['💓','Beating heart'],['💕','Two hearts'],['💞','Revolving hearts'],['💝','Heart with ribbon'],
    ['💘','Heart with arrow'],['💟','Heart decoration'],['❤️‍🔥','Heart on fire'],['❤️‍🩹','Mending heart']
  ].map(([emoji,name])=>({emoji,name}));
  const weatherEmojis=[
    ['☀️','Sunny'],['🌤️','Mostly sunny'],['⛅','Partly cloudy'],['🌥️','Mostly cloudy'],['☁️','Cloudy'],['🌦️','Sun shower'],['🌧️','Rainy'],
    ['⛈️','Thunderstorm'],['🌩️','Lightning'],['🌨️','Snow showers'],['❄️','Snowflake'],['🌫️','Foggy'],['💨','Windy'],['🌪️','Tornado']
  ].map(([emoji,name])=>({emoji,name}));
  fill('weather-emojis',weatherEmojis);
  fill('colored-hearts',coloredHearts);
  fill('decorative-hearts',decorativeHearts);
  ADDITIONAL_STICKER_PACKS.forEach(pack=>fill(pack.id,pack.items.map(item=>({...item,tags:`${item.tags||''} ${pack.tags}`.trim()}))));

  const regionCodes=`AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET EU FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM UN US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW`.split(/\s+/);
  const specialNames={EU:'European Union',UN:'United Nations',XK:'Kosovo'};
  let displayNames=null;
  try{displayNames=new Intl.DisplayNames(['en'],{type:'region'})}catch{}
  const flags=regionCodes.map(code=>({
    src:`https://flagcdn.io/flags/4x3/${code.toLowerCase()}.svg`,
    name:`${specialNames[code]||displayNames?.of(code)||code} flag`,
    tags:`country countries flag flags nation geography world international ${code.toLowerCase()}`
  }));
  fill('country-flags',flags);
  syncStickerShopPackCounts();
}

function setupCustomizeLauncher(){
  const toggle=document.getElementById('customize-toggle');
  const shelf=document.getElementById('asset-shelf');
  const tabs=document.createElement('nav');tabs.className='collection-category-tabs';tabs.setAttribute('aria-label','Customization categories');
  for(const [id,label] of [['theme-shelf-toggle','Themes'],['cursors-shelf-toggle','Cursors']]){
    const button=document.getElementById(id);button.className='collection-category-tab';
    button.querySelector('.upcoming-control__tooltip').remove();
    const text=document.createElement('span');text.textContent=label;button.append(text);tabs.append(button);
  }
  shelf.querySelector('.asset-shelf__header').after(tabs);
  const stickers=document.getElementById('sticker-shelf-toggle');stickers.classList.remove('shelf-launch-control');
  document.getElementById('shop-toggle').before(stickers);
  document.getElementById('customize-launch-menu').hidden=true;
  toggle.setAttribute('aria-controls','asset-shelf');
  toggle.addEventListener('click',event=>{event.stopPropagation();if(shelf.classList.contains('is-open')&&!shelf.classList.contains('is-sticker-mode'))document.getElementById('asset-shelf-close').click();else document.getElementById('theme-shelf-toggle').click()});
}
