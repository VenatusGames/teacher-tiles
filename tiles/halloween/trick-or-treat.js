(() => {
 'use strict';
 const palette=['#a83c36','#438c79','#d58a3c','#658da4','#986aab','#c98299','#997048','#538cb3'];
 const candyColors=['#e95a83','#8f6ddd','#48b7ad','#f1b941','#ed784b','#64a5df'];
 const pickOther=(length,last)=>{if(last<0)return Math.floor(Math.random()*length);const n=Math.floor(Math.random()*(length-1));return n>=last?n+1:n};
 const wrap=body=>`<svg viewBox="0 0 160 160" aria-hidden="true">${body}</svg>`;
 function prizeArt(kind,color){
  if(kind==='candy')return wrap(`<g transform="rotate(-18 80 80)" stroke="#562b4b" stroke-opacity=".2" stroke-width="2"><path fill="${color}" d="M53 65 20 49 27 80 20 111 53 95ZM107 65 140 49 133 80 140 111 107 95Z"/><path d="m28 61 23 13m-24 26 24-13m81-26-23 13m24 26-24-13" fill="none" stroke="#fff" stroke-opacity=".5"/><rect x="45" y="48" width="70" height="64" rx="23" fill="${color}"/><path d="m64 50-12 51m34-52-15 61m37-52-14 51" stroke="#fff" stroke-opacity=".55" stroke-width="12"/><path d="M59 58q19-8 38 0" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="5" stroke-linecap="round"/></g>`);
  if(kind==='spider')return wrap('<g fill="none" stroke="#43324f" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M64 72 41 46 23 52M61 82 31 69 17 81M61 93 31 98 23 117M66 103 48 126 50 141M96 72 119 46 137 52M99 82 129 69 143 81M99 93 129 98 137 117M94 103 112 126 110 141"/></g><ellipse cx="80" cy="85" rx="32" ry="37" fill="#6b458a"/><ellipse cx="80" cy="102" rx="25" ry="20" fill="#473050"/><circle cx="69" cy="75" r="11" fill="#fff"/><circle cx="91" cy="75" r="11" fill="#fff"/><circle cx="72" cy="77" r="6" fill="#282333"/><circle cx="88" cy="77" r="6" fill="#282333"/><path d="M75 95q5 5 10 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>');
  if(kind==='sock')return wrap('<path d="M65 25h54v68q1 21-18 31l-35 18q-21 10-33-8t9-32l23-16Z" fill="#9c86bf" stroke="#62517e" stroke-width="3"/><path d="M65 25h54v20H65Z" fill="#e8d5a3"/><path d="M73 29v12m12-12v12m12-12v12m12-12v12" stroke="#bda97e" stroke-width="2"/><path d="M42 102q19 7 24 40-21 10-33-8t9-32M99 91h20q1 21-18 31L86 112Z" fill="#e8d5a3"/><path d="m70 61 42 0m-42 12h42" stroke="#eee5f3" stroke-width="6"/>');
  return wrap('<path d="M79 24q-6 36-17 52-12 19-37 30l20 13q37-12 42-40" fill="#f2c745" stroke="#ba8b31" stroke-width="3"/><path d="M86 28q-3 30 4 48 12 22 42 22l-7 23q-33-6-47-33" fill="#ffdf68" stroke="#ba8b31" stroke-width="3"/><path d="M80 65q-8 22-11 48l18 29 15-12q-9-38-16-65" fill="#ffe793" stroke="#ba8b31" stroke-width="3"/><path d="m79 24 9 2-3 13-9-2Z" fill="#66533a"/><path d="M80 83 84 120M58 92 43 103M100 89l16 12" stroke="#fff2b4" stroke-width="5" fill="none" stroke-linecap="round"/>');
 }
 function drawDoor(m,variant){
  m.style.setProperty('--door-color',palette[variant%palette.length]);
  m.dataset.doorStyle=String(variant%4);
  const bell=variant%4>=2;m.dataset.doorHardware=bell?'bell':'knocker';
  const door=m.querySelector('.trick-door');door.setAttribute('aria-label',bell?'Ring the doorbell':'Knock on the door');
  if(!door.querySelector('.trick-doorbell')){const button=document.createElement('span');button.className='trick-doorbell';button.setAttribute('aria-hidden','true');button.innerHTML='<i></i>';door.append(button);}
  const panels=m.querySelector('.trick-door-panels');panels.replaceChildren();
  for(let i=0;i<(variant%4===0?6:variant%4===1?4:2);i++)panels.append(document.createElement('i'));
 }
 function setup(m){
  const door=m.querySelector('.trick-door'),result=m.querySelector('.trick-result'),title=m.querySelector('.trick-result-title'),prize=m.querySelector('.trick-prize'),again=m.querySelector('.trick-again');
  let variant=Math.floor(Math.random()*palette.length),lastKnock=-1,phase='ready',reward=null,disposed=false,timeout=0;
  const sounds=new Set();
  const stopSounds=()=>{for(const sound of sounds){sound.onended=null;sound.pause();sound.removeAttribute('src');sound.load();}sounds.clear();};
  function play(name){
   const level=Number(window.TeacherTilesTileAudio?.level?.(m)??1);
   if(level<=0)return null;
   const sound=new Audio(`tiles/halloween/assets/${name}.mp3`);sound.volume=Math.min(1,.65*level);sounds.add(sound);sound.onended=()=>sounds.delete(sound);sound._started=sound.play();sound._started.catch(()=>{});return sound;
  }
  function paint(){
   drawDoor(m,variant);m.dataset.trickPhase=phase;door.disabled=phase!=='ready';result.hidden=phase!=='result';
   if(reward){title.textContent=reward.kind==='candy'?'Treat! You win!':'Trick! Try again!';prize.innerHTML=prizeArt(reward.kind,reward.color);result.dataset.outcome=reward.kind==='candy'?'treat':'trick';}
  }
  function reveal(){
   if(disposed||phase!=='knocking'||!TeacherTilesHalloween.hasAccess())return;clearTimeout(timeout);
   const kind=Math.random()<.5?'candy':['spider','sock','banana'][Math.floor(Math.random()*3)];
   reward={kind,color:candyColors[Math.floor(Math.random()*candyColors.length)]};phase='opening';paint();
   timeout=setTimeout(()=>{if(disposed||!TeacherTilesHalloween.hasAccess())return;phase='result';paint();play(kind==='candy'?'win':'lose');again.focus({preventScroll:true});notifyBoardChanged('trick-or-treat');},420);
  }
  door.onclick=()=>{
   if(phase!=='ready'||!TeacherTilesHalloween.hasAccess())return;
   stopSounds();const firstSound=variant%4>=2?2:0;lastKnock=firstSound+pickOther(2,lastKnock>=firstSound&&lastKnock<firstSound+2?lastKnock-firstSound:-1);phase='knocking';reward=null;paint();
   const knock=play('knock'+(lastKnock+1));
   timeout=setTimeout(reveal,3500);
   if(knock){knock.onended=()=>{sounds.delete(knock);reveal()};knock.onerror=()=>{clearTimeout(timeout);timeout=setTimeout(reveal,900)};knock._started.catch(()=>{clearTimeout(timeout);timeout=setTimeout(reveal,900)});}else{clearTimeout(timeout);timeout=setTimeout(reveal,900)}
  };
  again.onclick=()=>{clearTimeout(timeout);stopSounds();variant=pickOther(palette.length,variant);phase='ready';reward=null;paint();door.focus({preventScroll:true});notifyBoardChanged('trick-or-treat-reset');};
  const syncAudio=()=>{const level=Number(window.TeacherTilesTileAudio?.level?.(m)??1);for(const sound of sounds){sound.volume=Math.min(1,.65*level);if(level<=0)sound.muted=true;else sound.muted=false;}};
  m.addEventListener('teachertiles:tileaudiochange',syncAudio);window.addEventListener('teachertiles:audiopreferenceschange',syncAudio);
  m._boardGetState=()=>({variant,lastKnock,reward:phase==='result'?reward:null});
  m._boardSetState=s=>{clearTimeout(timeout);stopSounds();variant=Number.isInteger(s?.variant)&&s.variant>=0&&s.variant<palette.length?s.variant:0;lastKnock=Number.isInteger(s?.lastKnock)&&s.lastKnock>=0&&s.lastKnock<4?s.lastKnock:-1;reward=['candy','spider','sock','banana'].includes(s?.reward?.kind)?{kind:s.reward.kind,color:candyColors.includes(s.reward.color)?s.reward.color:candyColors[0]}:null;phase=reward?'result':'ready';paint()};
  const deactivate=m._deactivate,cleanup=m._cleanup;
  m._deactivate=()=>{clearTimeout(timeout);stopSounds();if(phase!=='result'){phase='ready';paint();}deactivate?.()};
  m._cleanup=()=>{disposed=true;clearTimeout(timeout);stopSounds();m.removeEventListener('teachertiles:tileaudiochange',syncAudio);window.removeEventListener('teachertiles:audiopreferenceschange',syncAudio);cleanup?.()};paint();
 }
 function preview(m,state){drawDoor(m,Number.isInteger(state?.variant)?Math.max(0,Math.min(7,state.variant)):0);}
 window.TeacherTilesTrickOrTreat={setup,preview};
})();
