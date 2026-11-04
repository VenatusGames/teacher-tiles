import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js';
import {firebaseConfig} from '../firebase-config.js';
const read=httpsCallable(getFunctions(initializeApp(firebaseConfig)),'classConnectView',{timeout:15000});
const main=document.getElementById('cc-view'),refresh=document.getElementById('cc-refresh');
const make=(tag,cls='',text='')=>{const node=document.createElement(tag);node.className=cls;node.textContent=text;return node;};
let busy=false,lastAttempt=0,version=0;
function avatar(cls,item) {
  const node=make('div',cls);
  if(item.image){const image=make('img');image.src=item.image;image.alt='';image.decoding='async';node.append(image);}
  else node.textContent=item.emoji || item.initials || '👥';
  return node;
}
function render(view) {
  const banner=make('section','cc-student-banner'),identity=make('div');
  identity.append(make('span','cc-student-eyebrow','YOUR CLASS'),make('h1','',view.name),make('p','',`${view.students.length} student${view.students.length===1?'':'s'}${view.gradeLevel?` · ${/^\d+$/.test(view.gradeLevel)?`Grade ${view.gradeLevel}`:view.gradeLevel}`:''}`));
  banner.append(avatar('cc-class-avatar',view),identity);
  const grid=make('div','cc-student-grid');grid.setAttribute('aria-label','Students');
  for(const [index,student] of view.students.entries()) {
    const card=make('article','cc-student-card'),picture=avatar(`cc-student-avatar${student.emoji?' has-emoji':''}`,student);
    picture.style.setProperty('--hue',String(student.hue));card.style.animationDelay=`${Math.min(index*15,180)}ms`;
    card.append(picture,make('h2','',student.name));grid.append(card);
  }
  if(!view.students.length)grid.append(make('p','','Your teacher hasn’t added students yet.'));
  main.replaceChildren(banner,grid,make('p','cc-student-footer','ClassConnect · A shared view of your class'));
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
    const unavailable=error.code==='functions/not-found',panel=make('section','cc-student-status');
    panel.append(make('h1','',unavailable?'This class link is unavailable':'We couldn’t open your class'),make('p','',unavailable?'Your teacher may have disabled or replaced the link. Ask them for the current student link.':'Check your internet connection and try again.'));
    const retry=make('button','','Try Again');retry.type='button';retry.addEventListener('click',load);panel.append(retry);main.replaceChildren(panel);
  } finally{if(ticket===version){busy=false;refresh.disabled=false;main.removeAttribute('aria-busy');}}
}
refresh.addEventListener('click',load);
window.addEventListener('hashchange',()=>{version++;busy=false;load();});
// Revalidate when returning to an old tab; no timers, background polling, or student writes.
document.addEventListener('visibilitychange',()=>{if(!document.hidden && Date.now()-lastAttempt>60000)load();});
load();
