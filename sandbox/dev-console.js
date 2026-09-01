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
  const writeCoins=coins=>{
    const next=Math.max(0,Math.floor(Number(coins)||0));
    localStorage.setItem(SANDBOX_COIN_KEY,String(next));
    window.dispatchEvent(new CustomEvent('teachertiles:coinschange',{detail:{coins:next}}));
  };
  const setStatus=message=>{status.textContent=message};
  const coinsEnabled=()=>localStorage.getItem(SANDBOX_COIN_TOGGLE_KEY)==='true';

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
