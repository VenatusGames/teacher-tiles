/* Shared slide artwork: editor, shop previews and exports use the same SVG. */
(()=>{'use strict';
 const pastel=(id,name,base,accent,soft)=>({id,name,background:base,accent,soft,price:25,description:`Soft ${name.slice(7).toLowerCase()} curves and a clean, open canvas. Includes eight editable slide layouts.`});
 const catalog=Object.freeze([
  pastel('pastel-red','Pastel Red','#fff2ef','#d9817d','#f8d6d1'),
  pastel('pastel-blue','Pastel Blue','#eff6ff','#7c9fcd','#d5e5f7'),
  pastel('pastel-yellow','Pastel Yellow','#fffbeb','#d6b561','#f5e9b6'),
  pastel('pastel-green','Pastel Green','#f0f8ef','#82a989','#d7e9d5'),
  pastel('pastel-pink','Pastel Pink','#fff1f7','#cf90ad','#f4d6e5'),
  pastel('pastel-purple','Pastel Purple','#f6f1ff','#a28ac6','#e4d8f5'),
  {id:'construction-site',name:'Construction Site',background:'#fff8e8',accent:'#d7a745',soft:'#f3e4bc',price:30,description:'A tower crane, worksite details and striped borders. Includes eight editable slide layouts.'},
  {id:'notebook-paper',name:'Notebook Paper',background:'#fffef9',accent:'#83a6c7',soft:'#e7eff6',price:30,description:'Blue ruled paper, a red margin and punched holes. Includes eight editable slide layouts.'},
  {id:'cardboard',name:'Cardboard',background:'#dfc19b',accent:'#ab8058',soft:'#eddbc3',price:30,description:'Warm kraft paper with fine fibers, corrugated edges and tape details. Includes eight editable slide layouts.'}
 ].map(t=>Object.freeze({...t,productId:'presentation-theme-'+t.id})));
 const all=Object.freeze([{id:'none',name:'None',background:'#ffffff'},{id:'white',name:'White',background:'#ffffff',accent:'#829cc0',soft:'#e7eef7'},{id:'gray',name:'Gray',background:'#e9edf2',accent:'#657c96',soft:'#d5dfe9'},{id:'black',name:'Black',background:'#1c2330',accent:'#b9a8e8',soft:'#34394f'},...catalog]);
 const get=id=>all.find(t=>t.id===id)||all[0],urls=new Map(),images=new Map();
 function artwork(id){
  const t=get(id);let art='';
  if(id.startsWith('pastel-'))art=`<path d="M680 0H960V185C862 186 883 77 790 80S695 45 680 0Z" fill="${t.soft}"/><path d="M756 0C824 87 885 15 960 102" fill="none" stroke="${t.accent}" stroke-opacity=".35" stroke-width="2"/><path d="M0 427C84 410 113 505 210 490S343 518 380 540H0Z" fill="${t.soft}"/><circle cx="885" cy="58" r="13" fill="${t.accent}" opacity=".6"/><g fill="${t.accent}" opacity=".4"><circle cx="868" cy="495" r="3"/><circle cx="887" cy="495" r="3"/><circle cx="906" cy="495" r="3"/></g>`;
  if(id==='construction-site')art=`<defs><pattern id="stripes" width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="36" height="36" fill="#e9bd5d"/><rect width="18" height="36" fill="#46505b"/></pattern></defs><path d="M0 523H960V540H0Z" fill="url(#stripes)"/><g stroke="#ba934c" stroke-width="3" fill="none" opacity=".7"><path d="M876 25V171M896 25V171M876 27l20 24-20 24 20 24-20 24 20 24M786 28H941V44H786ZM786 44l33-16 34 16 33-16 32 16M886 12l-40 16M886 12l32 16M805 45v44"/><path d="M799 89v8a6 6 0 0 0 12 0"/><path d="M867 171h38"/></g><g fill="#dcb66e" opacity=".45"><path d="M12 503h34v-25H12Zm40 0h34v-25H52Zm-20-32h34v-25H32Z"/><path d="m916 505 12-34 12 34Z"/></g>`;
  if(id==='notebook-paper')art=`<defs><pattern id="rules" width="960" height="32" patternUnits="userSpaceOnUse"><path d="M0 31.5H960" stroke="#adc8df" stroke-opacity=".55"/></pattern></defs><rect width="960" height="540" fill="url(#rules)"/><path d="M46 0V540" stroke="#da9898" stroke-width="2"/>${[70,270,470].map(y=>`<circle cx="20" cy="${y+2}" r="8" fill="#e3e4de"/><circle cx="20" cy="${y}" r="7" fill="#f6f6f1" stroke="#d6d8d1"/>`).join('')}<path d="M910 0h50v50Z" fill="#e7e8de"/>`;
  if(id==='cardboard'){
   const fibers=Array.from({length:230},(_,i)=>{const x=(i*173+29)%960,y=(i*97+13)%540;return `<path d="m${x} ${y} ${3+i%7} ${i%3-1}"/>`;}).join('');
   art=`<defs><pattern id="flutes" width="8" height="12" patternUnits="userSpaceOnUse"><path d="M0 12Q4-8 8 12" fill="none" stroke="#a67f55" stroke-width="1.5"/></pattern></defs><g stroke="#a5815c" stroke-width=".8" opacity=".2">${fibers}</g><path d="M0 0H960V12H0ZM0 528H960V540H0Z" fill="url(#flutes)"/><path d="M13 21H947V519H13Z" fill="none" stroke="#b68e66" stroke-opacity=".4" stroke-dasharray="4 5"/><path d="m803 18 113 0-5 11 7 9-5 10-111 0 5-10-7-8Z" fill="#f7e7c8" opacity=".65"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><rect width="960" height="540" fill="${t.background}"/>${art}</svg>`;
 }
 function url(id){if(!catalog.some(t=>t.id===id))return '';if(!urls.has(id))urls.set(id,'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(artwork(id)));return urls.get(id);}
 async function draw(ctx,id){if(!url(id))return;if(!images.has(id)){const image=new Image();image.src=url(id);images.set(id,image.decode().then(()=>image).catch(error=>{images.delete(id);throw error;}));}ctx.drawImage(await images.get(id),0,0,960,540);}
 function preview(id){const t=get(id),host=document.createElement('span');host.className='presentation-theme-preview';host.style.backgroundColor=t.background;host.style.backgroundImage=`url("${url(id)}")`;host.style.setProperty('--presentation-preview-accent',t.accent);const title=document.createElement('strong');title.textContent=t.name;const lines=document.createElement('span');lines.className='presentation-theme-preview-lines';host.append(title,lines);return host;}
 window.TeacherTilesPresentationThemes={catalog,all,get,url,draw,preview};
})();
