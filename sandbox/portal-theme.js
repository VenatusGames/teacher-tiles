// Apply the portal-only preference before paint, independently of sign-in.
(()=>{
  const key='teachertiles:developer-portal:theme';
  const root=document.documentElement;
  function apply(theme){
    const dark=theme==='dark';root.dataset.portalTheme=dark?'dark':'light';
    document.getElementById('portal-theme-toggle')?.setAttribute('aria-checked',String(dark));
  }
  let saved;try{saved=localStorage.getItem(key);}catch{}
  apply(saved);
  document.addEventListener('DOMContentLoaded',()=>{
    const toggle=document.getElementById('portal-theme-toggle');
    if(!toggle)return;
    apply(root.dataset.portalTheme);
    toggle.addEventListener('click',()=>{
      const theme=root.dataset.portalTheme==='dark'?'light':'dark';apply(theme);
      try{localStorage.setItem(key,theme);}catch{}
    });
  },{once:true});
  window.addEventListener('storage',event=>{if(event.key===key||event.key===null)apply(event.newValue);});
})();
