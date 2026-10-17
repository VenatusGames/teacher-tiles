export function createCodesPanel(call) {
  const request=async data=>{const response=await call("developerCodes",data);return response?.data??response;};
  const element=document.createElement('section');
  element.id='portal-codes';element.hidden=true;
  element.innerHTML=`
    <div class="codes-head"><div><p class="eyebrow">REDEMPTION MANAGEMENT</p><h1>TT Codes</h1><p>Generate, review, disable, and audit TeacherTiles redemption codes.</p></div><button class="primary" id="codes-new" type="button">Generate Code</button></div>
    <div class="codes-toolbar">
      <input id="codes-search" type="search" placeholder="Search by a label, reward, or code word" maxlength="40">
      <select id="codes-status"><option value="active">Active</option><option value="all">All</option><option value="inactive">Disabled</option><option value="deleted">Deleted</option></select>
      <select id="codes-reward"><option value="all">All Rewards</option><option value="coins">Coin Packs</option><option value="cosmetic">Cosmetics</option><option value="membership_trial">Membership Trials</option></select>
      <button id="codes-refresh" class="quiet" type="button">Refresh</button>
    </div>
    <p id="codes-status-text" class="codes-status" role="status" aria-live="polite"></p>
    <div class="codes-table-wrap"><table class="codes-table"><thead><tr><th>Code</th><th>Reward</th><th>Status</th><th>Uses</th><th>Expires</th><th></th></tr></thead><tbody id="codes-list"></tbody></table></div><button id="codes-more" type="button" class="quiet" hidden>Load More</button>
    <dialog id="codes-create" class="codes-dialog"><form method="dialog" id="codes-create-form"><button class="codes-dialog-close quiet" type="button" data-codes-create-close aria-label="Close">×</button><p class="eyebrow">NEW REDEMPTION CODE</p><h2>Generate TT Code</h2>
      <label>Reward Type<select id="codes-create-type"><option value="coins">Coin Pack</option><option value="cosmetic">Specific Cosmetic</option><option value="membership_trial">Membership Trial</option></select></label>
      <section id="codes-create-reward-wrap" class="codes-reward-picker" aria-labelledby="codes-reward-heading">
        <div class="codes-reward-heading"><span id="codes-reward-heading">Choose a Reward</span><span id="codes-reward-count" role="status"></span></div>
        <label class="codes-reward-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg><input id="codes-reward-search" type="search" aria-label="Search Rewards" placeholder="Search rewards…" autocomplete="off"></label>
        <input id="codes-create-reward" type="hidden">
        <div id="codes-reward-options" class="codes-reward-options" role="radiogroup" aria-label="Available Rewards"></div>
        <p id="codes-selected-reward" class="codes-selected-reward" role="status">Choose a reward above.</p>
      </section>
      <label id="codes-create-days-wrap" hidden>Trial Length (Days)<input id="codes-create-days" type="number" min="1" max="365" value="30"></label>
      <label>Internal Label <input id="codes-create-label" maxlength="120" placeholder="Optional campaign / purpose"></label>
      <div class="codes-create-fields"><label>Use Limit <input id="codes-create-limit" type="number" min="1" max="100000" placeholder="Unlimited"></label>
      <label>Expires <input id="codes-create-expires" type="datetime-local"></label></div>
      <p id="codes-create-status" class="codes-status" role="status"></p><button type="button" class="quiet" id="codes-catalog-retry" hidden>Retry Loading Rewards</button>
      <div class="codes-dialog-actions"><button class="quiet" value="cancel" type="button" data-codes-cancel>Cancel</button><button class="primary" type="submit">Generate</button></div>
    </form></dialog>
    <dialog id="codes-result" class="codes-dialog codes-result"><button class="codes-dialog-close quiet" data-codes-result-close aria-label="Close">×</button><p class="eyebrow">CODE CREATED</p><h2>Ready to Redeem</h2><div class="codes-created-code" id="codes-created-code"></div><p id="codes-created-description"></p><button class="primary" id="codes-copy" type="button">Copy Code</button></dialog>
    <dialog id="codes-detail" class="codes-dialog codes-detail"><button class="codes-dialog-close quiet" data-codes-detail-close aria-label="Close">×</button><div id="codes-detail-body"></div></dialog>`;


  const q = id => element.querySelector(`#${id}`);
  const list = q('codes-list'), status = q('codes-status-text');
  const create = q('codes-create'), form = q('codes-create-form');
  const type = q('codes-create-type'), reward = q('codes-create-reward');
  let catalog, catalogPromise, loaded = false, creating = false, lastCreated = '';
  let items = [], cursor = null, loadVersion = 0, createAttempt = null;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const millis = value => value && typeof value === 'object'
    ? (value.seconds ?? value._seconds) * 1000 : new Date(value).getTime();
  const date = value => value && Number.isFinite(millis(value))
    ? new Intl.DateTimeFormat(undefined, {dateStyle:'medium', timeStyle:'short'}).format(millis(value)) : '—';
  const err = error => error?.message?.replace(/^Firebase:\s*/, '') || 'Something went wrong. Please try again.';
  const title = value => value ? value[0].toUpperCase() + value.slice(1) : 'Unknown';
  function availability(item) {
    if (item.status === 'deleted') return 'deleted';
    if (!item.active) return 'disabled';
    if (item.expiresAt && millis(item.expiresAt) <= Date.now()) return 'expired';
    if (item.maxRedemptions != null && item.completedUses >= item.maxRedemptions) return 'exhausted';
    return 'active';
  }
  const rewardOptions = q('codes-reward-options'), rewardSearch = q('codes-reward-search');
  const searchable = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const rewardKind = item => item.rewardType === 'coins' ? 'Coin Pack'
    : item.rewardId.startsWith('tile-skin-') ? 'Tile Skin'
    : item.rewardId.startsWith('presentation-theme-') ? 'Presentation Theme'
    : item.rewardId.startsWith('theme-') ? 'Theme'
    : item.rewardId.startsWith('cursor-') ? 'Cursor Pack' : 'Cosmetic Pack';
  function fillRewards() {
    const trial = type.value === 'membership_trial';
    q('codes-create-days-wrap').hidden = !trial;
    q('codes-create-reward-wrap').hidden = trial;
    const options = catalog?.[type.value === 'coins' ? 'coins' : 'cosmetics'] || [];
    const selected = options.find(item => item.rewardId === reward.value);
    if (!selected) reward.value = '';
    const terms = searchable(rewardSearch.value).split(' ').filter(Boolean);
    const visible = options.filter(item => {
      const words = searchable(`${item.name} ${item.rewardId} ${rewardKind(item)}`);
      return terms.every(term => words.includes(term));
    });
    rewardOptions.replaceChildren(...visible.map(item => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'codes-reward-option';
      button.dataset.rewardId = item.rewardId;
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', String(item.rewardId === reward.value));
      button.innerHTML = `<span><strong>${escape(item.name)}</strong><small>${escape(rewardKind(item))}</small></span><span class="codes-reward-check" aria-hidden="true">✓</span>`;
      button.onclick = () => { reward.value = item.rewardId; fillRewards(); rewardOptions.querySelector(`[data-reward-id="${item.rewardId}"]`)?.focus({preventScroll:true}); };
      return button;
    }));
    const buttons = [...rewardOptions.querySelectorAll('button')];
    const current = buttons.find(button => button.getAttribute('aria-checked') === 'true') || buttons[0];
    buttons.forEach(button => { button.tabIndex = button === current ? 0 : -1; });
    if (!visible.length) {
      const empty = document.createElement('p'); empty.className = 'codes-reward-empty';
      empty.textContent = !catalog ? 'Loading rewards…' : !options.length ? 'No rewards available. Refresh the reward catalog.' : 'No matching rewards. Try another search.';
      rewardOptions.append(empty);
    }
    q('codes-reward-count').textContent = catalog ? `${visible.length} of ${options.length}` : '';
    q('codes-selected-reward').textContent = selected ? `Selected: ${selected.name}` : 'Choose a reward above.';
    rewardSearch.placeholder = type.value === 'coins' ? 'Search coin packs…' : 'Search cosmetics by name or type…';
    form.querySelector('[type="submit"]').disabled = creating || !catalog || (!trial && !selected);
  }
  rewardSearch.oninput = fillRewards;
  rewardSearch.onkeydown = event => { if (event.key === 'Enter') event.preventDefault(); };
  rewardOptions.onkeydown = event => {
    const buttons = [...rewardOptions.querySelectorAll('button')], index = buttons.indexOf(event.target);
    if (index < 0 || !['ArrowDown','ArrowRight','ArrowUp','ArrowLeft','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : (index + (['ArrowDown','ArrowRight'].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].click();
    rewardOptions.querySelector('[aria-checked="true"]')?.scrollIntoView({block:'nearest'});
  };
  function render() {
    list.innerHTML = items.map(item => {
      const state = availability(item);
      return `<tr data-code-id="${escape(item.id)}"><td><button class="codes-link" type="button" data-code-detail>${escape(item.code || item.codeHint)}</button>${item.label ? `<small>${escape(item.label)}</small>` : ''}</td><td>${escape(item.rewardName)}</td><td><span class="codes-chip is-${state}">${title(state)}</span></td><td>${Number(item.completedUses || 0).toLocaleString()} / ${item.maxRedemptions == null ? '∞' : Number(item.maxRedemptions).toLocaleString()}${item.pendingReservations ? `<small>${Number(item.pendingReservations)} reserved</small>` : ''}</td><td>${item.expiresAt ? escape(date(item.expiresAt)) : 'Never'}</td><td>${item.status === 'deleted' ? '' : `<button class="quiet codes-row-action" type="button" data-code-toggle>${item.active ? 'Disable' : 'Enable'}</button><button class="danger codes-row-action" type="button" data-code-delete>Delete</button>`}</td></tr>`;
    }).join('') || '<tr><td colspan="6" class="codes-empty">No matching TT Codes.</td></tr>';
  }
  async function load(force = false, append = false) {
    if (loaded && !force) return;
    const version = ++loadVersion;
    status.textContent = 'Loading TT Codes…';
    q('codes-more').disabled = true;
    try {
      const filters = {action:'list', search:q('codes-search').value.trim()};
      // "All" is a UI choice, not a backend filter value.
      if (q('codes-status').value !== 'all') filters.status = q('codes-status').value;
      if (q('codes-reward').value !== 'all') filters.rewardType = q('codes-reward').value;
      if (append && cursor) filters.cursor = cursor;
      const result = await request(filters);
      if (version !== loadVersion) return;
      items = append ? [...items, ...(result.items || [])] : result.items || [];
      cursor = result.cursor || null;
      render();
      q('codes-more').hidden = !cursor;
      status.textContent = `${items.length} code${items.length === 1 ? '' : 's'}`;
      loaded = true;
    } catch (error) {
      if (version === loadVersion) status.textContent = err(error);
    } finally {
      if (version === loadVersion) q('codes-more').disabled = false;
    }
  }
  async function detail(id) {
    const dialog = q('codes-detail'), body = q('codes-detail-body');
    body.innerHTML = '<p>Loading…</p>';
    dialog.showModal();
    try {
      const item = await request({action:'detail', codeId:id});
      const uses = [...(item.redemptions || []), ...(item.reservations || []).filter(r => r.status !== 'completed')]
        .sort((a,b) => millis(b.createdAt) - millis(a.createdAt));
      body.innerHTML = `<p class="eyebrow">TT CODE DETAILS</p><h2>${escape(item.code || item.codeHint)}</h2>${item.code ? '<button class="primary" type="button" data-code-copy>Copy Code</button>' : '<p class="codes-status">This older code was stored only as a hash. Generate a replacement if you no longer have the original.</p>'}<dl class="codes-facts"><dt>Reward</dt><dd>${escape(item.rewardName)}</dd><dt>Status</dt><dd>${title(availability(item))}</dd><dt>Uses</dt><dd>${Number(item.completedUses || 0)} / ${item.maxRedemptions ?? 'unlimited'}</dd><dt>Expires</dt><dd>${item.expiresAt ? escape(date(item.expiresAt)) : 'Never'}</dd><dt>Label</dt><dd>${escape(item.label || '—')}</dd></dl><h3>Redemption History</h3><div class="codes-history">${uses.length ? uses.map(use => `<div><strong>${escape(use.uid || use.id)}</strong><span>${escape(title(use.status))}</span><small>${escape(date(use.completedAt || use.createdAt))}</small>${use.releaseReason ? `<em>${escape(use.releaseReason)}</em>` : ''}</div>`).join('') : '<p>No redemptions yet.</p>'}</div><small>Shows up to 50 recent redemptions and 50 reservations.</small>`;
      const copy=body.querySelector('[data-code-copy]');
      if(copy)copy.onclick=async()=>{try{await navigator.clipboard.writeText(item.code);copy.textContent='Copied!';}catch{copy.textContent='Select the code above to copy';}};
    } catch (error) { body.innerHTML = `<p class="codes-status">${escape(err(error))}</p>`; }
  }
  async function loadRewards(force = false) {
    if (force) catalog = null;
    form.querySelector('[type="submit"]').disabled = true;
    type.disabled = true;
    q('codes-catalog-retry').hidden = true;
    q('codes-create-status').textContent = 'Loading code rewards…';
    try {
      if (!catalog) {
        catalogPromise ||= request({action:'catalog'}).finally(() => { catalogPromise = null; });
        const received = await catalogPromise;
        if (!Array.isArray(received?.coins) || !Array.isArray(received?.cosmetics) || !received?.trials?.rewardId) {
          throw new Error('The reward service is out of date. Publish the current dev functions and try again.');
        }
        catalog = received;
      }
      fillRewards();
      q('codes-create-days').min = catalog.trials.minDays;
      q('codes-create-days').max = catalog.trials.maxDays;
      q('codes-create-status').textContent = catalog.catalogVersion === 3 ? '' : 'The deployed reward catalog is outdated and may be missing skins. Deploy the current dev backend, then reopen this menu.';
    } catch (error) {
      q('codes-create-status').textContent = err(error);
      q('codes-catalog-retry').hidden = false;
    } finally { type.disabled = false; }
  }
  q('codes-new').onclick = () => {
    form.reset(); reward.value = ''; createAttempt = null;
    q('codes-create-days').value = catalog?.trials.defaultDays || 30;
    fillRewards(); create.showModal(); void loadRewards(true);
  };
  q('codes-catalog-retry').onclick = () => loadRewards(true);
  type.onchange = () => { reward.value = ''; rewardSearch.value = ''; fillRewards(); };
  const closeCreate = () => { if (!creating) create.close(); };
  element.querySelector('[data-codes-cancel]').onclick = closeCreate;
  element.querySelector('[data-codes-create-close]').onclick = closeCreate;
  create.addEventListener('cancel', event => { if (creating) event.preventDefault(); });
  form.onsubmit = async event => {
    event.preventDefault();
    if (creating || !catalog || type.disabled || !form.reportValidity()) return;
    const trial = type.value === 'membership_trial';
    if (!trial && !catalog[type.value === 'coins' ? 'coins' : 'cosmetics'].some(item => item.rewardId === reward.value)) return;
    const expires = q('codes-create-expires').value;
    const payload = {
      action:'create', rewardType:type.value,
      rewardId:trial ? catalog.trials.rewardId : reward.value,
      ...(trial ? {trialDays:Number(q('codes-create-days').value)} : {}),
      maxRedemptions:q('codes-create-limit').value ? Number(q('codes-create-limit').value) : null,
      label:q('codes-create-label').value,
      expiresAt:expires ? new Date(expires).toISOString() : null
    };
    const fingerprint = JSON.stringify(payload);
    // Keep the same request ID on retry so a lost response cannot mint another code.
    if (createAttempt?.fingerprint !== fingerprint) createAttempt = {
      fingerprint, requestId:Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2,'0')).join('')
    };
    creating = true;
    form.querySelectorAll('input,select,button').forEach(node => { node.disabled = true; });
    q('codes-create-status').textContent = 'Generating…';
    try {
      const result = await request({...payload, requestId:createAttempt.requestId});
      lastCreated = result.code || '';
      create.close();
      q('codes-created-code').textContent = result.code || result.codeHint || 'Already Created';
      q('codes-created-description').textContent = result.code
        ? 'You can view and copy this code again from its details in TT Codes.'
        : 'This older code was stored only as a hash. If you did not save it, disable it and generate a replacement.';
      q('codes-copy').hidden = !lastCreated;
      q('codes-copy').textContent = 'Copy Code';
      q('codes-result').showModal();
      await load(true);
    } catch (error) { q('codes-create-status').textContent = err(error); }
    finally {
      creating = false;
      form.querySelectorAll('input,select,button').forEach(node => { node.disabled = false; });
      fillRewards();
    }
  };
  q('codes-copy').onclick = async () => {
    if (!lastCreated) return;
    try { await navigator.clipboard.writeText(lastCreated); q('codes-copy').textContent = 'Copied!'; }
    catch { q('codes-created-description').textContent = 'Select and copy the code above manually.'; }
  };
  q('codes-result').querySelector('[data-codes-result-close]').onclick = () => q('codes-result').close();
  q('codes-detail').querySelector('[data-codes-detail-close]').onclick = () => q('codes-detail').close();
  list.onclick = async event => {
    const row = event.target.closest('[data-code-id]');
    if (!row) return;
    const id = row.dataset.codeId;
    if (event.target.closest('[data-code-detail]')) return detail(id);
    const toggle = event.target.closest('[data-code-toggle]'), remove = event.target.closest('[data-code-delete]');
    if (!toggle && !remove) return;
    if (remove && !confirm('Delete this TT Code? It will stop redeeming, but its audit history is retained.')) return;
    row.querySelectorAll('button').forEach(node => { node.disabled = true; });
    try {
      await request(toggle ? {action:'set-active', codeId:id, active:!items.find(item => item.id === id).active} : {action:'delete', codeId:id});
      await load(true);
    } catch (error) { status.textContent = err(error); }
    finally { row.querySelectorAll('button').forEach(node => { node.disabled = false; }); }
  };
  q('codes-more').onclick = () => load(true, true);
  q('codes-refresh').onclick = () => load(true);
  q('codes-status').onchange = q('codes-reward').onchange = () => load(true);
  let searchTimer;
  q('codes-search').oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => load(true), 280); };
  return {element, load:() => load(), reset() {
    ++loadVersion; clearTimeout(searchTimer); loaded = false; items = []; cursor = null;
    list.innerHTML = ''; status.textContent = ''; q('codes-more').hidden = true;
    lastCreated = ''; q('codes-created-code').textContent = '';
    element.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  }};
}
