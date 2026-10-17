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

 const layoutIds=Object.freeze(['title','content','columns','section','image','quote','steps','discussion']);
 const layoutId=value=>layoutIds.includes(value)?value:'';
 // Artwork stays behind the editable objects; no bitmap assets or extra reads per slide.
 function variation(t,layout){
  const i=layoutIds.indexOf(layout),a=t.accent,s=t.soft;
  const path=(d,fill=s,extra='')=>`<path d="${d}" fill="${fill}" ${extra}/>`;
  const rect=(x,y,w,h,fill=s,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
  const circle=(x,y,r,fill=s,extra='')=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
  const line=(d,color=a,extra='')=>path(d,'none',`stroke="${color}" ${extra.includes('stroke-width=')?'':'stroke-width="2"'} ${extra}`);
  if(t.id.startsWith('pastel-')||['white','gray','black'].includes(t.id)){
   const arrangements=[
    path('M780 0H960V540H880C830 455 940 395 865 305S735 147 780 0Z')+circle(884,92,42,a,'opacity=".22"')+path('M0 480Q155 430 345 540H0Z'),
    path('M0 0H960V25Q735 63 480 26T0 42Z')+line('M65 504H895',''+a,'opacity=".35"')+circle(913,489,12),
    path('M0 0H210Q130 42 0 93Z')+path('M960 540H750Q830 498 960 447Z')+line('M472 165V465',a,'opacity=".18" stroke-dasharray="5 9"'),
    rect(0,0,960,540,s)+circle(927,490,255,t.background)+circle(927,490,212,'none',`stroke="${a}" stroke-width="2" opacity=".3"`)+rect(0,0,17,540,a),
    path('M625 0H960V540H728C650 450 705 330 650 215S598 60 625 0Z')+line('M625 38Q602 165 650 215',a,'opacity=".4"')+circle(905,488,16,a,'opacity=".25"'),
    circle(4,40,180)+circle(4,40,143,t.background)+line('M0 160Q95 167 135 73',a,'opacity=".3"')+path('M700 540Q828 435 960 440V540Z'),
    [0,1,2].map(n=>path(`M${n*320} 540V507Q${n*320+160} 465 ${n*320+320} 507V540Z`)+circle(n*320+160,510,5,a,'opacity=".5"')).join('')+line('M65 26H245',a,'opacity=".3"'),
    path('M0 0H960V64Q720 2 480 40T0 64Z')+path('M0 540V475Q240 540 480 505T960 475V540Z')+circle(911,105,22,'none',`stroke="${a}" stroke-width="2" opacity=".3"`)
   ];return arrangements[i];
  }
  if(t.id==='construction-site'){
   const stripe=(d)=>`<defs><pattern id="hazard" width="32" height="32" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="32" height="32" fill="#ebc367"/><rect width="16" height="32" fill="#46505b"/></pattern></defs>`+path(d,'url(#hazard)');
   const crane=(x,y,scale=1)=>`<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="#b58e46" stroke-width="3" opacity=".65"><path d="M100 0v190M120 0v190M100 0l20 30-20 30 20 30-20 30 20 30-20 30M0 20h180v20H0ZM0 40l40-20 40 20 40-20 40 20M110 0l-55 20M110 0l55 20M25 40v64q0 10 10 10t10-10M90 190h40"/></g>`;
   const skyline=`<g fill="${s}" stroke="${a}" stroke-opacity=".35">${[0,1,2,3,4,5].map(n=>rect(n*175,500-(n%3)*12,130,40+(n%3)*12)).join('')}</g>`;
   const cone=(x,y)=>`<g transform="translate(${x} ${y})">${path('M0 34 13 0 26 34Z','#e3ad52')}${path('M6 18H20L23 26H3Z','#fff7df')}${rect(-4,34,34,5,'#62635a')}</g>`;
   return [
    crane(770,22,.95)+stripe('M0 524H960V540H0Z')+cone(900,474),
    stripe('M0 0H960V10H0Z')+line('M65 505H895',a,'stroke-dasharray="12 8"')+cone(910,461),
    rect(0,0,960,20,s)+stripe('M0 0H12V540H0Z')+line('M474 168V470',a,'stroke-dasharray="5 9" opacity=".3"')+cone(910,480),
    rect(0,0,960,540,s)+crane(750,265,1.25)+stripe('M0 0H960V16H0Z')+line('M20 515H730',a),
    rect(620,0,340,540,'#f4e7c8')+crane(800,16,.7)+stripe('M0 530H600V540H0Z'),
    skyline+stripe('M0 0H12V540H0Z')+line('M850 30h64v64M30 420v64h64',a),
    stripe('M0 526H960V540H0Z')+[135,425,715].map(x=>cone(x,474)).join('')+line('M70 28H890',a,'stroke-dasharray="8 8" opacity=".3"'),
    skyline+crane(800,16,.6)+stripe('M0 0H960V10H0Z')
   ][i];
  }
  if(t.id==='notebook-paper'){
   const rules=(x,y,w,h,step=32)=>`<g stroke="#9bbbd4" opacity=".4">${Array.from({length:Math.floor(h/step)},(_,n)=>line(`M${x} ${y+(n+1)*step}h${w}`,'#9bbbd4','stroke-width="1"')).join('')}</g>`;
   const holes=(x,ys)=>ys.map(y=>circle(x,y,6,'#edeee8',`stroke="#d8dcd5" stroke-width="1"`)).join('');
   const tab=(x,w,color)=>rect(x,0,w,14,color,'rx="3"');
   return [
    rules(0,350,960,190)+line('M46 0V540','#d99898')+holes(20,[70,270,470])+tab(740,95,'#efcfbe')+tab(841,95,'#c9dce8'),
    rules(0,0,960,540)+line('M46 0V540','#d99898')+holes(20,[70,270,470]),
    rules(60,135,385,370)+rules(500,135,385,370)+line('M472 145V505','#d99898')+tab(65,125,'#c9dce8')+tab(500,125,'#e5d7ee'),
    rect(0,0,960,540,'#e7eef3')+path('M34 10 940 28 928 525 20 507Z','#fffef9')+rules(56,350,820,150)+line('M57 30 43 490','#d99898')+tab(740,125,'#efcfbe'),
    rules(635,110,280,385)+line('M620 32V510','#d99898')+holes(20,[70,270,470])+path('M900 0h60v60Z','#e3e9df'),
    rules(40,30,880,460,48)+line('M40 38H920','#d99898')+path('M900 540h60v-60Z','#e3e9df')+tab(758,140,'#eed9ba'),
    [65,355,645].map((x,n)=>rect(x,140,250,365,'#fffdf5',`stroke="#dee3df"`)+rules(x+10,145,230,345)+rect(x+75,130,100,19,['#d8e8d1','#f0d8ba','#e4d8ed'][n])).join(''),
    `<g fill="#a5bdd0" opacity=".35">${Array.from({length:240},(_,n)=>circle(20+(n%30)*32,20+Math.floor(n/30)*72,1.5,'#a5bdd0')).join('')}</g>`+path('M0 0H960V32H0Z','#e2eaf1')+line('M0 505H960','#d99898')+holes(20,[100,270,440])
   ][i];
  }
  if(t.id==='cardboard'){
   const fibers=`<g stroke="#95704d" opacity=".18">${Array.from({length:200},(_,n)=>line(`m${(n*173+29)%960} ${(n*97+13)%540} ${3+n%7} ${n%3-1}`,'#95704d','stroke-width=".8"')).join('')}</g>`;
   const tape=(x,y,w,angle=0)=>`<g transform="translate(${x} ${y}) rotate(${angle})">${path(`M0 0H${w}l-5 8 5 9-5 10H0l5-10-5-9Z`,'#f7e7c8','opacity=".8"')}</g>`;
   const stitch=(x,y,w,h)=>rect(x,y,w,h,'none',`rx="8" stroke="#b58d64" stroke-dasharray="5 6"`);
   const torn=(x,y,w,h)=>path(`M${x} ${y}l${w*.23} 4 ${w*.25}-6 ${w*.27} 5 ${w*.25}-3v${h}l-${w*.22}-4-${w*.26} 6-${w*.28}-5-${w*.24} 3Z`,'#eddbc3');
   return fibers+[
    stitch(22,22,916,496)+tape(775,12,145,8)+tape(16,481,135,-10),
    stitch(24,24,912,492)+rect(0,0,12,540,'#b78e60')+tape(780,12,140,0),
    torn(48,145,406,355)+torn(486,145,406,355)+tape(175,130,145,-4)+tape(620,130,145,4),
    path('M0 0H960V540H0Z','#d2ad80')+path('M710 0H960V540H830L770 280Z','#eddbc3')+line('M710 0 770 280 830 540','#ad835c','stroke-dasharray="5 7"')+tape(20,20,125,0),
    torn(48,130,567,345)+tape(50,117,125,-8)+tape(485,450,125,8)+stitch(632,145,270,325),
    torn(85,80,790,380)+tape(380,63,170,-3)+line('M115 440H845','#b58d64','stroke-dasharray="4 7"'),
    [65,355,645].map((x,n)=>torn(x,156,250,320)+tape(x+60,143,130,n===1?4:-4)).join('')+stitch(18,18,924,504),
    torn(55,145,850,300)+stitch(70,160,820,270)+tape(45,122,130,-7)+tape(795,428,125,7)
   ][i];
  }
  return '';
 }

 function artwork(id,layout){
  const t=get(id);let art='';
  if(id.startsWith('pastel-'))art=`<path d="M680 0H960V185C862 186 883 77 790 80S695 45 680 0Z" fill="${t.soft}"/><path d="M756 0C824 87 885 15 960 102" fill="none" stroke="${t.accent}" stroke-opacity=".35" stroke-width="2"/><path d="M0 427C84 410 113 505 210 490S343 518 380 540H0Z" fill="${t.soft}"/><circle cx="885" cy="58" r="13" fill="${t.accent}" opacity=".6"/><g fill="${t.accent}" opacity=".4"><circle cx="868" cy="495" r="3"/><circle cx="887" cy="495" r="3"/><circle cx="906" cy="495" r="3"/></g>`;
  if(id==='construction-site')art=`<defs><pattern id="stripes" width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="36" height="36" fill="#e9bd5d"/><rect width="18" height="36" fill="#46505b"/></pattern></defs><path d="M0 523H960V540H0Z" fill="url(#stripes)"/><g stroke="#ba934c" stroke-width="3" fill="none" opacity=".7"><path d="M876 25V171M896 25V171M876 27l20 24-20 24 20 24-20 24 20 24M786 28H941V44H786ZM786 44l33-16 34 16 33-16 32 16M886 12l-40 16M886 12l32 16M805 45v44"/><path d="M799 89v8a6 6 0 0 0 12 0"/><path d="M867 171h38"/></g><g fill="#dcb66e" opacity=".45"><path d="M12 503h34v-25H12Zm40 0h34v-25H52Zm-20-32h34v-25H32Z"/><path d="m916 505 12-34 12 34Z"/></g>`;
  if(id==='notebook-paper')art=`<defs><pattern id="rules" width="960" height="32" patternUnits="userSpaceOnUse"><path d="M0 31.5H960" stroke="#adc8df" stroke-opacity=".55"/></pattern></defs><rect width="960" height="540" fill="url(#rules)"/><path d="M46 0V540" stroke="#da9898" stroke-width="2"/>${[70,270,470].map(y=>`<circle cx="20" cy="${y+2}" r="8" fill="#e3e4de"/><circle cx="20" cy="${y}" r="7" fill="#f6f6f1" stroke="#d6d8d1"/>`).join('')}<path d="M910 0h50v50Z" fill="#e7e8de"/>`;
  if(id==='cardboard'){
   const fibers=Array.from({length:230},(_,i)=>{const x=(i*173+29)%960,y=(i*97+13)%540;return `<path d="m${x} ${y} ${3+i%7} ${i%3-1}"/>`;}).join('');
   art=`<defs><pattern id="flutes" width="8" height="12" patternUnits="userSpaceOnUse"><path d="M0 12Q4-8 8 12" fill="none" stroke="#a67f55" stroke-width="1.5"/></pattern></defs><g stroke="#a5815c" stroke-width=".8" opacity=".2">${fibers}</g><path d="M0 0H960V12H0ZM0 528H960V540H0Z" fill="url(#flutes)"/><path d="M13 21H947V519H13Z" fill="none" stroke="#b68e66" stroke-opacity=".4" stroke-dasharray="4 5"/><path d="m803 18 113 0-5 11 7 9-5 10-111 0 5-10-7-8Z" fill="#f7e7c8" opacity=".65"/>`;
  }
  if(layoutId(layout))art=variation(t,layout);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><rect width="960" height="540" fill="${t.background}"/>${art}</svg>`;
 }
 function url(id,layout){const chosen=layoutId(layout),key=id+'/'+chosen;if(!catalog.some(t=>t.id===id)&&!(chosen&&['white','gray','black'].includes(id)))return '';if(!urls.has(key))urls.set(key,'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(artwork(id,chosen)));return urls.get(key);}
 async function draw(ctx,id,layout){const src=url(id,layout);if(!src)return;const key=id+'/'+layoutId(layout);if(!images.has(key)){const image=new Image();image.src=src;images.set(key,image.decode().then(()=>image).catch(error=>{images.delete(key);throw error;}));}ctx.drawImage(await images.get(key),0,0,960,540);}
 function preview(id){const t=get(id),host=document.createElement('span');host.className='presentation-theme-preview';host.style.backgroundColor=t.background;host.style.backgroundImage=`url("${url(id)}")`;host.style.setProperty('--presentation-preview-accent',t.accent);const title=document.createElement('strong');title.textContent=t.name;const lines=document.createElement('span');lines.className='presentation-theme-preview-lines';host.append(title,lines);return host;}
 window.TeacherTilesPresentationThemes={catalog,all,get,url,draw,preview,layoutIds};
})();
