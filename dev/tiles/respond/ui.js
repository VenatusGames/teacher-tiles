// Used by board tiles, the shared class link, and interactive presentation slides.
(()=>{'use strict';
function form(submit,already=false){
 const form=document.createElement('form'),input=document.createElement('textarea'),send=document.createElement('button'),feedback=document.createElement('p');
 form.className='respond-form';input.maxLength=500;input.required=true;input.placeholder='Type your response…';input.setAttribute('aria-label','Your response');
 send.type='submit';send.textContent='Send Response';feedback.setAttribute('role','status');form.append(input,send,feedback);
 function finish(){input.hidden=true;send.hidden=true;feedback.textContent='Response submitted';}
 if(already)finish();
 form.onsubmit=async event=>{
  event.preventDefault();const answer=input.value.trim();if(!answer||send.disabled)return;
  send.disabled=true;input.disabled=true;feedback.textContent='Sending…';
  try{await submit({answer});finish();}
  catch(error){feedback.textContent=String(error.message||'Could not send. Try again.').replace(/\s*\[\d{3}\]\s*$/,'');send.disabled=false;input.disabled=false;}
 };
 for(const type of ['pointerdown','click','keydown','wheel'])form.addEventListener(type,event=>event.stopPropagation());
 return form;
}
function list(host,answers,showNames=false){
 if(!host.classList.contains('respond-results')){
  host.classList.add('respond-results');host.setAttribute('role','region');host.setAttribute('aria-label','Responses');
  host.addEventListener('wheel',event=>event.stopPropagation());
 }
 host.tabIndex=answers.length?0:-1;
 const scroll=host.scrollTop;
 host.replaceChildren(...answers.map(answer=>{
  const row=document.createElement('div');row.className='respond-answer';
  if(showNames&&answer.name){const label=document.createElement('strong');label.textContent=answer.name;row.append(label);}
  row.append(document.createTextNode(typeof answer==='string'?answer:answer.text));return row;
 }));
 host.scrollTop=scroll;
}
window.TeacherTilesRespond={form,list};
})();
