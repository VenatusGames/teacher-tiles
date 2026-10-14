(() => {
  'use strict';
  const clean=(value,max)=>String(value??'').trim().slice(0,max);
  const normalize=items=>(Array.isArray(items)?items:[]).slice(0,80).filter(x=>x&&typeof x==='object').map((x,i)=>({id:`word-${i}`,word:clean(x.word,60),definition:clean(x.definition,240)})).filter(x=>x.word);
  function setup(m){
    const wall=m.querySelector('.vocabulary-wall'),form=m.querySelector('.vocabulary-form'),word=m.querySelector('.vocabulary-word-input'),definition=m.querySelector('.vocabulary-definition-input'),status=m.querySelector('.vocabulary-status');
    let cards=[],editing=null,serial=0,showDefinitions=true,size='medium';
    const changed=()=>notifyBoardChanged('vocabulary');
    function close(){form.hidden=true;editing=null;form.reset();}
    function edit(card=null){editing=card?.id??null;word.value=card?.word||'';definition.value=card?.definition||'';form.hidden=false;form.querySelector('[type="submit"]').textContent=card?'Save card':'Add card';word.focus({preventScroll:true});}
    function render(){
      wall.replaceChildren();m.dataset.cardSize=size;
      m.querySelector('.vocabulary-definitions').checked=showDefinitions;m.querySelector('.vocabulary-size').value=size;
      if(!cards.length){const empty=document.createElement('div');empty.className='widget-empty';empty.textContent='Your word wall starts here. Add a word to hang your first card.';wall.append(empty);}
      cards.forEach((card,i)=>{
        const article=document.createElement('article');article.className='vocabulary-card';article.style.setProperty('--card-turn',`${[-1.2,.8,-.4,1.1][i%4]}deg`);article.dataset.tone=String(i%4);
        const open=document.createElement('button');open.type='button';open.className='vocabulary-card-content';open.setAttribute('aria-label',`Edit ${card.word}`);
        const title=document.createElement('strong');title.textContent=card.word;open.append(title);
        if(showDefinitions&&card.definition){const meaning=document.createElement('span');meaning.textContent=card.definition;open.append(meaning);}
        open.addEventListener('click',()=>edit(card));
        const remove=document.createElement('button');remove.type='button';remove.className='vocabulary-remove';remove.textContent='×';remove.setAttribute('aria-label',`Delete ${card.word}`);
        remove.addEventListener('click',()=>{cards=cards.filter(c=>c.id!==card.id);if(editing===card.id)close();render();changed();});
        article.append(open,remove);wall.append(article);
      });
      status.textContent=`${cards.length} / 80 cards`;m.querySelector('.vocabulary-add').disabled=cards.length>=80;
    }
    m.querySelector('.vocabulary-add').addEventListener('click',()=>edit());
    m.querySelector('.vocabulary-cancel').addEventListener('click',close);
    form.addEventListener('submit',event=>{event.preventDefault();const text=clean(word.value,60);if(!text){word.focus({preventScroll:true});return;}
      if(editing){const card=cards.find(c=>c.id===editing);if(card){card.word=text;card.definition=clean(definition.value,240);}}
      else if(cards.length<80)cards.push({id:`new-${++serial}`,word:text,definition:clean(definition.value,240)});
      close();render();changed();m.querySelector('.vocabulary-add').focus({preventScroll:true});
    });
    form.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();m.querySelector('.vocabulary-add').focus({preventScroll:true});}});
    m.querySelector('.vocabulary-definitions').addEventListener('change',e=>{showDefinitions=e.target.checked;render();changed();});
    m.querySelector('.vocabulary-size').addEventListener('change',e=>{size=e.target.value;render();changed();});
    m._boardGetState=()=>({cards:cards.map(({word,definition})=>({word,definition})),showDefinitions,size});
    m._boardSetState=s=>{cards=normalize(s?.cards);showDefinitions=s?.showDefinitions!==false;size=['small','medium','large'].includes(s?.size)?s.size:'medium';close();render();};
    render();
  }
  window.TeacherTilesVocabulary=Object.freeze({setup,normalize});
})();
