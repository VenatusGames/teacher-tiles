const SANDBOX_COIN_KEY='teacherTilesCoins';
const SANDBOX_COIN_TOGGLE_KEY='teacherTilesSandboxCoinsEnabled';
const SANDBOX_PREVIOUS_COINS_KEY='teacherTilesSandboxPreviousCoins';
const OWNED_PRODUCTS_KEY='teacherTilesOwnedShopPacks';
const DEFAULT_TILE_SKINS_KEY='teacherTilesDefaultTileSkins';
const SANDBOX_COIN_BALANCE=999999;

if(!window.__teacherTilesSandboxConsoleLoaded){
  window.__teacherTilesSandboxConsoleLoaded=true;

  const stylesheet=document.createElement('link');
  stylesheet.rel='stylesheet';
  stylesheet.href=new URL('./dev-console.css',import.meta.url).href;
  document.head.appendChild(stylesheet);
  document.body.classList.add('sandbox-mode');

  const workspace=document.getElementById('workspace');
  if(workspace&&!workspace.querySelector('.sandbox-watermark')){
    const watermark=document.createElement('div');
    watermark.className='sandbox-watermark';
    watermark.textContent='SANDBOX';
    watermark.setAttribute('aria-hidden','true');
    workspace.appendChild(watermark);
  }

  const boardButton=document.getElementById('boards-toggle');
  const devButton=document.createElement('button');
  devButton.id='sandbox-dev-console-toggle';
  devButton.className='workspace-control workspace-tooltip-control sandbox-dev-toggle';
  devButton.type='button';
  devButton.setAttribute('aria-label','Open Dev Console');
  devButton.setAttribute('aria-expanded','false');
  devButton.innerHTML=`
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.1 8.2 4.3 12l3.8 3.8M15.9 8.2l3.8 3.8-3.8 3.8M13.7 5.8l-3.4 12.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <span class="upcoming-control__tooltip"><strong>Dev Console</strong></span>`;
  boardButton?.insertAdjacentElement('afterend',devButton);

  const consoleRoot=document.createElement('section');
  consoleRoot.id='sandbox-dev-console';
  consoleRoot.className='sandbox-dev-console';
  consoleRoot.hidden=true;
  consoleRoot.setAttribute('role','dialog');
  consoleRoot.setAttribute('aria-modal','true');
  consoleRoot.setAttribute('aria-labelledby','sandbox-dev-console-title');
  consoleRoot.innerHTML=`
    <button class="sandbox-dev-console__backdrop" type="button" aria-label="Close Dev Console"></button>
    <div class="sandbox-dev-console__panel">
      <header class="sandbox-dev-console__header">
        <span class="sandbox-dev-console__eyebrow">SANDBOX BUILD</span>
        <button class="sandbox-dev-console__close" type="button" aria-label="Close Dev Console">×</button>
        <h2 id="sandbox-dev-console-title">Dev Console</h2>
        <p>Testing tools that never ship in production.</p>
      </header>
      <div class="sandbox-dev-console__body">
        <label class="sandbox-dev-setting" for="sandbox-unlimited-coins">
          <span><strong>Testing coins</strong><small>Keep the balance at 999,999 while this is on.</small></span>
          <span class="sandbox-switch"><input id="sandbox-unlimited-coins" type="checkbox"><i aria-hidden="true"></i></span>
        </label>
        <div class="sandbox-dev-setting sandbox-dev-setting--action">
          <span><strong>Owned shop items</strong><small>Remove every purchased theme, sticker pack, and Tile Skin.</small></span>
          <button id="sandbox-reset-owned-items" type="button">Reset owned items</button>
        </div>
        <div id="sandbox-dev-console-status" class="sandbox-dev-console__status" role="status" aria-live="polite"></div>
      </div>
    </div>`;
  document.body.appendChild(consoleRoot);

  const coinsToggle=consoleRoot.querySelector('#sandbox-unlimited-coins');
  const resetButton=consoleRoot.querySelector('#sandbox-reset-owned-items');
  const status=consoleRoot.querySelector('#sandbox-dev-console-status');
  const closeButton=consoleRoot.querySelector('.sandbox-dev-console__close');
  const backdrop=consoleRoot.querySelector('.sandbox-dev-console__backdrop');

  const readCoins=()=>Math.max(0,Number.parseInt(localStorage.getItem(SANDBOX_COIN_KEY)||'0',10)||0);
  const readOwned=()=>{try{const value=JSON.parse(localStorage.getItem(OWNED_PRODUCTS_KEY)||'[]');return Array.isArray(value)?[...new Set(value.map(String))]:[]}catch{return[]}};
  const writeOwned=owned=>localStorage.setItem(OWNED_PRODUCTS_KEY,JSON.stringify([...new Set(owned.map(String))]));
  const writeCoins=coins=>{
    const next=Math.max(0,Math.floor(Number(coins)||0));
    localStorage.setItem(SANDBOX_COIN_KEY,String(next));
    window.dispatchEvent(new CustomEvent('teachertiles:coinschange',{detail:{coins:next}}));
  };
  const setStatus=message=>{status.textContent=message};
  const coinsEnabled=()=>localStorage.getItem(SANDBOX_COIN_TOGGLE_KEY)==='true';
  window.TeacherTilesSandbox={get coinsEnabled(){return coinsEnabled()}};

  const syncSandboxAccount=()=>{
    const state=window.TeacherTilesAccount?.state;
    if(!state)return;
    const profileBalance=document.getElementById('profile-coin-balance');
    const shopBalance=document.getElementById('shop-coin-balance');
    if(profileBalance)profileBalance.textContent=Number(state.coinBalance||0).toLocaleString();
    if(shopBalance)shopBalance.textContent=Number(state.coinBalance||0).toLocaleString();
    const sandboxAccess=coinsEnabled();
    const sandboxLabels={
      'shop-toggle':['Open shop','Sign in to open shop'],'theme-shelf-toggle':['Open theme shelf','Sign in to open themes'],
      'sticker-shelf-toggle':['Open sticker shelf','Sign in to open stickers'],'tile-skins-shelf-toggle':['Open Tile Skins shelf','Sign in to open Tile Skins']
    };
    Object.entries(sandboxLabels).forEach(([id,labels])=>{
      const control=document.getElementById(id);
      if(control)control.setAttribute('aria-label',(sandboxAccess||state.signedIn)?labels[0]:labels[1]);
    });
    window.dispatchEvent(new CustomEvent('teachertiles:accountchange',{detail:state}));
    window.dispatchEvent(new CustomEvent('teachertiles:shopownershipchange',{detail:{owned:[...(state.ownedProductIds||[])]}}));
  };

  let accountBridgeInstalled=false;
  const installAccountBridge=()=>{
    const account=window.TeacherTilesAccount;
    if(!account||accountBridgeInstalled)return Boolean(accountBridgeInstalled);
    const stateDescriptor=Object.getOwnPropertyDescriptor(account,'state');
    const realState=stateDescriptor?.get?.bind(account);
    const realOwns=account.owns?.bind(account);
    const realPurchase=account.purchase?.bind(account);
    if(!realState||!realOwns||!realPurchase)return false;
    Object.defineProperty(account,'state',{configurable:true,get(){
      const state=realState();
      if(!coinsEnabled())return state;
      return{...state,ready:true,loading:false,signedIn:true,coinBalance:SANDBOX_COIN_BALANCE,ownedProductIds:readOwned()};
    }});
    account.owns=productId=>coinsEnabled()?readOwned().includes(String(productId||'')):realOwns(productId);
    account.purchase=async productId=>{
      if(!coinsEnabled())return realPurchase(productId);
      const id=String(productId||'');
      const owned=readOwned();
      const alreadyOwned=owned.includes(id);
      if(id&&!alreadyOwned){owned.push(id);writeOwned(owned)}
      syncSandboxAccount();
      return{alreadyOwned,coinBalance:SANDBOX_COIN_BALANCE,ownedProductIds:readOwned()};
    };
    accountBridgeInstalled=true;
    syncSandboxAccount();
    return true;
  };
  if(!installAccountBridge()){
    let attempts=0;
    const bridgeTimer=setInterval(()=>{attempts++;if(installAccountBridge()||attempts>=80)clearInterval(bridgeTimer)},100);
  }

  const setTestingCoins=enabled=>{
    if(enabled){
      if(!coinsEnabled())localStorage.setItem(SANDBOX_PREVIOUS_COINS_KEY,String(readCoins()));
      localStorage.setItem(SANDBOX_COIN_TOGGLE_KEY,'true');
      writeCoins(SANDBOX_COIN_BALANCE);
      setStatus('Testing coins enabled. Balance is 999,999.');
    }else{
      const previous=Math.max(0,Number.parseInt(localStorage.getItem(SANDBOX_PREVIOUS_COINS_KEY)||'0',10)||0);
      localStorage.removeItem(SANDBOX_COIN_TOGGLE_KEY);
      localStorage.removeItem(SANDBOX_PREVIOUS_COINS_KEY);
      writeCoins(previous);
      setStatus(`Testing coins disabled. Restored ${previous.toLocaleString()} coins.`);
    }
    coinsToggle.checked=enabled;
    installAccountBridge();
    syncSandboxAccount();
  };

  const openConsole=()=>{
    consoleRoot.hidden=false;
    devButton.setAttribute('aria-expanded','true');
    requestAnimationFrame(()=>consoleRoot.classList.add('is-open'));
    closeButton.focus();
  };
  const closeConsole=()=>{
    consoleRoot.classList.remove('is-open');
    devButton.setAttribute('aria-expanded','false');
    window.setTimeout(()=>{consoleRoot.hidden=true},180);
    devButton.focus();
  };

  devButton.addEventListener('click',()=>consoleRoot.hidden?openConsole():closeConsole());
  closeButton.addEventListener('click',closeConsole);
  backdrop.addEventListener('click',closeConsole);
  coinsToggle.addEventListener('change',()=>setTestingCoins(coinsToggle.checked));
  window.addEventListener('teachertiles:shopownershipchange',()=>{
    if(coinsEnabled())writeCoins(SANDBOX_COIN_BALANCE);
  });
  resetButton.addEventListener('click',()=>{
    localStorage.removeItem(OWNED_PRODUCTS_KEY);
    localStorage.removeItem(DEFAULT_TILE_SKINS_KEY);
    window.dispatchEvent(new CustomEvent('teachertiles:shopownershipchange',{detail:{owned:[]}}));
    window.dispatchEvent(new CustomEvent('teachertiles:tileskinchange',{detail:{defaults:{}}}));
    syncSandboxAccount();
    setStatus('All owned shop items have been reset.');
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!consoleRoot.hidden){event.preventDefault();closeConsole()}
  });

  if(boardButton){
    const syncVisibility=()=>{
      devButton.classList.toggle('is-revealed',boardButton.classList.contains('is-revealed'));
      devButton.classList.toggle('is-near',boardButton.classList.contains('is-near'));
    };
    new MutationObserver(syncVisibility).observe(boardButton,{attributes:true,attributeFilter:['class']});
    syncVisibility();
  }

  coinsToggle.checked=coinsEnabled();
  if(coinsToggle.checked)writeCoins(SANDBOX_COIN_BALANCE);
}
