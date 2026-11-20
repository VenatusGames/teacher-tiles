// Choice definitions are shared by the board, presentations and the session service.
(function(root){
 const isChoice=kind=>kind==='livepolls'||kind==='moodcheckin';
 const moods=['😊 Happy','😴 Sleepy','😐 Meh','😢 Sad'];
 function definition(kind,value={}){
  if(kind==='moodcheckin')return {prompt:'How are you feeling?',options:[...moods],multiple:false};
  const options=(Array.isArray(value?.options)?value.options:[]).slice(0,8).map(s=>String(s??'').trim().slice(0,80));
  return {prompt:String(value?.prompt||'Which option do you choose?').trim().slice(0,160)||'Which option do you choose?',options:options.length>=2?options:['Option A','Option B'],multiple:value?.multiple===true};
 }
 const api={isChoice,definition};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TeacherTilesChoice=api;
})(globalThis);
(() => {
 const api=window.TeacherTilesChoice;
 const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
 function button(text){const b=make('button','tt-board-action',text);b.type='button';return b;}
 api.form=(config,submit,previous)=>{
  const form=make('form','cc-choice-form'),options=make('div','cc-choice-options'),status=make('p'),send=button('Submit Vote');
  options.setAttribute('role','group');options.setAttribute('aria-label',config.prompt);status.setAttribute('role','status');
  let chosen=new Set(previous||[]),busy=false,done=!!previous;
  const choices=config.options.map((label,i)=>{
   const b=button(label);
   if(config.options.every((v,j)=>v===api.definition('moodcheckin').options[j])&&config.options.length===4){
    const [emoji,name]=label.split(' '),icon=make('span','cc-mood-emoji',emoji);icon.setAttribute('aria-hidden','true');b.replaceChildren(icon,make('span','',name));
   }
   b.onclick=()=>{if(done||busy)return;if(!config.multiple)chosen.clear();if(chosen.has(i))chosen.delete(i);else chosen.add(i);paint();};options.append(b);return b;
  });
  function paint(){choices.forEach((b,i)=>{b.disabled=busy||done;b.setAttribute('aria-pressed',String(chosen.has(i)));});
   send.disabled=busy||!chosen.size;send.hidden=done;
   if(done)status.textContent='Your response: '+[...chosen].map(i=>config.options[i]).join(', ');
  }
  if(config.multiple)form.append(make('small','','Select all that apply'));
  send.type='submit';form.append(options,send,status);paint();
  form.onsubmit=async e=>{e.preventDefault();if(done||busy||!chosen.size)return;busy=true;paint();status.textContent='Sending…';
   try{const result=await submit({choices:[...chosen],ballot:config});chosen=new Set(result.choices);done=true;}
   catch(err){status.textContent=err.message||'Could not send your vote. Try again.';}
   finally{busy=false;paint();}
  };
  for(const type of ['pointerdown','click','keydown','wheel'])form.addEventListener(type,e=>e.stopPropagation());
  return form;
 };
 api.results=(host,config,counts=[])=>{
  const max=Math.max(1,...counts);host.classList.add('cc-choice-results');host.setAttribute('aria-label','Vote counts');
  host.replaceChildren(...config.options.map((label,i)=>{const n=counts[i]||0,row=make('div','cc-choice-row'),caption=make('span','',label),count=make('strong','',String(n)),track=make('span','cc-choice-track'),bar=make('i');
   bar.style.width=(100*n/max)+'%';track.append(bar);row.append(caption,count,track);return row;}));
 };
 api.edit=(config,apply,host)=>{
  const dlg=make('dialog','cc-session-dialog cc-poll-editor'),form=make('form'),question=make('input'),fields=make('div','cc-poll-options');
  function field(label,input){const row=make('label','cc-poll-field');row.append(make('span','',label),input);return row;}
  question.required=true;question.maxLength=160;question.value=config.prompt;
  const add=button('Add Option'),multiple=make('button','tile-settings-switch');
  multiple.type='button';multiple.setAttribute('role','switch');
  multiple.setAttribute('aria-checked',String(config.multiple===true));
  multiple.append(make('i'));
  multiple.onclick=()=>multiple.setAttribute('aria-checked',String(multiple.getAttribute('aria-checked')!=='true'));
  function refresh(){[...fields.children].forEach((row,i)=>{row.firstChild.setAttribute('aria-label','Option '+(i+1));row.lastChild.disabled=fields.children.length<=2;});add.disabled=fields.children.length>=8;}
  function append(label){const row=make('div','cc-poll-option'),input=make('input'),remove=button('×');input.required=true;input.maxLength=80;input.value=label;remove.setAttribute('aria-label','Remove option');remove.onclick=()=>{row.remove();refresh();};row.append(input,remove);fields.append(row);refresh();return input;}
  config.options.forEach(append);add.onclick=()=>append('').focus();const cancel=button('Cancel'),save=button('Apply');save.type='submit';cancel.onclick=()=>dlg.close();
  const actions=make('div','cc-poll-actions');actions.append(cancel,save);
  const multi=make('label','tile-settings-switch-row cc-poll-multiple');multi.append(make('span','','Allow Multiple Selections'),multiple);
  form.append(make('h2','','Edit Live Poll'),field('Question',question),make('strong','','Poll Options'),fields,add,multi);
  if(host.classList.contains('is-classconnect-live'))form.append(make('small','','Changing the poll starts a new vote.'));
  form.append(actions);dlg.append(form);dlg.setAttribute('aria-label','Edit Live Poll');(document.fullscreenElement||document.body).append(dlg);dlg.showModal();
  dlg.addEventListener('close',()=>dlg.remove(),{once:true});
  for(const type of ['pointerdown','click','keydown'])dlg.addEventListener(type,e=>e.stopPropagation());
  form.onsubmit=e=>{e.preventDefault();const inputs=[question,...fields.querySelectorAll('input')];const invalid=inputs.find(input=>!input.value.trim());if(invalid){invalid.focus();return;}
   apply({prompt:question.value.trim(),options:inputs.slice(1).map(i=>i.value.trim()),multiple:multiple.getAttribute('aria-checked')==='true'});dlg.close();
  };
 };
 api.setup=tile=>{
  const kind=tile.dataset.type,policy=window.ClassConnectPolicy,student=policy?.student&&policy.controlled;
  setupClassroomTileControls(tile);
  const prompt=tile.querySelector('.wordcloud-prompt'),stage=tile.querySelector('.wordcloud-stage'),connect=tile.querySelector('.wordcloud-connect'),status=tile.querySelector('.wordcloud-status'),edit=tile.querySelector('.cc-edit-poll');
  let config=api.definition(kind),counts=[];
  if(policy)tile._wordCloudInteractionId=crypto.randomUUID();
  function draw(){prompt.value=config.prompt;
   if(!student){api.results(stage,config,counts);return;}
   const key=tile.dataset.boardObjectId+':'+(tile._wordCloudInteractionId||tile.dataset.boardObjectId);
   stage.replaceChildren(api.form(config,async input=>{const result=await policy.submitWord(tile,input);policy.ownVotes[key]=result.choices;return result;},policy.ownVotes?.[key]));
  }
  if(edit){edit.hidden=!!student;edit.onclick=()=>api.edit(config,next=>{
   if(JSON.stringify(next)===JSON.stringify(config))return;
   config=next;counts=[];if(policy)tile._wordCloudInteractionId=crypto.randomUUID();draw();
   prompt.dispatchEvent(new Event('change',{bubbles:true}));(tile._presentationChanged||window.notifyBoardChanged)?.('poll-settings');
  },tile);}
  prompt.readOnly=true;connect.hidden=!!policy||tile.dataset.presentationEmbedded==='true';
  connect.onclick=()=>window.TeacherTilesBoardSessions.wordcloud(tile).catch(err=>status.textContent=err.message);
  tile._wordCloudStatus=(text,live)=>{status.textContent=text;tile.classList.toggle('is-classconnect-live',live);};
  tile._wordCloudInfo=()=>({...config});
  tile._wordCloudUpdate=value=>{counts=Array.isArray(value)?value:[];if(!student)draw();};
  tile._boardGetState=()=>({...config,...(policy?{interactionId:tile._wordCloudInteractionId}:{})});
  tile._boardSetState=value=>{config=api.definition(kind,value);if(policy&&value?.interactionId)tile._wordCloudInteractionId=value.interactionId;draw();};
  const cleanup=tile._cleanup;tile._cleanup=()=>{void tile._classConnectSession?.end();cleanup?.();};draw();
 };
})();
