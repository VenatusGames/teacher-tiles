(()=>{'use strict';
const units={weeks:604800000,days:86400000,hours:3600000,minutes:60000,seconds:1000};
function normalize(s={}){return {event:String(s.event||'').slice(0,120),target:Number.isFinite(Date.parse(s.target))?new Date(s.target).toISOString():'',unit:Object.hasOwn(units,s.unit)?s.unit:'days'}}
function remaining(target,unit,now=Date.now()){return Math.ceil(Math.max(0,Date.parse(target)-now)/units[unit])||0}
function render(m,state){
 const s=normalize(state),ready=!!s.target,amount=remaining(s.target,s.unit);
 m.querySelector('.countdown-event').textContent=s.event||'Your Event';
 const number=m.querySelector('.countdown-number'),value=ready?amount.toLocaleString():'—';
 if(number.textContent!==value)number.textContent=value;
 number.style.fontSize=`clamp(18px,${Math.min(22,145/value.length)}cqw,74px)`;
 m.querySelector('.countdown-unit').textContent=ready&&amount===0?"It's time!":(amount===1?s.unit.slice(0,-1):s.unit)+' remaining';
 m.querySelector('.countdown-date').textContent=ready?new Date(s.target).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'Choose a date and time';
 m.querySelector('.countdown-metric').textContent=s.unit[0].toUpperCase()+s.unit.slice(1)+' ↻';
}
function setup(m){
 let state=normalize(),timer=0,visible=true,disposed=false;
 const form=m.querySelector('.countdown-form'),name=form.elements.event,date=form.elements.target,edit=m.querySelector('.countdown-edit'),metric=m.querySelector('.countdown-metric');
 function localDate(iso){if(!iso)return '';const d=new Date(iso);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
 function tick(){clearTimeout(timer);render(m,state);if(!disposed&&visible&&!document.hidden&&state.target&&Date.parse(state.target)>Date.now())timer=setTimeout(tick,state.unit==='seconds'?1000:Math.min(60000,Math.max(1000,(Date.parse(state.target)-Date.now())%units[state.unit]+20)))}
 function editing(open){form.hidden=!open;m.classList.toggle('is-editing',open);edit.setAttribute('aria-expanded',String(open));if(open){name.value=state.event;date.value=localDate(state.target);name.focus({preventScroll:true})}}
 edit.addEventListener('click',()=>editing(form.hidden));
 form.querySelector('.countdown-cancel').addEventListener('click',()=>editing(false));
 form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;const target=new Date(date.value);if(!Number.isFinite(target.getTime()))return;state=normalize({event:name.value.trim(),target:target.toISOString(),unit:state.unit});editing(false);tick();notifyBoardChanged('countdown-event')});
 metric.addEventListener('click',()=>{const keys=Object.keys(units);state.unit=keys[(keys.indexOf(state.unit)+1)%keys.length];tick();notifyBoardChanged('countdown-unit')});
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;tick()});observer.observe(m);
 document.addEventListener('visibilitychange',tick);
 m._boardGetState=()=>({...state});m._boardSetState=s=>{state=normalize(s);editing(!state.target);tick()};
 const cleanup=m._cleanup;m._cleanup=()=>{disposed=true;clearTimeout(timer);observer.disconnect();document.removeEventListener('visibilitychange',tick);cleanup?.()};
 editing(true);tick();
}
window.TeacherTilesCountdown=Object.freeze({setup,render,remaining});})();
