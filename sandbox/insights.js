import {createTrendCharts} from './insight-trends.js?v=20261015-override-20261012-daily-online';
export function createInsights(call){
 const root=document.getElementById('developer-insights');
 root.innerHTML=`<div class="insights-header"><div><h2>At a Glance</h2><p id="insights-status" role="status">Loading a current snapshot…</p></div><button class="quiet" id="insights-refresh"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1"/></svg>Refresh Insights</button></div>
 <div class="insight-cards">
  <article class="insight-card insight-online"><div class="insight-card-top"><span class="insight-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5"/></svg></span><span class="insight-caption">Activity</span></div><h3>Online Users</h3><strong data-stat="online">—</strong><small>Active in the last 6 minutes</small><div class="insight-track" aria-hidden="true"><i data-meter="online"></i></div></article>
  <article class="insight-card insight-active-day"><div class="insight-card-top"><span class="insight-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span><span class="insight-caption">Past 24 Hours</span></div><h3>Recently Online</h3><strong data-stat="active24Hours">—</strong><small>Unique signed-in users active on the site in the last 24 hours</small><span class="insight-bottom-label">Site activity · rolling 24 hours</span></article>
  <article class="insight-card insight-subscribers"><div class="insight-card-top"><span class="insight-icon" aria-hidden="true"><svg viewBox="0 0 48 48"><use href="assets/ui/subscriber-crown.svg#crown"/></svg></span><div class="portal-segments membership-tabs" role="group" aria-label="Subscription type"><button type="button" data-membership-kind="paid" aria-pressed="true">Paid</button><button type="button" data-membership-kind="trials" aria-pressed="false">Trials</button></div></div><h3>Paid Subscribers</h3><strong data-stat="subscribers">—</strong><small>Active paid subscriptions</small><div class="insight-track" aria-hidden="true"><i data-meter="subscribers"></i></div></article>
  <article class="insight-card insight-approvals"><div class="insight-card-top"><span class="insight-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h4m0 4 2 2 4-4"/></svg></span><span class="insight-caption">Community</span></div><h3>Boards to Review</h3><strong data-stat="approvalQueue">—</strong><small>Templates awaiting approval</small><span class="insight-bottom-label">Manual review queue</span></article>
  <article class="insight-card insight-bugs"><div class="insight-card-top"><span class="insight-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-9l-5 3v-3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M7 8h10M7 12h6"/></svg></span><span class="insight-caption">Support</span></div><h3>Open Tickets</h3><div class="ticket-insight-counts"><div><strong data-stat="reportedTickets">—</strong><small>Reported</small></div><div><strong data-stat="inProgressTickets">—</strong><small>In Progress</small></div></div><span class="insight-bottom-label">Closed tickets excluded</span></article>
 </div>
 <div class="insight-charts" hidden>
  <article class="insight-chart"><div><h3>Account Activity</h3><p>Activity across enabled accounts.</p></div><div class="portal-ring-content"><div class="portal-ring activity-ring" role="img"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="portal-ring-track" cx="60" cy="60" r="50"/><circle class="portal-ring-fill" cx="60" cy="60" r="50" pathLength="100"/></svg><span class="portal-ring-center"><strong>—</strong><small>online</small></span></div><div class="portal-ring-legend"><div class="activity-total"><strong data-stat="total">—</strong><span>enabled accounts</span></div><div class="chart-legend"><span class="online-legend"></span><span class="offline-legend"></span></div></div></div></article>
  <article class="insight-chart subscription-chart"><div class="membership-chart-heading"><h3>Subscription Share</h3><div class="portal-segments membership-tabs" role="group" aria-label="Subscription type"><button type="button" data-membership-kind="paid" aria-pressed="true">Paid</button><button type="button" data-membership-kind="trials" aria-pressed="false">Trials</button></div><p>Trials include dev-console testing subscriptions.</p></div><div class="portal-ring-content"><div class="portal-ring subscription-donut" role="img"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="portal-ring-track" cx="60" cy="60" r="50"/><circle class="portal-ring-fill" cx="60" cy="60" r="50" pathLength="100"/></svg><span class="portal-ring-center"><strong>—</strong><small>subscribed</small></span></div><div class="portal-ring-legend"><div class="activity-total"><strong data-membership-count>—</strong><span>active subscriptions</span></div><span class="subscription-legend"></span><p class="subscription-other"></p></div></div></article>
 </div>
 <section class="insight-trends" aria-label="Online users and subscriber trends"></section>`;
 const trends=createTrendCharts(root.querySelector('.insight-trends'));
 let membershipKind='paid',snapshot=null;
 function renderMembership(){
  trends.setMembershipKind(membershipKind);
  root.querySelectorAll('button[data-membership-kind]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.membershipKind===membershipKind)));
  const paid=membershipKind==='paid',title=paid?'Paid Subscribers':'Trial Subscribers';
  root.querySelector('.insight-subscribers h3').textContent=title;
  root.querySelector('.insight-subscribers>small').textContent=paid?'Active paid subscriptions':'Trials, free permanent access, and dev testing';
  root.querySelector('.subscription-chart>div>p').textContent=paid?'Paid memberships only · trials and dev previews excluded.':'Includes free permanent access and dev testing · paid plans excluded.';
  root.querySelector('.subscription-chart').dataset.membershipKind=membershipKind;
  if(!snapshot)return;
  const count=snapshot[paid?'paidSubscribers':'trialSubscribers'],known=Number.isFinite(count);
  const total=Math.max(snapshot.total,known?count:0,1),percent=known?count/total*100:0;
  root.querySelector('[data-stat=subscribers]').textContent=known?count.toLocaleString():'—';
  root.querySelector('[data-meter=subscribers]').style.width=percent+'%';
  const donut=root.querySelector('.subscription-donut');donut.querySelector('.portal-ring-fill').style.strokeDasharray=percent+' 100';donut.querySelector('strong').textContent=known?Math.round(percent)+'%':'—';donut.querySelector('small').textContent=paid?'paid':'trial';
  donut.setAttribute('aria-label',known?`${count} ${title.toLowerCase()} out of ${snapshot.total} enabled accounts`:'Separate subscription counts are unavailable');
  root.querySelector('[data-membership-count]').textContent=known?count.toLocaleString():'—';
  root.querySelector('.subscription-chart .activity-total span').textContent=paid?'active paid subscriptions':'active trial subscriptions';
  root.querySelector('.subscription-legend').textContent=known?`${count.toLocaleString()} ${paid?'paid':'trial'} subscribers`:'Deploy the updated backend for separate counts.';
  root.querySelector('.subscription-other').textContent=known?`${Math.max(0,snapshot.total-count).toLocaleString()} other accounts`:'';
 }
 root.addEventListener('click',event=>{const button=event.target.closest('button[data-membership-kind]');if(!button)return;membershipKind=button.dataset.membershipKind;renderMembership();});
 const status=root.querySelector('#insights-status'),refresh=root.querySelector('button');let loaded=false,busy=false,generation=0;
 async function load(force=false){if(busy||loaded&&!force)return;loaded=true;busy=true;refresh.disabled=true;root.setAttribute('aria-busy','true');status.textContent='Loading a current snapshot…';const attempt=generation;
  try{const {data}=await call('getDeveloperInsights',{});if(attempt!==generation)return;
   snapshot=data;trends.update(data);
   for(const key of ['online','subscribers','total','approvalQueue','reportedTickets','inProgressTickets'])root.querySelector(`[data-stat=${key}]`).textContent=Number(data[key]||0).toLocaleString();
   root.querySelector('[data-stat=active24Hours]').textContent=Number.isFinite(data.active24Hours)?data.active24Hours.toLocaleString():'—';
   const total=Math.max(data.total,data.online,data.subscribers,1),online=data.online/total*100,subscribers=data.subscribers/total*100;
   root.querySelector('[data-meter=online]').style.width=online+'%';root.querySelector('[data-meter=subscribers]').style.width=subscribers+'%';
   root.classList.remove('insights-updated');void root.offsetWidth;root.classList.add('insights-updated');
   const activity=root.querySelector('.activity-ring');activity.querySelector('strong').textContent=Math.round(online)+'%';activity.querySelector('.portal-ring-fill').style.strokeDasharray=online+' 100';activity.setAttribute('aria-label',`${data.online} online out of ${data.total} enabled accounts`);
   root.querySelector('.online-legend').textContent=`${Number(data.online).toLocaleString()} online`;root.querySelector('.offline-legend').textContent=`${Math.max(0,data.total-data.online).toLocaleString()} not recently active`;
   const donut=root.querySelector('.subscription-donut');donut.querySelector('.portal-ring-fill').style.strokeDasharray=subscribers+' 100';donut.querySelector('strong').textContent=Math.round(subscribers)+'%';donut.setAttribute('aria-label',`${data.subscribers} active subscriptions out of ${data.total} enabled accounts`);
   root.querySelector('[data-membership-count]').textContent=Number(data.subscribers).toLocaleString();root.querySelector('.subscription-legend').textContent=`${Number(data.subscribers).toLocaleString()} subscribed`;root.querySelector('.subscription-other').textContent=`${Math.max(0,data.total-data.subscribers).toLocaleString()} other accounts`;root.querySelector('.insight-charts').hidden=false;
   renderMembership();
   status.textContent='Updated '+new Date(data.asOf).toLocaleTimeString()+'. Refresh manually for new data.';
  }catch(error){if(attempt===generation)status.textContent='Insights could not load. '+(error.message||'Try Refresh Insights.');}
  finally{if(attempt===generation){busy=false;refresh.disabled=false;root.setAttribute('aria-busy','false');}}
 }
 refresh.onclick=()=>load(true);
 return {load,reset(){snapshot=null;membershipKind='paid';trends.reset();renderMembership();generation++;loaded=busy=false;refresh.disabled=false;root.setAttribute('aria-busy','false');root.classList.remove('insights-updated');root.querySelectorAll('[data-meter]').forEach(el=>el.style.width='0%');root.querySelectorAll('[data-stat]').forEach(el=>el.textContent='—');root.querySelector('.insight-charts').hidden=true;status.textContent='Sign in to view insights.';}};
}
