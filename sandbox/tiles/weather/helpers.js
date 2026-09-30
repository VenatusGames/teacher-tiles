function weatherCodeInfo(code){return WEATHER_CODES[Number(code)]||['Current conditions','○']}

function airQualityInfo(value){
  const aqi=Math.round(Number(value));
  if(!Number.isFinite(aqi))return{label:'Unavailable',className:'unknown',value:null};
  if(aqi<=50)return{label:'Good',className:'good',value:aqi};
  if(aqi<=100)return{label:'Moderate',className:'moderate',value:aqi};
  if(aqi<=150)return{label:'Sensitive groups',className:'sensitive',value:aqi};
  if(aqi<=200)return{label:'Unhealthy',className:'unhealthy',value:aqi};
  if(aqi<=300)return{label:'Very unhealthy',className:'very-unhealthy',value:aqi};
  return{label:'Hazardous',className:'hazardous',value:aqi};
}

function weatherDayLabel(value,index){
  if(index===0)return'Today';
  const date=new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime())?'Day':date.toLocaleDateString(undefined,{weekday:'short',timeZone:'UTC'});
}

function weatherClockLabel(value){
  const match=String(value||'').match(/T(\d{2}):(\d{2})/);
  if(!match)return'—';
  const hour=Number(match[1]);
  return`${hour%12||12}:${match[2]} ${hour>=12?'PM':'AM'}`;
}

function displayTemperature(celsius,unit){
  const value=unit==='f'?Number(celsius)*9/5+32:Number(celsius);
  return Number.isFinite(value)?`${Math.round(value)}°${unit.toUpperCase()}`:'—';
}

function requestLocalCoordinates(){
  if(localCoordinatesPromise)return localCoordinatesPromise;
  localCoordinatesPromise=new Promise((resolve,reject)=>{
    if(!navigator.geolocation){reject(new Error('unsupported'));return}
    navigator.geolocation.getCurrentPosition(
      position=>resolve({lat:position.coords.latitude,lon:position.coords.longitude}),
      error=>reject(error),
      {enableHighAccuracy:false,timeout:12000,maximumAge:10*60*1000}
    );
  }).catch(error=>{localCoordinatesPromise=null;throw error});
  return localCoordinatesPromise;
}

async function geocodeWeatherPlace(query,signal){
  const response=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`,{signal});
  if(!response.ok)throw new Error('geocoding');
  const result=(await response.json())?.results?.[0];
  if(!result)throw new Error('not-found');
  return{name:[result.name,result.admin1||result.country].filter(Boolean).join(', '),lat:Number(result.latitude),lon:Number(result.longitude),isLocal:false};
}

async function fetchCurrentConditions(location,signal,{extended=true}={}){
  const weatherQuery={
    latitude:String(location.lat),longitude:String(location.lon),
    current:'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,precipitation,is_day',
    timezone:'auto'
  };
  if(extended){
    weatherQuery.daily='weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,uv_index_max,sunrise,sunset';
    weatherQuery.forecast_days='7';
  }
  const params=new URLSearchParams(weatherQuery);
  const airParams=new URLSearchParams({
    latitude:String(location.lat),longitude:String(location.lon),
    current:'us_aqi,pm2_5',timezone:'auto'
  });
  const [response,airResult]=await Promise.all([
    fetch(`https://api.open-meteo.com/v1/forecast?${params}`,{signal}),
    extended?fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${airParams}`,{signal}).then(async airResponse=>airResponse.ok?airResponse.json():null).catch(error=>{if(error?.name==='AbortError')throw error;return null}):Promise.resolve(null)
  ]);
  if(!response.ok)throw new Error('forecast');
  const data=await response.json();
  if(!data?.current)throw new Error('forecast');
  const daily=data.daily||{};
  const days=Array.isArray(daily.time)?daily.time.slice(0,7).map((date,index)=>({
    date,
    label:weatherDayLabel(date,index),
    code:Number(daily.weather_code?.[index]),
    highC:Number(daily.temperature_2m_max?.[index]),
    lowC:Number(daily.temperature_2m_min?.[index]),
    precipitationProbability:Number(daily.precipitation_probability_max?.[index]),
    precipitation:Number(daily.precipitation_sum?.[index]),
    wind:Number(daily.wind_speed_10m_max?.[index]),
    uv:Number(daily.uv_index_max?.[index]),
    sunrise:daily.sunrise?.[index]||'',
    sunset:daily.sunset?.[index]||''
  })):[];
  return{
    tempC:Number(data.current.temperature_2m),
    apparentC:Number(data.current.apparent_temperature),
    humidity:Number(data.current.relative_humidity_2m),
    wind:Number(data.current.wind_speed_10m),
    code:Number(data.current.weather_code),
    precipitation:Number(data.current.precipitation),
    isDay:Boolean(data.current.is_day),
    time:data.current.time||'',
    forecast:days,
    air:{aqi:Number(airResult?.current?.us_aqi),pm25:Number(airResult?.current?.pm2_5)}
  };
}

function makeWeatherLocation(raw={}){
  return{
    id:String(raw.id||`weather-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`),
    name:String(raw.name||'My location').slice(0,80),
    lat:Number(raw.lat),lon:Number(raw.lon),isLocal:Boolean(raw.isLocal),
    loading:false,error:'',current:null
  };
}
