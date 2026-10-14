function setupTeacherTilesShop(){
  const modal=document.getElementById('shop-modal');
  const toggle=document.getElementById('shop-toggle');
  const close=document.getElementById('shop-close');
  if(!modal||!toggle||!close)return;

  setupShopExtras(modal);
  const shopHome=modal.querySelector('[data-shop-page="home"]');
  shopHome.querySelector('.shop-banner').after(shopHome.querySelector('.shop-membership-grid'));
  shopHome.append(shopHome.querySelector('.shop-featured-library'));
  const landing=document.createElement('div');landing.className='shop-landing';
  const promotions=document.createElement('div');promotions.className='shop-promotions';
  const discovery=document.createElement('div');discovery.className='shop-discovery';
  promotions.append(shopHome.querySelector('.shop-banner'),shopHome.querySelector('.shop-membership-grid'));
  discovery.append(shopHome.querySelector('.shop-home-heading'),shopHome.querySelector('[data-shop-browser]'),shopHome.querySelector('.shop-category-grid'));
  const explore=document.createElement('button');explore.type='button';explore.className='shop-explore-packs';explore.innerHTML='Explore the Featured Library <span aria-hidden="true">↓</span>';
  explore.addEventListener('click',()=>shopHome.querySelector('.shop-featured-library')?.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'start'}));
  discovery.append(explore);landing.append(promotions,discovery);shopHome.prepend(landing);
  const navigation=document.createElement('nav');navigation.className='shop-navigation';navigation.setAttribute('aria-label','Shop collections');
  navigation.innerHTML='<button type="button" data-shop-open-page="home" aria-label="Shop home"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8"/></svg></button>'+[['themes','Themes'],['stickers','Stickers'],['tile-skins','Tile Skins'],['cursors','Cursors']].map(([page,label])=>`<button type="button" data-shop-open-page="${page}">${label}</button>`).join('');
  modal.querySelector('.shop-header').after(navigation);
  const redeemTrigger=document.createElement('button');redeemTrigger.type='button';redeemTrigger.className='shop-redeem-trigger';redeemTrigger.textContent='Redeem Code';redeemTrigger.setAttribute('aria-haspopup','dialog');redeemTrigger.setAttribute('aria-expanded','false');
  navigation.append(redeemTrigger);
  for(const [id,label,soon] of [['planner-skins','Planners',false],['presentation-themes','Presentations',true],['profile-cosmetics','Profiles',false],['tile-effects','Tile Effects',true]]){
    const button=document.createElement('button');button.type='button';button.textContent=label;
    if(soon){button.disabled=true;button.setAttribute('aria-label',label+' — Coming Soon');const caption=document.createElement('span');caption.textContent=label;button.replaceChildren(caption);const hint=document.createElement('small');hint.textContent='Coming Soon';hint.setAttribute('aria-hidden','true');button.append(hint);}else button.dataset.shopOpenPage=id;
    navigation.insertBefore(button,redeemTrigger);
  }
  const redeemDialog=document.createElement('dialog');redeemDialog.className='shop-redeem-dialog';redeemDialog.setAttribute('aria-labelledby','shop-redeem-title');
  const redeemDismiss=document.createElement('button');redeemDismiss.type='button';redeemDismiss.className='shop-redeem-dismiss';redeemDismiss.setAttribute('aria-label','Close code redemption');redeemDismiss.textContent='×';
  redeemDialog.append(redeemDismiss,shopHome.querySelector('.shop-redeem-card'));modal.querySelector('.shop-panel').append(redeemDialog);
  redeemTrigger.addEventListener('click',()=>{closeCoins(false);stopBannerTimer();redeemDialog.showModal();redeemTrigger.setAttribute('aria-expanded','true');redeemDialog.querySelector('input')?.focus()});
  redeemDismiss.addEventListener('click',()=>redeemDialog.close());
  redeemDialog.addEventListener('close',()=>{redeemTrigger.setAttribute('aria-expanded','false');if(!modal.hidden)startBannerTimer()});
  redeemDialog.addEventListener('keydown',event=>{if(event.key==='Escape')event.stopPropagation()});
  redeemDialog.addEventListener('click',event=>{if(event.target!==redeemDialog)return;const rect=redeemDialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)redeemDialog.close()});
  for(const name of ['themes','stickers','cursors','planner-skins','profile-cosmetics']){
    const page=modal.querySelector('[data-shop-page="'+name+'"]');
    if(page.querySelector('[data-shop-browser]'))continue;
    const toolbar=shopHome.querySelector('[data-shop-browser]').cloneNode(true);
    toolbar.dataset.shopBrowser=name;
    const input=toolbar.querySelector('[data-shop-search]');
    input.placeholder='Search '+name.replaceAll('-',' ');input.setAttribute('aria-label','Search '+name.replaceAll('-',' '));
    page.querySelector('.shop-page-heading').after(toolbar);
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
  const products=[...modal.querySelectorAll('[data-shop-product]')];
  const catalogProducts=[...products];
  const featuredLibrary=createShopFeaturedLibrary({modal,sources:catalogProducts,
    mount:card=>{bindProduct(card);products.push(card)},
    unmount:card=>{const index=products.indexOf(card);if(index>=0)products.splice(index,1)},
    sync:()=>syncProducts(),canRotate:()=>!productPopup&&!redeemDialog.open&&(!coinMenu||coinMenu.hidden)
  });
  const redeemForm=document.getElementById('shop-redeem-form');
  const redeemInput=document.getElementById('shop-redeem-code');
  const redeemStatus=document.getElementById('shop-redeem-status');
  const subscribePreview=document.getElementById('shop-subscribe-preview');
  const membershipCard=subscribePreview?.closest('.shop-membership-card');
  const membershipTitle=membershipCard?.querySelector('h3');
  const membershipDefaultTitle=membershipTitle?.textContent;
  let membershipCheckoutBusy=false;
  if(membershipCard)membershipCard.tabIndex=-1;
  const coinPacks=[...modal.querySelectorAll('[data-coin-pack]')];
  const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const coinCheckoutStorageKey='teacherTilesPendingCoinCheckout';
  let activePage='home',bannerIndex=0,bannerTimer=0,toastTimer=0,coinCelebrationTimer=0,coinCelebrationFrame=0,lastFocus=null,checkoutHandled=false,pendingCoinCelebration=null,pendingMembershipConfirmation=false;

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
        const matched=catalogProducts.filter(item=>terms.every(term=>shopBrowserClean(`${item.dataset.shopProduct||''} ${item.textContent||''}`).includes(term))).sort((a,b)=>{
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
      if(result)result.textContent=`${visible} ${pageName==='home'?(visible===1?'category':'categories'):(visible===1?'item':'items')}`;
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
  function syncMembership(){
    const state=accountState(),active=Boolean(state.subscriptionActive);
    membershipCard?.classList.toggle('is-subscription-active',active);
    if(membershipTitle)membershipTitle.textContent=active?'Subscription Active!':membershipDefaultTitle;
    for(const selector of ['.shop-membership-price','.shop-membership-card__foot']){
      const element=membershipCard?.querySelector(selector);if(element)element.hidden=active;
    }
    if(subscribePreview){
      subscribePreview.hidden=active;
      subscribePreview.disabled=active||Boolean(state.loading)||!state.ready||membershipCheckoutBusy;
      subscribePreview.textContent=membershipCheckoutBusy?'Opening…':'Subscribe · $5.99/mo';
    }
  }
  function syncShop(){syncBalance();syncProducts();syncMembership()}
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
    featuredLibrary.setActive(name==='home'&&!modal.hidden);
    navigation.querySelectorAll('button').forEach(button=>{if(button.dataset.shopOpenPage===name)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current')});
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
    banners.forEach((slide,i)=>{const active=i===bannerIndex;slide.classList.toggle('is-active',active);slide.inert=!active;slide.setAttribute('aria-hidden',String(!active))});
    dots.forEach((dot,i)=>{
      const active=i===bannerIndex;
      dot.classList.toggle('is-active',active);
      dot.setAttribute('aria-pressed',String(active));
    });
    if(restart)startBannerTimer();
  }
  function stopBannerTimer(){if(bannerTimer){clearInterval(bannerTimer);bannerTimer=0}}
  function startBannerTimer(){
    stopBannerTimer();
    if(reduceMotion||modal.hidden||redeemDialog.open||coinMenu&&!coinMenu.hidden)return;
    bannerTimer=setInterval(()=>{if(!modal.querySelector('.shop-banner')?.contains(document.activeElement))showBanner(bannerIndex+1,false)},7500);
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
    featuredLibrary.refresh();
    syncShop();
    syncStickerShopPackCounts();
    showBanner(bannerIndex,false);
    requestAnimationFrame(()=>modal.classList.add('is-open'));
    startBannerTimer();
    close.focus({preventScroll:true});
  }
  function closeShop(){
    featuredLibrary.setActive(false);
    if(redeemDialog.open)redeemDialog.close();
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
    const url=new URL(window.location.href);url.searchParams.delete('tt_checkout');url.searchParams.delete('tt_checkout_kind');
    history.replaceState(history.state,'',`${url.pathname}${url.search}${url.hash}`);
  }
  let subscriptionDialog=null;
  function showMembershipNotice(message){
    let notice=document.getElementById('shop-membership-notice');
    if(!notice){notice=document.createElement('div');notice.id='shop-membership-notice';notice.className='shop-membership-notice';notice.setAttribute('role','status');document.body.append(notice)}
    notice.textContent=message;
    if(!pendingMembershipConfirmation)setTimeout(()=>notice.remove(),6000);
  }
  function showSubscriptionActivated(){
    cleanCheckoutQuery();
    if(!modal.hidden)closeShop();
    const profile=document.getElementById('profile-modal');
    if(profile&&!profile.hidden)profile.querySelector('[data-profile-close]')?.click();
    document.getElementById('shop-membership-notice')?.remove();
    if(!subscriptionDialog){
      subscriptionDialog=document.createElement('dialog');
      subscriptionDialog.className='shop-subscription-success';
      subscriptionDialog.setAttribute('aria-labelledby','shop-subscription-success-title');
      subscriptionDialog.innerHTML='<span class="shop-success-crown" aria-hidden="true"><svg viewBox="0 0 48 48"><use href="assets/ui/subscriber-crown.svg?v=20260926#crown"/></svg></span><small>WELCOME TO MEMBERSHIP</small><h2 id="shop-subscription-success-title">Subscription Activated!</h2><p>Your subscriber features are ready to use on your board. Thanks for supporting TeacherTiles!</p><button type="button">Back to My Board</button>';
      document.body.append(subscriptionDialog);
      subscriptionDialog.querySelector('button').addEventListener('click',()=>subscriptionDialog.close());
      subscriptionDialog.addEventListener('keydown',event=>{if(event.key==='Escape')event.stopPropagation()});
    }
    if(!subscriptionDialog.open)subscriptionDialog.showModal();
  }
  function handleCheckoutReturn(){
    if(pendingMembershipConfirmation&&accountState().subscriptionActive){
      pendingMembershipConfirmation=false;
      showSubscriptionActivated();
    }
    if(checkoutHandled)return;
    const params=new URLSearchParams(window.location.search);
    const status=params.get('tt_checkout');
    if(!status||!accountState().signedIn)return;
    checkoutHandled=true;
    if(['membership','membership_trial'].includes(params.get('tt_checkout_kind'))){
      if(status==='success'){
        pendingMembershipConfirmation=!accountState().subscriptionActive;
        if(pendingMembershipConfirmation)showMembershipNotice('Confirming your subscription…');
        else showSubscriptionActivated();
        [500,1600,3600,7000,15000,30000,60000].forEach(delay=>setTimeout(()=>{
          if(pendingMembershipConfirmation&&accountState().signedIn)window.TeacherTilesAccount?.refresh?.().catch(()=>{});
        },delay));
        setTimeout(()=>{if(pendingMembershipConfirmation)showMembershipNotice('Still confirming your subscription. Reload this page to check again.');},65000);
      }else showMembershipNotice('Subscription checkout cancelled. Your membership has not started.');
      if(!pendingMembershipConfirmation)cleanCheckoutQuery();
      return;
    }
    openShop();openCoins();
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
      redeemInput.value='';
      const coins=Number(result.coinsAwarded)||0;
      if(result.status==='already_owned')redeemStatus.textContent='You already own this cosmetic. The code was not used.';
      else if(result.duplicate)redeemStatus.textContent='You have already redeemed this code.';
      else if(result.rewardType==='cosmetic')redeemStatus.textContent='Cosmetic unlocked!';
      else if(result.rewardType==='membership_trial')redeemStatus.textContent='Membership trial redeemed. Your membership is being confirmed.';
      else redeemStatus.textContent=`Added ${coins.toLocaleString()} coins to your account.`;
      showToast(redeemStatus.textContent);syncShop();
      if(coins>0&&!result.duplicate){redeemDialog.close();showCoinCelebration(previousBalance,previousBalance+coins);}
    }catch(error){
      redeemStatus.classList.add('is-error');redeemStatus.textContent=errorMessage(error,'That code could not be redeemed.');
    }finally{if(button)button.disabled=false}
  });
  subscribePreview?.addEventListener('click',async()=>{
    if(accountState().subscriptionActive){syncMembership();showToast('Your subscription is already active.');return}
    if(membershipCheckoutBusy||accountState().loading||!accountState().ready)return;
    if(!window.TeacherTilesAccount?.createSubscriptionCheckout){showToast('The subscription store is still loading.');return}
    membershipCheckoutBusy=true;syncMembership();
    try{
      const {url}=await window.TeacherTilesAccount.createSubscriptionCheckout('price_1U9w2B2H9EEY7x9T4O9EiCIv');
      if(!accountState().subscriptionActive)window.location.assign(url);
    }catch(error){
      showToast(errorMessage(error,'Subscription checkout could not be opened.'));
    }finally{membershipCheckoutBusy=false;syncMembership()}
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
    openMembership:()=>{openShop();closeProduct();closeCoins(false);requestAnimationFrame(()=>{membershipCard?.scrollIntoView({block:'center',behavior:'smooth'});(subscribePreview&&!subscribePreview.disabled&&!subscribePreview.hidden?subscribePreview:membershipCard)?.focus({preventScroll:true});});},
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
