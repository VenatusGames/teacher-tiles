const dateLabel = value => value ? new Date(value).toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'}) : 'Not available';

export function subscriptionDuration(start,end){
  if(!start)return 'Not available';
  const from=new Date(start),to=end?new Date(end):new Date();
  if(!Number.isFinite(from.getTime())||!Number.isFinite(to.getTime()))return 'Not available';
  let months=(to.getUTCFullYear()-from.getUTCFullYear())*12+to.getUTCMonth()-from.getUTCMonth();
  const anniversary=new Date(from);
  anniversary.setUTCDate(1);anniversary.setUTCMonth(from.getUTCMonth()+months);
  anniversary.setUTCDate(Math.min(from.getUTCDate(),new Date(Date.UTC(anniversary.getUTCFullYear(),anniversary.getUTCMonth()+1,0)).getUTCDate()));
  if(to<anniversary)months--;
  return months<1?'Less than 1 month':`${months} ${months===1?'month':'months'}`;
}
function planPrice(s){
  if(s.amount===null||!s.currency)return 'Not available';
  const formatter=new Intl.NumberFormat(undefined,{style:'currency',currency:s.currency});
  const amount=formatter.format(s.amount/(10**formatter.resolvedOptions().maximumFractionDigits));
  const interval=s.intervalCount===1?s.interval:`${s.intervalCount} ${s.interval}s`;
  return s.interval?`${amount} / ${interval}`:amount;
}
export function setupSubscriptionManagement(call,getUserId,getSubscriptionAccess=()=>false){
  const trigger=document.getElementById('profile-manage-subscription');
  if(!trigger)return;
  const dialog=document.createElement('dialog');dialog.className='subscription-dialog';
  dialog.setAttribute('aria-labelledby','subscription-panel-title');
  dialog.innerHTML=`<header class="subscription-dialog__header"><span class="subscription-dialog__crown" aria-hidden="true"><svg viewBox="0 0 48 48"><use href="assets/ui/subscriber-crown.svg?v=20260926#crown"/></svg></span><div><small>TEACHERTILES MEMBERSHIP</small><h2 id="subscription-panel-title">Manage Subscription</h2></div><button type="button" data-close aria-label="Close subscription details">×</button></header><div class="subscription-dialog__body"><p class="subscription-feedback" role="status" aria-live="polite"></p><div class="subscription-details"></div><section class="subscription-confirm" hidden aria-labelledby="subscription-confirm-title"><h3 id="subscription-confirm-title">Cancel Subscription?</h3><p></p><div><button type="button" data-keep>Keep Subscription</button><button type="button" data-confirm class="subscription-danger">Confirm Cancellation</button></div></section></div><footer><span>Billing details are securely provided by Stripe.</span><button type="button" data-refresh>Refresh</button></footer>`;
  document.body.append(dialog);
  const feedback=dialog.querySelector('.subscription-feedback'),details=dialog.querySelector('.subscription-details'),confirm=dialog.querySelector('.subscription-confirm'),refresh=dialog.querySelector('[data-refresh]');
  let generation=0,owner='',selected=null,busy=false,resultData=null;
  const valid=token=>dialog.open&&token===generation&&owner===getUserId();
  const say=(text,error=false)=>{feedback.textContent=text;feedback.classList.toggle('is-error',error);feedback.hidden=!text;};
  const resetConfirmation=()=>{selected=null;confirm.hidden=true;};
  const setBusy=value=>{busy=value;dialog.setAttribute('aria-busy',String(value));dialog.querySelectorAll('[data-cancel-subscription],[data-confirm],[data-keep],[data-refresh]').forEach(button=>button.disabled=value);};
  const node=(tag,className,text)=>{const element=document.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=text;return element;};
  function render(result){
    resultData=result;details.replaceChildren();resetConfirmation();
    if(!result.subscriptions?.length){
      const dev=window.TeacherTilesAdminAccess?.developer===true&&window.TeacherTilesSandbox?.subscriptionEnabled===true;
      const access=result.accessWithoutBilling||getSubscriptionAccess();
      const empty=node('section','subscription-empty');empty.append(node('h3','',dev?'Developer Subscription Access':access?'Membership Access':'No Subscription'));
      empty.append(node('p','',access||dev?'There is no recurring Stripe subscription to cancel on this account.':'You do not currently have a TeacherTiles subscription.'));
      details.append(empty);return;
    }
    for(const s of result.subscriptions){
      const ended=['canceled','incomplete_expired'].includes(s.status);
      const card=node('section','subscription-membership'),head=node('div','subscription-membership__head');
      const labels={active:'Active',trialing:'Free Trial',past_due:'Payment Overdue',unpaid:'Unpaid',paused:'Paused',canceled:'Ended',incomplete:'Payment Incomplete',incomplete_expired:'Expired'};
      const badge=node('span','subscription-status',s.cancellationScheduled&&!ended?'Cancellation Scheduled':labels[s.status]||'Subscription');badge.dataset.status=ended?'ended':s.cancellationScheduled?'ending':s.status;
      head.append(node('h3','','TeacherTiles Subscriber'),badge);card.append(head);
      const metrics=node('div','subscription-metrics');
      for(const [label,value] of [['Time Subscribed',subscriptionDuration(s.startedAt,s.endedAt)],['Plan Price',planPrice(s)]]){const metric=node('div','subscription-metric');metric.append(node('span','',label),node('strong','',value));metrics.append(metric)}card.append(metrics);
      const dates=node('dl','subscription-dates');
      for(const [label,value] of [['Member Since',s.startedAt],[ended?'Membership Ended':s.cancellationScheduled?'Access Ends':s.status==='trialing'?'Trial Ends':'Current Period Ends',ended?s.endedAt:s.cancellationScheduled?s.endsAt:s.nextBillingAt]]){dates.append(node('dt','',label),node('dd','',dateLabel(value)))}card.append(dates);
      card.append(node('p','subscription-fine-print','Duration covers this membership, including any trial time. Plan price is before applicable discounts or taxes.'));
      if(s.cancellationScheduled&&!ended)card.append(node('p','subscription-notice',`Cancellation is scheduled for ${dateLabel(s.endsAt)}. Your current access continues until then.`));
      if(s.scheduleManaged&&!s.cancellationScheduled&&!ended)card.append(node('p','subscription-notice','This plan has a custom billing schedule. Contact Support to manage cancellation.'));
      if(s.canCancel){const cancel=node('button','subscription-cancel','Cancel Subscription');cancel.type='button';cancel.dataset.cancelSubscription=s.id;cancel.addEventListener('click',()=>{if(busy)return;selected=s;confirm.hidden=false;confirm.querySelector('p').textContent=`Your subscription will stop renewing at the end of this billing cycle, on ${dateLabel(s.nextBillingAt)}. This does not end your current access immediately.`;confirm.querySelector('[data-keep]').focus({preventScroll:true});confirm.scrollIntoView({block:'nearest',behavior:'smooth'});});card.append(cancel)}
      details.append(card);
    }
  }
  async function load(){
    const token=++generation;resetConfirmation();details.replaceChildren();setBusy(true);say('Loading subscription details…');
    try{const result=await call('getSubscriptionDetails');if(valid(token)){render(result);say('')}}
    catch(error){if(valid(token))say(error.message||'Unable to load subscription details. Please try again.',true)}
    finally{if(valid(token))setBusy(false)}
  }
  trigger.addEventListener('click',()=>{if(!getUserId()||dialog.open)return;owner=getUserId();dialog.showModal();load()});
  dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()}});
  dialog.addEventListener('close',()=>{generation++;owner='';resultData=null;resetConfirmation();details.replaceChildren();say('');setBusy(false)});
  window.addEventListener('teachertiles:authchange',()=>{if(dialog.open&&getUserId()!==owner)dialog.close()});
  refresh.addEventListener('click',load);
  dialog.querySelector('[data-keep]').addEventListener('click',()=>{const id=selected?.id;resetConfirmation();[...details.querySelectorAll('[data-cancel-subscription]')].find(b=>b.dataset.cancelSubscription===id)?.focus()});
  dialog.querySelector('[data-confirm]').addEventListener('click',async()=>{
    if(busy||!selected||owner!==getUserId())return;
    const token=++generation,subscription=selected;setBusy(true);say('Scheduling cancellation…');
    try{const updated=await call('scheduleSubscriptionCancellation',{subscriptionId:subscription.id,currentPeriodEnd:subscription.currentPeriodEnd,confirm:true});if(valid(token)){render({...resultData,subscriptions:resultData.subscriptions.map(s=>s.id===updated.id?updated:s)});setBusy(false);say(`Cancellation scheduled. Your current access continues until ${dateLabel(updated.endsAt)}.`)}}
    catch(error){if(valid(token)){say(error.message||'Cancellation could not be confirmed. Refresh the details before trying again.',true);setBusy(false)}}
  });
  return {dialog};
}
