import {createTrendCharts} from './insight-trends.js?v=20261012-compact-users';
export function createInsights(call){
 const root=document.getElementById('developer-insights');
 root.innerHTML=`<div class="insights-header"><div><h2>At a glance</h2><p id="insights-status" role="status">Loading a current snapshot…</p></div><button class="quiet" id="insights-refresh">Refresh insights</button></div>
 <div class="insight-cards"><article class="insight-card insight-online"><span class="insight-icon" aria-hidden="true">●</span><h3>Current Online Users</h3><strong data-stat="online">—</strong><small>Active within the last 6 minutes</small></article><article class="insight-card insight-subscribers"><svg class="insight-icon" viewBox="0 0 48 48" aria-hidden="true"><use href="assets/ui/subscriber-crown.svg#crown"/></svg><h3>Current Subscribers</h3><strong data-stat="subscribers">—</strong><small>Active subscriptions · excludes previews</small></article><article class="insight-card insight-approvals"><span class="insight-icon" aria-hidden="true">▤</span><h3>Boards Approval Queue</h3><strong data-stat="approvalQueue">—</strong><small>Awaiting manual review</small></article><article class="insight-card insight-bugs"><span class="insight-icon" aria-hidden="true">⚑</span><h3>Bug Reports</h3><strong data-stat="bugReports">—</strong><small>Reports submitted by users</small></article></div>
 <section class="insight-trends" aria-label="Online users and subscriber trends"></section>
 <div class="insight-charts" hidden><article class="insight-chart"><h3>Account activity</h3><p>Current snapshot of enabled accounts</p><div class="activity-total"><strong data-stat="total">—</strong><span>enabled accounts</span></div><div class="activity-bar" role="img"><i></i></div><div class="chart-legend"><span class="online-legend"></span><span class="offline-legend"></span></div></article><article class="insight-chart subscription-chart"><div><h3>Subscription share</h3><p>Active subscriptions across enabled accounts</p><span class="subscription-legend"></span></div><div class="subscription-donut" role="img"><strong></strong></div></article></div>`;
 const trends=createTrendCharts(root.querySelector('.insight-trends'));
 const status=root.querySelector('#insights-status'),refresh=root.querySelector('button');let loaded=false,busy=false,generation=0;
 async function load(force=false){if(busy||loaded&&!force)return;loaded=true;busy=true;refresh.disabled=true;status.textContent='Loading a current snapshot…';const attempt=generation;
  try{const {data}=await call('getDeveloperInsights',{});if(attempt!==generation)return;
   trends.update(data);
   for(const key of ['online','subscribers','total','approvalQueue','bugReports'])root.querySelector(`[data-stat=${key}]`).textContent=Number(data[key]).toLocaleString();
   const total=Math.max(data.total,data.online,data.subscribers,1),online=data.online/total*100,subscribers=data.subscribers/total*100;
   root.querySelector('.activity-bar i').style.width=online+'%';root.querySelector('.activity-bar').setAttribute('aria-label',`${data.online} online out of ${data.total} enabled accounts`);
   root.querySelector('.online-legend').textContent=`${data.online} online`;root.querySelector('.offline-legend').textContent=`${Math.max(0,data.total-data.online)} not recently active`;
   const donut=root.querySelector('.subscription-donut');donut.style.setProperty('--share',subscribers+'%');donut.querySelector('strong').textContent=Math.round(subscribers)+'%';donut.setAttribute('aria-label',`${data.subscribers} active subscribers`);
   root.querySelector('.subscription-legend').textContent=`${data.subscribers} active subscribers`;root.querySelector('.insight-charts').hidden=false;
   status.textContent='Updated '+new Date(data.asOf).toLocaleTimeString()+'. Refresh manually for new data.';
  }catch(error){if(attempt===generation)status.textContent='Insights could not load. '+(error.message||'Try Refresh insights.');}
  finally{if(attempt===generation){busy=false;refresh.disabled=false;}}
 }
 refresh.onclick=()=>load(true);
 return {load,reset(){trends.reset();generation++;loaded=busy=false;refresh.disabled=false;root.querySelectorAll('[data-stat]').forEach(el=>el.textContent='—');root.querySelector('.insight-charts').hidden=true;status.textContent='Sign in to view insights.';}};
}
