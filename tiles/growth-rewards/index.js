(()=>{'use strict';
  function setup(m){
    const eggs=m.dataset.type==='egghatching',kind=eggs?'eggHatching':'flowerPots';
    const intro=m.querySelector('.growth-import'),panel=m.querySelector('.growth-dashboard'),grid=m.querySelector('.growth-grid'),goalInput=m.querySelector('.growth-goal');
    let activeClassId='',goal=5;const completed=new Set();
    const roster=()=>readClassRosters().find(r=>r.id===activeClassId);
    const goalValue=()=>eggs?5:goal;
    const art=(step,done)=>{
      if(eggs)return `<svg viewBox="0 0 120 130" aria-hidden="true"><ellipse cx="60" cy="116" rx="31" ry="6" fill="#9a765219"/>${done?'<text x="60" y="94" text-anchor="middle" font-size="62">😊</text><path d="M26 97 37 104 46 97 58 106 71 99 82 106 94 98Q88 125 60 121Q32 123 26 97" fill="#f3dfb4" stroke="#c8aa7b" stroke-width="2"/>':`<path d="M60 13C35 13 19 65 23 88C28 126 95 126 98 88C101 63 84 13 60 13Z" fill="#f6e8c9" stroke="#cbb68e" stroke-width="2"/><ellipse cx="46" cy="44" rx="10" ry="18" fill="#fff8e8" transform="rotate(22 46 44)"/><g fill="#c9ac7a" opacity=".42"><circle cx="74" cy="49" r="3"/><circle cx="37" cy="84" r="2.5"/><circle cx="83" cy="85" r="4"/></g>${step?`<path d="M60 18 52 40 66 49 49 62${step>1?' 65 75 48 90':''}${step>2?' 63 104 58 120':''}M49 62 34 57${step>3?'M65 75 86 70':''}" fill="none" stroke="#977b51" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`:''}`}</svg>`;
      const h=done?58:12+step/goalValue()*43,y=92-h;
      return `<svg viewBox="0 0 120 130" aria-hidden="true"><ellipse cx="60" cy="117" rx="35" ry="6" fill="#9a765219"/><path d="M60 94V${y}" stroke="#568c65" stroke-width="5" stroke-linecap="round"/><path d="M59 ${y+22}Q28 ${y+7} 39 ${y+29}Q50 ${y+38} 59 ${y+31}M62 ${y+13}Q91 ${y-1} 81 ${y+21}Q70 ${y+28} 62 ${y+23}" fill="#77ad78"/>${done?`<g fill="#ed9aaf">${[0,60,120,180,240,300].map(a=>`<ellipse cx="60" cy="${y-13}" rx="9" ry="15" transform="rotate(${a} 60 ${y})"/>`).join('')}<circle cx="60" cy="${y}" r="10" fill="#f3ce68"/></g>`:`<ellipse cx="60" cy="${y}" rx="6" ry="9" fill="#90bd7d"/>`}<path d="M31 88H89L81 116H39Z" fill="#c98767"/><rect x="26" y="82" width="68" height="12" rx="4" fill="#e3a889"/><path d="M44 97v12" stroke="#e8b89b" stroke-width="4" stroke-linecap="round"/>${step&&!done?'<path d="M89 30Q75 47 89 48Q102 47 89 30" fill="#7fbfd7"/>':''}</svg>`;
    };
    function render(){
      const r=roster(),focus=document.activeElement?.dataset.student;
      intro.hidden=Boolean(r);panel.hidden=!r;grid.replaceChildren();if(!r)return;
      m.querySelector('.growth-class').textContent=r.name;
      const progress=normalizePunchcardProgress(r[kind],r.students);
      if(!r.students.length){const empty=document.createElement('p');empty.textContent='Add students to this class to begin.';grid.append(empty)}
      for(const name of r.students){const key=starChartStudentKey(name),step=Math.min(goalValue()-1,progress.studentProgress[key]||0),done=completed.has(key),card=document.createElement('button');card.type='button';card.className='growth-student'+(done?' is-complete':'');card.dataset.student=name;card.setAttribute('aria-label',`${name}: ${done?'Point earned':step+' of '+goalValue()+' clicks'}, ${progress.studentPoints[key]||0} PBIS points. ${eggs?'Crack egg':'Water flower'}.`);
        const visual=document.createElement('span');visual.className='growth-art';visual.innerHTML=art(step,done);const label=document.createElement('strong');label.textContent=name;const count=document.createElement('small');count.textContent=done?'+1 PBIS point':`${step} / ${goalValue()} · ${progress.studentPoints[key]||0} points`;card.append(visual,label,count);card.onclick=()=>advance(name);grid.append(card);if(focus===name)card.focus({preventScroll:true});
      }
    }
    function advance(name){const r=roster();if(!r||!r.students.includes(name))return;const progress=normalizePunchcardProgress(r[kind],r.students),key=starChartStudentKey(name);completed.delete(key);const next=Math.min(goalValue()-1,progress.studentProgress[key]||0)+1;if(next>=goalValue()){progress.studentProgress[key]=0;progress.studentPoints[key]=(progress.studentPoints[key]||0)+1;completed.add(key)}else progress.studentProgress[key]=next;writeClassGrowth(r.id,kind,progress);}
    const selectClass=id=>{activeClassId=String(id||'');completed.clear();render()};
    const detach=attachClassRosterLoader(m.querySelector('.growth-loader'),(_,r)=>{selectClass(r.id);notifyBoardChanged('growth-class')});
    m.querySelector('.growth-change').onclick=()=>{selectClass('');notifyBoardChanged('growth-class')};
    goalInput?.addEventListener('change',()=>{goal=Math.max(1,Math.min(10,Math.round(Number(goalInput.value)||5)));goalInput.value=goal;render();notifyBoardChanged('flower-goal')});
    for(const [selector,key,values] of [['.tile-bg','bg',['white','cream','blue','pink','green','lavender','charcoal']],['.tile-font','font',FONT_OPTIONS],['.tile-text','text',['dark','soft','blue','rose','white','cream']]])m.querySelector(selector).onclick=()=>cycleData(m,key,values);
    window.addEventListener('teachertiles:classeschange',render);
    m._boardGetState=()=>({activeClassId,goal});m._boardSetState=s=>{goal=Math.max(1,Math.min(10,Math.round(Number(s?.goal)||5)));if(goalInput)goalInput.value=goal;selectClass(s?.activeClassId)};
    bindGeneratedTileSettings(m,m.querySelector('.tile-settings-toggle'),m.querySelector('.tile-settings-panel'));
    const prior=m._cleanup;m._cleanup=()=>{detach();window.removeEventListener('teachertiles:classeschange',render);prior?.()};render();
  }
  window.TeacherTilesGrowthRewards={setup};
})();
