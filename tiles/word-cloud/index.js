(()=>{'use strict';
const ns='http://www.w3.org/2000/svg';
const clean=rows=>(Array.isArray(rows)?rows:[]).filter(w=>w&&typeof w.text==='string'&&[...w.text].length<=40&&Number.isFinite(w.count)&&w.count>0).slice(0,120).map(w=>({text:w.text,count:Math.min(2000,Math.floor(w.count))}));
function layout(words,font='Arial'){
 const g=document.createElement('canvas').getContext('2d'),sorted=[...words].sort((a,b)=>b.count-a.count||a.text.localeCompare(b.text)),max=Math.max(1,...sorted.map(w=>w.count)),min=Math.max(1,Math.min(...sorted.map(w=>w.count)));
 // Relative frequency controls emphasis; bound the contrast so rare words stay readable.
 const exponent=max>min?Math.min(.9,Math.log(4.5)/Math.log(max/min)):.9;
 for(let scale=1;scale>.025;scale*=.88){const placed=[];let fits=true;
  for(const word of sorted){const size=108*Math.pow(word.count/max,exponent)*scale;g.font='700 '+size+'px '+font;const width=g.measureText(word.text).width+20*scale,height=size*1.25+8*scale;let spot;
   for(let i=0;i<5000;i++){const angle=i*.29,r=Math.sqrt(i)*5.5,x=480+Math.cos(angle)*r*1.45,y=290+Math.sin(angle)*r;
    const box={x:x-width/2,y:y-height/2,w:width,h:height};if(box.x<22||box.x+width>938||box.y<20||box.y+height>560)continue;
    if(placed.some(p=>box.x<p.x+p.w&&box.x+box.w>p.x&&box.y<p.y+p.h&&box.y+box.h>p.y))continue;
    spot={...box,cx:x,cy:y,size,...word};break;
   }if(!spot){fits=false;break;}placed.push(spot);
  }if(fits)return placed;
 }return [];
}
function render(host,rows){
 const words=clean(rows);let svg=host.querySelector('svg.wordcloud-art');if(!svg){svg=document.createElementNS(ns,'svg');svg.classList.add('wordcloud-art');svg.setAttribute('viewBox','0 0 960 580');svg.setAttribute('role','img');host.replaceChildren(svg);}
 svg.setAttribute('aria-label',words.length?words.map(w=>w.text+': '+w.count).join(', '):'Waiting for words');
 const old=new Map([...svg.querySelectorAll('text')].map(n=>[n.dataset.word,n]));
 const font=getComputedStyle(host).getPropertyValue('--module-font').trim()||'Arial';
 for(const word of layout(words,font)){let text=old.get(word.text);if(!text){text=document.createElementNS(ns,'text');text.dataset.word=word.text;text.setAttribute('text-anchor','middle');text.setAttribute('dominant-baseline','central');const label=document.createElementNS(ns,'tspan');label.textContent=word.text;const title=document.createElementNS(ns,'title');text.append(label,title);svg.append(text);}old.delete(word.text);
  text.querySelector('title').textContent=word.text+' · '+word.count;text.style.transform='translate('+word.cx+'px,'+word.cy+'px)';text.style.fontSize=word.size+'px';text.dataset.count=word.count;text.style.fontFamily=font;text.style.fill='hsl(212 75% '+Math.max(32,70-9*Math.log2(word.count))+'%)';
 }for(const node of old.values())node.remove();
}
function setup(tile){
 setupClassroomTileControls(tile);
 if(window.ClassConnectPolicy)tile._wordCloudInteractionId=crypto.randomUUID();
 const stage=tile.querySelector('.wordcloud-stage'),prompt=tile.querySelector('.wordcloud-prompt'),empty=tile.querySelector('.wordcloud-empty'),total=tile.querySelector('.wordcloud-total'),status=tile.querySelector('.wordcloud-status'),connect=tile.querySelector('.wordcloud-connect');let words=[],disposed=false;
 const paint=()=>{render(stage,words);empty.hidden=words.length>0;total.textContent=words.length?words.reduce((sum,w)=>sum+w.count,0)+' words shared':'';};
 tile._wordCloudUpdate=rows=>{words=clean(rows);paint();};
 tile._wordCloudInfo=()=>({prompt:prompt.value.trim()||'Share a word with your class'});
 tile._wordCloudStatus=(text,live)=>{status.textContent=text;prompt.disabled=live;tile.classList.toggle('is-classconnect-live',live);connect.setAttribute('aria-label',live?'ClassConnect word cloud · Live':'ClassConnect word cloud');};
 connect.onclick=()=>window.TeacherTilesBoardSessions.wordcloud(tile).catch(e=>status.textContent=e.message);
 prompt.addEventListener('change',()=>(tile._presentationChanged||window.notifyBoardChanged)?.('wordcloud-question'));
 tile._boardGetState=()=>({...window.ClassConnectPolicy?{interactionId:tile._wordCloudInteractionId}:{},prompt:prompt.value,words:window.ClassConnectPolicy?[]:clean(words)});
 tile._boardSetState=value=>{void tile._classConnectSession?.end();if(window.ClassConnectPolicy&&value?.interactionId)tile._wordCloudInteractionId=value.interactionId;prompt.value=String(value?.prompt||'').slice(0,160);words=clean(value?.words);paint();};
 const appearanceObserver=new MutationObserver(paint);appearanceObserver.observe(tile,{attributes:true,attributeFilter:['data-font']});
 const cleanup=tile._cleanup;tile._cleanup=()=>{if(disposed)return;disposed=true;appearanceObserver.disconnect();void tile._classConnectSession?.end();cleanup?.();};
 if(window.ClassConnectPolicy||tile.dataset.presentationEmbedded==='true')connect.hidden=true;paint();
 if(window.ClassConnectPolicy?.controlled&&window.ClassConnectPolicy.student){
  tile.classList.add('is-wordcloud-input');prompt.disabled=true;prompt.placeholder='Send a word to the Word Cloud';
  const form=document.createElement('form'),input=document.createElement('input'),send=document.createElement('button'),feedback=document.createElement('p');form.className='wordcloud-input-form';input.type='text';input.maxLength=40;input.required=true;input.autocomplete='off';input.placeholder='Type a word…';input.setAttribute('aria-label','Your word');send.type='submit';send.textContent='Send Word';feedback.className='wordcloud-input-feedback';feedback.setAttribute('role','status');form.append(input,send,feedback);tile.querySelector('.wordcloud-content').replaceChildren(form);total.hidden=true;status.hidden=true;
  let busy=false,pending=null,until=0,timer=0;
  const button=()=>{const n=Math.max(0,Math.ceil((until-performance.now())/1000));send.disabled=busy||n>0;send.textContent=n?'Send in '+n+'s':'Send Word';if(!n&&timer){clearInterval(timer);timer=0;}};
  const cooldown=()=>{until=performance.now()+2000;if(!timer)timer=setInterval(button,100);button();};
  form.addEventListener('pointerdown',e=>e.stopPropagation());form.addEventListener('keydown',e=>e.stopPropagation());
  form.onsubmit=async e=>{e.preventDefault();if(busy||disposed||performance.now()<until)return;const word=input.value.trim();if(!word)return;if(pending?.word!==word)pending={word,requestId:crypto.randomUUID()};busy=true;input.disabled=true;button();feedback.textContent='Sending…';
   try{await window.ClassConnectPolicy.submitWord(tile,pending);if(disposed)return;pending=null;input.value='';feedback.textContent='Your word joined the cloud!';cooldown();}
   catch(error){if(disposed)return;if(error.code==='functions/resource-exhausted'&&/moment/.test(error.message)){feedback.textContent='';cooldown();}else feedback.textContent=String(error.message||'Could not send. Try again.').replace(/\s*\[\d{3}\]\s*$/,'');}
   finally{busy=false;if(!disposed){input.disabled=false;button();input.focus({preventScroll:true});}}
  };
  const previous=tile._cleanup;tile._cleanup=()=>{clearInterval(timer);pending=null;previous?.();};
 }

}
window.TeacherTilesWordCloud=Object.freeze({setup,render,clean,layout});
})();
