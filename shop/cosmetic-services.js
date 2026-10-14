function getOwnedShopProducts(){
  const accountState=window.TeacherTilesAccount?.state;
  if(accountState?.ready&&Array.isArray(accountState.ownedProductIds))return new Set(accountState.ownedProductIds);
  try{
    const value=JSON.parse(localStorage.getItem(SHOP_OWNED_PRODUCTS_KEY)||'[]');
    return Array.isArray(value)?new Set(value):new Set();
  }catch{return new Set()}
}

function migrateLegacyCursorOwnership(){
  const owned=getOwnedShopProducts();
  const legacy=['cursor-blue','cursor-red','cursor-green','cursor-purple','cursor-gold'];
  if(owned.has(CURSOR_COLOR_PACK_PRODUCT_ID)||!legacy.some(id=>owned.has(id)))return;
  legacy.forEach(id=>owned.delete(id));
  owned.add(CURSOR_COLOR_PACK_PRODUCT_ID);
  try{localStorage.setItem(SHOP_OWNED_PRODUCTS_KEY,JSON.stringify([...owned]))}catch{}
}

function tileSkinById(id){return TILE_SKIN_CATALOG.find(skin=>skin.id===id)||null}

function hasCosmeticSubscription(){const state=window.TeacherTilesAccount?.state;return Boolean(state?.subscriptionActive)}

function cosmeticIsAccessible(product){return !product||getOwnedShopProducts().has(product)||hasCosmeticSubscription()}

function markSubscriptionAccess(element,product){
  element.querySelector(':scope > .subscription-access-crown')?.remove();
  if(!product||!hasCosmeticSubscription()||getOwnedShopProducts().has(product))return;
  const crown=document.createElement('span');crown.className='subscription-access-crown';crown.title='Unlocked via subscription';crown.setAttribute('aria-label',crown.title);crown.tabIndex=0;crown.innerHTML='<svg viewBox="0 0 48 48" aria-hidden="true"><use href="assets/ui/subscriber-crown.svg?v=20260926#crown"/></svg>';element.append(crown);
}

function tileSkinIsOwned(skin){return Boolean(skin&&(skin.free===true||cosmeticIsAccessible(skin.productId)))}

function cursorById(id){return CURSOR_CATALOG.find(cursor=>cursor.id===id)||CURSOR_CATALOG[0]}

function cursorIsOwned(cursor){return Boolean(cursor&&(!cursor.productId||cosmeticIsAccessible(cursor.productId)))}

function collectionPackIsOwned(pack){const product=COLLECTION_PACK_PRODUCTS[pack?.id];return cosmeticIsAccessible(product)}

function themeChoiceProduct(theme){const prefix=Object.keys(THEME_CHOICE_PRODUCTS).find(name=>(String(theme||'')===name||String(theme||'').startsWith(`${name}-`)));return prefix?THEME_CHOICE_PRODUCTS[prefix]:''}

function themeChoiceIsOwned(theme){const product=themeChoiceProduct(theme);return cosmeticIsAccessible(product)}

function applyAppCursor(id,{persist=true}={}){
  const equipGeneration=++cursorEquipGeneration;
  const requested=cursorById(id);
  const cursor=cursorIsOwned(requested)?requested:CURSOR_CATALOG[0];
  if(persist){try{localStorage.setItem(ACTIVE_CURSOR_KEY,cursor.id)}catch{}}
  document.body.dataset.appCursor=cursor.id;
  const cursorRoot=document.documentElement;
  if(cursor.id==='default'){
    document.body.classList.remove('has-custom-cursor');
    cursorRoot.style.removeProperty('--teacher-cursor-normal');
    cursorRoot.style.removeProperty('--teacher-cursor-point');
    cursorRoot.style.removeProperty('--teacher-cursor-open');
    cursorRoot.style.removeProperty('--teacher-cursor-grab');
  }
  else{
    const asset=state=>new URL(`assets/cursors/${cursor.runtimeDirectory||''}${cursor.id}-${state}.png?v=20260928-unified`,document.baseURI).href;
    const defaults={normal:[4,1],point:[10,1],open:[12,12],grab:[12,12]};
    const value=state=>`url("${asset(state)}") ${(cursor.hotspots?.[state]||defaults[state]).join(' ')}`;
    // Decode all states before activating the pack so the first grab cannot
    // lazily download its sprite and briefly show the operating system hand.
    if(!cursorSpriteLoads.has(cursor.id)){
      const images=['normal','point','open','grab'].map(state=>{const img=new Image();img.src=asset(state);return img});
      const ready=Promise.all(images.map(img=>img.decode()));
      cursorSpriteLoads.set(cursor.id,{images,ready,decoded:false});
      ready.then(()=>{cursorSpriteLoads.get(cursor.id).decoded=true}).catch(()=>cursorSpriteLoads.delete(cursor.id));
    }
    const applyStates=()=>{if(equipGeneration!==cursorEquipGeneration)return;for(const state of ['normal','point','open','grab'])cursorRoot.style.setProperty(`--teacher-cursor-${state}`,value(state));document.body.classList.add('has-custom-cursor')};
    const load=cursorSpriteLoads.get(cursor.id);
    if(load.decoded)applyStates();else load.ready.then(applyStates).catch(()=>{});
  }
  window.dispatchEvent(new CustomEvent('teachertiles:cursorchange',{detail:{cursorId:cursor.id}}));
  return cursor;
}

function restoreTileEdit(m,snapshot){
  if(!m?.isConnected)return m;
  for(const media of m.querySelectorAll('audio,video'))media.pause();
  for(const sound of m._activeTileSounds||[]){sound.pause();releaseBoostedMedia(sound)}
  m._activeTileSounds?.clear();
  const sibling=m.nextSibling;m._deactivate?.();m.remove();
  let next;
  try{next=withBoardChangesSuspended(()=>restoreTeacherTilesBoardObject(snapshot));}
  catch(error){console.error('Could not restore tile edit',error);}
  if(!next){if(sibling?.parentNode===workspace)workspace.insertBefore(m,sibling);else workspace.append(m);m._reactivate?.();if(snapshot.timer)m._boardTimerSetState?.(snapshot.timer);return m;}
  if(sibling?.parentNode===workspace)workspace.insertBefore(next,sibling);
  for(const action of [...undoStack,...redoStack]){
    if(action.el===m)action.el=next;
    if(action.elements)action.elements=action.elements.map(el=>el===m?next:el);
    for(const entry of action.entries||[]){if(entry.el===m)entry.el=next;if(entry.nextSibling===m)entry.nextSibling=next;}
  }
  selectedModules.delete(m);m._cleanup?.();return next;
}

function applyTileSkinToModule(m,id,{record=true}={}){
  const type=m.dataset.type,skin=id?tileSkinById(id):null;
  if(!m.isConnected||(id&&(!skin||skin.tileType!==type||!tileSkinIsOwned(skin))))return m;
  const before=m.dataset.tileSkin||'';if(before===id)return m;
  const snapshot=serializeBoardModule(m);if(!snapshot)return m;
  if(id)snapshot.dataset.tileSkin=id;else delete snapshot.dataset.tileSkin;
  if(skin?.preferredSize&&snapshot.transform){
    const prior=snapshot.transform,priorScale=Math.max(.5,Math.min(1,Number(prior.uniformScale)||1));
    const width=Math.max(1,Number(skin.preferredSize.width)||Number(prior.width)||m.offsetWidth);
    const height=Math.max(1,Number(skin.preferredSize.height)||Number(prior.height)||m.offsetHeight);
    const centerX=(Number(prior.left)||0)+(Number(prior.width)||m.offsetWidth)*priorScale/2;
    const centerY=(Number(prior.top)||0)+(Number(prior.height)||m.offsetHeight)*priorScale/2;
    snapshot.transform={...prior,left:clamp(centerX-width/2,0,Math.max(0,BOARD_WIDTH-width)),top:clamp(centerY-height/2,0,Math.max(0,BOARD_HEIGHT-height)),width,height,uniformScale:1};
  }
  const wasSelected=selectedModules.has(m),nextSibling=m.nextSibling;
  m._deactivate?.();m.remove();
  let next;
  try{next=restoreTeacherTilesBoardObject(snapshot);if(!next)throw Error('Could not restore tile skin')}
  catch(error){workspace.appendChild(m);m._boardTimerSetState?.(snapshot.timer);console.error(error);return m}
  if(nextSibling?.parentNode===workspace)workspace.insertBefore(next,nextSibling);
  for(const action of [...undoStack,...redoStack]){
    if(action.el===m)action.el=next;
    if(action.elements)action.elements=action.elements.map(el=>el===m?next:el);
    for(const entry of action.entries||[]){if(entry.el===m)entry.el=next;if(entry.nextSibling===m)entry.nextSibling=next}
  }
  selectedModules.delete(m);if(wasSelected)selectModules([next],{add:true});
  m._cleanup?.();
  if(record)recordHistory({type:'skin',el:next,before,after:id});
  notifyBoardChanged('tile-skin');return next;
}

function applyNewModuleTileSkin(m,type,requestedSkinId=''){
  const requested=tileSkinById(requestedSkinId);
  const skin=requested?.tileType===type&&tileSkinIsOwned(requested)?requested:null;
  if(skin)m.dataset.tileSkin=skin.id;
}
