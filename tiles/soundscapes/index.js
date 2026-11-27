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

  // Shared with Christmas Carols so both selectors keep the same behavior and UI.
  function attachSelector({tile,tracks,triggers,dialog,selectTrack,getTrackIndex}){
    const list=dialog.querySelector('.carol-song-list'),choices=[];
    function close(){dialog.close();triggers.forEach(button=>button.setAttribute('aria-expanded','false'));}
    function sync(index){
      choices.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
      triggers.forEach(button=>button.setAttribute('aria-label',`Choose ${tile.dataset.type==='christmascarols'?'a Carol':'a Soundscape'}: ${tracks[index].title}`));
    }
    for(const trigger of triggers){
      trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');
      trigger.addEventListener('click',()=>{
        if(dialog.open){close();return;}
        dialog.showModal();trigger.setAttribute('aria-expanded','true');
        dialog.querySelector('[aria-pressed="true"]')?.scrollIntoView({block:'nearest'});
      });
    }
    tracks.map((track,index)=>({track,index})).sort((a,b)=>a.track.title.localeCompare(b.track.title)).forEach(({track,index})=>{
      const button=document.createElement('button');button.type='button';button.className='carol-song';
      const text=document.createElement('span'),title=document.createElement('strong');title.textContent=track.title;text.append(title);
      if(track.artist){const artist=document.createElement('small');artist.textContent=track.artist;text.append(artist);}
      const check=document.createElement('span');check.className='carol-song-check';check.textContent='✓';check.setAttribute('aria-hidden','true');
      button.append(text,check);choices[index]=button;list.append(button);
      button.addEventListener('click',()=>{
        if(index!==getTrackIndex()){selectTrack(index);(tile._presentationChanged||window.notifyBoardChanged)?.('audio-track');}
        close();
      });
    });
    dialog.querySelector('.carol-credits-close').addEventListener('click',close);
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    dialog.addEventListener('click',event=>{
      if(event.target!==dialog)return;
      const rect=dialog.getBoundingClientRect();
      if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();
    });
    dialog.addEventListener('pointerdown',event=>event.stopPropagation());
    dialog.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
    sync(getTrackIndex());
    return {sync,close};
  }

  function setup(m,{tracks=TRACKS,lazy=false,onTrackChange}={}){
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
    const seekBars=[...m.querySelectorAll('.boombox-progress')];
    const currents=[...m.querySelectorAll('.boombox-current')];
    const durations=[...m.querySelectorAll('.boombox-duration')];
    const style=SKIN_STYLE[m.dataset.tileSkin]||'compact';
    let index=0,userVolume=55,pendingSeek=0,selector=null;

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
      const track=tracks[index];
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
      selector?.sync(index);
      m.style.setProperty('--vinyl-label',track.label);
      m.style.setProperty('--vinyl-label-text',track.text);
    };
    const syncProgress=()=>{
      const length=Number.isFinite(audio.duration)?audio.duration:tracks[index].duration;
      const position=pendingSeek||audio.currentTime||0;
      const pct=length?clamp(position/length*100,0,100):0;
      each(progresses,progress=>progress.style.width=`${pct}%`);
      each(currents,current=>current.textContent=fmt(position));
      each(durations,duration=>duration.textContent=fmt(Number.isFinite(audio.duration)?audio.duration:tracks[index].duration));
      const duration=Number.isFinite(audio.duration)?audio.duration:tracks[index].duration||0;
      each(seekBars,bar=>{bar.setAttribute('aria-valuemax',String(Math.round(duration)));bar.setAttribute('aria-valuenow',String(Math.round(pendingSeek||audio.currentTime||0)));bar.setAttribute('aria-valuetext',`${fmt(pendingSeek||audio.currentTime)} of ${fmt(duration)}`)});
    };
    const load=(nextIndex,autoplay=false)=>{
      index=(nextIndex+tracks.length)%tracks.length;
      pendingSeek=0;
      syncTrack();
      if(lazy&&!autoplay){
        audio.pause();audio.removeAttribute('src');
      }else audio.src=tracks[index].src;
      audio.load();
      each(progresses,progress=>progress.style.width='0%');
      each(currents,current=>current.textContent='0:00');
      each(durations,duration=>duration.textContent=fmt(tracks[index].duration));
      syncProgress();
      onTrackChange?.(tracks[index],index);
      if(autoplay)audio.play().catch(()=>{});
      renderPlay();
    };
    function seek(seconds){
      const duration=Number.isFinite(audio.duration)?audio.duration:tracks[index].duration;
      if(!duration)return;
      const time=clamp(seconds,0,duration);
      if(audio.readyState>=1){pendingSeek=0;audio.currentTime=time;}
      else{pendingSeek=time;if(!audio.getAttribute('src')){audio.src=tracks[index].src;audio.load();}}
      syncProgress();
      each(progresses,progress=>progress.style.width=`${time/duration*100}%`);
      each(currents,current=>current.textContent=fmt(time));
    }
    const seekCleanups=seekBars.map(bar=>{
      bar.tabIndex=0;bar.setAttribute('role','slider');bar.setAttribute('aria-label','Playback Position');bar.setAttribute('aria-valuemin','0');
      let pointer=null;
      function move(event){if(pointer!==event.pointerId)return;event.stopPropagation();const rect=bar.getBoundingClientRect();const duration=Number.isFinite(audio.duration)?audio.duration:tracks[index].duration;seek((event.clientX-rect.left)/Math.max(1,rect.width)*(duration||0));}
      function finish(event){if(pointer!==event.pointerId)return;event.stopPropagation();try{bar.releasePointerCapture(pointer)}catch{}pointer=null;(m._presentationChanged||window.notifyBoardChanged)?.('audio-seek');}
      bar.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();pointer=event.pointerId;bar.setPointerCapture(pointer);move(event)});
      bar.addEventListener('pointermove',move);bar.addEventListener('pointerup',finish);bar.addEventListener('pointercancel',finish);
      bar.addEventListener('keydown',event=>{const duration=Number.isFinite(audio.duration)?audio.duration:tracks[index].duration||0;let time=pendingSeek||audio.currentTime||0;if(event.key==='Home')time=0;else if(event.key==='End')time=duration;else if(['ArrowLeft','ArrowDown'].includes(event.key))time-=5;else if(['ArrowRight','ArrowUp'].includes(event.key))time+=5;else return;event.preventDefault();event.stopPropagation();seek(time);(m._presentationChanged||window.notifyBoardChanged)?.('audio-seek')});
      return()=>{if(pointer!==null){try{bar.releasePointerCapture(pointer)}catch{}pointer=null;}};
    });
    const applyVolume=()=>{audio.volume=clamp((userVolume/100)*masterAudioLevel(),0,1)};
    const setVolume=value=>{
      userVolume=clamp(Number(value),0,100);
      applyVolume();
      each(volumes,input=>{if(Number(input.value)!==userVolume)input.value=userVolume});
      each(volumeValues,output=>output.textContent=`${Math.round(userVolume)}%`);
    };
    const onAudioPreferences=()=>applyVolume();

    each(plays,button=>button.addEventListener('click',()=>{
      if(audio.paused){
        if(!audio.getAttribute('src')){audio.src=tracks[index].src;audio.load();}
        audio.play().catch(()=>{});
      }else audio.pause();
    }));
    each(prevs,button=>button.addEventListener('click',()=>load(index-1,!audio.paused)));
    each(nexts,button=>button.addEventListener('click',()=>load(index+1,!audio.paused)));
    each(skips,button=>button.addEventListener('click',()=>{if(Number.isFinite(audio.duration))audio.currentTime=Math.min(audio.duration,audio.currentTime+15)}));
    each(volumes,input=>input.addEventListener('input',()=>setVolume(input.value)));
    window.addEventListener('teachertiles:audiopreferenceschange',onAudioPreferences);
    audio.addEventListener('play',renderPlay);
    audio.addEventListener('pause',renderPlay);
    audio.addEventListener('loadedmetadata',()=>{
      if(pendingSeek){
        try{audio.currentTime=Math.min(pendingSeek,audio.duration||pendingSeek)}catch{}
        pendingSeek=0;
      }
      syncProgress();
    });
    audio.addEventListener('timeupdate',syncProgress);

    const resizeObserver=new ResizeObserver(()=>{
      if(style==='vinyl')m.querySelectorAll('.vinyl-label .boombox-title').forEach(fitVinylTitle);
    });
    resizeObserver.observe(m);

    if(m.dataset.type==='boombox'){
      const dialog=document.createElement('dialog');dialog.className='carol-credits carol-library soundscapes-library';dialog.setAttribute('aria-label','Choose a Soundscape');
      dialog.innerHTML='<button class="carol-credits-close" type="button" aria-label="Close Soundscapes">×</button><h2>Soundscapes</h2><div class="carol-song-list"></div>';
      m.append(dialog);
      const triggers=titles.map(title=>{
        const button=document.createElement('button');button.type='button';button.className='soundscapes-choose';
        if(title.closest('.vinyl-label')){
          const caption=document.createElement('strong');caption.className='boombox-title';caption.textContent=title.textContent;
          button.append(caption);titles.push(caption);m.querySelector('.vinyl-footer').prepend(button);
        }else{title.before(button);button.append(title);}
        button.insertAdjacentHTML('beforeend','<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>');
        return button;
      });
      selector=attachSelector({tile:m,tracks,triggers,dialog,selectTrack:next=>load(next,!audio.paused),getTrackIndex:()=>index});
      each([...prevs,...nexts],button=>button.addEventListener('click',()=>window.notifyBoardChanged?.('audio-track')));
    }

    setVolume(55);
    load(0,false);
    if(style==='vinyl')requestAnimationFrame(()=>m.querySelectorAll('.vinyl-label .boombox-title').forEach(fitVinylTitle));

    m._boardGetState=()=>({
      track:index,
      volume:Math.round(userVolume),
      currentTime:pendingSeek||(Number.isFinite(audio.currentTime)?audio.currentTime:0)
    });
    m._boardSetState=state=>{
      if(!state)return;
      const track=Math.max(0,Math.min(tracks.length-1,Math.round(Number(state.track)||0)));
      setVolume(Number.isFinite(Number(state.volume))?Number(state.volume):55);
      load(track,false);
      pendingSeek=Math.max(0,Number(state.currentTime)||0);
      syncProgress();
    };

    const priorDeactivate=m._deactivate;
    m._deactivate=()=>{selector?.close();seekCleanups.forEach(clean=>clean());audio.pause();priorDeactivate?.()};
    const priorCleanup=m._cleanup;
    m._cleanup=()=>{
      selector?.close();
      seekCleanups.forEach(clean=>clean());
      resizeObserver.disconnect();
      window.removeEventListener('teachertiles:audiopreferenceschange',onAudioPreferences);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      priorCleanup?.();
    };
    return Object.freeze({
      selectTrack(nextIndex){
        if(Number.isInteger(nextIndex)&&nextIndex>=0&&nextIndex<tracks.length)load(nextIndex,!audio.paused);
      },
      getTrackIndex:()=>index
    });
  }

  window.TeacherTilesSoundscapes=Object.freeze({setup,attachSelector});
})();
