(() => {
  'use strict';
  function searchUrl(query){const url=new URL('https://www.google.com/search');url.searchParams.set('q',String(query??'').trim().slice(0,500));url.searchParams.set('safe','active');return url.href;}
  function setup(m){
    const form=m.querySelector('.google-form'),input=m.querySelector('.google-query'),last=m.querySelector('.google-last-search');
    const frame=document.createElement('iframe');frame.className='google-results';frame.title='Google search results';frame.hidden=true;frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');m.querySelector('.google-content').append(frame);
    let recent='';
    function render(){
      const id=window.TeacherTilesGoogleConfig?.engineId||'';last.removeAttribute('href');last.hidden=!recent;
      last.textContent=recent&&!id?'Google search needs to be connected for this site.':'';
      frame.hidden=!recent||!id;m.classList.toggle('has-google-results',!frame.hidden);
      if(!frame.hidden){const url=new URL('tiles/google/search.html',document.baseURI);url.searchParams.set('cx',id);url.searchParams.set('q',recent);if(frame.src!==url.href)frame.src=url.href;}
    }
    form.addEventListener('submit',event=>{event.preventDefault();const query=input.value.trim().slice(0,500);if(!query){input.focus({preventScroll:true});return;}
      recent=query;render();notifyBoardChanged('google-search');
    });
    m._boardGetState=()=>({query:input.value.slice(0,500),recent});
    m._boardSetState=s=>{input.value=String(s?.query??'').slice(0,500);recent=String(s?.recent??'').slice(0,500);render();};render();
  }
  window.TeacherTilesGoogle=Object.freeze({setup,searchUrl});
})();
