function setupDate(m){
  const display=m.querySelector('.date-display');
  const weekday=m.querySelector('.date-weekday');
  const main=m.querySelector('.date-main');
  const year=m.querySelector('.date-year');
  const styleBtn=m.querySelector('.date-style');
  const layoutBtn=m.querySelector('.date-layout');
  const weekdayBtn=m.querySelector('.date-weekday-toggle');
  const yearBtn=m.querySelector('.date-year-toggle');

  TeacherTilesDisplayMenu.setup(m,{panel:m.querySelector('.date-options'),title:'Date Display',icon:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 11h18"/>'});
  let fitFrame=0;

  const fit=()=>{
    cancelAnimationFrame(fitFrame);
    fitFrame=requestAnimationFrame(()=>{
      const availableWidth=Math.max(1,display.clientWidth);
      const availableHeight=Math.max(1,display.clientHeight);

      let lo=10,hi=700,best=10;
      for(let i=0;i<18;i++){
        const mid=(lo+hi)/2;
        m.style.setProperty('--date-size',`${mid}px`);
        const parts=[weekday,main,year].filter(el=>!el.hidden),horizontal=m.classList.contains('is-horizontal');
        const gap=parseFloat(getComputedStyle(display).gap)||0;
        const width=horizontal?parts.reduce((sum,el)=>sum+el.scrollWidth,0)+gap*(parts.length-1):Math.max(...parts.map(el=>el.scrollWidth));
        const height=horizontal?Math.max(...parts.map(el=>el.scrollHeight)):parts.reduce((sum,el)=>sum+el.scrollHeight,0)+gap*(parts.length-1);
        const fits=width<=availableWidth&&height<=availableHeight;
        if(fits){best=mid;lo=mid}else hi=mid;
      }
      m.style.setProperty('--date-size',`${Math.max(10,best*.97)}px`);
    });
  };

  const render=()=>{
    const d=new Date();
    const numeric=m.dataset.dateStyle==='numbers';
    const horizontal=m.dataset.dateLayout==='horizontal';
    const showWeekday=m.dataset.showWeekday!=='false';
    const showYear=m.dataset.showYear!=='false';

    m.classList.toggle('is-numeric',numeric);
    m.classList.toggle('is-horizontal',horizontal);

    weekday.hidden=!showWeekday;
    year.hidden=numeric||!showYear;

    const weekdayText=new Intl.DateTimeFormat([],{weekday:'long'}).format(d);
    const monthDayText=new Intl.DateTimeFormat([],{month:'long',day:'numeric'}).format(d);
    const numericText=new Intl.DateTimeFormat([],{month:'2-digit',day:'2-digit',year:'numeric'}).format(d);

    if(horizontal&&!numeric){
      weekday.textContent=showWeekday?`${weekdayText},`:'';
      main.textContent=showYear?`${monthDayText},`:monthDayText;
      year.textContent=String(d.getFullYear());
    }else{
      weekday.textContent=weekdayText.toUpperCase();
      main.textContent=numeric?numericText:monthDayText;
      year.textContent=String(d.getFullYear());
    }

    const icon=path=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+path+'"/></svg>';
    styleBtn.innerHTML=icon('M4 5h16M12 5v14M8 19h8')+'<span>'+(numeric?'Numbers':'Text')+'</span>';
    layoutBtn.innerHTML=icon(horizontal?'M4 5h6v14H4zM14 5h6v14h-6z':'M4 5h16v5H4zM4 14h16v5H4z')+'<span>'+(horizontal?'Horizontal':'Stacked')+'</span>';
    weekdayBtn.setAttribute('aria-pressed',String(showWeekday));
    yearBtn.setAttribute('aria-pressed',String(showYear));

    weekdayBtn.classList.toggle('is-active',showWeekday);
    yearBtn.classList.toggle('is-active',showYear);
    yearBtn.disabled=numeric;
    yearBtn.hidden=numeric;
    yearBtn.setAttribute('aria-disabled',String(numeric));

    fit();
  };

  styleBtn.addEventListener('click',()=>{
    m.dataset.dateStyle=m.dataset.dateStyle==='numbers'?'text':'numbers';
    render();
    notifyBoardChanged('date-options');
  });

  layoutBtn.addEventListener('click',()=>{
    m.dataset.dateLayout=m.dataset.dateLayout==='horizontal'?'stacked':'horizontal';
    render();
    notifyBoardChanged('date-options');
  });

  weekdayBtn.addEventListener('click',()=>{
    m.dataset.showWeekday=m.dataset.showWeekday==='false'?'true':'false';
    render();
    notifyBoardChanged('date-options');
  });

  yearBtn.addEventListener('click',()=>{
    if(m.dataset.dateStyle==='numbers')return;
    m.dataset.showYear=m.dataset.showYear==='false'?'true':'false';
    render();
    notifyBoardChanged('date-options');
  });

  m.querySelector('.date-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.date-font').addEventListener('click',()=>{
    cycleData(m,'font',FONT_OPTIONS);
    fit();
  });
  m.querySelector('.date-text').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));

  const observer=new ResizeObserver(fit);
  observer.observe(m);
  observer.observe(display);

  const id=setInterval(render,30*1000);
  render();

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    clearInterval(id);
    cancelAnimationFrame(fitFrame);
    observer.disconnect();
  };
}
