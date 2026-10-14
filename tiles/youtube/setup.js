function setupYoutube(m){
  m.addEventListener('pointerleave',()=>{if(m.querySelector('.youtube-controls')?.contains(document.activeElement))document.activeElement.blur()});
  const frame=m.querySelector('.youtube-frame'),empty=m.querySelector('.youtube-empty'),input=m.querySelector('.youtube-url'),load=m.querySelector('.youtube-load'),error=m.querySelector('.youtube-error');
  m.querySelector('.youtube-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  const getId=value=>{
    const raw=(value||'').trim();if(!raw)return null;if(/^[A-Za-z0-9_-]{11}$/.test(raw))return raw;
    try{const u=new URL(raw);const host=u.hostname.replace(/^www\./,'').toLowerCase();if(host==='youtu.be')return u.pathname.split('/').filter(Boolean)[0]||null;if(host.endsWith('youtube.com')){const v=u.searchParams.get('v');if(v)return v;const parts=u.pathname.split('/').filter(Boolean);if(['embed','shorts','live'].includes(parts[0])&&parts[1])return parts[1]}}catch{}
    return null
  };
  const loadVideo=()=>{const id=getId(input.value);if(!id){error.textContent='Enter a valid YouTube link.';return}if(location.protocol==='file:'){error.textContent='YouTube embeds require localhost or HTTPS. Run the included site through a local server.';frame.hidden=true;m.classList.remove('has-video');return}error.textContent='';const origin=(location.protocol==='http:'||location.protocol==='https:')?`&origin=${encodeURIComponent(location.origin)}`:'';frame.src=`https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0${origin}`;frame.hidden=false;m.classList.add('has-video')};
  load.addEventListener('click',loadVideo);input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();loadVideo()}});
  m._boardGetState=()=>({url:input.value,loaded:m.classList.contains('has-video')});
  m._boardSetState=state=>{if(!state)return;input.value=state.url||'';if(state.loaded&&input.value)loadVideo()};
  const prior=m._cleanup;m._cleanup=()=>{prior?.();frame.src=''}
}
