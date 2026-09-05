(() => {
  'use strict';
  function setup(m){
    const daily=window.TeacherTilesDaily,quotes=window.TeacherTilesQuotes;
    let offset=0,day=daily.dayKey();
    function render(){
      const today=daily.dayKey();if(day!==today){day=today;offset=0;}
      const item=quotes[daily.index(quotes.length,offset)];
      m.querySelector('.daily-date').textContent=new Date().toLocaleDateString(undefined,{month:'long',day:'numeric'});
      m.querySelector('.daily-quote').textContent=item.text;
      m.querySelector('.quote-author').textContent=item.author;
      const source=m.querySelector('.quote-source');source.textContent=item.work;source.href=item.source;
      m.querySelector('.quote-prompt').textContent=item.prompt;
      m.querySelector('.daily-today').disabled=offset===0;
    }
    m.querySelector('.daily-next').addEventListener('click',()=>{offset=(offset+1)%quotes.length;render();notifyBoardChanged('daily-quote');});
    m.querySelector('.daily-today').addEventListener('click',()=>{offset=0;render();notifyBoardChanged('daily-quote');});
    m._boardGetState=()=>({offset,day});
    m._boardSetState=s=>{day=daily.dayKey();offset=s?.day===day&&Number.isInteger(s.offset)?Math.max(0,s.offset)%quotes.length:0;render();};
    daily.watch(m,render);
  }
  window.TeacherTilesQuoteOfTheDay=Object.freeze({setup});
})();
