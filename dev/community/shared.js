export function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}
export function eventArt(event){
 if(event.image==='builtin:halloween'){const art=el('div','community-halloween');art.setAttribute('role','img');art.setAttribute('aria-label','Halloween event with a jack-o-lantern and spiderwebs');const title=el('strong','','Halloween'),img=el('img');img.src=new URL('../assets/shop/halloween-pumpkin.webp',import.meta.url).href;img.alt='';art.append(title,img);return art}
 if(!event.image)return null;const img=el('img','community-image');img.src=event.image;img.alt=event.name||event.question||'';img.loading='lazy';img.decoding='async';return img;
}
export function eventDates(event){const format=value=>new Date(value+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});return event.startDate&&event.endDate?`${format(event.startDate)} – ${format(event.endDate)}`:''}
export function resultRows(poll,counts){const wrap=el('div','community-results'),total=poll.options.reduce((sum,o)=>sum+(counts[o.id]||0),0);for(const option of poll.options){const count=counts[option.id]||0,percent=total?Math.round(count/total*100):0,row=el('div','community-result'),bar=el('i');bar.style.width=percent+'%';row.append(bar,el('span','',option.label),el('b','',`${percent}% · ${count}`));wrap.append(row)}wrap.append(el('small','',`${total} vote${total===1?'':'s'}`));return wrap}

export function eventTitle(event,tag='h4'){const title=el(tag,'community-event-title');title.append(el('span','',event.name));if(event.upcoming)title.append(el('span','community-upcoming','Upcoming'));return title}
