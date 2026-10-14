function normalizeAppPreferences(value={}){
  const source=value&&typeof value==='object'?value:{};
  const prefClamp=(number,min,max)=>Math.max(min,Math.min(max,number));
  const rawMasterVolume=Number(source.masterVolume);
  const rawVolume=Number(source.uiVolume);
  const rawScroll=Number(source.scrollSpeed);
  return{
    siteFont:['inter','system','arial','verdana','georgia'].includes(source.siteFont)?source.siteFont:'inter',
    siteFontSize:prefClamp(Number(source.siteFontSize)||100,100,150),
    squareCorners:Boolean(source.squareCorners),
    disableTileSnapping:Boolean(source.disableTileSnapping),
    uiMuted:Boolean(source.uiMuted),
    masterVolume:prefClamp(Number.isFinite(rawMasterVolume)?rawMasterVolume:100,0,100),
    uiVolume:prefClamp(Number.isFinite(rawVolume)?rawVolume:100,0,100),
    scrollSpeed:prefClamp(Number.isFinite(rawScroll)?rawScroll:100,50,175),
    defaultViewSize:[75,100,125,150].includes(Number(source.defaultViewSize))?Number(source.defaultViewSize):100,
    language:APP_LANGUAGE_CODES.has(source.language)?source.language:'en',
    alwaysShowTileDeleteButtons:Boolean(source.alwaysShowTileDeleteButtons)
  };
}

function readStoredAppPreferences(){
  try{
    const saved=JSON.parse(localStorage.getItem(APP_PREFERENCES_KEY)||'null');
    if(saved&&typeof saved==='object')return normalizeAppPreferences({...DEFAULT_APP_PREFERENCES,...saved});
  }catch{}
  return normalizeAppPreferences({...DEFAULT_APP_PREFERENCES,uiMuted:localStorage.getItem(UI_SFX_KEY)==='true'});
}

function applyTileDeleteVisibilityPreference(){
  document.body?.classList.remove('tile-delete-always-visible');
  document.body?.classList.toggle('tile-options-always-visible',Boolean(appPreferences.alwaysShowTileDeleteButtons));
  requestAnimationFrame(()=>document.querySelectorAll('.workspace .module').forEach(module=>layoutTileOptionControls(module)));
}

function persistAppPreferences(){
  try{localStorage.setItem(APP_PREFERENCES_KEY,JSON.stringify(appPreferences))}catch{}
  try{localStorage.setItem(UI_SFX_KEY,String(appPreferences.uiMuted))}catch{}
}

function boardPreferenceSnapshot(){
  return{
    disableTileSnapping:Boolean(appPreferences.disableTileSnapping),
    uiMuted:Boolean(appPreferences.uiMuted),
    masterVolume:Number.isFinite(Number(appPreferences.masterVolume))?Number(appPreferences.masterVolume):100,
    uiVolume:Number.isFinite(Number(appPreferences.uiVolume))?Number(appPreferences.uiVolume):100,
    scrollSpeed:Number(appPreferences.scrollSpeed)||100,
    defaultViewSize:Number(appPreferences.defaultViewSize)||100,
    language:APP_LANGUAGE_CODES.has(appPreferences.language)?appPreferences.language:'en',
    alwaysShowTileDeleteButtons:Boolean(appPreferences.alwaysShowTileDeleteButtons)
  };
}

function normalizeTileAudioState(value){
  const source=value&&typeof value==='object'?value:{};
  return{
    enabled:source.enabled===undefined?true:Boolean(source.enabled),
    volume:clamp(Number.isFinite(Number(source.volume))?Number(source.volume):100,0,150)
  };
}

function tileAudioState(owner){
  if(!owner)return DEFAULT_TILE_AUDIO_STATE;
  if(!owner._tileAudioState)owner._tileAudioState=normalizeTileAudioState(null);
  return owner._tileAudioState;
}

function masterAudioLevel(){
  return clamp((Number(appPreferences.masterVolume)||0)/100,0,1);
}

function globalUiAudioLevel(){
  if(appPreferences.uiMuted)return 0;
  return masterAudioLevel()*clamp((Number(appPreferences.uiVolume)||0)/100,0,1);
}

function tileAudioLevel(owner){
  const masterLevel=masterAudioLevel();
  if(!owner)return masterLevel;
  const state=tileAudioState(owner);
  return state.enabled?masterLevel*clamp(Number(state.volume)/100,0,1.5):0;
}

function setTileAudioState(owner,value,{notify=true}={}){
  if(!owner)return normalizeTileAudioState(value);
  const next=normalizeTileAudioState({...tileAudioState(owner),...(value||{})});
  owner._tileAudioState=next;
  owner.dispatchEvent(new CustomEvent('teachertiles:tileaudiochange',{detail:{...next,level:tileAudioLevel(owner)}}));
  if((!next.enabled||next.volume<=0)&&owner._activeTileSounds){
    for(const sound of owner._activeTileSounds){try{sound.pause()}catch{}}
  }
  if(notify)notifyBoardChanged('tile-audio');
  return next;
}

function setBoostedMediaVolume(audio,volume){
  const value=Math.max(0,Number(volume)||0);let nodes=boostedMedia.get(audio);
  if(value>1&&!nodes){try{boostAudioContext||=new (window.AudioContext||window.webkitAudioContext)();const source=boostAudioContext.createMediaElementSource(audio),gain=boostAudioContext.createGain();source.connect(gain);gain.connect(boostAudioContext.destination);nodes={source,gain};boostedMedia.set(audio,nodes)}catch{}}
  audio.volume=Math.min(1,value);if(nodes){nodes.gain.gain.value=Math.max(1,value);if(boostAudioContext.state==='suspended')boostAudioContext.resume().catch(()=>{})}
}

function releaseBoostedMedia(audio){const nodes=boostedMedia.get(audio);if(nodes){nodes.source.disconnect();nodes.gain.disconnect();boostedMedia.delete(audio)}}

function playUiSfx(kind='click',volumeScale=1,owner=null){
  if(owner&&!owner.isConnected)return;
  const effectiveLevel=kind==='click'?globalUiAudioLevel():tileAudioLevel(owner);
  if(effectiveLevel<=0)return;
  try{
    const prototype=kind==='confetti'?confettiSfxPrototype:kind==='timer-tada'?timerTadaSfxPrototype:kind==='money'?moneySfxPrototype:kind==='hole-punch'?holePunchSfxPrototype:kind==='sticker-place'?stickerPlaceSfxPrototype:uiSfxPrototype;
    const sound=prototype.cloneNode();
    const base=kind==='intro'?.62:kind==='confetti'?.72:kind==='timer-tada'?.16:kind==='money'?.5:kind==='hole-punch'?.12:kind==='sticker-place'?.28:kind==='collection'?.18:.11;
    setBoostedMediaVolume(sound,base*effectiveLevel*Math.max(0,Number(volumeScale)||0));
    sound.playbackRate=kind==='intro'||kind==='confetti'||kind==='timer-tada'||kind==='money'||kind==='hole-punch'||kind==='sticker-place'?1:kind==='collection'?.92:1.35;
    sound.currentTime=0;
    if(owner){
      const sounds=owner._activeTileSounds||(owner._activeTileSounds=new Set());sounds.add(sound);
      const release=()=>{releaseBoostedMedia(sound);sounds.delete(sound)};sound.addEventListener('ended',release,{once:true});sound.addEventListener('error',release,{once:true});
      sound.play().catch(release);
    }else sound.play().catch(()=>{});
  }catch{}
}

function startClassMeterFillSfx(owner=null){
  const effectiveLevel=tileAudioLevel(owner);
  if(effectiveLevel<=0)return()=>{};
  try{
    const sound=classMeterFillSfxPrototype.cloneNode();
    const targetVolume=clamp(.34*effectiveLevel,0,1);
    const fadeDuration=180;
    let fadeFrame=0;
    let stopped=false;
    sound.volume=0;
    sound.currentTime=0;
    sound.loop=false;
    if(owner){
      const sounds=owner._activeTileSounds||(owner._activeTileSounds=new Set());
      sounds.add(sound);
      const release=()=>{releaseBoostedMedia(sound);sounds.delete(sound)};
      sound.addEventListener('ended',release,{once:true});
      sound.addEventListener('error',release,{once:true});
    }

    const fade=(from,to,duration,onDone)=>{
      if(fadeFrame)cancelAnimationFrame(fadeFrame);
      const startedAt=performance.now();
      const tick=now=>{
        const progress=clamp((now-startedAt)/duration,0,1);
        const eased=progress*progress*(3-2*progress);
        sound.volume=clamp(from+(to-from)*eased,0,1);
        if(progress<1)fadeFrame=requestAnimationFrame(tick);
        else{fadeFrame=0;onDone?.()}
      };
      fadeFrame=requestAnimationFrame(tick);
    };

    sound.play().then(()=>{
      if(stopped){sound.pause();sound.currentTime=0;return}
      fade(0,targetVolume,fadeDuration);
    }).catch(()=>{});
    return()=>{
      if(stopped)return;
      stopped=true;
      fade(sound.volume,0,240,()=>{sound.pause();sound.currentTime=0});
    };
  }catch{
    return()=>{};
  }
}

function readCachedInterfaceTranslations(language){
  try{
    const value=JSON.parse(localStorage.getItem(`tt-interface-${INTERFACE_TRANSLATION_CACHE_VERSION}-${language}`)||'null');
    return value&&typeof value==='object'&&!Array.isArray(value)?value:null;
  }catch{return null}
}

function writeCachedInterfaceTranslations(language,value){
  try{localStorage.setItem(`tt-interface-${INTERFACE_TRANSLATION_CACHE_VERSION}-${language}`,JSON.stringify(value))}catch{}
}

async function translateInterfaceChunk(language,phrases){
  const marker='\uE000';
  const request=async values=>{
    const source=values.join(`\n${marker}\n`);
    const url=`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(language)}&dt=t&q=${encodeURIComponent(source)}`;
    const response=await fetch(url);
    if(!response.ok)throw new Error(`interface-translation-${response.status}`);
    const data=await response.json();
    const result=Array.isArray(data?.[0])?data[0].map(segment=>Array.isArray(segment)?String(segment[0]||''):'').join(''):'';
    return result.split(marker).map(value=>value.trim());
  };
  const translated=await request(phrases);
  if(translated.length===phrases.length)return translated;
  return Promise.all(phrases.map(async phrase=>(await request([phrase]))[0]||phrase));
}

async function loadInterfaceTranslations(language){
  if(language==='en'||language==='es')return;
  if(runtimeInterfaceTranslations[language])return;
  if(interfaceTranslationRequests.has(language))return interfaceTranslationRequests.get(language);
  const request=(async()=>{
    const cached=readCachedInterfaceTranslations(language);
    if(cached){runtimeInterfaceTranslations[language]=cached;return}
    const sources=[...new Set([
      ...Object.values(APP_TRANSLATIONS.en),
      ...Object.values(CONTEXT_MODULE_TRANSLATIONS.en).flat()
    ])];
    const chunks=[];
    for(let index=0;index<sources.length;){
      const chunk=[];
      let length=0;
      while(index<sources.length&&chunk.length<12&&length+sources[index].length<2400){
        chunk.push(sources[index]);
        length+=sources[index].length+3;
        index++;
      }
      chunks.push(chunk);
    }
    const translatedBySource={};
    for(let index=0;index<chunks.length;index+=4){
      const group=chunks.slice(index,index+4);
      const results=await Promise.all(group.map(chunk=>translateInterfaceChunk(language,chunk)));
      group.forEach((chunk,chunkIndex)=>chunk.forEach((source,itemIndex)=>translatedBySource[source]=results[chunkIndex][itemIndex]||source));
    }
    translatedBySource.TEACHERTILES='TEACHERTILES';
    translatedBySource['TEACHERTILES ACCOUNT']='TEACHERTILES ACCOUNT';
    runtimeInterfaceTranslations[language]=translatedBySource;
    writeCachedInterfaceTranslations(language,translatedBySource);
  })().finally(()=>interfaceTranslationRequests.delete(language));
  interfaceTranslationRequests.set(language,request);
  return request;
}

function translateAppText(key){
  const lang=APP_LANGUAGE_CODES.has(appPreferences.language)?appPreferences.language:'en';
  const english=APP_TRANSLATIONS.en[key];
  return APP_TRANSLATIONS[lang]?.[key]||runtimeInterfaceTranslations[lang]?.[english]||english||key;
}

function applyAppLanguage({load=true}={}){
  const lang=APP_LANGUAGE_CODES.has(appPreferences.language)?appPreferences.language:'en';
  document.documentElement.lang=lang;
  document.querySelectorAll('[data-i18n]').forEach(node=>{
    const key=node.getAttribute('data-i18n');
    const value=translateAppText(key);
    if(value)node.textContent=value;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(node=>{
    const key=node.getAttribute('data-i18n-placeholder');
    const value=translateAppText(key);
    if(value)node.setAttribute('placeholder',value);
  });
  document.querySelectorAll('.context-menu__item[data-module]').forEach(item=>{
    const englishCopy=CONTEXT_MODULE_TRANSLATIONS.en[item.dataset.module];
    const copy=CONTEXT_MODULE_TRANSLATIONS[lang]?.[item.dataset.module]||(englishCopy?englishCopy.map(value=>runtimeInterfaceTranslations[lang]?.[value]||value):null);
    if(!copy)return;
    const strong=item.querySelector('strong');
    const small=item.querySelector('small');
    if(strong)strong.textContent=copy[0];
    if(small)small.textContent=copy[1];
  });
  settingsToggle?.setAttribute('aria-label',translateAppText('top.settings'));
  const shelfTitle=document.getElementById('asset-shelf-title');
  if(shelfTitle){
    const stickerPanel=document.getElementById('sticker-shelf-content');
    shelfTitle.textContent=stickerPanel&&!stickerPanel.hidden?translateAppText('top.stickers'):translateAppText('top.themes');
  }
  const settingsTitle=document.getElementById('settings-title');
  const activeSettingsTab=document.querySelector('[data-settings-tab].is-active [data-i18n]');
  if(settingsTitle&&activeSettingsTab)settingsTitle.textContent=activeSettingsTab.textContent.trim();
  window.dispatchEvent(new CustomEvent('teachertiles:languagechange',{detail:{language:lang}}));
  if(load&&lang!=='en'&&lang!=='es'&&!runtimeInterfaceTranslations[lang]){
    document.documentElement.dataset.interfaceLanguageLoading='true';
    loadInterfaceTranslations(lang).then(()=>{
      if(appPreferences.language===lang)applyAppLanguage({load:false});
    }).catch(()=>{}).finally(()=>{
      if(appPreferences.language===lang)delete document.documentElement.dataset.interfaceLanguageLoading;
    });
  }else delete document.documentElement.dataset.interfaceLanguageLoading;
}

function updateSettingsControls(){
  document.getElementById('settings-disable-snapping')?.setAttribute('aria-checked',String(appPreferences.disableTileSnapping));
  const font=document.getElementById('settings-site-font'),fontSize=document.getElementById('settings-site-font-size'),corners=document.getElementById('settings-square-corners');
  if(font)font.value=appPreferences.siteFont||'inter';
  if(fontSize)fontSize.value=String(appPreferences.siteFontSize||100);
  if(corners)corners.setAttribute('aria-checked',String(!!appPreferences.squareCorners));
  window.TeacherTilesSiteAppearance?.apply(appPreferences);
  const mute=document.getElementById('settings-ui-sfx-toggle');
  const masterVolume=document.getElementById('settings-master-volume');
  const masterVolumeOut=document.getElementById('settings-master-volume-value');
  const volume=document.getElementById('settings-ui-volume');
  const volumeOut=document.getElementById('settings-ui-volume-value');
  const scroll=document.getElementById('settings-scroll-speed');
  const scrollOut=document.getElementById('settings-scroll-speed-value');
  const view=document.getElementById('settings-default-view');
  const language=document.getElementById('settings-language');
  const deleteButtons=document.getElementById('settings-tile-delete-toggle');
  if(mute){
    mute.setAttribute('aria-checked',String(Boolean(appPreferences.uiMuted)));
    mute.setAttribute('aria-label',appPreferences.uiMuted?'Turn UI sounds on':'Mute UI Sounds');
  }
  if(masterVolume)masterVolume.value=String(appPreferences.masterVolume);
  if(masterVolumeOut)masterVolumeOut.textContent=`${Math.round(appPreferences.masterVolume)}%`;
  if(volume)volume.value=String(appPreferences.uiVolume);
  if(volumeOut)volumeOut.textContent=`${Math.round(appPreferences.uiVolume)}%`;
  if(scroll)scroll.value=String(appPreferences.scrollSpeed);
  if(scrollOut)scrollOut.textContent=`${Math.round(appPreferences.scrollSpeed)}%`;
  if(view)view.value=String(appPreferences.defaultViewSize);
  if(language)language.value=appPreferences.language;
  if(deleteButtons){
    deleteButtons.setAttribute('aria-checked',String(Boolean(appPreferences.alwaysShowTileDeleteButtons)));
    deleteButtons.setAttribute('aria-label',appPreferences.alwaysShowTileDeleteButtons?'Only show tile options near their corners':'Always Show Tile Options');
  }
  applyTileDeleteVisibilityPreference();
  const volumeRow=volume?.closest('.settings-row');
  if(volumeRow)volumeRow.classList.toggle('is-disabled',Boolean(appPreferences.uiMuted));
}

function setCurrentBoardViewSize(percent){
  if(typeof boardCamera==='undefined')return;
  const next=clamp(Number(percent)/100,BOARD_MIN_ZOOM,BOARD_MAX_ZOOM);
  const cx=innerWidth/2,cy=innerHeight/2;
  const anchor=screenToBoard(cx,cy);
  boardCamera.scale=next;
  boardCamera.x=cx-anchor.x*next;
  boardCamera.y=cy-anchor.y*next;
  applyBoardCamera();
}

function applyAppPreferences(value,{persist=true,notify=false,applyView=false}={}){
  appPreferences=normalizeAppPreferences({...appPreferences,...value});
  uiSfxMuted=appPreferences.uiMuted;
  if(persist)persistAppPreferences();
  updateSettingsControls();
  applyTileDeleteVisibilityPreference();
  applyAppLanguage();
  window.dispatchEvent(new CustomEvent('teachertiles:audiopreferenceschange',{detail:{masterVolume:appPreferences.masterVolume,uiMuted:appPreferences.uiMuted,uiVolume:appPreferences.uiVolume}}));
  if(applyView)setCurrentBoardViewSize(appPreferences.defaultViewSize);
  if(notify)notifyBoardChanged('preferences');
  return boardPreferenceSnapshot();
}

function setupSettingsHub(){
  const boardSettingsCard=document.getElementById('settings-scroll-speed')?.closest('.settings-card');
  if(boardSettingsCard&&!document.getElementById('settings-tile-delete-toggle')){
    const row=document.createElement('div');
    row.className='settings-row settings-row--switch';
    row.innerHTML='<div><strong data-i18n="settings.deleteButtons.title">Always Show Tile Options</strong><small data-i18n="settings.deleteButtons.copy">Show tabbing, fullscreen, pin, and delete controls whenever you hover over a tile, instead of only near its corners.</small></div><button id="settings-tile-delete-toggle" class="settings-switch" type="button" role="switch" aria-checked="false" aria-label="Show tile options always"><span></span></button>';
    boardSettingsCard.appendChild(row);
  }
  const modal=document.getElementById('settings-modal');
  const closeButtons=[...document.querySelectorAll('[data-settings-close]')];
  const tabs=[...document.querySelectorAll('[data-settings-tab]')];
  const panes=[...document.querySelectorAll('[data-settings-pane]')];
  const title=document.getElementById('settings-title');
  const mute=document.getElementById('settings-ui-sfx-toggle');
  const masterVolume=document.getElementById('settings-master-volume');
  const volume=document.getElementById('settings-ui-volume');
  const scroll=document.getElementById('settings-scroll-speed');
  const view=document.getElementById('settings-default-view');
  const language=document.getElementById('settings-language');
  const deleteButtons=document.getElementById('settings-tile-delete-toggle');
  if(!modal||!settingsToggle)return;
  let lastFocus=null;
  let currentTab='settings';

  const updateTitle=()=>{
    const active=tabs.find(tab=>tab.dataset.settingsTab===currentTab);
    const label=active?.lastElementChild?.textContent?.trim();
    if(title&&label)title.textContent=label;
  };

  const showTab=name=>{
    currentTab=name;
    tabs.forEach(tab=>{
      const active=tab.dataset.settingsTab===name;
      tab.classList.toggle('is-active',active);
      tab.setAttribute('aria-selected',String(active));
    });
    panes.forEach(pane=>{
      const active=pane.dataset.settingsPane===name;
      pane.hidden=!active;
      pane.classList.toggle('is-active',active);
    });
    updateTitle();
    window.dispatchEvent(new CustomEvent('teachertiles:settings-tab',{detail:{name}}));
  };
  const close=()=>{
    if(modal.hidden)return;
    modal.hidden=true;
    modal.setAttribute('aria-hidden','true');
    settingsToggle.setAttribute('aria-expanded','false');
    if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});
    lastFocus=null;
  };
  const open=()=>{
    if(!modal.hidden){close();return}
    document.getElementById('asset-shelf-close')?.click();
    document.getElementById('shop-close')?.click();
    document.querySelector('[data-profile-close]')?.click();
    lastFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    modal.hidden=false;
    modal.setAttribute('aria-hidden','false');
    settingsToggle.setAttribute('aria-expanded','true');
    updateSettingsControls();
    applyAppLanguage();
    updateTitle();
    requestAnimationFrame(()=>modal.querySelector('.settings-panel__close')?.focus({preventScroll:true}));
  };

  document.getElementById('settings-site-font')?.addEventListener('change',event=>applyAppPreferences({siteFont:event.target.value}));
  document.getElementById('settings-site-font-size')?.addEventListener('change',event=>applyAppPreferences({siteFontSize:Number(event.target.value)}));
  document.getElementById('settings-disable-snapping')?.addEventListener('click',()=>applyAppPreferences({disableTileSnapping:!appPreferences.disableTileSnapping},{notify:true}));
  document.getElementById('settings-square-corners')?.addEventListener('click',()=>applyAppPreferences({squareCorners:!appPreferences.squareCorners}));
  settingsToggle.addEventListener('click',open);
  closeButtons.forEach(button=>button.addEventListener('click',close));
  tabs.forEach(tab=>tab.addEventListener('click',()=>showTab(tab.dataset.settingsTab)));
  mute?.addEventListener('click',()=>{
    const wasMuted=appPreferences.uiMuted;
    applyAppPreferences({uiMuted:!wasMuted},{notify:true});
    if(wasMuted)playUiSfx('click');
  });
  masterVolume?.addEventListener('input',()=>{
    appPreferences=normalizeAppPreferences({...appPreferences,masterVolume:Number(masterVolume.value)});
    persistAppPreferences();
    updateSettingsControls();
    window.dispatchEvent(new CustomEvent('teachertiles:audiopreferenceschange',{detail:{masterVolume:appPreferences.masterVolume,uiMuted:appPreferences.uiMuted,uiVolume:appPreferences.uiVolume}}));
  });
  masterVolume?.addEventListener('change',()=>notifyBoardChanged('preferences'));
  volume?.addEventListener('input',()=>{
    appPreferences=normalizeAppPreferences({...appPreferences,uiVolume:Number(volume.value)});
    persistAppPreferences();
    updateSettingsControls();
    window.dispatchEvent(new CustomEvent('teachertiles:audiopreferenceschange',{detail:{masterVolume:appPreferences.masterVolume,uiMuted:appPreferences.uiMuted,uiVolume:appPreferences.uiVolume}}));
  });
  volume?.addEventListener('change',()=>notifyBoardChanged('preferences'));
  scroll?.addEventListener('input',()=>{
    appPreferences=normalizeAppPreferences({...appPreferences,scrollSpeed:Number(scroll.value)});
    persistAppPreferences();
    updateSettingsControls();
  });
  scroll?.addEventListener('change',()=>notifyBoardChanged('preferences'));
  view?.addEventListener('change',()=>applyAppPreferences({defaultViewSize:Number(view.value)},{notify:true,applyView:true}));
  language?.addEventListener('change',()=>{applyAppPreferences({language:language.value},{notify:true});updateTitle();setMenuCategory(activeMenuCategory)});
  deleteButtons?.addEventListener('click',()=>applyAppPreferences({alwaysShowTileDeleteButtons:!appPreferences.alwaysShowTileDeleteButtons},{notify:true}));

  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!modal.hidden){event.preventDefault();close()}
  });
  document.addEventListener('click',event=>{
    if(modal.hidden)return;
    const target=event.target instanceof Element?event.target.closest('#profile-toggle,#theme-shelf-toggle,#sticker-shelf-toggle,#shop-toggle,#boards-toggle'):null;
    if(target)close();
  },true);

  updateSettingsControls();
  applyAppLanguage();
  showTab('settings');
}
