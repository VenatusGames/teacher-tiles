function setupStoplight(m){
  const stage=m.querySelector('.stoplight-stage');
  const img=m.querySelector('.stoplight-image');
  const label=m.querySelector('.stoplight-label');
  const bg=m.querySelector('.stoplight-bg');
  const modeButton=m.querySelector('.stoplight-mode-button');
  const modeCurrent=m.querySelector('.stoplight-mode-button__current');
  const modeMenu=m.querySelector('.stoplight-mode-menu');
  const modeOptions=[...m.querySelectorAll('[data-stoplight-mode-option]')];

  const modes={
    voice:{
      name:'Voice Level',
      summary:'Normal · Whisper · Zero',
      labels:['NORMAL','WHISPER','ZERO']
    },
    choice:{
      name:'Yes / Maybe / No',
      summary:'Yes · Maybe · No',
      labels:['YES','MAYBE','NO']
    },
    classic:{
      name:'Classic',
      summary:'Go · Listen · Stop',
      labels:['GO','LISTEN','STOP']
    }
  };

  const simplistic=m.dataset.tileSkin==='stoplight-simplistic';
  const states=[
    {id:'green',src:simplistic?'assets/stoplight-simplistic-green.svg':'assets/stoplight-green.png',alt:'Green stoplight'},
    {id:'yellow',src:simplistic?'assets/stoplight-simplistic-yellow.svg':'assets/stoplight-yellow.png',alt:'Yellow stoplight'},
    {id:'red',src:simplistic?'assets/stoplight-simplistic-red.svg':'assets/stoplight-red.png',alt:'Red stoplight'}
  ];

  let i=0;
  let mode=m.dataset.stoplightMode||'voice';
  if(!modes[mode])mode='voice';

  const closeModeMenu=()=>{
    modeMenu.hidden=true;
    modeButton.setAttribute('aria-expanded','false');
  };

  const render=(animate=true)=>{
    const state=states[i];
    const config=modes[mode];
    m.dataset.stoplight=state.id;
    m.dataset.stoplightMode=mode;
    label.textContent=config.labels[i];
    img.src=state.src;
    img.alt=state.alt;
    modeCurrent.textContent=config.summary;
    modeOptions.forEach(option=>{
      option.classList.toggle('is-active',option.dataset.stoplightModeOption===mode);
    });
    stage.setAttribute('aria-label',`${config.labels[i]}. Click to change stoplight state.`);
    modeButton.setAttribute('aria-label',`Change stoplight mode. Current mode: ${config.name}, ${config.summary}.`);
    if(animate){
      stage.classList.remove('stoplight-pop');
      void stage.offsetWidth;
      stage.classList.add('stoplight-pop');
      setTimeout(()=>stage.classList.remove('stoplight-pop'),220);
    }
  };

  stage.addEventListener('click',()=>{
    i=(i+1)%states.length;
    render(true);
  });

  modeButton.addEventListener('click',e=>{
    e.stopPropagation();
    const opening=modeMenu.hidden;
    modeMenu.hidden=!opening;
    modeButton.setAttribute('aria-expanded',String(opening));
  });

  modeOptions.forEach(option=>{
    option.addEventListener('click',e=>{
      e.stopPropagation();
      mode=option.dataset.stoplightModeOption;
      closeModeMenu();
      render(true);
    });
  });

  m.addEventListener('pointerdown',e=>{
    if(!e.target.closest('.stoplight-mode-wrap'))closeModeMenu();
  });

  bg.addEventListener('click',e=>{
    e.stopPropagation();
    cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']);
  });

  m._boardGetState=()=>({index:i,mode});
  m._boardSetState=state=>{
    if(!state)return;
    mode=modes[state.mode]?state.mode:'voice';
    i=Math.max(0,Math.min(states.length-1,Math.round(Number(state.index)||0)));
    render(false);
  };

  render(false);
}
