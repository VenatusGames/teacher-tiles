function setupDate(m){
  const display=m.querySelector('.date-display');
  const weekday=m.querySelector('.date-weekday');
  const main=m.querySelector('.date-main');
  const year=m.querySelector('.date-year');
  const styleBtn=m.querySelector('.date-style');
  const layoutBtn=m.querySelector('.date-layout');
  const weekdayBtn=m.querySelector('.date-weekday-toggle');
  const yearBtn=m.querySelector('.date-year-toggle');

  let fitFrame=0;

  const fit=()=>{
    cancelAnimationFrame(fitFrame);
    fitFrame=requestAnimationFrame(()=>{
      const availableWidth=Math.max(40,m.clientWidth-24);
      const availableHeight=Math.max(40,m.clientHeight-34);

      let lo=10,hi=700,best=10;
      for(let i=0;i<18;i++){
        const mid=(lo+hi)/2;
        m.style.setProperty('--date-size',`${mid}px`);
        const fits=display.scrollWidth<=availableWidth+1&&display.scrollHeight<=availableHeight+1;
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

    styleBtn.textContent=numeric?'Numbers':'Text';
    layoutBtn.textContent=horizontal?'Horizontal':'Stacked';

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
  });

  layoutBtn.addEventListener('click',()=>{
    m.dataset.dateLayout=m.dataset.dateLayout==='horizontal'?'stacked':'horizontal';
    render();
  });

  weekdayBtn.addEventListener('click',()=>{
    m.dataset.showWeekday=m.dataset.showWeekday==='false'?'true':'false';
    render();
  });

  yearBtn.addEventListener('click',()=>{
    if(m.dataset.dateStyle==='numbers')return;
    m.dataset.showYear=m.dataset.showYear==='false'?'true':'false';
    render();
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
