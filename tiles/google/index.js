(() => {
  'use strict';
  function searchUrl(query){const url=new URL('https://www.google.com/search');url.searchParams.set('q',String(query??'').trim().slice(0,500));url.searchParams.set('safe','active');return url.href;}
  function setup(m){
    const form=m.querySelector('.google-form'),input=m.querySelector('.google-query'),last=m.querySelector('.google-last-search');
    let recent='';
    function render(){last.hidden=!recent;last.textContent=recent?`Open results: ${recent}`:'';if(recent)last.href=searchUrl(recent);else last.removeAttribute('href');}
    form.addEventListener('submit',event=>{event.preventDefault();const query=input.value.trim().slice(0,500);if(!query){input.focus({preventScroll:true});return;}
      recent=query;render();notifyBoardChanged('google-search');
      window.open(searchUrl(query),'_blank','noopener,noreferrer');
    });
    m._boardGetState=()=>({query:input.value.slice(0,500),recent});
    m._boardSetState=s=>{input.value=String(s?.query??'').slice(0,500);recent=String(s?.recent??'').slice(0,500);render();};render();
  }
  window.TeacherTilesGoogle=Object.freeze({setup,searchUrl});
})();
