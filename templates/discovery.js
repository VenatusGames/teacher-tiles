const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text)n.textContent=text;return n;};
export function tagEditor(initial=[]){
 const root=el('div','template-tag-editor'),chips=el('div','template-tags'),input=el('input');input.placeholder='Type a tag and press Enter';input.setAttribute('aria-label','Add a tag');input.maxLength=24;let values=[...initial];
 const paint=()=>{chips.replaceChildren();values.forEach(tag=>{const chip=el('span','template-tag',tag),remove=el('button','','×');remove.type='button';remove.setAttribute('aria-label',`Remove tag ${tag}`);remove.onclick=()=>{values=values.filter(t=>t!==tag);input.setCustomValidity('');paint();input.focus();};chip.append(remove);chips.append(chip);});};
 const add=()=>{const tag=input.value.trim().toLowerCase();if(tag&&values.length<10&&!values.includes(tag))values.push(tag);if(values.includes(tag))input.value='';input.setCustomValidity(tag&&values.length>=10&&!values.includes(tag)?'Use up to ten tags.':'');paint();};
 input.oninput=()=>input.setCustomValidity('');input.onkeydown=e=>{if(e.key==='Enter'||e.key===','){e.preventDefault();add();}else if(e.key==='Backspace'&&!input.value){values.pop();paint();}};input.onblur=e=>{if(input.value.trim()&&!e.relatedTarget?.closest('.template-tag'))add();};root.append(input,chips);paint();return {element:root,values:()=>{add();return [...values];}};
}
export function discoveryShelves(root,data,card,onTag){
 root.replaceChildren();root.className='template-discovery';
 const section=(title,subtitle)=>{const s=el('section','template-shelf');s.append(el('h3','',title),el('p','template-hint',subtitle));root.append(s);return s;};
 const featured=section('Featured Boards','Selected by TeacherTiles to inspire your next board.'),slides=el('div','template-featured'),controls=el('div','template-feature-controls');const picks=data.featured||[];
 picks.forEach((m,i)=>{const slide=card(m);slide.classList.add('template-feature-slide');slide.hidden=i!==0;slides.append(slide);const b=el('button','',String(i+1));b.type='button';b.setAttribute('aria-label',`Show featured board ${i+1}`);b.onclick=()=>show(i);controls.append(b);});let current=0,paused=false;
 const show=i=>{current=i;[...slides.children].forEach((s,j)=>s.hidden=j!==i);[...controls.children].forEach((b,j)=>b.setAttribute('aria-pressed',String(j===i)));root.dispatchEvent(new Event('templatepreviewresize',{bubbles:true}));};
 if(picks.length){featured.append(slides,controls);show(0);}else featured.append(el('p','template-empty','Boards selected by TeacherTiles will appear here.'));
 const pause=el('button','','Pause rotation');pause.type='button';pause.onclick=()=>{paused=!paused;pause.textContent=paused?'Resume rotation':'Pause rotation';};if(picks.length>1)controls.append(pause);
 const timer=picks.length>1?setInterval(()=>{if(!paused&&!document.hidden&&root.getClientRects().length&&!featured.matches(':hover,:focus-within')&&!matchMedia('(prefers-reduced-motion: reduce)').matches)show((current+1)%picks.length);},7000):null;
 for(const [title,description,items] of [['TeacherTiles Curated','From TeacherTiles — thoughtfully selected for your classroom.',data.curated],['Most Liked','Boards the community has upvoted.',data.highlyRated]]){const s=section(title,description),row=el('div','template-shelf-row');for(const m of items||[])row.append(card(m));if(!row.children.length)row.append(el('p','template-empty','No boards here yet.'));s.append(row);}
 const tags=section('Explore by tag','Popular subjects, routines, and activities.'),browser=el('div','template-tag-browser'),bar=el('div','template-tag-filters template-popular-tags'),pager=el('div','template-tag-pager');Object.assign(bar.style,{display:'grid',gridTemplateColumns:'repeat(10,minmax(86px,1fr))',gap:'9px',overflowX:'auto',padding:'2px 0 8px',margin:'15px 0 8px'});Object.assign(pager.style,{display:'flex',alignItems:'center',justifyContent:'center',gap:'10px',margin:'4px 0 0'});
 const allTags=[...new Set((data.tags||[]).filter(Boolean))],pageSize=30,totalPages=Math.max(1,Math.ceil(allTags.length/pageSize));let page=0;
 const previous=el('button','template-tag-page-button','Previous tags'),pageLabel=el('span','template-tag-page-label'),next=el('button','template-tag-page-button','More tags');previous.type=next.type='button';
 const renderTags=()=>{
  page=Math.max(0,Math.min(page,totalPages-1));bar.replaceChildren();
  const start=page*pageSize;
  for(const tag of allTags.slice(start,start+pageSize)){const b=el('button','template-tag-filter',tag);b.type='button';b.title=tag;Object.assign(b.style,{boxSizing:'border-box',width:'100%',minWidth:'0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textAlign:'center'});b.onclick=()=>onTag(tag);bar.append(b);}
  if(!bar.children.length)bar.append(el('p','template-empty','Popular tags will appear here.'));
  previous.disabled=page===0;next.disabled=page>=totalPages-1;pageLabel.textContent=`Page ${page+1} of ${totalPages}`;pager.hidden=allTags.length<=pageSize;
 };
 previous.onclick=()=>{if(page>0){page--;renderTags();bar.scrollLeft=0;}};next.onclick=()=>{if(page<totalPages-1){page++;renderTags();bar.scrollLeft=0;}};
 pager.append(previous,pageLabel,next);browser.append(bar,pager);tags.append(browser);renderTags();
 return ()=>{clearInterval(timer);};
}
