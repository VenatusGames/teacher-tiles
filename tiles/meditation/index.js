(() => {
  'use strict';
  function setup(m) {
    const scene=m.querySelector('.meditation-scene');
    const cue=m.querySelector('.meditation-cue');
    const count=m.querySelector('.meditation-count');
    const showCues=m.querySelector('.meditation-show-cues');
    const toggle=m.querySelector('.meditation-toggle');
    const reset=m.querySelector('.meditation-reset');
    const inhaleInput=m.querySelector('.meditation-inhale');
    const exhaleInput=m.querySelector('.meditation-exhale');
    const durationInput=m.querySelector('.meditation-duration');
    const remaining=m.querySelector('.meditation-remaining');
    const paletteButton=m.querySelector('.meditation-palette-toggle'),drawer=m.querySelector('.meditation-palette-drawer');
    const palettes={lagoon:['Lagoon','#d4fff0','#55c9ba','#087f8c'],ocean:['Ocean','#d6f2ff','#66bdec','#305db6'],dusk:['Dusk','#f1e2ff','#bd9be8','#7852b5'],sunrise:['Sunrise','#fff0ce','#efac86','#be665b']};
    let palette='lagoon',drawerFrame=0;
    const setPalette=value=>{
      palette=palettes[value]?value:'lagoon';m.dataset.medPalette=palette;
      drawer.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.palette===palette)));
    };
    const closeDrawer=()=>{cancelAnimationFrame(drawerFrame);if(drawer.matches(':popover-open'))drawer.hidePopover();paletteButton.setAttribute('aria-expanded','false');m.classList.remove('has-meditation-palette-open');};
    const positionDrawer=()=>{
      if(!m.isConnected){closeDrawer();return;}
      const r=paletteButton.getBoundingClientRect();
      drawer.style.left=Math.max(8,Math.min(r.left,innerWidth-drawer.offsetWidth-8))+'px';
      drawer.style.top=Math.max(8,Math.min(r.top-drawer.offsetHeight-8,innerHeight-drawer.offsetHeight-8))+'px';
      drawerFrame=requestAnimationFrame(positionDrawer);
    };
    const heading=document.createElement('strong');heading.textContent='Breathing colors';drawer.append(heading);
    for(const [key,[name,light,mid,deep]] of Object.entries(palettes)){
      const button=document.createElement('button');button.type='button';button.dataset.palette=key;
      const swatch=document.createElement('i');swatch.setAttribute('aria-hidden','true');swatch.style.background=`radial-gradient(circle at 30% 25%,${light},${mid} 55%,${deep})`;
      const label=document.createElement('span');label.textContent=name;button.append(swatch,label);
      button.addEventListener('click',()=>{setPalette(key);notifyBoardChanged('meditation-palette');closeDrawer();paletteButton.focus({preventScroll:true});});drawer.append(button);
    }
    paletteButton.addEventListener('click',()=>{if(drawer.matches(':popover-open')){closeDrawer();return;}drawer.showPopover();paletteButton.setAttribute('aria-expanded','true');m.classList.add('has-meditation-palette-open');positionDrawer();});
    const outsideDrawer=event=>{if(!drawer.contains(event.target)&&!paletteButton.contains(event.target))closeDrawer();};
    const escapeDrawer=event=>{if(event.key==='Escape'&&drawer.matches(':popover-open')){event.stopPropagation();closeDrawer();paletteButton.focus({preventScroll:true});}};
    document.addEventListener('pointerdown',outsideDrawer);document.addEventListener('keydown',escapeDrawer,true);
    drawer.addEventListener('pointerdown',event=>event.stopPropagation());drawer.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
    setPalette('lagoon');
    const resizeObserver=new ResizeObserver(()=>m.classList.toggle('meditation-compact',m.clientHeight<490||m.clientWidth<330));
    resizeObserver.observe(m);
    let inhaleSeconds=4,exhaleSeconds=6,durationSeconds=180;
    let running=false,disposed=false,elapsed=0,lastTime=0,raf=0,lastPhase='';
    const music=[new Audio('tiles/meditation/assets/ambient-meditation.mp3'),new Audio('tiles/meditation/assets/ambient-meditation.mp3')];
    music.forEach(audio=>{audio.preload='auto';audio.loop=true;audio.volume=0;});
    let deck=0,crossfadeStart=null;
    const play=audio=>{audio.play().catch(()=>{});};
    function syncMusic(){
      const level=window.TeacherTilesTileAudio?.level(m)??1;
      const envelope=Math.min(1,elapsed/1500,Math.max(0,durationSeconds*1000-elapsed)/2000);
      const blend=crossfadeStart===null?0:Math.min(1,(elapsed-crossfadeStart)/1500);
      music[deck].volume=.48*level*envelope*(1-blend);
      music[1-deck].volume=.48*level*envelope*blend;
    }
    function updateMusic(){
      const current=music[deck];
      if(crossfadeStart===null&&Number.isFinite(current.duration)&&current.duration>3&&current.duration-current.currentTime<=1.5){
        crossfadeStart=elapsed;music[1-deck].currentTime=0;play(music[1-deck]);
      }
      if(crossfadeStart!==null&&elapsed-crossfadeStart>=1500){current.pause();current.currentTime=0;deck=1-deck;crossfadeStart=null;}
      syncMusic();
    }
    const stopMusic=()=>music.forEach(audio=>audio.pause());
    const rewind=()=>{stopMusic();music.forEach(audio=>{audio.currentTime=0;});deck=0;crossfadeStart=null;};
    const format=seconds=>`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
    function render() {
      const cycle=(inhaleSeconds+exhaleSeconds)*1000,inhaleMs=inhaleSeconds*1000;
      const position=elapsed%cycle;
      const inhale=position<inhaleMs;
      const progress=inhale?position/inhaleMs:(position-inhaleMs)/(exhaleSeconds*1000);
      const ease=(1-Math.cos(Math.PI*progress))/2;
      const expansion=inhale?ease:1-ease;
      scene.style.setProperty('--breath-scale',String(.64+expansion*.36));
      scene.style.setProperty('--breath-glow',String(.24+expansion*.42));
      scene.style.setProperty('--breath-turn',`${elapsed/350}deg`);
      const complete=elapsed>=durationSeconds*1000;
      const phase=complete?'Well done':running?(inhale?'Breathe in':'Breathe out'):(elapsed?'Paused':'Find your calm');
      if(phase!==lastPhase){cue.textContent=phase;lastPhase=phase;}
      count.textContent=running?String(Math.max(1,Math.ceil((inhale?inhaleMs-position:cycle-position)/1000))):'✦';
      cue.hidden=!showCues.checked;
      toggle.textContent=complete?'Start again':running?'Pause':elapsed?'Resume':'Start breathing';
      remaining.textContent=format(Math.max(0,Math.ceil(durationSeconds-elapsed/1000)));
      m.querySelector('.meditation-inhale-label').textContent=`Inhale · ${inhaleSeconds} seconds`;
      m.querySelector('.meditation-exhale-label').textContent=`Exhale · ${exhaleSeconds} seconds`;
      toggle.setAttribute('aria-pressed',String(running));
      m.dataset.breathing=String(running);
    }
    function tick(now) {
      if(!running||disposed||!m.isConnected){pause();return;}
      elapsed+=Math.max(0,now-lastTime);
      lastTime=now;
      if(elapsed>=durationSeconds*1000){elapsed=durationSeconds*1000;pause();return;}
      updateMusic();
      render();
      raf=requestAnimationFrame(tick);
    }
    function pause() {running=false;cancelAnimationFrame(raf);raf=0;stopMusic();render();}
    toggle.addEventListener('click',()=>{
      if(disposed)return;
      if(running){pause();return;}
      if(elapsed>=durationSeconds*1000){elapsed=0;rewind();}
      running=true;lastTime=performance.now();render();raf=requestAnimationFrame(tick);
      syncMusic();play(music[deck]);if(crossfadeStart!==null)play(music[1-deck]);
    });
    reset.addEventListener('click',()=>{elapsed=0;pause();rewind();});
    function configure(){
      inhaleSeconds=Math.min(20,Math.max(1,Number(inhaleInput.value)||4));
      exhaleSeconds=Math.min(20,Math.max(1,Number(exhaleInput.value)||6));
      const value=durationInput.value.trim();
      if(!/^\d{1,3}:[0-5]\d$/.test(value)){durationInput.setCustomValidity('Enter a duration as minutes:seconds, such as 3:00.');durationInput.reportValidity();return;}
      durationInput.setCustomValidity('');
      const [minutes,seconds]=value.split(':').map(Number);
      durationSeconds=Math.min(3600,Math.max(10,minutes*60+seconds));
      inhaleInput.value=String(inhaleSeconds);exhaleInput.value=String(exhaleSeconds);durationInput.value=format(durationSeconds);
      elapsed=0;pause();rewind();notifyBoardChanged('meditation-settings');
    }
    [inhaleInput,exhaleInput,durationInput].forEach(input=>input.addEventListener('change',configure));
    showCues.addEventListener('change',()=>{render();notifyBoardChanged('meditation-cues');});
    durationInput.addEventListener('input',()=>durationInput.setCustomValidity(''));
    m.addEventListener('teachertiles:tileaudiochange',syncMusic);
    window.addEventListener('teachertiles:audiopreferenceschange',syncMusic);
    const onVisibility=()=>{if(document.hidden)pause();};
    document.addEventListener('visibilitychange',onVisibility);
    // Sessions intentionally reopen at rest, never silently running offscreen.
    m._boardGetState=()=>({version:4,inhaleSeconds,exhaleSeconds,durationSeconds,showCues:showCues.checked,palette});
    m._boardSetState=state=>{
      setPalette(state?.palette);
      showCues.checked=state?.showCues!==false;
      inhaleSeconds=Math.min(20,Math.max(1,Number(state?.inhaleSeconds)||4));
      exhaleSeconds=Math.min(20,Math.max(1,Number(state?.exhaleSeconds)||6));
      durationSeconds=Math.min(3600,Math.max(10,Number(state?.durationSeconds)||180));
      inhaleInput.value=inhaleSeconds;exhaleInput.value=exhaleSeconds;durationInput.value=format(durationSeconds);
      elapsed=0;pause();rewind();
    };
    const priorDeactivate=m._deactivate;
    m._deactivate=()=>{closeDrawer();pause();priorDeactivate?.();};
    const priorCleanup=m._cleanup;
    m._cleanup=()=>{closeDrawer();document.removeEventListener('pointerdown',outsideDrawer);document.removeEventListener('keydown',escapeDrawer,true);disposed=true;pause();resizeObserver.disconnect();document.removeEventListener('visibilitychange',onVisibility);m.removeEventListener('teachertiles:tileaudiochange',syncMusic);window.removeEventListener('teachertiles:audiopreferenceschange',syncMusic);music.forEach(audio=>{audio.removeAttribute('src');audio.load();});priorCleanup?.();};
    render();
  }
  window.TeacherTilesMeditation=Object.freeze({setup});
})();
