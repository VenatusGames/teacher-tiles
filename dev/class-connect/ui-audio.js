// The standalone student page uses the board's click sound and stored audio preferences.
const pop=new Audio(new URL('../assets/ui/pop.mp3',import.meta.url).href);pop.preload='auto';
const voices=[pop];let next=0;
function volume(){
  let saved;try{saved=JSON.parse(localStorage.getItem('teachertiles-app-preferences-v1')||'null');}catch{}
  if(!saved||typeof saved!=='object'){saved={};try{saved.uiMuted=localStorage.getItem('teachertiles-ui-sfx-muted')==='true';}catch{}}
  const level=value=>Number.isFinite(Number(value))?Math.max(0,Math.min(100,Number(value)))/100:1;
  return saved.uiMuted?0:.11*level(saved.masterVolume)*level(saved.uiVolume);
}
document.addEventListener('click',event=>{
  if(!event.isTrusted||!(event.target instanceof Element))return;
  const control=event.target.closest('button,[role="button"],input[type="checkbox"],input[type="radio"],select');
  if(!control||control.disabled||control.getAttribute('aria-disabled')==='true')return;
  const gain=volume();if(gain<=0)return;
  try{
    let sound=voices.find(audio=>audio.paused||audio.ended);
    if(!sound&&voices.length<4){sound=pop.cloneNode();voices.push(sound);}
    if(!sound){sound=voices[next++%voices.length];sound.pause();}
    sound.volume=gain;sound.playbackRate=1.35;sound.currentTime=0;sound.play().catch(()=>{});
  }catch{}
},true);
