function setupClassroomTileControls(m){
  m.querySelectorAll('.widget-scroll,.widget-editor,.tile-settings-panel,.google-content,textarea').forEach(surface=>{
    surface.addEventListener('wheel',event=>{
      if(!event.ctrlKey&&!event.shiftKey&&(surface.scrollHeight>surface.clientHeight||surface.scrollWidth>surface.clientWidth))event.stopPropagation();
    },{passive:true});
  });
  m.querySelector('.tile-bg')?.addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.tile-font')?.addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.tile-text')?.addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));
  const toggle=m.querySelector('.tile-settings-toggle'),panel=m.querySelector('.tile-settings-panel');
  if(!toggle||!panel)return;
  const setOpen=open=>{panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));m.classList.toggle('has-tile-settings-open',open);if(open)m._positionTileSettings?.();};
  toggle.addEventListener('click',()=>setOpen(panel.hidden));
  const outside=event=>{if(!panel.hidden&&!toggle.parentElement.contains(event.target))setOpen(false);};
  document.addEventListener('pointerdown',outside);
  m.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){setOpen(false);toggle.focus();event.stopPropagation();}});
  const prior=m._cleanup;m._cleanup=()=>{document.removeEventListener('pointerdown',outside);prior?.();};
}

function bindGeneratedTileSettings(m,toggle,panel){
  if(!toggle||!panel||toggle.dataset.tileSettingsBound==='true')return;
  toggle.dataset.tileSettingsBound='true';
  const setOpen=open=>{
    panel.hidden=!open;
    toggle.setAttribute('aria-expanded',String(open));
    m.classList.toggle('has-tile-settings-open',open);
    if(open)m._positionTileSettings?.();
  };
  const onToggle=()=>setOpen(panel.hidden);
  const onOutside=event=>{
    if(!panel.hidden&&!toggle.parentElement.contains(event.target))setOpen(false);
  };
  const onKey=event=>{
    if(event.key==='Escape'&&!panel.hidden){setOpen(false);toggle.focus();event.stopPropagation();}
  };
  toggle.addEventListener('click',onToggle);
  document.addEventListener('pointerdown',onOutside);
  m.addEventListener('keydown',onKey);
  const prior=m._cleanup;
  m._cleanup=()=>{
    document.removeEventListener('pointerdown',onOutside);
    toggle.removeEventListener('click',onToggle);
    m.removeEventListener('keydown',onKey);
    prior?.();
  };
}

function createStandardTileSettingsPanel(m,type){
  const title=TILE_AUDIO_TITLES[type]||'Tile';
  const host=m.querySelector(TILE_AUDIO_HOSTS[type]||'.customization-bar');
  if(!host)return null;
  const wrap=document.createElement('div');
  wrap.className='tile-settings-wrap tile-audio-settings-wrap';
  wrap.innerHTML=`<button class="custom-icon tile-settings-toggle" type="button" aria-expanded="false" aria-label="Open ${title} settings" title="${title} settings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="m9 3 6 0 .6 3 2 .9 2.6-1 3 5.2-2.3 2 .1 2.1 2.2 2-3 5.2-2.8-.9-1.8 1-.6 3H9l-.6-3-1.8-1-2.8.9-3-5.2 2.2-2 .1-2.1-2.3-2 3-5.2 2.6 1 2-.9Z" transform="translate(2 0) scale(.83)"/><circle cx="12" cy="12" r="3.2"/></svg></button><div class="tile-settings-panel" hidden><strong>${title} settings</strong></div>`;
  host.appendChild(wrap);
  const toggle=wrap.querySelector('.tile-settings-toggle');
  const panel=wrap.querySelector('.tile-settings-panel');
  bindGeneratedTileSettings(m,toggle,panel);
  return panel;
}

function setupTileAudioSettings(m,type){
  if(!TILE_AUDIO_SETTING_TYPES.has(type))return;

  let panel=null;
  if(type==='classmeter')panel=m.querySelector('.classmeter-settings');
  else if(type==='collections')panel=m.querySelector('.collection-settings');
  else panel=m.querySelector('.tile-settings-panel');
  if(!panel)panel=createStandardTileSettingsPanel(m,type);
  if(!panel||panel.querySelector('.tile-audio-settings-section'))return;

  const section=document.createElement('div');
  section.className='tile-audio-settings-section';
  section.innerHTML='<strong>Audio</strong><div class="tile-audio-toggle-row"><span>Sound effects</span><button class="tile-audio-toggle" type="button" role="switch" aria-checked="true" aria-label="Turn tile audio off"><i aria-hidden="true"></i></button></div><label class="tile-audio-volume-row"><span>Volume <output>100%</output></span><input class="tile-audio-volume" type="range" min="0" max="150" step="5" value="100" aria-label="Tile audio volume"></label><small>Master Volume still controls the overall output.</small>';
  panel.appendChild(section);

  const toggle=section.querySelector('.tile-audio-toggle');
  const volume=section.querySelector('.tile-audio-volume');
  const output=section.querySelector('output');

  const refresh=()=>{
    const state=tileAudioState(m);
    toggle.setAttribute('aria-checked',String(state.enabled));
    toggle.setAttribute('aria-label',state.enabled?'Turn tile audio off':'Turn tile audio on');
    volume.value=String(Math.round(state.volume));
    volume.disabled=!state.enabled;
    output.textContent=`${Math.round(state.volume)}%`;
    section.classList.toggle('is-disabled',!state.enabled);
  };

  toggle.addEventListener('click',()=>{
    const state=tileAudioState(m);
    setTileAudioState(m,{enabled:!state.enabled},{notify:true});
    refresh();
  });
  volume.addEventListener('input',()=>{
    output.textContent=`${Math.round(Number(volume.value)||0)}%`;
    setTileAudioState(m,{volume:Number(volume.value)||0},{notify:false});
  });
  volume.addEventListener('change',()=>{
    setTileAudioState(m,{volume:Number(volume.value)||0},{notify:true});
    refresh();
  });
  const onAudioChange=()=>refresh();
  m.addEventListener('teachertiles:tileaudiochange',onAudioChange);

  const priorGet=m._boardGetState;
  const priorSet=m._boardSetState;
  m._boardGetState=()=>{
    const base=priorGet?.();
    const audio={...tileAudioState(m)};
    if(base&&typeof base==='object'&&!Array.isArray(base))return{...base,tileAudio:audio};
    return{tileAudio:audio};
  };
  m._boardSetState=state=>{
    priorSet?.(state);
    let saved=state?.tileAudio;
    if(!saved&&type==='quietcritters'&&state?.soundDisabled!==undefined)saved={enabled:!Boolean(state.soundDisabled),volume:100};
    setTileAudioState(m,saved||DEFAULT_TILE_AUDIO_STATE,{notify:false});
    refresh();
  };

  const priorCleanup=m._cleanup;
  m._cleanup=()=>{
    m.removeEventListener('teachertiles:tileaudiochange',onAudioChange);
    priorCleanup?.();
  };

  setTileAudioState(m,tileAudioState(m),{notify:false});
  refresh();
}
