/* Unified class library, student profiles, and per-class PBIS preferences. */
function setupClassesStudents(){
  const opener=document.getElementById('profile-classes-button');if(!opener)return;
  const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  const icons={pbis:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',assessment:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9zM9 11h6M9 15h4"/>',connect:'<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M2 21v-3a6 6 0 0 1 12 0v3m2-7a5 5 0 0 1 6 5v2"/>',extras:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><path d="M14 17.5h7m-3.5-3.5v7"/>',pet:'<ellipse cx="12" cy="16" rx="5" ry="4"/><ellipse cx="5" cy="10" rx="2" ry="2.5"/><ellipse cx="10" cy="5" rx="2" ry="2.5"/><ellipse cx="16" cy="5" rx="2" ry="2.5"/><ellipse cx="20" cy="11" rx="2" ry="2.5"/>',back:'<path d="m14 6-6 6 6 6"/>',edit:'<path d="m15 4 5 5M4 20l4-1L20 7a2.1 2.1 0 0 0-3-3L5 16z"/>',plus:'<path d="M12 5v14M5 12h14"/>',settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>'};
  const icon=name=>{const span=el('span','cs-icon');span.setAttribute('aria-hidden','true');span.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name]||icons.plus}</svg>`;return span;};
  const button=(label,action,cls='cs-button',symbol)=>{const b=el('button',cls);b.type='button';if(symbol)b.append(icon(symbol));b.append(el('span','',label));b.onclick=action;return b;};
  const panel=el('dialog','cs-tool');panel.id='profile-classes-panel';panel.setAttribute('aria-label','Student View');
  const top=el('header','cs-topbar'),brand=el('div','cs-brand');brand.append(el('strong','','Student View'),el('span','profile-tool-beta','BETA'));
  const topActions=el('div','cs-top-actions'),saveStatus=el('span','cs-save-status','Saved on this device');saveStatus.setAttribute('role','status');
  const exit=button('Back to Board',()=>panel.close(),'cs-button','back');topActions.append(saveStatus,exit);top.append(brand,topActions);
  const content=el('main','cs-content'),classHeader=el('section','cs-class-header'),heading=el('div','cs-list-heading'),titleBox=el('div'),title=el('h1'),subtitle=el('p');titleBox.append(title,subtitle);
  const searchLabel=el('label','cs-search'),search=el('input');search.type='search';searchLabel.append(icon('search'),search);heading.append(titleBox,searchLabel);
  const grid=el('div','cs-grid');content.append(classHeader,heading,grid);panel.append(top,content);document.body.append(panel);
  const editor=el('dialog','cs-modal'),settings=el('dialog','cs-modal cs-settings'),detail=el('dialog','cs-modal cs-detail');document.body.append(editor,settings,detail);
  let visibleStudents=new Set(),activeClass='',activeStudent=null,scope=window.TeacherTilesClassScope||'local',photoTask=0;
  const notice=el('p','cs-notice');notice.setAttribute('role','status');panel.append(notice);let noticeTimer;
  function notify(message){clearTimeout(noticeTimer);notice.textContent=message;notice.classList.add('is-visible');noticeTimer=setTimeout(()=>notice.classList.remove('is-visible'),5000);}
  const current=()=>readClassRosters().find(c=>c.id===activeClass);
  function commit(change){
    try{
      if(scope!==(window.TeacherTilesClassScope||'local'))throw new Error('Your account changed. Reopen Student View to continue.');
      const classes=readClassRosters();change(classes);
      // Leave room for encrypted base64 overhead and future PBIS progress in the existing class document.
      if(new TextEncoder().encode(JSON.stringify(classes)).length>600000)throw new Error('Your class photo storage is full. Remove a photo or use an emoji to save this change.');
      writeClassRosters(classes);if(!window.TeacherTilesAuth?.user)saveStatus.textContent='Saved on this device';return true;
    }catch(error){return error.message||'Unable to save this change. Please try again.';}
  }
  const updateClass=change=>commit(classes=>{const c=classes.find(c=>c.id===activeClass);if(!c)throw new Error('This class is no longer available.');change(c);});
  function avatar(c,name,large=false){
    const profile=name?c.studentProfiles?.[starChartStudentKey(name)]:null,v=studentProfileVisual(name||c.name,c.id),node=el('span','cs-avatar'+(large?' cs-avatar-large':''));node.style.setProperty('--avatar-hue',v.hue);node.setAttribute('aria-hidden','true');
    if(profile?.image){const img=el('img');img.src=profile.image;img.alt='';img.decoding='async';img.loading='lazy';node.append(img);}else node.textContent=name?(profile?.emoji||v.initials):normalizeClassLogo(c.logo);return node;
  }
  const statsFor=(c,whole=false)=>c.pbisEnabled===false?[]:PBIS_STUDENT_STAT_DEFINITIONS.filter(s=>c.pbisStats?.[s.id]!==false&&(!s.wholeClassOnly||whole)&&(!s.studentOnly||!whole));
  const statValue=(s,c,name)=>{if(!name)return s.wholeClassValue?.(c)||0;const key=starChartStudentKey(name),map={eggPoints:c.eggHatching?.studentPoints,flowerPoints:c.flowerPots?.studentPoints,stars:c.starChart?.studentStars,punchcardPoints:c.punchcards?.studentPoints,raceWins:c.racer?.studentWins};return normalizeStarChartCount(map[s.id]?.[key]);};
  function rewardSummary(c,name){const box=el('div','cs-reward-summary');if(c.pbisEnabled===false)return box;const stats=statsFor(c,!name);const total=stats.reduce((n,s)=>n+statValue(s,c,name),0);box.append(el('strong','',`${total} PBIS rewards`));const chips=el('div','cs-reward-chips');for(const s of stats){const chip=el('span','',`${s.icon} ${statValue(s,c,name)}`);chip.title=s.label;chip.setAttribute('aria-label',`${s.label}: ${statValue(s,c,name)}`);chips.append(chip);}box.append(chips);return box;}
  function addCard(label,action){const b=button(label,action,'cs-add-card','plus');b.setAttribute('aria-label',label);return b;}
  function openClass(id){activeClass=id;search.value='';render();content.scrollTop=0;title.focus({preventScroll:true});}
  title.tabIndex=-1;
  function render(){
    const c=current();if(activeClass&&!c)activeClass='';classHeader.replaceChildren();classHeader.hidden=!c;grid.replaceChildren();
    title.textContent=c?'Students':'Your Classes';subtitle.textContent=c?`${c.students.length} ${c.students.length===1?'student':'students'}`:'';subtitle.hidden=!c;grid.classList.toggle('cs-students-grid',Boolean(c));search.placeholder=c?'Search students':'Search classes';search.setAttribute('aria-label',search.placeholder);
    if(c){
      const back=button('All Classes',()=>openClass(''),'cs-button cs-back','back');
      const info=el('div','cs-class-info'),copy=el('div');copy.append(el('h2','',c.name),el('p','',`${c.students.length} ${c.students.length===1?'student':'students'}`));info.append(avatar(c),copy);
      const rewards=button('',()=>showDetail(null),'cs-class-rewards');rewards.replaceChildren(rewardSummary(c,null));rewards.setAttribute('aria-label','View whole-class PBIS rewards');rewards.hidden=c.pbisEnabled===false;
      const configure=button('Class Settings',showSettings,'cs-button','settings');classHeader.append(back,info,rewards,configure);
      const names=c.students.filter(n=>n.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()));
      for(const [index,name] of names.entries()){const card=button('',()=>showDetail(name),'cs-student-card');card.setAttribute('aria-label',`Open ${name}'s student profile`);card.replaceChildren(avatar(c,name),el('strong','cs-card-name',name));
        if(!visibleStudents.has(c.id+':'+starChartStudentKey(name))){card.classList.add('is-entering');card.style.setProperty('--student-enter-delay',Math.min(index,6)*35+'ms');}
        grid.append(card);}
      visibleStudents=new Set(names.map(name=>c.id+':'+starChartStudentKey(name)));
      grid.append(addCard('Add Student',()=>editStudent()));
      if(!names.length)grid.append(el('p','cs-empty',c.students.length?'No students match your search.':'Add your first student using a first name or nickname.'));
    }else{
      visibleStudents.clear();
      const classes=readClassRosters().filter(c=>c.name.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()));
      for(const c of classes){
        const card=el('article','cs-class-card'),open=button('',()=>openClass(c.id),'cs-class-open');open.setAttribute('aria-label',`Open ${c.name}`);open.replaceChildren(avatar(c),el('strong','cs-card-name',c.name),el('small','',`${c.students.length} ${c.students.length===1?'student':'students'}`));
        const edit=button('Edit Class',()=>editClass(c.id),'cs-button cs-card-edit','edit');edit.setAttribute('aria-label',`Edit ${c.name}`);card.append(open,edit);grid.append(card);
      }
      grid.append(addCard('New Class',()=>editClass()));
      if(!classes.length)grid.append(el('p','cs-empty',search.value?'No classes match your search.':'Create your first class to get started.'));
    }
  }
  function modalHeader(dialog,label){dialog.replaceChildren();dialog.setAttribute('aria-label',label);const head=el('header','cs-modal-header'),h=el('h2','',label),close=button('',()=>dialog.close(),'cs-close profile-panel__close','close');close.setAttribute('aria-label',`Close ${label}`);head.append(h,close);dialog.append(head);}
  function field(label,value,max){const holder=el('label','cs-field'),input=el('input');input.type='text';input.required=true;input.maxLength=max;input.value=value;input.setAttribute('aria-label',label);holder.append(el('span','',label),input);return{holder,input};}
  function emojiPicker(selected,onChange){
    const box=el('fieldset','cs-emoji-picker');box.append(el('legend','','Choose an emoji'));const choices=el('div','cs-emoji-options');
    const options=[...CLASS_LOGO_OPTIONS.map(o=>o.symbol),'🐸','🦋','🐱','🐶','🦊','🐼','🐙','🌻','🍀','⚽','🎵','📚'];
    for(const emoji of options){const b=button(emoji,()=>choose(emoji),'cs-emoji');b.setAttribute('aria-label',`Use ${emoji}`);b.dataset.emoji=emoji;b.setAttribute('aria-pressed',String(selected===emoji));choices.append(b);}
    const custom=field('Custom emoji',options.includes(selected)?'':selected,16);custom.input.required=false;custom.input.placeholder='Type or paste an emoji';custom.input.addEventListener('input',()=>choose(custom.input.value,false));
    function choose(value,reset=true){selected=value?normalizeClassLogo(value):'';choices.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.emoji===selected)));if(reset)custom.input.value='';onChange(selected);}
    box.append(choices,custom.holder);return box;
  }
  function editClass(id=''){
    const c=readClassRosters().find(c=>c.id===id);if(id&&!c)return;modalHeader(editor,c?'Edit Class':'New Class');
    const form=el('form','cs-form'),name=field('Class name',c?.name||'',50),preview=el('div','cs-form-preview');let emoji=c?.logo||'👥';preview.textContent=emoji;
    const error=el('p','cs-error');error.setAttribute('role','alert');const actions=el('div','cs-form-actions'),save=button(c?'Save Changes':'Create Class',null,'cs-button cs-primary');save.type='submit';actions.append(button('Cancel',()=>editor.close()),save);
    form.append(preview,name.holder,emojiPicker(emoji,value=>{emoji=value||'👥';preview.textContent=emoji;}),error,actions);editor.append(form);
    form.onsubmit=e=>{e.preventDefault();const clean=name.input.value.trim().replace(/\s+/g,' ');if(!clean){error.textContent='Enter a class name.';return;}
      const result=commit(classes=>{if(c){const target=classes.find(v=>v.id===id);if(!target)throw new Error('This class is no longer available.');target.name=clean;target.logo=emoji;}else classes.push({id:classRosterId(),name:clean,logo:emoji,students:[],studentProfiles:{},pbisEnabled:true,pbisStats:readStudentViewStatPreferences()});});
      if(result!==true){error.textContent=result;return;}editor.close();render();notify(c?'Class updated':'Class created');};editor.showModal();name.input.focus();
  }
  async function compactPhoto(file){
    if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type))throw new Error('Choose a PNG, JPG, WebP, or GIF image.');if(file.size>12*1024*1024)throw new Error('Choose an image smaller than 12 MB.');
    const url=URL.createObjectURL(file),img=new Image();try{img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=96;const ctx=canvas.getContext('2d'),size=Math.min(img.naturalWidth,img.naturalHeight);ctx.drawImage(img,(img.naturalWidth-size)/2,(img.naturalHeight-size)/2,size,size,0,0,96,96);for(const quality of [.75,.55,.35]){const data=canvas.toDataURL('image/webp',quality);if(data.length<=10000)return data;}throw new Error('This image could not be resized. Try another image.');}finally{URL.revokeObjectURL(url);}
  }
  function editStudent(oldName=''){
    const c=current();if(!c)return;if(oldName&&!c.students.includes(oldName))return;const classId=c.id,original=c.studentProfiles?.[starChartStudentKey(oldName)]||{};let emoji=original.emoji||'',image=original.image||'';
    modalHeader(editor,oldName?'Edit Student':'Add Student');const form=el('form','cs-form'),name=field('Student first name or nickname',oldName,60),preview=el('div','cs-form-preview'),error=el('p','cs-error');error.setAttribute('role','alert');
    const paint=()=>{preview.replaceChildren();if(image){const img=el('img');img.src=image;img.alt='Student image preview';preview.append(img);}else preview.textContent=emoji||studentProfileVisual(name.input.value).initials;};paint();name.input.addEventListener('input',paint);
    const picker=emojiPicker(emoji,value=>{photoTask++;emoji=value;image='';file.value='';save.disabled=false;error.textContent='';paint();}),file=el('input');file.type='file';file.accept='image/png,image/jpeg,image/webp,image/gif';file.hidden=true;file.setAttribute('aria-label','Upload student image');
    const photoActions=el('div','cs-photo-actions');photoActions.append(button('Upload Image',()=>file.click()),button('Use Initials',()=>{photoTask++;emoji='';image='';save.disabled=false;error.textContent='';paint();picker.querySelectorAll('[data-emoji]').forEach(b=>b.setAttribute('aria-pressed','false'));}),file);
    const actions=el('div','cs-form-actions'),save=button(oldName?'Save Changes':'Add Student',null,'cs-button cs-primary');save.type='submit';actions.append(button('Cancel',()=>editor.close()),save);
    form.append(preview,name.holder,picker,photoActions,el('small','cs-muted','Images are cropped to a square and resized automatically.'),error,actions);editor.append(form);
    file.onchange=async()=>{const chosen=file.files?.[0];if(!chosen)return;const task=++photoTask;save.disabled=true;error.textContent='Resizing image…';try{const data=await compactPhoto(chosen);if(task!==photoTask||!editor.open)return;image=data;emoji='';paint();picker.querySelectorAll('[data-emoji]').forEach(b=>b.setAttribute('aria-pressed','false'));error.textContent='';}catch(e){if(task===photoTask)error.textContent=e.message;}finally{if(task===photoTask)save.disabled=false;}};
    form.onsubmit=e=>{e.preventDefault();if(save.disabled)return;const clean=name.input.value.trim().replace(/\s+/g,' ');if(!clean){error.textContent='Enter a first name or nickname.';return;}
      const result=updateClass(target=>{if(target.id!==classId)throw new Error('The selected class changed. Reopen this student.');if(target.students.some(n=>n!==oldName&&n.toLocaleLowerCase()===clean.toLocaleLowerCase()))throw new Error('A student with that name already exists in this class.');if(!oldName&&target.students.length>=300)throw new Error('This class already has 300 students.');
        if(oldName){if(!target.students.includes(oldName))throw new Error('This student is no longer in the class.');renameClassStudent(target,oldName,clean);}else target.students.push(clean);
        target.studentProfiles[starChartStudentKey(clean)]={emoji,image};});
      if(result!==true){error.textContent=result;return;}if(activeStudent?.name===oldName){activeStudent.name=clean;renderDetail();}editor.close();render();notify(oldName?'Student updated':'Student added');};
    editor.showModal();name.input.focus();
  }
  function toggle(label,checked,action,description=''){
    const row=el('label','cs-toggle'),copy=el('span');copy.append(el('strong','',label));if(description)copy.append(el('small','',description));const input=el('input');input.type='checkbox';input.checked=checked;input.setAttribute('role','switch');input.setAttribute('aria-label',label);input.onchange=()=>action(input.checked,input);const track=el('i');track.setAttribute('aria-hidden','true');row.append(copy,input,track);return row;
  }
  function showSettings(){const c=current();if(!c)return;modalHeader(settings,'Class Settings');const body=el('div','cs-settings-body'),statOptions=el('fieldset','cs-pbis-options'),error=el('p','cs-error');error.setAttribute('role','alert');statOptions.append(el('legend','','Show PBIS rewards'));statOptions.hidden=!c.pbisEnabled;
    body.append(toggle('Enable PBIS',c.pbisEnabled,(enabled,input)=>{const result=updateClass(target=>target.pbisEnabled=enabled);if(result!==true){input.checked=!enabled;error.textContent=result;return;}statOptions.hidden=!enabled;renderDetail();},'Show class and student reward totals. Turning this off keeps their saved progress.'));
    for(const stat of PBIS_STUDENT_STAT_DEFINITIONS)statOptions.append(toggle(stat.label,c.pbisStats[stat.id]!==false,(enabled,input)=>{const result=updateClass(target=>target.pbisStats[stat.id]=enabled);if(result!==true){input.checked=!enabled;error.textContent=result;}renderDetail();},stat.wholeClassOnly?(stat.wholeClassDescription||stat.description):stat.description));
    const actions=el('div','cs-settings-actions');actions.append(button('Edit Class Name & Emoji',()=>{settings.close();editClass(c.id);},'cs-button','edit'),button('Delete Class',()=>{if(!confirm(`Delete ${c.name}, its roster, and all saved PBIS history?`))return;const result=commit(classes=>{const i=classes.findIndex(t=>t.id===c.id);if(i>=0)classes.splice(i,1);});if(result!==true){error.textContent=result;return;}settings.close();openClass('');},'cs-button cs-danger'));
    body.append(statOptions,error,actions);settings.append(body);settings.showModal();
  }
  function resetStat(stat,c,name){
    if(!confirm(`Reset ${stat.label} for ${name||c.name}? This cannot be undone.`))return;
    const result=updateClass(target=>{const key=starChartStudentKey(name),whole=!name;if(stat.id==='stars'){if(whole)target.starChart.wholeClassStars=0;else target.starChart.studentStars[key]=0;}else if(stat.id==='punchcardPoints'){if(whole)target.punchcards.wholeClassPoints=0;else target.punchcards.studentPoints[key]=0;}else if(stat.id==='eggPoints'||stat.id==='flowerPoints')target[stat.id==='eggPoints'?'eggHatching':'flowerPots'].studentPoints[key]=0;else if(stat.id==='raceWins')target.racer.studentWins[key]=0;else if(stat.id==='meterWins')target.classMeter.wins=0;else if(stat.id==='jarsFilled')target.collectionJar.jarsFilled=0;});
    if(result!==true)notify(result);else renderDetail();
  }
  function renderDetail(animate=false){
    if(!detail.open||!activeStudent)return;
    const c=current(),name=activeStudent.name;
    if(!c||(name&&!c.students.includes(name))){detail.close();return;}
    const focusKey=detail.contains(document.activeElement)?document.activeElement.dataset.detailFocus:null;
    const scroll=detail.scrollTop;
    modalHeader(detail,name?'Student Profile':'Whole-Class Rewards');
    const layout=el('div','cs-profile-layout'),hero=el('aside','cs-detail-hero');
    hero.append(avatar(c,name,true),el('h3','',name||c.name),el('p','cs-muted',name?c.name:'Whole class'));
    if(name){const edit=button('Edit Student',()=>editStudent(name),'cs-button cs-detail-edit','edit');edit.dataset.detailFocus='edit';hero.append(edit);}
    const body=el('section','cs-profile-body'+(animate?' is-entering':''));
    const view=activeStudent.view||'home';
    function navigate(next){activeStudent.view=next;renderDetail(true);detail.querySelector('.cs-profile-title')?.focus({preventScroll:true});}
    const title=el('h3','cs-profile-title',view==='pbis'?'PBIS Rewards':view==='extras'?'Extras':'Student Profile');title.tabIndex=-1;
    if(name&&view!=='home'){const back=button('Student Profile',()=>navigate('home'),'cs-button cs-profile-back','back');back.dataset.detailFocus='back';body.append(back);}
    body.append(title);
    function sectionButton(label,symbol,action,status=''){
      const b=button('',action,'cs-profile-section',symbol),copy=el('span','cs-section-copy');
      b.lastElementChild.remove();copy.append(el('strong','',label));if(status)copy.append(el('small','cs-section-status',status));b.append(copy);
      b.dataset.detailFocus=symbol;b.disabled=!action;return b;
    }
    if(view==='home'){
      const sections=el('div','cs-profile-sections');
      sections.append(sectionButton('PBIS','pbis',c.pbisEnabled?()=>navigate('pbis'):null,c.pbisEnabled?'View rewards':'Off in Class Settings'),sectionButton('Assessments','assessment',null,'Coming soon'),sectionButton('ClassConnect','connect',null,'Coming soon'),sectionButton('Extras','extras',()=>navigate('extras')));
      body.append(sections);
    }else if(view==='extras'){
      const sections=el('div','cs-profile-sections');sections.append(sectionButton('Student Pets','pet',null,'Coming soon'));body.append(sections);
    }else if(c.pbisEnabled){
      const stats=el('div','cs-detail-stats');stats.setAttribute('aria-label','PBIS rewards');
      for(const [index,stat] of statsFor(c,!name).entries()){
        const row=el('article','cs-stat'),count=statValue(stat,c,name),label=el('h4','',stat.label),value=el('strong','cs-stat-value',String(count));
        row.style.setProperty('--stat-hue',[38,265,150,205,340,22,180][index%7]);
        row.setAttribute('aria-label',stat.label);value.setAttribute('aria-live','polite');
        const symbol=el('span','cs-stat-icon',stat.icon);symbol.setAttribute('aria-hidden','true');
        const reset=button('Reset',()=>resetStat(stat,c,name),'cs-button');reset.disabled=!count;reset.setAttribute('aria-label',`Reset ${stat.label}`);reset.dataset.detailFocus='reset-'+stat.id;
        row.append(symbol,value,label,el('p','cs-stat-description',name?stat.description:stat.wholeClassDescription||stat.description),reset);stats.append(row);
      }
      if(!stats.children.length)stats.append(el('p','cs-muted','No reward types selected in Class Settings.'));
      body.append(stats);
    }else body.append(el('p','cs-muted','PBIS is turned off in Class Settings. Your saved progress is kept.'));
    layout.append(hero,body);detail.append(layout);detail.scrollTop=scroll;
    if(focusKey&&!animate)Array.from(detail.querySelectorAll('[data-detail-focus]')).find(b=>b.dataset.detailFocus===focusKey)?.focus({preventScroll:true});
  }
  function showDetail(name){activeStudent={name,view:name?'home':'pbis'};detail.showModal();renderDetail();detail.scrollTop=0;detail.querySelector('.cs-close')?.focus();}
  search.addEventListener('input',render);
  opener.addEventListener('click',()=>{document.querySelector('[data-profile-close]')?.click();scope=window.TeacherTilesClassScope||'local';activeClass='';search.value='';render();panel.showModal();opener.setAttribute('aria-expanded','true');document.body.classList.add('classes-tool-open');});
  panel.addEventListener('close',()=>{for(const d of [editor,settings,detail])if(d.open)d.close();flushPbisCloudSave();document.body.classList.remove('classes-tool-open');opener.setAttribute('aria-expanded','false');document.getElementById('profile-toggle')?.focus({preventScroll:true});});
  panel.addEventListener('cancel',e=>{e.preventDefault();if(activeClass)openClass('');else panel.close();});
  for(const d of [panel,editor,settings,detail])d.addEventListener('keydown',e=>e.stopPropagation());
  for(const d of [editor,settings,detail])d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();});
  editor.addEventListener('close',()=>photoTask++);detail.addEventListener('close',()=>activeStudent=null);
  function refresh(){if(!panel.open)return;const next=window.TeacherTilesClassScope||'local';if(scope!==next){scope=next;activeClass='';for(const d of [editor,settings,detail])if(d.open)d.close();saveStatus.textContent='Saved on this device';}render();if(!editor.open)renderDetail();}
  for(const event of ['teachertiles:classeschange','teachertiles:starchartchange','teachertiles:classmeterchange','teachertiles:collectionchange','teachertiles:punchcardchange','teachertiles:racerchange'])window.addEventListener(event,refresh);
  window.addEventListener('teachertiles:classsavestatus',event=>{if(event.detail?.scope!==scope)return;saveStatus.textContent=({saving:'Saving…',saved:'Saved',error:'Saved on this device · sync pending'})[event.detail.status]||'';});
}
