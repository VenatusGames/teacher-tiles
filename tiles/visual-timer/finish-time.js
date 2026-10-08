(() => {
  'use strict';
  function setup(m){
    window.TeacherTilesSettings.ensure(m);
    const panel=m.querySelector('.tile-settings-panel');
    const row=document.createElement('div');row.className='tile-settings-switch-row';
    const label=document.createElement('span');label.textContent='Show Finish Time';
    const toggle=document.createElement('button');toggle.type='button';toggle.className='tile-settings-switch timer-finish-toggle';toggle.setAttribute('role','switch');toggle.setAttribute('aria-label','Show Finish Time');toggle.innerHTML='<i aria-hidden="true"></i>';row.append(label,toggle);panel.append(row);
    let state={running:false,left:0,total:0,endAt:0},lastKey='',lastTime='';
    const statuses=[];
    if(m.dataset.type==='timer')statuses.push(m.querySelector('.timer-status'));
    else for(const number of m.querySelectorAll('.hourglass-countdown,.candle-countdown,.scene-countdown')){
      const status=document.createElement('div');status.className='interactive-timer-status';number.after(status);statuses.push(status);
    }
    function refresh(){
      const enabled=m.dataset.showFinishTime==='true',running=state.running&&state.left>0;
      toggle.setAttribute('aria-checked',String(enabled));
      const key=enabled&&running?String(state.endAt):'';
      if(key!==lastKey){lastKey=key;lastTime=key?new Date(state.endAt).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):'';}
      const text=state.left<=0?(state.total>0?'DONE':'READY'):running?'RUNNING':state.left<state.total?'PAUSED':'READY';
      for(const status of statuses){
        if(!status)continue;
        const value=lastTime?`${text} · ${lastTime}`:text;
        if(status.textContent!==value)status.textContent=value;
        if(m.dataset.type==='interactive')status.hidden=!enabled;
        status.classList.toggle('has-finish-time',!!lastTime);
        status.title=lastTime?`Finishes at ${lastTime}`:'';
      }
    }
    toggle.addEventListener('click',()=>{m.dataset.showFinishTime=String(m.dataset.showFinishTime!=='true');refresh();notifyBoardChanged('timer-finish-time')});
    return next=>{state=next;refresh()};
  }
  window.TeacherTilesTimerFinish={setup};
})();
