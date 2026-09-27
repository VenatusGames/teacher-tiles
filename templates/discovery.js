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
 const tags=section('Explore by tag','Popular subjects, routines, and activities.'),bar=el('div','template-tag-filters template-popular-tags');for(const tag of [...new Set(data.tags||[])]){const b=el('button','template-tag-filter',tag);b.type='button';b.onclick=()=>onTag(tag);bar.append(b);}tags.append(bar);
 const fitTags=()=>{if(!bar.clientWidth)return;const buttons=[...bar.children];buttons.forEach(b=>b.hidden=false);let first=null,second=null,overflow=false;for(const b of buttons){const top=b.offsetTop;if(first===null)first=top;else if(top!==first&&second===null)second=top;if(second!==null&&top>second)overflow=true;if(overflow)b.hidden=true;}};
 const resize=new ResizeObserver(fitTags);resize.observe(bar);
 return ()=>{clearInterval(timer);resize.disconnect();};
}
