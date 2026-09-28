export function createCodesPanel(call) {
  const request=async data=>{const response=await call("developerCodes",data);return response?.data??response;};
  const element=document.createElement('section');
  element.id='portal-codes';element.hidden=true;
  element.innerHTML=`
    <div class="codes-head"><div><p class="eyebrow">REDEMPTION MANAGEMENT</p><h1>TT Codes</h1><p>Generate, review, disable, and audit TeacherTiles redemption codes.</p></div><button class="primary" id="codes-new" type="button">Generate Code</button></div>
    <div class="codes-toolbar">
      <input id="codes-search" type="search" placeholder="Search label, reward, code, or creator" maxlength="120">
      <select id="codes-status"><option value="active">Active</option><option value="all">All</option><option value="exhausted">Exhausted</option><option value="expired">Expired</option><option value="disabled">Disabled</option></select>
      <select id="codes-reward"><option value="all">All rewards</option><option value="coin_pack">Coin packs</option><option value="cosmetic">Cosmetics</option><option value="membership_trial">Membership trials</option></select>
      <button id="codes-refresh" class="quiet" type="button">Refresh</button>
    </div>
    <p id="codes-status-text" class="codes-status" role="status" aria-live="polite"></p>
    <div class="codes-table-wrap"><table class="codes-table"><thead><tr><th>Code</th><th>Reward</th><th>Status</th><th>Uses</th><th>Expires</th><th></th></tr></thead><tbody id="codes-list"></tbody></table></div>
    <dialog id="codes-create" class="codes-dialog"><form method="dialog" id="codes-create-form"><button class="codes-dialog-close quiet" type="button" data-codes-create-close aria-label="Close">×</button><p class="eyebrow">NEW REDEMPTION CODE</p><h2>Generate TT Code</h2>
      <label>Reward type<select id="codes-create-type"><option value="coin_pack">Coin pack</option><option value="cosmetic">Specific cosmetic</option><option value="membership_trial">Membership trial</option></select></label>
      <label id="codes-create-reward-wrap">Reward<select id="codes-create-reward"></select></label>
      <label id="codes-create-days-wrap" hidden>Trial length (days)<input id="codes-create-days" type="number" min="1" max="365" value="30"></label>
      <label>Internal label <input id="codes-create-label" maxlength="120" placeholder="Optional campaign / purpose"></label>
      <label>Use limit <input id="codes-create-limit" type="number" min="1" max="1000000" placeholder="Unlimited"></label>
      <label>Expires <input id="codes-create-expires" type="datetime-local"></label>
      <p id="codes-create-status" class="codes-status" role="status"></p>
      <div class="codes-dialog-actions"><button class="quiet" value="cancel" type="button" data-codes-cancel>Cancel</button><button class="primary" type="submit">Generate</button></div>
    </form></dialog>
    <dialog id="codes-result" class="codes-dialog codes-result"><button class="codes-dialog-close quiet" data-codes-result-close aria-label="Close">×</button><p class="eyebrow">CODE CREATED</p><h2>Ready to redeem</h2><div class="codes-created-code" id="codes-created-code"></div><p id="codes-created-description"></p><button class="primary" id="codes-copy" type="button">Copy Code</button></dialog>
    <dialog id="codes-detail" class="codes-dialog codes-detail"><button class="codes-dialog-close quiet" data-codes-detail-close aria-label="Close">×</button><div id="codes-detail-body"></div></dialog>`;

  const q=id=>element.querySelector(`#${id}`),list=q('codes-list'),status=q('codes-status-text');
  const create=q('codes-create'),form=q('codes-create-form'),type=q('codes-create-type'),reward=q('codes-create-reward'),rewardWrap=q('codes-create-reward-wrap'),daysWrap=q('codes-create-days-wrap');
  let catalog={coinPacks:[],cosmetics:[]},loaded=false,busy=false,creating=false,lastCreated='';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=value=>value?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Never';
  const err=error=>['functions/not-found','functions/unavailable'].includes(error?.code)?'The TT Codes service is unavailable. Deploy developerCodes, then refresh this page.':error?.message?.replace(/^Firebase:\s*/,'')||'Something went wrong.';
  function setBusy(value){busy=value;element.querySelectorAll('button,select,input').forEach(node=>node.disabled=value)}
  function fillRewards(){
    const value=type.value;reward.innerHTML='';daysWrap.hidden=value!=='membership_trial';rewardWrap.hidden=value==='membership_trial';
    const items=value==='coin_pack'?catalog.coinPacks:value==='cosmetic'?catalog.cosmetics:[];
    for(const item of items){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;reward.append(option)}
  }
  async function ensureCatalog(){if(catalog.coinPacks.length||catalog.cosmetics.length)return;catalog=await request({action:'catalog'});fillRewards()}
  function statusLabel(item){return item.status[0].toUpperCase()+item.status.slice(1)}
  function render(items){
    list.innerHTML=items.map(item=>`<tr data-code-id="${item.id}"><td><button class="codes-link" type="button" data-code-detail>${escape(item.hint)}</button>${item.label?`<small>${escape(item.label)}</small>`:''}</td><td>${escape(item.rewardName)}</td><td><span class="codes-chip is-${escape(item.status)}">${escape(statusLabel(item))}</span></td><td>${item.useCount.toLocaleString()}${item.maxUses===null?' / ∞':` / ${item.maxUses.toLocaleString()}`}${item.reservedCount?`<small>${item.reservedCount} reserved</small>`:''}</td><td>${escape(date(item.expiresAtMs))}</td><td><button class="quiet codes-row-action" type="button" data-code-toggle>${item.active?'Disable':'Enable'}</button><button class="danger codes-row-action" type="button" data-code-delete>Delete</button></td></tr>`).join('')||'<tr><td colspan="6" class="codes-empty">No matching TT Codes.</td></tr>';
  }
  async function load(force=false){if(busy||loaded&&!force)return;setBusy(true);status.textContent='Loading TT Codes…';try{const result=await request({action:'list',status:q('codes-status').value,rewardType:q('codes-reward').value,search:q('codes-search').value});render(result.items||[]);status.textContent=result.truncated?'Showing the newest 1,000 stored codes. Narrow the filters to find older codes.':`${(result.items||[]).length} code${(result.items||[]).length===1?'':'s'}`;loaded=true}catch(error){status.textContent=err(error)}finally{setBusy(false)}}
  async function detail(id){const dialog=q('codes-detail'),body=q('codes-detail-body');body.innerHTML='<p>Loading…</p>';dialog.showModal();try{const result=await request({action:'detail',id}),item=result.item,uses=result.uses||[];body.innerHTML=`<p class="eyebrow">TT CODE DETAILS</p><h2>${escape(item.hint)}</h2><dl class="codes-facts"><dt>Reward</dt><dd>${escape(item.rewardName)}</dd><dt>Status</dt><dd>${escape(statusLabel(item))}</dd><dt>Uses</dt><dd>${item.useCount}${item.maxUses===null?' / unlimited':` / ${item.maxUses}`}</dd><dt>Expires</dt><dd>${escape(date(item.expiresAtMs))}</dd><dt>Label</dt><dd>${escape(item.label||'—')}</dd></dl><h3>Redemption history</h3><div class="codes-history">${uses.length?uses.map(use=>`<div><strong>${escape(use.uid)}</strong><span>${escape(use.status)}</span><small>${escape(date(use.completedAtMs||use.createdAtMs))}</small>${use.releaseReason?`<em>${escape(use.releaseReason)}</em>`:''}</div>`).join(''):'<p>No redemptions yet.</p>'}</div>${result.historyTruncated?'<small>Showing the first 250 stored redemption records.</small>':''}`;}catch(error){body.innerHTML=`<p class="codes-status">${escape(err(error))}</p>`}}
  q('codes-new').onclick=async()=>{const opener=q('codes-new');opener.disabled=true;status.textContent='Loading code rewards…';try{await ensureCatalog();q('codes-create-status').textContent='';form.reset();q('codes-create-days').value='30';fillRewards();create.showModal();status.textContent='';}catch(error){status.textContent=err(error)}finally{opener.disabled=false}};
  type.onchange=fillRewards;
  const closeCreate=()=>{if(!creating)create.close();};
  element.querySelector('[data-codes-cancel]').onclick=closeCreate;
  element.querySelector('[data-codes-create-close]').onclick=closeCreate;
  create.addEventListener('cancel',e=>{if(creating)e.preventDefault();});
  form.onsubmit=async event=>{event.preventDefault();if(busy||creating)return;creating=true;const submit=form.querySelector('[type="submit"]');submit.disabled=true;q('codes-create-status').textContent='Generating…';try{const expires=q('codes-create-expires').value;const result=await request({action:'create',rewardType:type.value,rewardId:reward.value,trialDays:q('codes-create-days').value,maxUses:q('codes-create-limit').value,label:q('codes-create-label').value,expiresAt:expires?new Date(expires).toISOString():null});lastCreated=result.code;create.close();q('codes-created-code').textContent=result.code;q('codes-created-description').textContent=result.item.rewardName;q('codes-result').showModal();loaded=false;await load(true)}catch(error){q('codes-create-status').textContent=err(error)}finally{creating=false;submit.disabled=false}};
  q('codes-copy').onclick=async()=>{if(!lastCreated)return;await navigator.clipboard.writeText(lastCreated);q('codes-copy').textContent='Copied!';setTimeout(()=>q('codes-copy').textContent='Copy Code',1400)};
  q('codes-result').querySelector('[data-codes-result-close]').onclick=()=>q('codes-result').close();
  q('codes-detail').querySelector('[data-codes-detail-close]').onclick=()=>q('codes-detail').close();
  list.onclick=async event=>{const row=event.target.closest('[data-code-id]');if(!row)return;const id=row.dataset.codeId;if(event.target.closest('[data-code-detail]'))return detail(id);if(event.target.closest('[data-code-toggle]')){const button=event.target.closest('[data-code-toggle]');button.disabled=true;try{await request({action:'set-active',id,active:button.textContent.trim()==='Enable'});loaded=false;await load(true)}catch(error){status.textContent=err(error)}return}if(event.target.closest('[data-code-delete]')){if(!confirm('Delete this TT Code? It will immediately stop redeeming, but its audit history is retained.'))return;try{await request({action:'delete',id});loaded=false;await load(true)}catch(error){status.textContent=err(error)}}};
  q('codes-refresh').onclick=()=>{loaded=false;void load(true)};
  q('codes-status').onchange=q('codes-reward').onchange=()=>{loaded=false;void load(true)};
  let searchTimer;q('codes-search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{loaded=false;void load(true)},280)};
  return{element,load:()=>load(false),reset(){loaded=false;list.innerHTML='';status.textContent='';}};
}
