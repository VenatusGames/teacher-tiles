function resolveVisualScheduleIcon(src){
  const value=String(src||'').trim();
  if(!value)return null;
  const direct=VISUAL_SCHEDULE_ICONS.find(icon=>icon.src===value);
  if(direct)return direct;
  try{
    const wanted=new URL(value,document.baseURI).href;
    return VISUAL_SCHEDULE_ICONS.find(icon=>new URL(icon.src,document.baseURI).href===wanted)||null;
  }catch{return null}
}

function getStoredCalendarEvents(){
  try{
    const parsed=JSON.parse(localStorage.getItem(CALENDAR_STORAGE_KEY)||'[]');
    return Array.isArray(parsed)?parsed:[];
  }catch{
    return [];
  }
}

function saveStoredCalendarEvents(events){
  try{localStorage.setItem(CALENDAR_STORAGE_KEY,JSON.stringify(events))}catch{}
  notifyBoardChanged('calendar');
}

function calendarDateKey(date){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function calendarObservedDate(date){
  const d=new Date(date);
  if(d.getDay()===6)d.setDate(d.getDate()-1);
  if(d.getDay()===0)d.setDate(d.getDate()+1);
  return d;
}

function nthWeekdayOfMonth(year,month,weekday,n){
  const d=new Date(year,month,1);
  const offset=(weekday-d.getDay()+7)%7;
  d.setDate(1+offset+(n-1)*7);
  return d;
}

function lastWeekdayOfMonth(year,month,weekday){
  const d=new Date(year,month+1,0);
  const offset=(d.getDay()-weekday+7)%7;
  d.setDate(d.getDate()-offset);
  return d;
}

function usCalendarHolidays(year){
  const rows=[];
  const add=(date,title)=>rows.push({date:calendarDateKey(date),title,type:'holiday',builtIn:true});

  add(new Date(year,0,1),"New Year's Day");
  add(nthWeekdayOfMonth(year,0,1,3),'Martin Luther King Jr. Day');
  add(nthWeekdayOfMonth(year,1,1,3),"Presidents' Day");
  add(lastWeekdayOfMonth(year,4,1),'Memorial Day');
  add(new Date(year,5,19),'Juneteenth');
  add(new Date(year,6,4),'Independence Day');
  add(nthWeekdayOfMonth(year,8,1,1),'Labor Day');
  add(nthWeekdayOfMonth(year,9,1,2),'Columbus Day');
  add(new Date(year,10,11),"Veterans Day");
  add(nthWeekdayOfMonth(year,10,4,4),'Thanksgiving');
  add(new Date(year,11,25),'Christmas Day');

  [
    [new Date(year,0,1),"New Year's Day (Observed)"],
    [new Date(year,5,19),'Juneteenth (Observed)'],
    [new Date(year,6,4),'Independence Day (Observed)'],
    [new Date(year,10,11),"Veterans Day (Observed)"],
    [new Date(year,11,25),'Christmas Day (Observed)']
  ].forEach(([date,title])=>{
    const observed=calendarObservedDate(date);
    if(observed.getTime()!==date.getTime())add(observed,title);
  });

  return rows;
}

function makeChartSvgNode(tag,attributes={},text=''){
  const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
  Object.entries(attributes).forEach(([key,value])=>node.setAttribute(key,String(value)));
  if(text!==''&&text!==undefined)node.textContent=String(text);
  return node;
}

function chartNiceMaximum(value){
  const max=Math.max(1,Number(value)||0);
  const magnitude=10**Math.floor(Math.log10(max));
  const fraction=max/magnitude;
  const nice=fraction<=1?1:fraction<=2?2:fraction<=5?5:10;
  return nice*magnitude;
}
