function setupWeatherWheel(m){
  const wheel=setupChoiceWheel(m,{items:WEATHER_WHEEL_ITEMS});
  m._boardGetState=()=>wheel.getState();
  m._boardSetState=saved=>wheel.setState(saved);
}
