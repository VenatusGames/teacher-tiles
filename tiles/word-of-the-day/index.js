(() => {
  'use strict';
  function setup(m){
    const daily=window.TeacherTilesDaily,bank=window.TeacherTilesWords;
    let level='everyday',offset=0,day=daily.dayKey();
    const choice=m.querySelector('.word-level');
    function render(){
      const today=daily.dayKey();if(day!==today){day=today;offset=0;}
      const words=bank[level],item=words[daily.index(words.length,offset)];
      m.querySelector('.daily-date').textContent=new Date().toLocaleDateString(undefined,{month:'long',day:'numeric'});
      m.querySelector('.daily-word').textContent=item.word;
      m.querySelector('.daily-part').textContent=item.part;
      m.querySelector('.daily-definition').textContent=item.definition;
      m.querySelector('.daily-example').textContent=item.example;
      m.querySelector('.daily-today').disabled=offset===0;
      choice.value=level;
    }
    choice.addEventListener('change',()=>{level=choice.value==='challenge'?'challenge':'everyday';offset=0;render();notifyBoardChanged('daily-word-level');});
    m.querySelector('.daily-next').addEventListener('click',()=>{offset=(offset+1)%bank[level].length;render();notifyBoardChanged('daily-word');});
    m.querySelector('.daily-today').addEventListener('click',()=>{offset=0;render();notifyBoardChanged('daily-word');});
    m._boardGetState=()=>({level,offset,day});
    m._boardSetState=s=>{level=s?.level==='challenge'?'challenge':'everyday';day=daily.dayKey();offset=s?.day===day&&Number.isInteger(s.offset)?Math.max(0,s.offset)%bank[level].length:0;render();};
    daily.watch(m,render);
  }
  window.TeacherTilesWordOfTheDay=Object.freeze({setup});
})();
