function setupWeather(m){
  const tileTitle=bindEditableModuleTitle(m,'.weather-title','Weather');
  const segments=m.querySelector('.weather-segments');
  const form=m.querySelector('.weather-place-form');
  const input=m.querySelector('.weather-place-input');
  const useLocation=m.querySelector('.weather-use-location');
  const message=m.querySelector('.weather-message');
  const controller=new AbortController();
  let unit='f';
  let locations=[];
  let restored=false;
  let disposed=false;
  let autoFitComplete=Boolean(m._isBoardRestore);

  const fitNewWeatherTile=()=>{
    if(autoFitComplete||disposed)return;
    requestAnimationFrame(()=>{
      if(autoFitComplete||disposed||!locations.some(location=>location.current))return;
      const cards=[...segments.querySelectorAll('.weather-card')];
      if(!cards.length)return;
      const fullCardHeight=Math.max(...cards.map(card=>card.scrollHeight));
      const fixedHeight=Math.max(0,m.offsetHeight-segments.clientHeight);
      const neededHeight=Math.ceil(fixedHeight+fullCardHeight+4);
      if(neededHeight>m.offsetHeight){
        m.style.height=`${Math.min(neededHeight,BOARD_HEIGHT-m.offsetTop)}px`;
        notifyBoardChanged('weather-auto-fit');
      }
      autoFitComplete=true;
    });
  };

  const setMessage=value=>message.textContent=value;
  const render=()=>{
    segments.replaceChildren();
    segments.dataset.count=String(locations.length);
    for(const location of locations){
      const card=document.createElement('article');
      card.className='weather-card';
      if(location.loading)card.classList.add('is-loading');
      const head=document.createElement('header');
      const icon=document.createElement('span');
      const place=document.createElement('strong');
      place.textContent=location.name;
      const info=weatherCodeInfo(location.current?.code);
      icon.textContent=location.loading?'…':location.error?'!':info[1];
      head.append(icon,place);
      if(locations.length>1||!location.isLocal){
        const remove=document.createElement('button');
        remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',`Remove ${location.name}`);
        remove.addEventListener('click',()=>{locations=locations.filter(item=>item!==location);render();notifyBoardChanged('weather-remove')});
        head.appendChild(remove);
      }
      const temp=document.createElement('div');
      temp.className='weather-card-temperature';
      temp.textContent=location.loading?'—':displayTemperature(location.current?.tempC,unit);
      const condition=document.createElement('p');
      condition.textContent=location.loading?'Loading current conditions…':location.error||info[0];
      const metrics=document.createElement('div');
      metrics.className='weather-card-metrics';
      if(location.current){
        const today=location.current.forecast?.[0]||{};
        const aqi=airQualityInfo(location.current.air?.aqi);
        const addMetric=(label,text,className='')=>{
          const item=document.createElement('span');
          if(className)item.className=className;
          const key=document.createElement('b');key.textContent=label;
          const val=document.createElement('em');val.textContent=text;
          item.append(key,val);metrics.appendChild(item);
          return item;
        };
        addMetric('Feels',displayTemperature(location.current.apparentC,unit));
        addMetric('Humidity',`${Math.round(location.current.humidity)}%`);
        addMetric('Precipitation',`${Math.round(today.precipitationProbability||0)}% · ${Number(today.precipitation||0).toFixed(1)} mm`);
        addMetric('Wind',`${Math.round(location.current.wind)} km/h`);
        addMetric('UV',Number.isFinite(today.uv)?today.uv.toFixed(1):'—');
        const airItem=addMetric('Air quality',aqi.value===null?'Unavailable':`${aqi.label} · AQI ${aqi.value}`,`weather-aqi weather-aqi--${aqi.className}`);
        if(Number.isFinite(location.current.air?.pm25))airItem.title=`PM2.5: ${location.current.air.pm25.toFixed(1)} µg/m³`;
        addMetric('Sunrise',weatherClockLabel(today.sunrise));
        addMetric('Sunset',weatherClockLabel(today.sunset));
      }
      const weekly=document.createElement('div');
      weekly.className='weather-weekly';
      for(const [index,day] of (location.current?.forecast||[]).entries()){
        const forecast=document.createElement('article');
        forecast.className='weather-forecast-day';
        const dayName=document.createElement('strong');dayName.textContent=day.label||weatherDayLabel(day.date,index);
        const dayIcon=document.createElement('span');dayIcon.textContent=weatherCodeInfo(day.code)[1];dayIcon.setAttribute('aria-label',weatherCodeInfo(day.code)[0]);
        const high=document.createElement('b');high.textContent=displayTemperature(day.highC,unit).replace(/[FC]$/,'');
        const low=document.createElement('small');low.textContent=displayTemperature(day.lowC,unit).replace(/[FC]$/,'');
        const rain=document.createElement('em');rain.textContent=`${Math.round(day.precipitationProbability||0)}%`;
        rain.title=`${Number(day.precipitation||0).toFixed(1)} mm precipitation`;
        forecast.append(dayName,dayIcon,high,low,rain);
        weekly.appendChild(forecast);
      }
      card.append(head,temp,condition,metrics,weekly);
      segments.appendChild(card);
    }
    if(!locations.length){
      const empty=document.createElement('div');empty.className='weather-empty';empty.textContent='Add a place or use your location.';segments.appendChild(empty);
    }
    m.querySelectorAll('[data-weather-unit]').forEach(button=>button.classList.toggle('is-active',button.dataset.weatherUnit===unit));
    fitNewWeatherTile();
  };
  const refresh=async location=>{
    if(!Number.isFinite(location.lat)||!Number.isFinite(location.lon))return;
    location.loading=true;location.error='';render();
    try{location.current=await fetchCurrentConditions(location,controller.signal);setMessage(`Updated ${location.name}.`)}
    catch(error){if(error?.name==='AbortError')return;location.error='Weather is unavailable right now.';setMessage('Current weather could not be loaded.')}
    finally{location.loading=false;if(!disposed)render()}
  };
  const loadLocal=async({replace=true}={})=>{
    useLocation.disabled=true;setMessage('Finding your local weather…');
    let location=locations.find(item=>item.isLocal);
    if(!location){location=makeWeatherLocation({name:'My location',isLocal:true});if(replace)locations.unshift(location);else locations.push(location)}
    location.loading=true;location.error='';render();
    try{
      const coords=await requestLocalCoordinates();
      location.lat=coords.lat;location.lon=coords.lon;location.loading=false;
      await refresh(location);
      notifyBoardChanged('weather-local');
    }catch(error){
      location.loading=false;location.error=error?.code===1?'Location permission is needed.':'Your location could not be found.';
      render();setMessage('Use the city box if you prefer not to share location.');
    }finally{useLocation.disabled=false}
  };
  const addPlace=async query=>{
    if(locations.length>=4){setMessage('This tile can compare up to 4 places.');return}
    setMessage('Finding that place…');
    try{
      const result=await geocodeWeatherPlace(query,controller.signal);
      if(locations.some(item=>Math.abs(item.lat-result.lat)<.001&&Math.abs(item.lon-result.lon)<.001)){setMessage('That place is already on this tile.');return}
      const location=makeWeatherLocation(result);locations.push(location);input.value='';render();await refresh(location);notifyBoardChanged('weather-place');
    }catch(error){if(error?.name!=='AbortError')setMessage(error?.message==='not-found'?'No matching place was found.':'That place could not be loaded.')}
  };

  form.addEventListener('submit',event=>{event.preventDefault();const query=input.value.trim();if(query)addPlace(query)});
  useLocation.addEventListener('click',()=>loadLocal());
  m.querySelectorAll('[data-weather-unit]').forEach(button=>button.addEventListener('click',()=>{unit=button.dataset.weatherUnit;render();notifyBoardChanged('weather-unit')}));
  segments.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
  m.querySelector('.weather-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.weather-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.weather-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));
  render();
  m._boardGetState=()=>({title:tileTitle.get(),unit,locations:locations.map(location=>location.isLocal?{name:location.name,isLocal:true}:{name:location.name,lat:location.lat,lon:location.lon,isLocal:false})});
  m._boardSetState=saved=>{
    restored=true;tileTitle.set(saved?.title);unit=saved?.unit==='c'?'c':'f';
    const savedLocations=Array.isArray(saved?.locations)?saved.locations.slice(0,4):[];
    locations=savedLocations.map(makeWeatherLocation);render();
    locations.forEach(location=>location.isLocal?loadLocal():refresh(location));
    if(!locations.length)loadLocal();
  };
  queueMicrotask(()=>{if(!restored)loadLocal()});
  const prior=m._cleanup;
  m._cleanup=()=>{prior?.();disposed=true;controller.abort()};
}
