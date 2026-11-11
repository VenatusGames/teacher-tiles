(()=>{'use strict';
const ns='http://www.w3.org/2000/svg',palette=['#3269b5','#a84e80','#428a79','#8e64ac','#c27831','#436b8c'];
const clean=rows=>(Array.isArray(rows)?rows:[]).filter(w=>w&&typeof w.text==='string'&&[...w.text].length<=40&&Number.isFinite(w.count)&&w.count>0).slice(0,120).map(w=>({text:w.text,count:Math.min(2000,Math.floor(w.count))}));
function layout(words){
 const g=document.createElement('canvas').getContext('2d'),sorted=[...words].sort((a,b)=>b.count-a.count||a.text.localeCompare(b.text)),max=Math.max(1,...sorted.map(w=>w.count));
 for(let scale=1;scale>.025;scale*=.88){const placed=[];let fits=true;
  for(const word of sorted){const size=(24+64*Math.sqrt(word.count/max))*scale;g.font='700 '+size+'px Arial';const width=g.measureText(word.text).width+20*scale,height=size*1.25+8*scale;let spot;
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
 for(const word of layout(words)){let text=old.get(word.text);if(!text){text=document.createElementNS(ns,'text');text.dataset.word=word.text;text.setAttribute('text-anchor','middle');text.setAttribute('dominant-baseline','central');const label=document.createElementNS(ns,'tspan');label.textContent=word.text;const title=document.createElementNS(ns,'title');text.append(label,title);svg.append(text);}old.delete(word.text);
  text.querySelector('title').textContent=word.text+' · '+word.count;text.style.transform='translate('+word.cx+'px,'+word.cy+'px)';text.style.fontSize=word.size+'px';text.dataset.count=word.count;let hash=0;for(const c of word.text)hash=(hash*31+c.codePointAt(0))>>>0;text.style.fill=palette[hash%palette.length];
 }for(const node of old.values())node.remove();
}
function setup(tile){
 const stage=tile.querySelector('.wordcloud-stage'),prompt=tile.querySelector('.wordcloud-prompt'),empty=tile.querySelector('.wordcloud-empty'),total=tile.querySelector('.wordcloud-total'),status=tile.querySelector('.wordcloud-status'),connect=tile.querySelector('.wordcloud-connect');let words=[],disposed=false;
 const paint=()=>{render(stage,words);empty.hidden=words.length>0;total.textContent=words.length?words.reduce((sum,w)=>sum+w.count,0)+' words shared':'';};
 tile._wordCloudUpdate=rows=>{words=clean(rows);paint();};
 tile._wordCloudInfo=()=>({prompt:prompt.value.trim()||'Share a word with your class'});
 tile._wordCloudStatus=(text,live)=>{status.textContent=text;prompt.disabled=live;tile.classList.toggle('is-classconnect-live',live);connect.setAttribute('aria-label',live?'ClassConnect word cloud · Live':'ClassConnect word cloud');};
 connect.onclick=()=>window.TeacherTilesBoardSessions.wordcloud(tile).catch(e=>status.textContent=e.message);
 prompt.addEventListener('change',()=>window.notifyBoardChanged?.('wordcloud-question'));
 tile._boardGetState=()=>({prompt:prompt.value,words:clean(words)});
 tile._boardSetState=value=>{void tile._classConnectSession?.end();prompt.value=String(value?.prompt||'').slice(0,160);words=clean(value?.words);paint();};
 const cleanup=tile._cleanup;tile._cleanup=()=>{if(disposed)return;disposed=true;void tile._classConnectSession?.end();cleanup?.();};
 if(window.ClassConnectPolicy)connect.hidden=true;paint();
}
window.TeacherTilesWordCloud=Object.freeze({setup,render,clean,layout});
})();
