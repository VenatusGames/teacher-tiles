(() => {
  'use strict';

  const TRACKS=Object.freeze([
    {title:'Relaxing Rain',src:'tiles/soundscapes/assets/relaxing-rain.mp3',label:'#dce6ee',text:'#273641'},
    {title:'Thunderstorm',src:'tiles/soundscapes/assets/Thunderstorm.mp3',label:'#c8cddd',text:'#282d3a'},
    {title:'Blizzard',src:'tiles/soundscapes/assets/Blizzard.mp3',label:'#edf8fc',text:'#31566a'},
    {title:'Flowing Stream',src:'tiles/soundscapes/assets/Flowing Stream.mp3',label:'#d4eeee',text:'#205456'},
    {title:'Campfire',src:'tiles/soundscapes/assets/campfire.mp3',label:'#f4d4b9',text:'#67321f'},
    {title:'Crickets',src:'tiles/soundscapes/assets/crickets.mp3',label:'#dce7ce',text:'#334626'},
    {title:'Waterfall',src:'tiles/soundscapes/assets/Waterfall.mp3',label:'#d5e8f5',text:'#24445b'},
    {title:'Ocean Waves',src:'tiles/soundscapes/assets/ocean-waves.mp3',label:'#cfe2ef',text:'#203d53'}
  ]);
  const SKIN_STYLE=Object.freeze({
    'soundscapes-music-player':'music',
    'soundscapes-ipod':'ipod',
    'soundscapes-vinyl':'vinyl'
  });

  function setup(m){
    const audio=m.querySelector('.boombox-audio');
    if(!audio)return;
    const titles=[...m.querySelectorAll('.boombox-title')];
    const plays=[...m.querySelectorAll('.boombox-play')];
    const prevs=[...m.querySelectorAll('.boombox-prev')];
    const nexts=[...m.querySelectorAll('.boombox-next')];
    const skips=[...m.querySelectorAll('.boombox-skip')];
    const volumes=[...m.querySelectorAll('.boombox-volume')];
    const volumeValues=[...m.querySelectorAll('.boombox-volume-value')];
    const progresses=[...m.querySelectorAll('.boombox-progress span')];
    const currents=[...m.querySelectorAll('.boombox-current')];
    const durations=[...m.querySelectorAll('.boombox-duration')];
    const style=SKIN_STYLE[m.dataset.tileSkin]||'compact';
    let index=0,userVolume=55;

    m.querySelectorAll('.boombox-view').forEach(view=>view.hidden=!view.classList.contains(`boombox-view--${style}`));

    const fmt=value=>{
      if(!Number.isFinite(value))return'0:00';
      const seconds=Math.max(0,Math.floor(value));
      return`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
    };
    const each=(items,fn)=>items.forEach(fn);
    const renderPlay=()=>{
      each(plays,button=>{
        button.textContent=audio.paused?(button.closest('.boombox-view--ipod')?'▶❚❚':'▶'):'❚❚';
        button.classList.toggle('is-playing',!audio.paused);
      });
      m.classList.toggle('is-playing',!audio.paused);
    };
    const fitVinylTitle=title=>{
      const label=title.closest('.vinyl-label');
      if(!label)return;
      const words=[...title.querySelectorAll('.vinyl-title-word')];
      if(!words.length)return;
      let size=Math.min(14,Math.max(7,label.clientWidth*.18));
      const minSize=6.25;
      title.style.fontSize=`${size}px`;
      const fits=()=>words.every(word=>word.scrollWidth<=title.clientWidth+1)&&title.scrollHeight<=title.clientHeight+1;
      while(size>minSize&&!fits()){
        size-=.25;
        title.style.fontSize=`${size}px`;
      }
    };
    const syncTrack=()=>{
      const track=TRACKS[index];
      each(titles,title=>{
        if(title.closest('.vinyl-label')){
          title.replaceChildren(...track.title.split(/\s+/).map(word=>{
            const span=document.createElement('span');
            span.className='vinyl-title-word';
            span.textContent=word;
            return span;
          }));
          requestAnimationFrame(()=>fitVinylTitle(title));
        }else title.textContent=track.title;
      });
      m.style.setProperty('--vinyl-label',track.label);
      m.style.setProperty('--vinyl-label-text',track.text);
    };
    const syncProgress=()=>{
      const pct=audio.duration?clamp(audio.currentTime/audio.duration*100,0,100):0;
      each(progresses,progress=>progress.style.width=`${pct}%`);
      each(currents,current=>current.textContent=fmt(audio.currentTime));
      each(durations,duration=>duration.textContent=fmt(audio.duration));
    };
    const load=(nextIndex,autoplay=false)=>{
      index=(nextIndex+TRACKS.length)%TRACKS.length;
      syncTrack();
      audio.src=TRACKS[index].src;
      audio.load();
      each(progresses,progress=>progress.style.width='0%');
      each(currents,current=>current.textContent='0:00');
      if(autoplay)audio.play().catch(()=>{});
      renderPlay();
    };
    const applyVolume=()=>{audio.volume=clamp((userVolume/100)*masterAudioLevel(),0,1)};
    const setVolume=value=>{
      userVolume=clamp(Number(value),0,100);
      applyVolume();
      each(volumes,input=>{if(Number(input.value)!==userVolume)input.value=userVolume});
      each(volumeValues,output=>output.textContent=`${Math.round(userVolume)}%`);
    };
    const onAudioPreferences=()=>applyVolume();

    each(plays,button=>button.addEventListener('click',()=>{if(audio.paused)audio.play().catch(()=>{});else audio.pause()}));
    each(prevs,button=>button.addEventListener('click',()=>load(index-1,!audio.paused)));
    each(nexts,button=>button.addEventListener('click',()=>load(index+1,!audio.paused)));
    each(skips,button=>button.addEventListener('click',()=>{if(Number.isFinite(audio.duration))audio.currentTime=Math.min(audio.duration,audio.currentTime+15)}));
    each(volumes,input=>input.addEventListener('input',()=>setVolume(input.value)));
    window.addEventListener('teachertiles:audiopreferenceschange',onAudioPreferences);
    audio.addEventListener('play',renderPlay);
    audio.addEventListener('pause',renderPlay);
    audio.addEventListener('loadedmetadata',syncProgress);
    audio.addEventListener('timeupdate',syncProgress);

    const resizeObserver=new ResizeObserver(()=>{
      if(style==='vinyl')m.querySelectorAll('.vinyl-label .boombox-title').forEach(fitVinylTitle);
    });
    resizeObserver.observe(m);

    setVolume(55);
    load(0,false);
    if(style==='vinyl')requestAnimationFrame(()=>m.querySelectorAll('.vinyl-label .boombox-title').forEach(fitVinylTitle));

    m._boardGetState=()=>({
      track:index,
      volume:Math.round(userVolume),
      currentTime:Number.isFinite(audio.currentTime)?audio.currentTime:0
    });
    m._boardSetState=state=>{
      if(!state)return;
      const track=Math.max(0,Math.min(TRACKS.length-1,Math.round(Number(state.track)||0)));
      setVolume(Number.isFinite(Number(state.volume))?Number(state.volume):55);
      load(track,false);
      const restoreTime=Math.max(0,Number(state.currentTime)||0);
      if(restoreTime){
        audio.addEventListener('loadedmetadata',()=>{
          try{audio.currentTime=Math.min(restoreTime,audio.duration||restoreTime)}catch{}
        },{once:true});
      }
    };

    const priorDeactivate=m._deactivate;
    m._deactivate=()=>{audio.pause();priorDeactivate?.()};
    const priorCleanup=m._cleanup;
    m._cleanup=()=>{
      resizeObserver.disconnect();
      window.removeEventListener('teachertiles:audiopreferenceschange',onAudioPreferences);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      priorCleanup?.();
    };
  }

  window.TeacherTilesSoundscapes=Object.freeze({setup});
})();
