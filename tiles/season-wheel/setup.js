function setupSeasonWheel(m){
  const wheel=setupChoiceWheel(m,{items:SEASON_WHEEL_ITEMS});
  m._boardGetState=()=>wheel.getState();
  m._boardSetState=saved=>wheel.setState(saved);
}
