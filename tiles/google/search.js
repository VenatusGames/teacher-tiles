(() => {
  const params=new URLSearchParams(location.search),id=params.get('cx')||'',query=(params.get('q')||'').slice(0,500),status=document.getElementById('status');
  if(!/^[\w:-]{5,150}$/.test(id)){status.textContent='Google search needs to be connected for this site.';return;}
  const timeout=setTimeout(()=>{status.textContent='Google is taking longer than expected. Try your search again.';},15000);
  window.__gcse={parsetags:'explicit',initializationCallback(){
    clearTimeout(timeout);status.hidden=true;
    google.search.cse.element.render({div:'results',tag:'searchresults-only',gname:'tile',attributes:{safeSearch:'active',webSearchSafesearch:'active',linkTarget:'_blank'}});
    if(query)google.search.cse.element.getElement('tile').execute(query);
  }};
  const script=document.createElement('script');script.async=true;script.src='https://cse.google.com/cse.js?cx='+encodeURIComponent(id);
  script.onerror=()=>{clearTimeout(timeout);status.textContent='Google could not load. Check your connection and try again.';};document.head.append(script);
})();
