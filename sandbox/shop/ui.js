function setupTeacherTilesShop(){
  const modal=document.getElementById('shop-modal');
  const toggle=document.getElementById('shop-toggle');
  const close=document.getElementById('shop-close');
  if(!modal||!toggle||!close)return;

  const shopHome=modal.querySelector('[data-shop-page="home"]');
  shopHome.querySelector('.shop-banner').after(shopHome.querySelector('.shop-membership-grid'));
  shopHome.querySelectorAll('.shop-featured-section').forEach(section=>shopHome.append(section));
  for(const name of ['themes','stickers','cursors']){
    const page=modal.querySelector('[data-shop-page="'+name+'"]');
    if(page.querySelector('[data-shop-browser]'))continue;
    const toolbar=shopHome.querySelector('[data-shop-browser]').cloneNode(true);
    toolbar.dataset.shopBrowser=name;
    const input=toolbar.querySelector('[data-shop-search]');
    input.placeholder='Search '+name;input.setAttribute('aria-label','Search '+name);
    page.querySelector('.shop-page-heading').after(toolbar);
  }
  const previousFeatured=new Map();
  function refreshFeatured(){
    const owned=getOwnedShopProducts();
    for(const [group,pages] of Object.entries({themes:['themes'],skins:['tile-skins'],extras:['stickers','cursors']})){
      const container=modal.querySelector('[data-featured-section="'+group+'"]');
      for(const card of [...container.children]){const index=products.indexOf(card);if(index>=0)products.splice(index,1)}
      container.replaceChildren();
      const previous=previousFeatured.get(group)||new Set();
      const pool=pages.flatMap(page=>[...modal.querySelectorAll('[data-shop-page="'+page+'"] [data-shop-product]')]).filter(card=>!owned.has(card.dataset.shopProduct));
      // Shuffle, then prefer products absent from the last opening.
      for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
      pool.sort((a,b)=>Number(previous.has(a.dataset.shopProduct))-Number(previous.has(b.dataset.shopProduct)));
      const selected=pool.slice(0,3);
      previousFeatured.set(group,new Set(selected.map(card=>card.dataset.shopProduct)));
      container.closest('.shop-featured-section').hidden=!selected.length;
      for(const source of selected){const card=source.cloneNode(true);bindProduct(card);products.push(card);container.append(card)}
    }
  }
  const pages=[...modal.querySelectorAll('[data-shop-page]')];
  const pageButtons=[...modal.querySelectorAll('[data-shop-open-page]')];
  const balanceNode=document.getElementById('shop-coin-balance');
  const coinButton=document.getElementById('shop-coins-button');
  const profileCoinCard=document.getElementById('profile-coin-card');
  const coinMenu=document.getElementById('shop-coin-menu');
  const coinMenuClose=document.getElementById('shop-coin-menu-close');
  const toast=document.getElementById('shop-toast');
  const coinCelebration=document.getElementById('shop-coin-celebration');
  const coinCelebrationCoins=coinCelebration?.querySelector('.shop-coin-celebration__coins');
  const coinCelebrationAmount=document.getElementById('shop-coin-celebration-amount');
  const coinCelebrationBalance=document.getElementById('shop-coin-celebration-balance');
  const coinCelebrationClose=document.getElementById('shop-coin-celebration-close');
  const banners=[...modal.querySelectorAll('[data-shop-banner]')];
  const dots=[...modal.querySelectorAll('[data-shop-banner-dot]')];
  const prev=modal.querySelector('[data-shop-banner-prev]');
  const next=modal.querySelector('[data-shop-banner-next]');
  const products=[...modal.querySelectorAll('[data-shop-product]')];
  const redeemForm=document.getElementById('shop-redeem-form');
  const redeemInput=document.getElementById('shop-redeem-code');
  const redeemStatus=document.getElementById('shop-redeem-status');
  const subscribePreview=document.getElementById('shop-subscribe-preview');
  const coinPacks=[...modal.querySelectorAll('[data-coin-pack]')];
  const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const coinCheckoutStorageKey='teacherTilesPendingCoinCheckout';
  let activePage='home',bannerIndex=0,bannerTimer=0,toastTimer=0,coinCelebrationTimer=0,coinCelebrationFrame=0,lastFocus=null,checkoutHandled=false,pendingCoinCelebration=null;

  const shopBrowserClean=value=>String(value||'').toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim();
  const setupShopSelect=select=>{
    if(!select||select.dataset.customized==='true')return;
    const host=select.closest('.shop-browser-sort');
    if(!host)return;
    select.dataset.customized='true';
    select.hidden=true;
    select.tabIndex=-1;
    select.setAttribute('aria-hidden','true');
    const trigger=document.createElement('button');
    trigger.type='button';
    trigger.className='shop-select-button';
    trigger.setAttribute('aria-haspopup','listbox');
    trigger.setAttribute('aria-expanded','false');
    trigger.setAttribute('aria-label',select.getAttribute('aria-label')||'Choose an option');
    const value=document.createElement('b');
    const chevron=document.createElement('i');
    chevron.setAttribute('aria-hidden','true');
    chevron.textContent='⌄';
    trigger.append(value,chevron);
    const menu=document.createElement('div');
    menu.className='shop-select-menu';
    menu.setAttribute('role','listbox');
    menu.hidden=true;
    const close=()=>{menu.hidden=true;trigger.setAttribute('aria-expanded','false');host.classList.remove('is-select-open')};
    const sync=()=>{
      value.textContent=select.selectedOptions[0]?.textContent||'';
      menu.querySelectorAll('button').forEach(option=>{
        const selected=option.dataset.value===select.value;
        option.classList.toggle('is-selected',selected);
        option.setAttribute('aria-selected',String(selected));
      });
    };
    [...select.options].forEach(nativeOption=>{
      const option=document.createElement('button');
      option.type='button';
      option.dataset.value=nativeOption.value;
      option.setAttribute('role','option');
      option.innerHTML=`<span>${nativeOption.textContent}</span><i aria-hidden="true">✓</i>`;
      option.addEventListener('click',event=>{
        event.preventDefault();
        event.stopPropagation();
        select.value=nativeOption.value;
        sync();
        select.dispatchEvent(new Event('change',{bubbles:true}));
        close();
        trigger.focus();
      });
      menu.appendChild(option);
    });
    trigger.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      const open=menu.hidden;
      document.querySelectorAll('.shop-select-menu:not([hidden])').forEach(other=>{
        if(other===menu)return;
        other.hidden=true;
        other.previousElementSibling?.setAttribute('aria-expanded','false');
        other.closest('.shop-browser-sort')?.classList.remove('is-select-open');
      });
      menu.hidden=!open;
      trigger.setAttribute('aria-expanded',String(open));
      host.classList.toggle('is-select-open',open);
      if(open)menu.querySelector('.is-selected')?.focus();
    });
    trigger.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();close()}});
    select.addEventListener('change',sync);
    document.addEventListener('click',event=>{if(!host.contains(event.target))close()});
    host.append(trigger,menu);
    sync();
  };
  const setupShopBrowser=toolbar=>{
    const page=toolbar.closest('[data-shop-page]');
    const pageName=toolbar.dataset.shopBrowser;
    const container=pageName==='home'?page?.querySelector('.shop-category-grid'):page?.querySelector('.shop-product-grid');
    const search=toolbar.querySelector('[data-shop-search]');
    const clearButton=toolbar.querySelector('[data-shop-search-clear]');
    const sort=toolbar.querySelector('[data-shop-sort]');
    const filter=toolbar.querySelector('[data-shop-filter]');
    const result=toolbar.querySelector('[data-shop-results]');
    if(!container||!search||!sort)return()=>{};
    setupShopSelect(filter);
    setupShopSelect(sort);
    const items=[...container.children].filter(item=>item.matches(pageName==='home'?'.shop-category':'.shop-product'));
    const globalResults=pageName==='home'?document.createElement('div'):null;
    if(globalResults){globalResults.className='shop-global-results';globalResults.hidden=true;toolbar.insertAdjacentElement('afterend',globalResults)}
    const empty=document.createElement('div');
    empty.className='shop-browser-empty';
    empty.innerHTML='<span aria-hidden="true">⌕</span><strong>No matches</strong><small>Try a different name or keyword.</small>';
    empty.hidden=true;
    container.insertAdjacentElement('afterend',empty);
    const nameOf=item=>item.querySelector('h3,.shop-category__copy strong')?.textContent?.trim()||'';
    const render=()=>{
      const terms=shopBrowserClean(search.value).split(/\s+/).filter(Boolean);
      const mode=sort.value;
      const tileType=filter?.value||'all';
      if(pageName==='home'&&terms.length){
        const matched=products.filter(item=>terms.every(term=>shopBrowserClean(`${item.dataset.shopProduct||''} ${item.textContent||''}`).includes(term))).sort((a,b)=>{
          if(mode==='name-asc')return nameOf(a).localeCompare(nameOf(b));
          if(mode==='name-desc')return nameOf(b).localeCompare(nameOf(a));
          if(mode==='price-asc')return Number(a.dataset.shopPrice||0)-Number(b.dataset.shopPrice||0)||nameOf(a).localeCompare(nameOf(b));
          if(mode==='price-desc')return Number(b.dataset.shopPrice||0)-Number(a.dataset.shopPrice||0)||nameOf(a).localeCompare(nameOf(b));
          if(mode==='newest')return products.indexOf(b)-products.indexOf(a);
          return products.indexOf(a)-products.indexOf(b);
        });
        globalResults.replaceChildren();
        globalResults.classList.toggle('is-empty',matched.length===0);
        matched.forEach(source=>{
          const card=source.cloneNode(true);
          card.classList.add('shop-search-result');
          card.removeAttribute('data-shop-product');
          const action=card.querySelector('[data-shop-buy]');
          if(action){action.disabled=false;action.removeAttribute('data-shop-buy');action.className='shop-search-result__view';action.textContent='View →';action.addEventListener('click',()=>{
            const targetPage=source.closest('[data-shop-page]')?.dataset.shopPage||'home';
            showPage(targetPage);
            source.classList.add('is-shop-highlighted');
            source.scrollIntoView({block:'center',behavior:reduceMotion?'auto':'smooth'});
            setTimeout(()=>source.classList.remove('is-shop-highlighted'),1300);
          })}
          globalResults.appendChild(card);
        });
        page.classList.add('is-global-searching');
        if(!matched.length)globalResults.innerHTML='<span aria-hidden="true">⌕</span><strong>No shop items found</strong><small>Try another product name, collection, or keyword.</small>';
        globalResults.hidden=false;
        empty.hidden=true;
        clearButton.hidden=false;
        if(result)result.textContent=`${matched.length} ${matched.length===1?'result':'results'}`;
        return;
      }
      if(pageName==='home'){page.classList.remove('is-global-searching');globalResults.hidden=true;globalResults.replaceChildren()}
      const ordered=[...items].sort((a,b)=>{
        if(mode==='name-asc')return nameOf(a).localeCompare(nameOf(b));
        if(mode==='name-desc')return nameOf(b).localeCompare(nameOf(a));
        if(mode==='price-asc')return Number(a.dataset.shopPrice||0)-Number(b.dataset.shopPrice||0)||nameOf(a).localeCompare(nameOf(b));
        if(mode==='price-desc')return Number(b.dataset.shopPrice||0)-Number(a.dataset.shopPrice||0)||nameOf(a).localeCompare(nameOf(b));
        if(mode==='newest')return items.indexOf(b)-items.indexOf(a);
        return items.indexOf(a)-items.indexOf(b);
      });
      let visible=0;
      ordered.forEach(item=>{
        const searchMatch=terms.every(term=>shopBrowserClean(`${item.dataset.shopProduct||''} ${item.textContent||''}`).includes(term));
        const typeMatch=tileType==='all'||item.dataset.shopTileType===tileType;
        const match=searchMatch&&typeMatch;
        item.hidden=!match;
        item.classList.toggle('shop-filter-hidden',!match);
        if(match)visible++;
        container.appendChild(item);
      });
      clearButton.hidden=!search.value;
      empty.hidden=visible>0;
      if(result)result.textContent=`${visible} ${pageName==='home'?(visible===1?'category':'categories'):(visible===1?'skin':'skins')}`;
    };
    search.addEventListener('input',render);
    search.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();search.value='';render();search.focus()}});
    clearButton.addEventListener('click',()=>{search.value='';render();search.focus()});
    sort.addEventListener('change',render);
    filter?.addEventListener('change',render);
    render();
    return render;
  };
  const refreshShopBrowsers=[...modal.querySelectorAll('[data-shop-browser]')].map(setupShopBrowser);

  const accountState=()=>window.TeacherTilesAccount?.state||{ready:false,loading:true,signedIn:false,coinBalance:0,ownedProductIds:[]};
  const errorMessage=(error,fallback)=>{
    const raw=String(error?.message||'').replace(/^Firebase:\s*/i,'').replace(/^Error:\s*/i,'').trim();
    return raw||fallback;
  };
  function syncBalance(){
    const state=accountState();
    const formattedBalance=(Number(state.coinBalance)||0).toLocaleString();
    if(balanceNode)balanceNode.textContent=formattedBalance;
    if(coinButton){
      coinButton.dataset.coinDigits=String(formattedBalance.length);
      coinButton.classList.toggle('is-wide-balance',formattedBalance.length>9);
      coinButton.classList.toggle('is-extra-wide-balance',formattedBalance.length>13);
    }
    coinButton?.classList.toggle('is-loading',Boolean(state.loading));
    coinPacks.forEach(button=>{button.disabled=state.loading||!state.signedIn||button.dataset.checkoutBusy==='true'});
  }
  function syncProducts(){
    const state=accountState();
    const owned=new Set(state.ownedProductIds||[]);
    products.forEach(card=>{
      const isOwned=owned.has(card.dataset.shopProduct);
      markSubscriptionAccess(card,card.dataset.shopProduct);
      card.classList.toggle('is-owned',isOwned);
      const button=card.querySelector('[data-shop-buy]');
      if(!button)return;
      button.innerHTML=isOwned?'<strong>Owned</strong>':`<span class="shop-coin-icon shop-coin-icon--small" aria-hidden="true"><img src="assets/shop/coin.png" alt=""></span><strong>${Number(card.dataset.shopPrice||0).toLocaleString()}</strong>`;
      button.setAttribute('aria-label',isOwned?`${card.querySelector('h3')?.textContent||'Pack'} owned`:`Buy ${card.querySelector('h3')?.textContent||'pack'} for ${card.dataset.shopPrice||0} coins`);
      button.disabled=isOwned||state.loading||!state.signedIn||card.classList.contains('is-purchasing');
    });
  }
  function syncShop(){syncBalance();syncProducts()}
  function showToast(message){
    if(!toast)return;
    toast.textContent=message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>toast.classList.remove('is-visible'),2300);
  }
  function closeCoinCelebration(){
    if(!coinCelebration||coinCelebration.hidden)return;
    coinCelebration.classList.remove('is-visible');
    coinButton?.classList.remove('is-celebrating');
    clearTimeout(coinCelebrationTimer);
    cancelAnimationFrame(coinCelebrationFrame);
    setTimeout(()=>{if(!coinCelebration.classList.contains('is-visible'))coinCelebration.hidden=true},reduceMotion?0:260);
  }
  function showCoinCelebration(previousBalance,currentBalance){
    if(!coinCelebration||!coinCelebrationAmount||!coinCelebrationBalance)return;
    const from=Math.max(0,Number(previousBalance)||0);
    const to=Math.max(from,Number(currentBalance)||0);
    const added=to-from;
    if(added<1)return;

    clearTimeout(coinCelebrationTimer);
    cancelAnimationFrame(coinCelebrationFrame);
    coinCelebrationAmount.textContent=`+${added.toLocaleString()}`;
    coinCelebrationBalance.textContent=from.toLocaleString();
    coinCelebrationCoins?.replaceChildren();
    for(let index=0;index<22;index++){
      const particle=document.createElement('i');
      const image=document.createElement('img');
      const angle=Math.PI*2*index/22+(index%3)*.08;
      const distance=145+(index%5)*19;
      particle.style.setProperty('--coin-x',`${Math.cos(angle)*distance}px`);
      particle.style.setProperty('--coin-y',`${Math.sin(angle)*distance}px`);
      particle.style.setProperty('--coin-r',`${(index%2?-1:1)*(150+index*29)}deg`);
      particle.style.setProperty('--coin-delay',`${(index%7)*18}ms`);
      particle.style.setProperty('--coin-size',`${22+(index%4)*5}px`);
      image.src='assets/shop/coin.png';image.alt='';image.draggable=false;
      particle.appendChild(image);coinCelebrationCoins?.appendChild(particle);
    }

    coinCelebration.hidden=false;
    coinCelebration.classList.remove('is-visible');
    void coinCelebration.offsetWidth;
    coinCelebration.classList.add('is-visible');
    coinButton?.classList.add('is-celebrating');
    playUiSfx('money',.72);
    setTimeout(()=>playUiSfx('confetti',.68),120);

    if(reduceMotion){coinCelebrationBalance.textContent=to.toLocaleString()}
    else{
      const started=performance.now();
      const duration=1250;
      const tick=now=>{
        const progress=Math.min(1,(now-started)/duration);
        const eased=1-Math.pow(1-progress,4);
        coinCelebrationBalance.textContent=Math.round(from+added*eased).toLocaleString();
        if(progress<1)coinCelebrationFrame=requestAnimationFrame(tick);
        else coinCelebrationBalance.textContent=to.toLocaleString();
      };
      coinCelebrationFrame=requestAnimationFrame(tick);
    }
    coinCelebrationTimer=setTimeout(closeCoinCelebration,4600);
  }
  function readPendingCoinCheckout(){
    try{
      const value=JSON.parse(sessionStorage.getItem(coinCheckoutStorageKey)||'null');
      if(!value||Date.now()-Number(value.startedAt||0)>2*60*60*1000)return null;
      return value;
    }catch{return null}
  }
  function maybeCelebrateCoinCheckout(){
    if(!pendingCoinCelebration)return;
    const current=Number(accountState().coinBalance)||0;
    const previous=Number(pendingCoinCelebration.balance)||0;
    if(current<=previous)return;
    showCoinCelebration(previous,current);
    pendingCoinCelebration=null;
    try{sessionStorage.removeItem(coinCheckoutStorageKey)}catch{}
  }
  function showPage(name){
    if(!pages.some(page=>page.dataset.shopPage===name))name='home';
    activePage=name;
    pages.forEach(page=>{
      const active=page.dataset.shopPage===name;
      page.hidden=!active;
      page.classList.toggle('is-active',active);
    });
    modal.querySelector('.shop-content')?.scrollTo({top:0,behavior:reduceMotion?'auto':'smooth'});
    refreshShopBrowsers.forEach(render=>render());
  }
  function showBanner(index,restart=true){
    if(!banners.length)return;
    bannerIndex=(index+banners.length)%banners.length;
    banners.forEach((slide,i)=>slide.classList.toggle('is-active',i===bannerIndex));
    dots.forEach((dot,i)=>{
      const active=i===bannerIndex;
      dot.classList.toggle('is-active',active);
      dot.setAttribute('aria-selected',String(active));
    });
    if(restart)startBannerTimer();
  }
  function stopBannerTimer(){if(bannerTimer){clearInterval(bannerTimer);bannerTimer=0}}
  function startBannerTimer(){
    stopBannerTimer();
    if(reduceMotion||modal.hidden||coinMenu&&!coinMenu.hidden)return;
    bannerTimer=setInterval(()=>showBanner(bannerIndex+1,false),5200);
  }
  function openCoins(){
    if(!coinMenu)return;
    coinMenu.hidden=false;
    coinMenu.setAttribute('aria-hidden','false');
    coinButton?.setAttribute('aria-expanded','true');
    requestAnimationFrame(()=>coinMenu.classList.add('is-open'));
    stopBannerTimer();
    coinMenuClose?.focus({preventScroll:true});
  }
  function closeCoins(restoreFocus=true){
    if(!coinMenu||coinMenu.hidden)return;
    coinMenu.classList.remove('is-open');
    coinMenu.setAttribute('aria-hidden','true');
    coinButton?.setAttribute('aria-expanded','false');
    setTimeout(()=>{coinMenu.hidden=true;if(!modal.hidden)startBannerTimer()},reduceMotion?0:220);
    if(restoreFocus)coinButton?.focus({preventScroll:true});
  }
  function openShop(){
    lastFocus=document.activeElement;
    const shelf=document.getElementById('asset-shelf');
    if(shelf?.classList.contains('is-open'))document.getElementById('asset-shelf-close')?.click();
    modal.hidden=false;
    modal.setAttribute('aria-hidden','false');
    toggle.setAttribute('aria-expanded','true');
    showPage('home');
    modal.querySelector('.shop-content').scrollTop=0;
    refreshFeatured();
    syncShop();
    syncStickerShopPackCounts();
    showBanner(bannerIndex,false);
    requestAnimationFrame(()=>modal.classList.add('is-open'));
    startBannerTimer();
    close.focus({preventScroll:true});
  }
  function closeShop(){
    closeProduct();
    closeCoins(false);
    closeCoinCelebration();
    stopBannerTimer();
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden','true');
    toggle.setAttribute('aria-expanded','false');
    setTimeout(()=>{modal.hidden=true},reduceMotion?0:220);
    if(lastFocus&&typeof lastFocus.focus==='function')lastFocus.focus({preventScroll:true});else toggle.focus({preventScroll:true});
  }
  let productPopup=null,productPopupCard=null,productPopupFocus=null;
  function closeProduct(){
    if(!productPopup)return;
    const index=products.indexOf(productPopupCard);if(index>=0)products.splice(index,1);
    productPopup.remove();productPopup=null;productPopupCard=null;
    if(productPopupFocus?.isConnected)productPopupFocus.focus({preventScroll:true});
  }
  function openProduct(id){
    const source=products.find(card=>card.dataset.shopProduct===id);if(!source)return;
    if(modal.hidden)openShop();closeProduct();productPopupFocus=document.activeElement;
    productPopup=document.createElement('div');productPopup.className='shop-product-popup';
    const panel=document.createElement('section');panel.className='shop-product-popup__panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',source.querySelector('h3')?.textContent||'Product details');
    const dismiss=document.createElement('button');dismiss.type='button';dismiss.className='shop-product-popup__close';dismiss.textContent='×';dismiss.setAttribute('aria-label','Close product details');dismiss.onclick=closeProduct;
    productPopupCard=source.cloneNode(true);productPopupCard.removeAttribute('tabindex');productPopupCard.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));productPopupCard.classList.remove('is-shop-highlighted');
    const card=productPopupCard;card.querySelector('[data-shop-buy]')?.addEventListener('click',()=>tryBuy(card));products.push(card);
    panel.append(dismiss,card);productPopup.append(panel);modal.querySelector('.shop-panel').append(productPopup);
    productPopup.addEventListener('click',event=>{if(event.target===productPopup)closeProduct()});
    productPopup.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();closeProduct()}if(event.key==='Tab'){const controls=[...panel.querySelectorAll('button:not(:disabled),[tabindex="0"]')];const first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}});
    syncProducts();dismiss.focus({preventScroll:true});
  }
  async function tryBuy(card){
    const id=card.dataset.shopProduct;
    const state=accountState();
    if((state.ownedProductIds||[]).includes(id)){showToast('This pack is already owned.');return}
    if(!window.TeacherTilesAccount?.purchase){showToast('The secure shop is still loading.');return}
    card.classList.add('is-purchasing');syncProducts();
    try{
      const result=await window.TeacherTilesAccount.purchase(id);
      syncShop();
      showToast(result.alreadyOwned?'This pack is already owned.':`${card.querySelector('h3')?.textContent||'Pack'} added to your collection.`);
    }catch(error){
      const shortfall=Number(error?.details?.shortfall);
      if(Number.isFinite(shortfall)&&shortfall>0){showToast(`You need ${shortfall.toLocaleString()} more coins.`);setTimeout(openCoins,260)}
      else showToast(errorMessage(error,'The purchase could not be completed.'));
    }finally{card.classList.remove('is-purchasing');syncProducts()}
  }
  async function startCoinCheckout(button){
    if(!window.TeacherTilesAccount?.createCoinCheckout){showToast('The secure coin store is still loading.');return}
    const original=button.textContent;
    button.dataset.checkoutBusy='true';button.disabled=true;button.textContent='Opening…';
    try{
      const {url}=await window.TeacherTilesAccount.createCoinCheckout(button.dataset.coinPack);
      try{sessionStorage.setItem(coinCheckoutStorageKey,JSON.stringify({balance:Number(accountState().coinBalance)||0,packId:button.dataset.coinPack,startedAt:Date.now()}))}catch{}
      window.location.assign(url);
    }catch(error){
      showToast(errorMessage(error,'Stripe Checkout could not be opened.'));
      delete button.dataset.checkoutBusy;button.disabled=!accountState().signedIn;button.textContent=original;
    }
  }
  function cleanCheckoutQuery(){
    const url=new URL(window.location.href);url.searchParams.delete('tt_checkout');
    history.replaceState(history.state,'',`${url.pathname}${url.search}${url.hash}`);
  }
  function handleCheckoutReturn(){
    if(checkoutHandled)return;
    const status=new URLSearchParams(window.location.search).get('tt_checkout');
    if(!status||!accountState().signedIn)return;
    checkoutHandled=true;openShop();openCoins();
    if(status==='success'){
      pendingCoinCelebration=readPendingCoinCheckout()||{balance:Number(accountState().coinBalance)||0,startedAt:Date.now()};
      showToast('Payment complete. Your coin balance will update momentarily.');
      maybeCelebrateCoinCheckout();
      [500,1600,3600,7000].forEach(delay=>setTimeout(()=>window.TeacherTilesAccount?.refresh?.().catch(()=>{}),delay));
    }else{
      try{sessionStorage.removeItem(coinCheckoutStorageKey)}catch{}
      showToast('Checkout cancelled — you were not charged.');
    }
    cleanCheckoutQuery();
  }

  toggle.addEventListener('click',openShop);
  close.addEventListener('click',closeShop);
  modal.querySelectorAll('[data-shop-close]').forEach(node=>node.addEventListener('click',closeShop));
  pageButtons.forEach(button=>button.addEventListener('click',()=>showPage(button.dataset.shopOpenPage)));
  coinButton?.addEventListener('click',openCoins);
  profileCoinCard?.addEventListener('click',()=>{
    document.querySelector('[data-profile-close]')?.click();
    openShop();
    openCoins();
  });
  coinMenuClose?.addEventListener('click',()=>closeCoins());
  coinCelebrationClose?.addEventListener('click',closeCoinCelebration);
  prev?.addEventListener('click',()=>showBanner(bannerIndex-1));
  next?.addEventListener('click',()=>showBanner(bannerIndex+1));
  dots.forEach(dot=>dot.addEventListener('click',()=>showBanner(Number(dot.dataset.shopBannerDot)||0)));
  function bindProduct(card){
    card.tabIndex=0;card.setAttribute('aria-label',`View ${card.querySelector('h3')?.textContent||'product'}`);
    card.querySelector('[data-shop-buy]')?.addEventListener('click',event=>{event.stopPropagation();tryBuy(card)});
    card.addEventListener('click',event=>{if(!event.target.closest('button,.subscription-access-crown'))openProduct(card.dataset.shopProduct)});
    card.addEventListener('keydown',event=>{if(event.target===card&&['Enter',' '].includes(event.key)){event.preventDefault();openProduct(card.dataset.shopProduct)}});
  }
  products.forEach(bindProduct);
  coinPacks.forEach(button=>button.addEventListener('click',()=>startCoinCheckout(button)));
  redeemInput?.addEventListener('input',()=>{
    const start=redeemInput.selectionStart;
    redeemInput.value=redeemInput.value.toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,32);
    try{redeemInput.setSelectionRange(start,start)}catch{}
    if(redeemStatus)redeemStatus.textContent='';
  });
  redeemForm?.addEventListener('submit',async event=>{
    event.preventDefault();
    const code=redeemInput?.value.trim()||'';
    if(!redeemStatus)return;
    if(!code){redeemStatus.textContent='Enter a code to continue.';redeemStatus.classList.add('is-error');redeemInput?.focus();return}
    const button=redeemForm.querySelector('button[type="submit"]');
    redeemStatus.classList.remove('is-error');redeemStatus.textContent='Checking code…';
    if(button)button.disabled=true;
    try{
      const previousBalance=Number(accountState().coinBalance)||0;
      const result=await window.TeacherTilesAccount.redeem(code);
      redeemInput.value='';redeemStatus.textContent=`Added ${Number(result.grantedCoins||0).toLocaleString()} coins to your account.`;
      showToast('Code redeemed successfully.');syncShop();
      showCoinCelebration(previousBalance,Number(result.coinBalance)||Number(accountState().coinBalance)||previousBalance+Number(result.grantedCoins||0));
    }catch(error){
      redeemStatus.classList.add('is-error');redeemStatus.textContent=errorMessage(error,'That code could not be redeemed.');
    }finally{if(button)button.disabled=false}
  });
  subscribePreview?.addEventListener('click',async()=>{
    if(!window.TeacherTilesAccount?.createSubscriptionCheckout){showToast('The subscription store is still loading.');return}
    const original=subscribePreview.textContent;
    subscribePreview.disabled=true;subscribePreview.textContent='Opening…';
    try{
      const {url}=await window.TeacherTilesAccount.createSubscriptionCheckout('price_1U9w2B2H9EEY7x9T4O9EiCIv');
      window.location.assign(url);
    }catch(error){
      showToast(errorMessage(error,'Subscription checkout could not be opened.'));
      subscribePreview.disabled=false;subscribePreview.textContent=original;
    }
  });
  modal.querySelector('.shop-banner')?.addEventListener('pointerenter',stopBannerTimer);
  modal.querySelector('.shop-banner')?.addEventListener('pointerleave',startBannerTimer);
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||modal.hidden)return;
    if(coinMenu&&!coinMenu.hidden){closeCoins();return}
    closeShop();
  });
  window.addEventListener('teachertiles:accountchange',()=>{syncShop();handleCheckoutReturn();maybeCelebrateCoinCheckout()});
  window.addEventListener('teachertiles:shoprequest',event=>{
    const productId=event.detail?.productId;
    openProduct(productId);
  });
  syncStickerShopPackCounts();
  window.TeacherTilesShop={
    open:openShop,
    openMembership:()=>{openShop();closeProduct();closeCoins(false);requestAnimationFrame(()=>{subscribePreview?.closest('.shop-membership-card')?.scrollIntoView({block:'center',behavior:'smooth'});subscribePreview?.focus({preventScroll:true});});},
    openProduct,
    openCoins:()=>{openShop();openCoins()},
    openPage:name=>{openShop();showPage(name)},
    previewCoinCelebration:(amount=500)=>{
      const added=Math.max(1,Math.floor(Number(amount)||500));
      const current=Number(accountState().coinBalance)||0;
      openShop();
      requestAnimationFrame(()=>showCoinCelebration(current,current+added));
    },
    sync:()=>{syncShop();syncStickerShopPackCounts();refreshShopBrowsers.forEach(render=>render())}
  };
  syncShop();handleCheckoutReturn();
}
