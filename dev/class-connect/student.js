import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js';
import {firebaseConfig} from '../firebase-config.js';
import {REWARDS,EMOJIS} from './profile-catalog.js?v=20261103-student-profiles';
const functions=getFunctions(initializeApp(firebaseConfig)),read=httpsCallable(functions,'classConnectView',{timeout:15000}),saveEmoji=httpsCallable(functions,'classConnectStudent',{timeout:15000});
const main=document.getElementById('cc-view'),refresh=document.getElementById('cc-refresh');
const make=(tag,cls='',text='')=>{const node=document.createElement(tag);node.className=cls;node.textContent=text;return node;};
let busy=false,lastAttempt=0,version=0,roster=null,activeId='',section='home',selected='',saving=false,profileVersion=0;
const profile=make('dialog','cs-modal cs-detail cc-student-profile');profile.setAttribute('aria-label','Student Profile');document.body.append(profile);
let entranceAnimations=[],entranceLayer=null;
function clearEntrance(){entranceAnimations.forEach(animation=>animation.cancel());entranceAnimations=[];entranceLayer?.remove();entranceLayer=null;}
const token=()=>location.hash.slice(1),selectionKey=()=>`tt:classconnect:selected:${token()}`;
function readSelection(){try{selected=sessionStorage.getItem(selectionKey()) || '';}catch{selected='';}}
readSelection();
const shapes={close:'<path d="m6 6 12 12M18 6 6 18"/>',back:'<path d="m14 6-6 6 6 6"/>',pbis:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',assessment:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9zM9 11h6M9 15h4"/>',connect:'<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M2 21v-3a6 6 0 0 1 12 0v3m2-7a5 5 0 0 1 6 5v2"/>',extras:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><path d="M14 17.5h7m-3.5-3.5v7"/>'};
function symbol(name){const span=make('span','cs-icon');span.setAttribute('aria-hidden','true');span.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${shapes[name]}</svg>`;return span;}
function button(label,action,cls='cs-button',icon='') {const b=make('button',cls);b.type='button';if(icon)b.append(symbol(icon));b.append(make('span','',label));if(action)b.addEventListener('click',action);return b;}
function navigate(next){section=next;renderProfile();profile.scrollTop=0;profile.querySelector(next==='home'?'.cc-greeting':'.cs-profile-title')?.focus({preventScroll:true});}
function renderProfile() {
  const student=roster?.students.find(item=>item.id===activeId);if(!student){profile.close();return;}
  clearEntrance();const ticket=++profileVersion;profile.replaceChildren();
  const head=make('header','cs-modal-header');
  const back=button('',()=>section==='home'?profile.close():navigate('home'),'cs-button cc-icon-button','back');back.setAttribute('aria-label',section==='home'?'Back to Class':'Back to Student Profile');head.append(back);
  head.append(make('h2','',section==='pbis'?'PBIS Rewards':section==='emoji'?'Choose an Emoji':'Student Profile'));
  const close=button('',()=>profile.close(),'cs-button cc-icon-button','close');close.setAttribute('aria-label','Close Student Profile');head.append(close);
  const layout=make('div','cs-profile-layout'),hero=make('aside','cs-detail-hero'),picture=avatar(`cc-student-avatar${student.emoji?' has-emoji':''}`,student);picture.style.setProperty('--hue',String(student.hue));
  hero.append(picture);
  const own=selected===student.id;
  const body=make('section','cs-profile-body is-entering'),greeting=make('h1','cc-greeting',`Hi, ${student.name}!`),title=make('h3','cs-profile-title',section==='pbis'?'Your Rewards':section==='emoji'?'Choose your emoji':'Student Profile');greeting.tabIndex=-1;title.tabIndex=-1;title.hidden=section==='home';body.append(greeting,title);
  const sectionButton=(label,icon,action,hint)=>{const b=button('',action,'cs-profile-section',icon);b.lastElementChild.remove();const text=make('span','cs-section-copy');text.append(make('strong','',label),make('small','cs-section-status',hint));b.append(text);b.disabled=!action;return b;};
  if(section==='home') {
    const choices=make('div','cs-profile-sections');choices.append(sectionButton('PBIS','pbis',roster.pbisEnabled?()=>navigate('pbis'):null,roster.pbisEnabled?'View rewards':'Off in Class Settings'),sectionButton('Assessments','assessment',null,'Coming soon'),sectionButton('ClassConnect','connect',null,'Coming soon'),sectionButton('Extras','extras',()=>navigate('extras'),'Explore more'));body.append(choices);
    const actions=make('div','cc-profile-actions');
    if(own&&roster.allowStudentEmojiEditing)actions.append(button('Change Emoji',()=>navigate('emoji'),'cs-button'));
    const enter=button('Enter Board',null,'cs-button cc-enter-board');enter.disabled=true;enter.title=roster.studentBoards?'Coming soon':'Student Boards are turned off';actions.append(enter);body.append(actions);
  }else if(section==='pbis') {
    title.textContent='PBIS Rewards';
    const stats=make('div','cs-detail-stats');
    if(roster.pbisEnabled)for(const [index,stat]of REWARDS.entries())if(Object.hasOwn(student.rewards || {},stat.id)){
      const row=make('article','cs-stat');row.style.setProperty('--stat-hue',[38,150,265,205,340][index]);row.setAttribute('aria-label',stat.label);
      const icon=make('span','cs-stat-icon');icon.setAttribute('aria-hidden','true');icon.innerHTML=stat.svg;
      row.append(icon,make('strong','cs-stat-value',String(student.rewards[stat.id])),make('h4','',stat.label));stats.append(row);
    }
    if(!stats.children.length)stats.append(make('p','cc-profile-hint',roster.pbisEnabled?'No rewards have been enabled by your teacher.':'PBIS is turned off for this class.'));body.append(stats);
  }else if(section==='extras'){
    title.textContent='Extras';const choices=make('div','cs-profile-sections');for(const label of ['Student Pets','Profile Borders','Podium Effects'])choices.append(sectionButton(label,'extras',null,'Coming soon'));body.append(choices);
  }else if(section==='emoji') {
    if(!own || !roster.allowStudentEmojiEditing){body.append(make('p','cc-profile-hint','Your teacher has turned off student emoji editing.'));}
    else {
      const choices=make('div','cc-emoji-options'),status=make('p','cc-emoji-status');status.setAttribute('role','status');
      for(const emoji of EMOJIS){const choice=button(emoji,async()=>{
        if(saving)return;saving=true;const link=token();choices.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent='Saving emoji…';
        try {
          const {data}=await saveEmoji({token:link,studentId:student.id,emoji});
          if(link!==token())return;
          const target=roster?.students.find(item=>item.id===data.studentId);
          if(target && target.avatarVersion===student.avatarVersion){target.emoji=data.emoji;target.image='';if(ticket===profileVersion)section='home';render(roster);}
        }catch(error){
          if(ticket!==profileVersion)return;
          if(error.code==='functions/permission-denied'){roster.allowStudentEmojiEditing=false;renderProfile();}
          else if(error.code==='functions/not-found'){profile.close();await load();}
          else status.textContent=error.message || 'Could not save your emoji. Try again.';
        }finally{saving=false;profile.querySelectorAll('.cc-emoji-choice').forEach(b=>b.disabled=false);}
      },'cc-emoji-choice');choice.disabled=saving;choice.setAttribute('aria-label',`Use ${emoji}`);choice.setAttribute('aria-pressed',String(student.emoji===emoji));choices.append(choice);}
      body.append(choices,status);
    }
  }
  layout.append(hero,body);profile.append(head,layout);
}
profile.addEventListener('close',()=>{clearEntrance();document.body.classList.remove('cc-profile-open');profileVersion++;activeId='';section='home';});
function openStudent(student,card){
  if(profile.open)return;
  const origin=card.querySelector('.cc-student-avatar').getBoundingClientRect();
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const others=reduce?[]:[...main.querySelectorAll('.cc-student-card')].filter(item=>item!==card).map(item=>({node:item.cloneNode(true),rect:item.getBoundingClientRect()}));
  selected=activeId=student.id;section='home';try{sessionStorage.setItem(selectionKey(),selected);}catch{}
  main.querySelectorAll('.cc-student-card').forEach(item=>item.classList.toggle('is-me',item===card));
  profile.showModal();renderProfile();profile.scrollTop=0;document.body.classList.add('cc-profile-open');
  if(reduce)return;
  const picture=profile.querySelector('.cc-student-avatar'),destination=picture.getBoundingClientRect();
  const animate=(node,frames,options)=>{const animation=node.animate(frames,options);entranceAnimations.push(animation);return animation;};
  entranceLayer=make('div','cc-departing-students');entranceLayer.setAttribute('aria-hidden','true');entranceLayer.inert=true;profile.append(entranceLayer);
  others.forEach(({node,rect},index)=>{
    if(rect.bottom<0||rect.top>innerHeight)return;
    Object.assign(node.style,{position:'absolute',left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,margin:'0',animation:'none'});entranceLayer.append(node);
    animate(node,[{opacity:1,transform:'translateY(0) rotate(0)'},{opacity:0,transform:`translateY(100px) rotate(${index%2?8:-8}deg)`}],{duration:360,delay:Math.min(index*15,100),easing:'cubic-bezier(.4,0,.8,.3)',fill:'both'});
  });
  animate(picture,[{transformOrigin:'top left',transform:`translate(${origin.left-destination.left}px,${origin.top-destination.top}px) scale(${origin.width/destination.width},${origin.height/destination.height})`},{transformOrigin:'top left',transform:'none'}],{duration:650,easing:'cubic-bezier(.22,1,.36,1)'});
  animate(profile.querySelector('.cs-profile-body'),[{opacity:0,transform:'translateY(20px)'},{opacity:1,transform:'none'}],{duration:380,delay:260,easing:'ease-out',fill:'both'});
  Promise.all(entranceAnimations.map(animation=>animation.finished)).then(clearEntrance).catch(()=>{});
}

profile.addEventListener('click',event=>{if(event.target!==profile)return;const bounds=profile.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)profile.close();});
function avatar(cls,item) {
  const node=make('div',cls);
  if(item.image){const image=make('img');image.src=item.image;image.alt='';image.decoding='async';node.append(image);}
  else node.textContent=item.emoji || item.initials || '👥';
  return node;
}
function render(view) {
  roster=view;if(!roster.students.some(student=>student.id===selected))selected='';
  const grid=make('div','cc-student-grid');grid.setAttribute('aria-label','Students');
  for(const [index,student] of view.students.entries()) {
    const card=button('',()=>openStudent(student,card),'cc-student-card'),picture=avatar(`cc-student-avatar${student.emoji?' has-emoji':''}`,student);
    picture.style.setProperty('--hue',String(student.hue));card.style.animationDelay=`${Math.min(index*15,180)}ms`;
    card.replaceChildren(picture,make('span','cc-student-name',student.name));card.setAttribute('aria-label',`Open ${student.name}`);if(selected===student.id)card.classList.add('is-me');grid.append(card);
  }
  if(!view.students.length)grid.append(make('p','','Your teacher hasn’t added students yet.'));
  main.replaceChildren(grid);if(profile.open)renderProfile();
}
async function load() {
  if(busy)return;busy=true;lastAttempt=Date.now();const ticket=++version;
  refresh.disabled=true;main.setAttribute('aria-busy','true');
  const status=make('section','cc-student-status');status.append(make('p','cc-loading','Opening your class…'));main.replaceChildren(status);
  try {
    const token=location.hash.slice(1);
    if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw Object.assign(new Error(),{code:'functions/not-found'});
    const {data}=await read({token});if(ticket===version)render(data.view);
  } catch(error) {
    if(ticket!==version)return;
    profile.close();roster=null;
    const unavailable=error.code==='functions/not-found',panel=make('section','cc-student-status');
    panel.append(make('h1','',unavailable?'This class link is unavailable':'We couldn’t open your class'),make('p','',unavailable?'Your teacher may have disabled or replaced the link. Ask them for the current student link.':'Check your internet connection and try again.'));
    const retry=make('button','','Try Again');retry.type='button';retry.addEventListener('click',load);panel.append(retry);main.replaceChildren(panel);
  } finally{if(ticket===version){busy=false;refresh.disabled=false;main.removeAttribute('aria-busy');}}
}
refresh.addEventListener('click',load);
window.addEventListener('hashchange',()=>{version++;busy=false;profile.close();readSelection();load();});
// Revalidate when returning to an old tab, without timers or background polling.
document.addEventListener('visibilitychange',()=>{if(!document.hidden && Date.now()-lastAttempt>60000)load();});
load();
