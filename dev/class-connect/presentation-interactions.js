import {call,watchCloud,watchPresentationWords} from './boards.js?v=20261119-attach';
// One live document per viewer, independent of how many interactive tiles are on the slide.
export function createInteractionChannel({room,sessionId,deck,credentials,classId,route={},ownVotes={},answered=[]}){
 let current=-1,data=null,off=null,source='',generation=0,closed=false,problem='';
 const listeners=new Set(),sent=answered instanceof Set?answered:new Set(answered);
 const emit=()=>{for(const fn of listeners)fn();};
 const onSlide=id=>!closed&&deck.slides[current]?.id===id;
 const teacherEntry=id=>data?.entries?.find(e=>e.index===current&&e.elementId===id);
 const api={
  get problem(){return problem;},
  setSlide(index){
   if(closed||current===index)return;
   current=index;problem='';
   const tiles=deck.slides[index]?.elements.filter(e=>e.type==='tile')||[];
   const respond=tiles.some(e=>e.tileType==='respond'||TeacherTilesChoice.isChoice(e.tileType));
   const next=classId&&respond?'private':respond||tiles.some(e=>e.tileType==='wordcloud')?'public':'';
   if(next!==source){
    const turn=++generation;off?.();off=null;source=next;data=null;
    if(next)off=(next==='private'?watchCloud:watchPresentationWords)(room,(value,error)=>{
     if(closed||turn!==generation)return;
     problem=error?'Live responses are reconnecting…':'';
     data=value?.sessionId===sessionId?value:null;emit();
    });
   }
   emit();
  },
  read(slide,id){
   if(!onSlide(slide))return [];
   if(source==='private')return data?.activities?.[teacherEntry(id)?.key]?.words||[];
   return data?.slideIndex===current?data.clouds?.[id]||[]:[];
  },
  responses(slide,id){
   if(!onSlide(slide))return [];
   if(source==='private')return data?.activities?.[teacherEntry(id)?.key]?.answers||[];
   return data?.slideIndex===current?data.answers?.[id]||[]:[];
  },
  counts(slide,id){
   if(!onSlide(slide))return [];
   return source==='private'?data?.activities?.[teacherEntry(id)?.key]?.counts||[]:data?.slideIndex===current?data.answers?.[id]||[]:[];
  },
  ownVote:(slide,id)=>ownVotes[slide+':'+id],
  shared(slide,id){
   if(!onSlide(slide))return false;
   if(source==='private')return !!data?.activities?.[teacherEntry(id)?.key]?.shared;
   return data?.slideIndex===current&&Array.isArray(data.answers?.[id]);
  },
  focused(slide,id){
   if(!onSlide(slide))return false;
   return source==='private'?!!data?.focusKey&&data.focusKey===teacherEntry(id)?.key:data?.slideIndex===current&&data.focus===id;
  },
  answered:(slide,id)=>sent.has(slide+':'+id),
  subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
  dispose(){closed=true;generation++;off?.();off=null;data=null;emit();listeners.clear();}
 };
 if(classId)api.display=(slideId,elementId,control,enabled)=>{
  if(!onSlide(slideId))throw Error('This slide is no longer active.');
  return call({action:'displayResults',...route,classId,sessionId,slideId,elementId,control,enabled});
 };
 if(credentials)api.submit=async(slideId,elementId,input)=>{
  if(!onSlide(slideId))throw Error('Your teacher has moved to another slide.');
  const response=typeof input.answer==='string';
  const result=await call({...credentials,sessionId,action:Array.isArray(input.choices)?'submitVote':response?'submitResponse':'presentationWord',slideId,elementId,...input});
  if(result.choices)ownVotes[slideId+':'+elementId]=result.choices;
  if(response)sent.add(slideId+':'+elementId);
  return result;
 };
 return api;
}
