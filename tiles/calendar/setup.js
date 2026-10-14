function setupCalendar(m){
  const grid=m.querySelector('.calendar-grid');
  const monthLabel=m.querySelector('.calendar-month');
  const yearLabel=m.querySelector('.calendar-year');
  const prev=m.querySelector('.calendar-prev');
  const next=m.querySelector('.calendar-next');
  const monthButton=m.querySelector('.calendar-month-label');
  const todayButton=m.querySelector('.calendar-today');
  const addButton=m.querySelector('.calendar-add-event');

  const eventPopover=m.querySelector('.calendar-event-popover');
  const eventForm=m.querySelector('.calendar-event-form');
  const eventDate=m.querySelector('.calendar-event-date');
  const eventTitle=m.querySelector('.calendar-event-title');
  const eventType=m.querySelector('.calendar-event-type');
  const eventRecurring=m.querySelector('.calendar-event-recurring');
  const eventClose=m.querySelector('.calendar-event-close');

  const dayPopover=m.querySelector('.calendar-day-popover');
  const dayPopoverTitle=m.querySelector('.calendar-day-popover-title');
  const dayPopoverSubtitle=m.querySelector('.calendar-day-popover-subtitle');
  const dayEvents=m.querySelector('.calendar-day-events');
  const dayClose=m.querySelector('.calendar-day-popover-close');
  const dayAdd=m.querySelector('.calendar-day-add');

  const now=new Date();
  let viewYear=now.getFullYear();
  let viewMonth=now.getMonth();
  let selectedDate=calendarDateKey(now);
  let events=getStoredCalendarEvents();

  const allEventsForYear=year=>[...events,...usCalendarHolidays(year)];

  const eventMatchesDate=(event,dateKey)=>{
    if(event.recurring){
      return event.date.slice(5)===dateKey.slice(5);
    }
    return event.date===dateKey;
  };

  const eventsForDate=dateKey=>{
    const y=Number(dateKey.slice(0,4));
    return allEventsForYear(y).filter(event=>eventMatchesDate(event,dateKey));
  };

  const closeEventPopover=()=>eventPopover.hidden=true;
  const closeDayPopover=()=>dayPopover.hidden=true;

  const openEventPopover=(dateKey=selectedDate)=>{
    selectedDate=dateKey||selectedDate;
    eventDate.value=selectedDate;
    eventTitle.value='';
    eventType.value='event';
    eventRecurring.checked=false;
    eventPopover.hidden=false;
    closeDayPopover();
    requestAnimationFrame(()=>eventTitle.focus({preventScroll:true}));
  };

  const deleteEvent=id=>{
    events=events.filter(event=>event.id!==id);
    saveStoredCalendarEvents(events);
    render();
    openDayPopover(selectedDate);
  };

  const openDayPopover=dateKey=>{
    selectedDate=dateKey;
    const d=new Date(`${dateKey}T12:00:00`);
    dayPopoverTitle.textContent=new Intl.DateTimeFormat([],{weekday:'long',month:'long',day:'numeric'}).format(d);
    dayPopoverSubtitle.textContent=String(d.getFullYear());
    dayEvents.innerHTML='';

    const rows=eventsForDate(dateKey);
    if(!rows.length){
      const empty=document.createElement('div');
      empty.className='calendar-day-empty';
      empty.textContent='Nothing added yet.';
      dayEvents.appendChild(empty);
    }else{
      rows.forEach(event=>{
        const row=document.createElement('div');
        row.className=`calendar-day-event calendar-day-event--${event.type||'event'}`;

        const dot=document.createElement('span');
        dot.className='calendar-day-event-dot';

        const copy=document.createElement('div');
        copy.className='calendar-day-event-copy';
        const strong=document.createElement('strong');
        strong.textContent=event.title;
        const small=document.createElement('small');
        if(event.type==='birthday')small.textContent=event.recurring?'Birthday • repeats yearly':'Birthday';
        else if(event.type==='holiday')small.textContent='Holiday';
        else if(event.type==='reminder')small.textContent=event.recurring?'Reminder • repeats yearly':'Reminder';
        else small.textContent=event.recurring?'Event • repeats yearly':'Event';
        copy.append(strong,small);

        row.append(dot,copy);

        if(!event.builtIn){
          const remove=document.createElement('button');
          remove.type='button';
          remove.className='calendar-day-event-remove';
          remove.setAttribute('aria-label',`Delete ${event.title}`);
          remove.textContent='×';
          remove.addEventListener('click',e=>{
            e.stopPropagation();
            deleteEvent(event.id);
          });
          row.appendChild(remove);
        }

        dayEvents.appendChild(row);
      });
    }

    closeEventPopover();
    dayPopover.hidden=false;
  };

  const render=()=>{
    monthLabel.textContent=new Intl.DateTimeFormat([],{month:'long'}).format(new Date(viewYear,viewMonth,1));
    yearLabel.textContent=String(viewYear);
    grid.innerHTML='';

    const firstDay=new Date(viewYear,viewMonth,1).getDay();
    const daysInMonth=new Date(viewYear,viewMonth+1,0).getDate();
    const prevMonthDays=new Date(viewYear,viewMonth,0).getDate();
    const todayKey=calendarDateKey(new Date());

    for(let cellIndex=0;cellIndex<42;cellIndex++){
      let date;
      let outside=false;

      if(cellIndex<firstDay){
        date=new Date(viewYear,viewMonth-1,prevMonthDays-firstDay+cellIndex+1);
        outside=true;
      }else if(cellIndex>=firstDay+daysInMonth){
        date=new Date(viewYear,viewMonth+1,cellIndex-firstDay-daysInMonth+1);
        outside=true;
      }else{
        date=new Date(viewYear,viewMonth,cellIndex-firstDay+1);
      }

      const dateKey=calendarDateKey(date);
      const rows=eventsForDate(dateKey);
      const button=document.createElement('button');
      button.type='button';
      button.className='calendar-day';
      button.dataset.date=dateKey;
      button.setAttribute('role','gridcell');
      if(outside)button.classList.add('is-outside');
      if(dateKey===todayKey)button.classList.add('is-today');
      if(dateKey===selectedDate)button.classList.add('is-selected');

      const number=document.createElement('span');
      number.className='calendar-day-number';
      number.textContent=String(date.getDate());
      button.appendChild(number);

      if(rows.length){
        const dots=document.createElement('span');
        dots.className='calendar-day-dots';
        rows.slice(0,3).forEach(event=>{
          const dot=document.createElement('i');
          dot.className=`calendar-dot calendar-dot--${event.type||'event'}`;
          dots.appendChild(dot);
        });
        button.appendChild(dots);

        const firstLabel=document.createElement('span');
        firstLabel.className='calendar-day-label';
        firstLabel.textContent=rows[0].title;
        button.appendChild(firstLabel);
      }

      button.addEventListener('click',()=>{
        const target=new Date(`${dateKey}T12:00:00`);
        if(target.getMonth()!==viewMonth||target.getFullYear()!==viewYear){
          viewMonth=target.getMonth();
          viewYear=target.getFullYear();
        }
        selectedDate=dateKey;
        render();
        openDayPopover(dateKey);
      });

      grid.appendChild(button);
    }
  };

  prev.addEventListener('click',()=>{
    viewMonth--;
    if(viewMonth<0){viewMonth=11;viewYear--}
    closeDayPopover();
    closeEventPopover();
    render();
  });

  next.addEventListener('click',()=>{
    viewMonth++;
    if(viewMonth>11){viewMonth=0;viewYear++}
    closeDayPopover();
    closeEventPopover();
    render();
  });

  const goToday=()=>{
    const d=new Date();
    viewYear=d.getFullYear();
    viewMonth=d.getMonth();
    selectedDate=calendarDateKey(d);
    closeDayPopover();
    closeEventPopover();
    render();
  };

  todayButton.addEventListener('click',goToday);
  monthButton.addEventListener('click',goToday);
  addButton.addEventListener('click',()=>openEventPopover(selectedDate));
  dayAdd.addEventListener('click',()=>openEventPopover(selectedDate));
  eventClose.addEventListener('click',closeEventPopover);
  dayClose.addEventListener('click',closeDayPopover);

  eventPopover.addEventListener('pointerdown',e=>{
    if(e.target===eventPopover)closeEventPopover();
  });
  dayPopover.addEventListener('pointerdown',e=>{
    if(e.target===dayPopover)closeDayPopover();
  });

  eventForm.addEventListener('submit',e=>{
    e.preventDefault();
    const title=eventTitle.value.trim();
    const date=eventDate.value;
    if(!title||!date)return;

    events.push({
      id:`evt-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      date,
      title,
      type:eventType.value,
      recurring:eventRecurring.checked
    });
    saveStoredCalendarEvents(events);

    const d=new Date(`${date}T12:00:00`);
    viewYear=d.getFullYear();
    viewMonth=d.getMonth();
    selectedDate=date;
    closeEventPopover();
    render();
    openDayPopover(date);
  });

  m.querySelector('.calendar-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.calendar-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.calendar-text').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));

  render();
}
