function setupTemperature(m){
  const tileTitle=bindEditableModuleTitle(m,'.temperature-title','Temperature');
  const value=m.querySelector('.temperature-value');
  const verticalValue=m.querySelector('.temperature-vertical-value');
  const horizontalValue=m.querySelector('.temperature-horizontal-value');
  const condition=m.querySelector('.temperature-condition');
  const verticalCondition=m.querySelector('.temperature-vertical-condition');
  const horizontalCondition=m.querySelector('.temperature-horizontal-condition');
  const icon=m.querySelector('.temperature-weather-icon');
  const form=m.querySelector('.temperature-place-form');
  const input=m.querySelector('.temperature-place-input');
  const useLocation=m.querySelector('.temperature-use-location');
  const message=m.querySelector('.temperature-message');
  const controller=new AbortController();
  let unit='f';
  let mode='number';
  let location=null;
  let current=null;
  let restored=false;
  let disposed=false;

  const render=()=>{
    m.dataset.temperatureMode=mode;
    const text=displayTemperature(current?.tempC,unit);
    value.textContent=text;verticalValue.textContent=text;horizontalValue.textContent=text;
    const info=weatherCodeInfo(current?.code);
    icon.textContent=current?info[1]:'○';
    const conditionText=current?`${location?.name||'Outside'} · ${info[0]}`:'Finding local temperature…';
    condition.textContent=conditionText;
    verticalCondition.textContent=conditionText;
    horizontalCondition.textContent=conditionText;
    const level=Number.isFinite(current?.tempC)?clamp((current.tempC+20)/70*100,4,96):4;
    m.style.setProperty('--temperature-level',`${level}%`);
    m.querySelectorAll('[data-temperature-unit]').forEach(button=>button.classList.toggle('is-active',button.dataset.temperatureUnit===unit));
    m.querySelectorAll('[data-temperature-mode-choice]').forEach(button=>button.classList.toggle('is-active',button.dataset.temperatureModeChoice===mode));
  };
  const load=async next=>{
    location=makeWeatherLocation(next);current=null;render();message.textContent=`Loading temperature for ${location.name}…`;
    try{current=await fetchCurrentConditions(location,controller.signal,{extended:false});message.textContent=`Current outdoor temperature for ${location.name}.`;notifyBoardChanged('temperature-place')}
    catch(error){if(error?.name!=='AbortError')message.textContent='Current temperature could not be loaded.'}
    finally{if(!disposed)render()}
  };
  const loadLocal=async()=>{
    useLocation.disabled=true;message.textContent='Finding your local temperature…';
    try{const coords=await requestLocalCoordinates();await load({name:'My location',isLocal:true,...coords})}
    catch(error){message.textContent=error?.code===1?'Location permission was not granted. Search for a city instead.':'Your location could not be found.'}
    finally{useLocation.disabled=false}
  };
  form.addEventListener('submit',async event=>{
    event.preventDefault();const query=input.value.trim();if(!query)return;
    message.textContent='Finding that place…';
    try{const result=await geocodeWeatherPlace(query,controller.signal);input.value='';await load(result)}
    catch(error){if(error?.name!=='AbortError')message.textContent=error?.message==='not-found'?'No matching place was found.':'That place could not be loaded.'}
  });
  useLocation.addEventListener('click',loadLocal);
  m.querySelectorAll('[data-temperature-unit]').forEach(button=>button.addEventListener('click',()=>{unit=button.dataset.temperatureUnit;render();notifyBoardChanged('temperature-unit')}));
  m.querySelectorAll('[data-temperature-mode-choice]').forEach(button=>button.addEventListener('click',()=>{mode=['number','vertical','horizontal'].includes(button.dataset.temperatureModeChoice)?button.dataset.temperatureModeChoice:'number';render();notifyBoardChanged('temperature-mode')}));
  m.querySelector('.temperature-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.temperature-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.temperature-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));
  render();
  m._boardGetState=()=>({title:tileTitle.get(),unit,mode,location:location?.isLocal?{name:location.name,isLocal:true}:location?{name:location.name,lat:location.lat,lon:location.lon,isLocal:false}:null});
  m._boardSetState=saved=>{
    restored=true;tileTitle.set(saved?.title);unit=saved?.unit==='c'?'c':'f';mode=['number','vertical','horizontal'].includes(saved?.mode)?saved.mode:'number';render();
    if(saved?.location?.isLocal)loadLocal();else if(saved?.location&&Number.isFinite(Number(saved.location.lat))&&Number.isFinite(Number(saved.location.lon)))load(saved.location);else loadLocal();
  };
  queueMicrotask(()=>{if(!restored)loadLocal()});
  const prior=m._cleanup;
  m._cleanup=()=>{prior?.();disposed=true;controller.abort()};
}
