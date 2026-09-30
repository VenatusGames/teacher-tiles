function setupAmbienceVideo(m){
  const frame=m.querySelector('.ambience-video-frame');
  const title=m.querySelector('.ambience-video-title');
  const message=m.querySelector('.ambience-video-message');
  const channelButtons=[...m.querySelectorAll('[data-ambience-channel-button]')];

  const channels={
    campfire:{
      title:'Campfire',
      id:'E77jmtut1Zc'
    },
    fireplace:{
      title:'Fireplace',
      id:'mSX3OyW9Rao'
    },
    aquarium:{
      title:'Aquarium',
      id:'W0u-7lgWXpw'
    }
  };

  const loadChannel=channel=>{
    const key=channel in channels?channel:'campfire';
    const config=channels[key];

    m.dataset.ambienceChannel=key;
    title.textContent=config.title;
    frame.title=`${config.title} ambience video`;

    channelButtons.forEach(button=>{
      const active=button.dataset.ambienceChannelButton===key;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',String(active));
    });

    message.textContent='';
    frame.hidden=false;

    const params=new URLSearchParams({
      autoplay:'1',
      mute:'1',
      rel:'0',
      playsinline:'1'
    });

    if(location.protocol==='http:'||location.protocol==='https:'){
      params.set('origin',location.origin);
    }

    frame.src=`https://www.youtube.com/embed/${encodeURIComponent(config.id)}?${params.toString()}`;
  };

  channelButtons.forEach(button=>{
    button.addEventListener('click',()=>{
      loadChannel(button.dataset.ambienceChannelButton);
    });
  });

  m.querySelector('.ambience-video-font').addEventListener('click',()=>{
    cycleData(m,'font',FONT_OPTIONS);
  });

  loadChannel(m.dataset.ambienceChannel||'campfire');

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    frame.src='';
  };
}
