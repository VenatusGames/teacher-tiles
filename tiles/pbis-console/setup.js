function setupPbisConsole(m){
  const importView=m.querySelector('.pbisconsole-import'),dashboard=m.querySelector('.pbisconsole-dashboard'),loaderAnchor=m.querySelector('.pbisconsole-loader-anchor'),className=m.querySelector('.pbisconsole-class-name'),classLogo=m.querySelector('.pbisconsole-class-logo'),changeClass=m.querySelector('.pbisconsole-change-class'),studentSelect=m.querySelector('.pbisconsole-student'),studentToolbar=m.querySelector('.pbisconsole-student-toolbar'),stats=m.querySelector('.pbisconsole-stats'),tabs=[...m.querySelectorAll('[data-pbisconsole-view]')];
  let activeClassId='',student='',view='students';
  const roster=()=>readClassRosters().find(item=>item.id===activeClassId)||null;
  const studentDefinitions=[{id:'studentEggPoints',label:'Egg Hatching Points',icon:'🥚'},{id:'studentFlowerPoints',label:'Flower Pot Points',icon:'🌷'},{id:'studentStars',label:'Student Stars',icon:'★'},{id:'studentPunchcardPoints',label:'Punchcard Points',icon:'●'},{id:'studentRaceWins',label:'Race Wins',icon:'🏁'}];
  const classDefinitions=[{id:'classStars',label:'Whole-class Stars',icon:'★'},{id:'meterWins',label:'Class Meter Wins',icon:'🏆'},{id:'jarsFilled',label:'Jars Filled',icon:'🫙'},{id:'classPunchcardPoints',label:'Whole-class Punchcard Points',icon:'●'},{id:'meterFill',label:'Current Meter Fill',icon:'💧',suffix:'%'},{id:'jarItems',label:'Items in Current Jar',icon:'○'}];
  const setClass=id=>{
    const r=readClassRosters().find(item=>item.id===id);
    activeClassId=r?.id||'';
    importView.hidden=Boolean(r);dashboard.hidden=!r;
    if(r){
      className.textContent=r.name;classLogo.textContent=normalizeClassLogo(r.logo);
      const prior=student;
      studentSelect.replaceChildren(new Option(r.students.length?'Choose a student…':'No students',''));
      r.students.forEach(name=>studentSelect.add(new Option(name,name)));
      student=r.students.includes(prior)?prior:(r.students[0]||'');studentSelect.value=student;
    }
    render();
  };
  const render=()=>{
    const r=roster();if(!r)return;
    tabs.forEach(tab=>{const active=tab.dataset.pbisconsoleView===view;tab.classList.toggle('is-active',active);tab.setAttribute('aria-selected',String(active))});
    studentToolbar.hidden=view!=='students';
    stats.replaceChildren();
    const definitions=view==='students'?studentDefinitions:classDefinitions;
    definitions.forEach(def=>{
      const value=pbisBalance(r,def.id,student);
      const row=document.createElement('section');row.className='pbisconsole-stat';
      if(view==='students'){
        row.innerHTML=`<div class="pbisconsole-stat-copy"><span>${def.icon}</span><div><strong>${def.label}</strong><small>${student||'Choose a student'}</small></div></div><div class="pbisconsole-stat-value"><strong>${value}${def.suffix||''}</strong></div><div class="pbisconsole-reset"><button type="button" ${student&&value>0?'':'disabled'}>Reset</button></div>`;
        row.querySelector('button').addEventListener('click',()=>{if(!student)return;if(!confirm(`Reset ${def.label} for ${student}?`))return;adjustPbisBalance(activeClassId,def.id,0,{studentName:student,mode:'set'});render();notifyBoardChanged('pbis-console-student-reset')});
      }else{
        row.innerHTML=`<div class="pbisconsole-stat-copy"><span>${def.icon}</span><div><strong>${def.label}</strong><small>Whole class</small></div></div><div class="pbisconsole-stat-value"><strong>${value}${def.suffix||''}</strong></div><div class="pbisconsole-adjust"><input type="number" min="1" max="9999" step="1" value="1" aria-label="Adjustment amount"><button type="button" data-op="remove">Remove</button><button type="button" data-op="add">Add</button><button type="button" data-op="clear">Clear</button></div>`;
        const input=row.querySelector('input');
        row.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{const amount=Math.max(1,Math.round(Number(input.value)||1));if(button.dataset.op==='clear')adjustPbisBalance(activeClassId,def.id,0,{mode:'set'});else adjustPbisBalance(activeClassId,def.id,button.dataset.op==='add'?amount:-amount);render();notifyBoardChanged('pbis-console-class-adjust')}));
      }
      stats.append(row);
    });
  };
  tabs.forEach(tab=>tab.addEventListener('click',()=>{view=tab.dataset.pbisconsoleView==='class'?'class':'students';render();notifyBoardChanged('pbis-console-view')}));
  studentSelect.addEventListener('change',()=>{student=studentSelect.value;render();notifyBoardChanged('pbis-console-student')});
  changeClass.addEventListener('click',()=>{activeClassId='';student='';importView.hidden=false;dashboard.hidden=true;notifyBoardChanged('pbis-console-class')});
  const detach=attachClassRosterLoader(loaderAnchor,(_,r)=>{setClass(r.id);notifyBoardChanged('pbis-console-class')});
  m.querySelector('.pbisconsole-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.pbisconsole-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.pbisconsole-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));
  const refresh=()=>{if(activeClassId&&!roster())setClass('');else render()};
  ['teachertiles:classeschange','teachertiles:starchartchange','teachertiles:classmeterchange','teachertiles:collectionchange','teachertiles:punchcardchange','teachertiles:racerchange'].forEach(name=>window.addEventListener(name,refresh));
  m._boardGetState=()=>({activeClassId,student,view});
  m._boardSetState=state=>{student=String(state?.student||'');view=state?.view==='class'?'class':'students';setClass(String(state?.activeClassId||''))};
  const prior=m._cleanup;
  m._cleanup=()=>{prior?.();detach();['teachertiles:classeschange','teachertiles:starchartchange','teachertiles:classmeterchange','teachertiles:collectionchange','teachertiles:punchcardchange','teachertiles:racerchange'].forEach(name=>window.removeEventListener(name,refresh))};
}
