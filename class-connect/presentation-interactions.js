import {call,watchPresentationWords} from './boards.js?v=20261112-present-mode-connect';
// One listener per active presentation, shared by all interactive objects on its current slide.
export function createInteractionChannel({room,sessionId,deck,credentials}){
 let current=-1,data=null,off=null,closed=false,problem='';const listeners=new Set();
 const emit=()=>{for(const fn of listeners)fn();};
 const api={
  get problem(){return problem;},
  setSlide(index){if(closed||current===index)return;current=index;problem='';const needs=deck.slides[index]?.elements.some(e=>e.type==='tile'&&e.tileType==='wordcloud');if(!needs){off?.();off=null;data=null;}else if(!off)off=watchPresentationWords(room,(value,error)=>{if(closed)return;problem=error?'Live responses are reconnecting…':'';data=value?.sessionId===sessionId?value:null;emit();});emit();},
  read(slideId,elementId){return !closed&&deck.slides[current]?.id===slideId&&data?.slideIndex===current?data.clouds?.[elementId]||[]:[];},
  subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
  dispose(){closed=true;off?.();off=null;listeners.clear();data=null;}
 };
 if(credentials)api.submit=async(slideId,elementId,input)=>{if(closed||deck.slides[current]?.id!==slideId)throw Error('Your teacher has moved to another slide.');return call({...credentials,sessionId,action:'presentationWord',slideId,elementId,...input});};
 return api;
}
