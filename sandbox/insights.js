import {createRankings} from './overview-rankings.js?v=20261119-ranking-dialogs';
import { node, count, snapshotSeries, dailySeries, drawChart } from './overview-chart.js?v=20261119-insights2';

const artwork = {
  boards: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 8h4v8H7zm8 0h2m-2 4h2"/>',
  ticket: '<path d="M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4Z"/><path d="M15 8v2m0 4v2"/>',
  accounts: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5"/>',
  online: '<path d="M2 12h5l3-7 4 14 3-7h5"/>',
  day: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18m-13 5 2 2 5-4"/>',
  paid: '<path d="m3 6 5 5 4-7 4 7 5-5-2 13H5Z"/>',
  trial: '<path d="M6 3h12M6 21h12M7 3v3c0 3 3 5 5 6-2 1-5 3-5 6v3m10-18v3c0 3-3 5-5 6 2 1 5 3 5 6v3"/>',
  org: '<path d="M3 21h18M5 21V4h9v17m0-12h5v12M8 8h3m-3 4h3m-3 4h3"/>',
};
const icon = key => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${artwork[key]}</svg>`;
const subscriptions = {
  paid: ['Paid', 'paidSubscribers', 'Personal paid subscriptions'],
  trial: ['Trials', 'trialSubscribers', 'Active personal billing trials'],
  org: ['Organization Seats', 'orgSubscribers', 'Members receiving premium through their organization']
};
const ranges = [['1','24 Hours'], ['7','7 Days'], ['30','30 Days']];
const styles = [['line','Line'], ['bar','Bars']];
const defaults = { mode:'online', activityDays:'7', subscriptionDays:'30', activityStyle:'line', subscriptionStyle:'line', type:'paid' };

function controls(label, options, key, selection) {
  const group = node('div', 'overview-segments');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', label);
  for (const [value, title] of options) {
    const button = node('button', '', title);
    button.type = 'button';
    button.dataset.control = key;
    button.dataset.value = value;
    button.setAttribute('aria-pressed', String(selection === value));
    group.append(button);
  }
  return group;
}

export function createInsights(call) {
  const root = document.getElementById('developer-insights');
  root.innerHTML = `
    <div class="overview-heading">
      <p id="insights-status" role="status"></p>
    </div>
    <div class="overview-dashboard">
    <div class="overview-left"><div class="overview-metrics" role="group" aria-label="Overview Metrics">
      <article class="overview-metric" data-accent="online">
        <div class="overview-metric-label"><i class="overview-symbol">${icon('online')}</i><h3>Active Users</h3></div>
        <div class="overview-ticket-counts">
          <span><strong data-stat="online">—</strong><span>Online Now<small>Last 15 minutes</small></span></span>
          <span><strong data-stat="active24Hours">—</strong>Last 24 Hours</span>
        </div>
      </article>
      <button type="button" class="overview-metric overview-shortcut" data-accent="boards" data-destination="templates">
        <span class="overview-metric-label"><i class="overview-symbol">${icon('boards')}</i>Boards to Review</span>
        <strong data-stat="approvalQueue">—</strong>
        <span class="overview-detail">Templates awaiting approval</span>
      </button>
      <button type="button" class="overview-metric overview-shortcut" data-accent="ticket" data-destination="bugs">
        <span class="overview-metric-label"><i class="overview-symbol">${icon('ticket')}</i>Open Tickets</span>
        <span class="overview-ticket-counts">
          <span><strong data-stat="reportedTickets">—</strong>Reported</span>
          <span><strong data-stat="inProgressTickets">—</strong>In Progress</span>
        </span>
        <span class="overview-detail">Closed tickets excluded</span>
      </button>
      <article class="overview-metric" data-accent="accounts">
        <div class="overview-metric-label"><i class="overview-symbol">${icon('accounts')}</i><h3>Total Accounts</h3></div>
        <strong data-stat="total">—</strong><p>Enabled accounts</p>
      </article>
    </div>
    <section class="overview-panel overview-rankings" aria-label="Usage Rankings"></section></div>
    <div class="overview-charts">
      <article class="overview-panel overview-activity" aria-label="User Activity"></article>
      <article class="overview-panel overview-memberships" aria-label="Subscriptions"></article>
    </div></div>`;
  for (const button of root.querySelectorAll('[data-destination]')) {
    button.onclick = () => document.querySelector(`.portal-sidebar [data-portal-view="${button.dataset.destination}"]`)?.click();
  }
  const status = root.querySelector('#insights-status');
  const refresh = document.getElementById('insights-refresh');
  const rankings = createRankings(root.querySelector('.overview-rankings'),async () => {
    const {data} = await call('getDeveloperInsights',{view:'topActiveUsers'});
    if (!Array.isArray(data?.active)) throw new Error('Ranking unavailable');
    return data.active;
  });
  const activity = root.querySelector('.overview-activity');
  const members = root.querySelector('.overview-memberships');
  let snapshot = null, busy = false, generation = 0, failed = false;
  let state = {...defaults};

  function draw(panel, series, style, label) {
    const plot = node('div','overview-plot');
    panel.append(plot);
    drawChart(plot, {series, style, label, loaded:!!snapshot, failed});
    panel.append(node('p','overview-chart-note',series.note));
  }
  function renderCharts() {
    const data = snapshot || {asOf:Date.now()};
    const daily = state.mode === 'daily';
    activity.replaceChildren(node('h2','','User Activity'));
    activity.dataset.accent = 'online';
    activity.append(controls('Activity Metric', [['online','Online Now'],['daily','Daily Users']], 'mode',state.mode));
    const description = daily ? 'Unique signed-in users each day' : 'Users online at each recorded snapshot';
    activity.append(node('p','overview-context',description));
    const activityTools = node('div','overview-chart-controls');
    activityTools.append(controls('Activity Time Range',daily ? ranges.slice(1) : ranges,'activityDays',state.activityDays),
      controls('Activity Chart Style',styles,'activityStyle',state.activityStyle));
    activity.append(activityTools);
    const days = Number(state.activityDays);
    draw(activity,daily ? dailySeries(data,days) : snapshotSeries(data,'online',days),state.activityStyle,daily ? 'Daily Users' : 'Online Users');

    members.replaceChildren(node('h2','','Subscriptions'));
    const billing = snapshot?.subscriptionStatsVersion === 2 ? snapshot : null;
    const types = node('div','overview-types');
    types.setAttribute('role','group');
    types.setAttribute('aria-label','Subscription History');
    for (const [type,[title,key]] of Object.entries(subscriptions)) {
      const b = node('button','overview-type');
      b.type = 'button';
      Object.assign(b.dataset,{control:'type',value:type,accent:type});
      b.setAttribute('aria-pressed',String(type === state.type));
      b.innerHTML = `${icon(type)}<span>${title}</span><strong>${count(billing?.[key])}</strong>`;
      types.append(b);
    }
    const [title,key,detail] = subscriptions[state.type];
    members.dataset.accent = state.type;
    const tools = node('div','overview-chart-controls');
    tools.append(controls('Subscription Time Range',ranges,'subscriptionDays',state.subscriptionDays),
      controls('Subscription Chart Style',styles,'subscriptionStyle',state.subscriptionStyle));
    members.append(types,node('p','overview-context',snapshot && !billing ? 'Updated subscription statistics are pending.' : detail),tools);
    draw(members,snapshotSeries(billing || {asOf:data.asOf},key,Number(state.subscriptionDays)),state.subscriptionStyle,title);
  }
  function render() {
    for (const stat of root.querySelectorAll('[data-stat]')) stat.textContent = count(snapshot?.[stat.dataset.stat]);
    rankings.render(snapshot?.rankings,failed,snapshot !== null);
    renderCharts();
  }
  root.addEventListener('click', event => {
    const button = event.target.closest('button[data-control]');
    if (!button) return;
    const {control,value} = button.dataset;
    state[control] = value;
    if (state.mode === 'daily' && state.activityDays === '1') state.activityDays = '7';
    renderCharts();
    root.querySelector(`[data-control="${control}"][data-value="${value}"]`)?.focus({preventScroll:true});
  });
  let plotWidth = 0;
  new ResizeObserver(() => {
    const width = activity.clientWidth;
    if (width && width !== plotWidth) {
      plotWidth = width;
      for (const plot of root.querySelectorAll('.overview-plot')) plot.dispatchEvent(new Event('plotresize'));
    }
  }).observe(activity);
  async function load(force=false) {
    if (busy || (snapshot && !force)) return;
    busy = true;
    refresh.disabled = true;
    root.setAttribute('aria-busy','true');
    status.textContent = 'Refreshing snapshot…';
    const attempt = generation;
    try {
      const {data} = await call('getDeveloperInsights',{});
      if (attempt !== generation) return;
      snapshot = {...data,asOf:Number.isFinite(data.asOf) ? data.asOf : Date.now()};
      failed = false;
      render();
      status.textContent = 'Updated ' + new Date(snapshot.asOf).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
    } catch (error) {
      if (attempt !== generation) return;
      failed = true;
      status.textContent = (snapshot ? 'Showing the previous snapshot. ' : '') + 'Could not refresh. ' + (error.message || 'Please try again.');
      if (!snapshot) render();
    } finally {
      if (attempt === generation) {busy=false; refresh.disabled=false; root.setAttribute('aria-busy','false');}
    }
  }
  refresh.onclick = () => load(true);
  render();
  return {load,reset(){
    generation++; snapshot=null; busy=false; failed=false; state={...defaults}; refresh.disabled=false;
    root.setAttribute('aria-busy','false'); status.textContent='Sign in to view insights.'; render();
  }};
}
