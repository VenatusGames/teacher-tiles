import {openTicketThread,ticketBadge} from '../ticket-thread.js?v=20260926-ticket-updates';
const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
const labels={new:'Reported','in-progress':'In Progress',complete:'Closed'};
export function createBugReports(call){
 const element=el('section');element.id='portal-bug-reports';element.hidden=true;
 const header=el('div'),title=el('h1','Tickets'),filter=el('select'),refresh=el('button','Refresh'),status=el('p'),list=el('div'),more=el('button','Load more');header.className='bug-report-toolbar';filter.setAttribute('aria-label','Filter tickets');
 for(const [value,name] of Object.entries({all:'All tickets',...labels})){const option=el('option',name);option.value=value;filter.append(option);}header.append(title,filter,refresh);list.className='bug-report-list';more.hidden=true;status.setAttribute('role','status');element.append(header,status,list,more);let cursor=null,generation=0;const cache=new Map();
 const request=async data=>(await call('developerBugReports',data)).data;
 async function load(force=false,append=false){const ticket=++generation,key=filter.value;if(force)cache.clear();refresh.disabled=more.disabled=true;status.textContent='Loading tickets…';try{let data=!append&&cache.get(key);if(!data||Date.now()-data.at>300000){data={...(await request({action:'list',status:key,cursor:append?cursor:null})),at:Date.now()};if(!append)cache.set(key,data);}if(ticket!==generation)return;if(!append)list.replaceChildren();for(const report of data.items){const row=el('button');row.className='bug-report-row';row.append(el('strong',report.title),el('span',report.category+' · '+report.authorEmail),ticketBadge(report.status));row.dataset.status=report.status;row.onclick=()=>detail(report.id);list.append(row);}cursor=data.cursor;more.hidden=!cursor;status.textContent=list.children.length?'':'No tickets here.';}catch(error){if(ticket===generation)status.textContent=error.message;}finally{if(ticket===generation)refresh.disabled=more.disabled=false;}}
 function detail(id){openTicketThread({id,request,admin:true,onChange:()=>load(true)});}
 refresh.onclick=()=>load(true);filter.onchange=()=>load();more.onclick=()=>load(false,true);
 return {element,load,reset(){generation++;cache.clear();list.replaceChildren();document.querySelectorAll('.ticket-thread').forEach(d=>d.close());}};
}
