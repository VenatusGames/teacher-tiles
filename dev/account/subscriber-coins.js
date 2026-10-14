// Notification only: the server has already credited these coins.
export function createSubscriberCoinNotice({call,getUid,canShow=()=>true}) {
  let uid='',pending=null,balance=0,dialog=null,shown=null,timer=0,retryTimer=0,lastFocus=null;
  let seen={coinsThrough:0,grantsThrough:0,ackPending:false},epoch=0,saving=false,retries=0,releaseLock=null,acquiring=false;
  const key=()=>`teacherTilesSubscriberCoins:${uid}`;
  function readSeen(){try{const value=JSON.parse(localStorage.getItem(key())||'null');if(value&&Number.isSafeInteger(value.coinsThrough)&&Number.isSafeInteger(value.grantsThrough)&&value.coinsThrough>=0&&value.grantsThrough>=0)return value;}catch{}return {coinsThrough:0,grantsThrough:0,ackPending:false};}
  function saveSeen(){try{localStorage.setItem(key(),JSON.stringify(seen));}catch{}}
  function unseen(notice){
    if(!notice||![notice.coins,notice.grants,notice.coinsThrough,notice.grantsThrough].every(n=>Number.isSafeInteger(n)&&n>0))return null;
    const coins=Math.min(notice.coins,notice.coinsThrough-seen.coinsThrough),grants=Math.min(notice.grants,notice.grantsThrough-seen.grantsThrough);
    return coins>0&&grants>0?{...notice,coins,grants}:null;
  }
  function close(){
    shown=null;if(dialog?.open)dialog.close();
    releaseLock?.();releaseLock=null;
    if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});lastFocus=null;
  }
  function reset(nextUid){
    if(uid===nextUid)return;
    close();clearTimeout(timer);clearTimeout(retryTimer);epoch++;uid=nextUid;pending=null;saving=false;retries=0;acquiring=false;seen=readSeen();
  }
  function schedule(){clearTimeout(timer);if(pending&&!shown&&uid)timer=setTimeout(tryShow,700);}
  async function acknowledge(){
    if(!uid||getUid()!==uid||saving||!seen.ackPending)return;
    const token=epoch,receipt={coinsThrough:seen.coinsThrough,grantsThrough:seen.grantsThrough};saving=true;
    try{
      const result=await call('acknowledgeSubscriptionCoins',receipt);
      if(epoch!==token)return;
      if(seen.grantsThrough===receipt.grantsThrough){seen.ackPending=false;saveSeen();}
      const next=unseen(result.notice);if(next&&(!pending||next.grantsThrough>pending.grantsThrough))pending=next;
      retries=0;schedule();
    }catch{
      // A network failure must not trap the user in a reward popup. Retry the
      // acknowledgement later; the local receipt prevents repeat popups here.
      if(epoch===token&&retries++<3)retryTimer=setTimeout(acknowledge,30000);
    }finally{if(epoch===token){saving=false;if(seen.ackPending&&seen.grantsThrough>receipt.grantsThrough)void acknowledge();}}
  }
  function dismiss(){
    if(!shown)return;
    seen={coinsThrough:Math.max(seen.coinsThrough,shown.coinsThrough),grantsThrough:Math.max(seen.grantsThrough,shown.grantsThrough),ackPending:true};
    saveSeen();close();pending=unseen(pending);void acknowledge();schedule();
  }
  function build(){
    if(dialog)return;
    dialog=document.createElement('dialog');dialog.className='subscriber-coins-dialog';
    dialog.setAttribute('aria-labelledby','subscriber-coins-title');dialog.setAttribute('aria-describedby','subscriber-coins-description');
    dialog.innerHTML='<button type="button" class="subscriber-coins-close" aria-label="Close subscriber coin notification"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg></button><div class="subscriber-coins-label"><svg viewBox="0 0 48 48" aria-hidden="true"><use href="assets/ui/subscriber-crown.svg?v=20260926#crown"/></svg><span>Subscriber Reward</span></div><h2 id="subscriber-coins-title">Monthly Coins Added</h2><div class="subscriber-coins-art" aria-hidden="true"><i></i><img class="subscriber-coins-side subscriber-coins-side--left" src="assets/shop/coin.png" alt=""><img class="subscriber-coins-main" src="assets/shop/coin.png" alt=""><img class="subscriber-coins-side subscriber-coins-side--right" src="assets/shop/coin.png" alt=""><span class="subscriber-coins-spark subscriber-coins-spark--one">✦</span><span class="subscriber-coins-spark subscriber-coins-spark--two">✦</span><span class="subscriber-coins-spark subscriber-coins-spark--three">✦</span></div><div class="subscriber-coins-amount"><strong></strong><span>coins</span></div><p id="subscriber-coins-description">Added automatically with your subscription.</p><p class="subscriber-coins-periods" hidden></p><div class="subscriber-coins-balance"><span>Current Balance</span><strong></strong></div><button type="button" class="subscriber-coins-done">Continue to Board</button>';
    dialog.querySelector('.subscriber-coins-close').addEventListener('click',dismiss);dialog.querySelector('.subscriber-coins-done').addEventListener('click',dismiss);
    dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss();});
    dialog.addEventListener('keydown',event=>event.stopPropagation());
    document.body.append(dialog);
  }
  function display(){
    pending=unseen(pending);if(!pending){releaseLock?.();releaseLock=null;return;}
    build();shown=pending;pending=null;lastFocus=document.activeElement;
    dialog.querySelector('.subscriber-coins-amount strong').textContent='+'+shown.coins.toLocaleString();
    dialog.querySelector('.subscriber-coins-balance strong').textContent=balance.toLocaleString()+' coins';
    const periods=dialog.querySelector('.subscriber-coins-periods');periods.hidden=shown.grants<2;periods.textContent=`Includes ${shown.grants} monthly rewards.`;
    dialog.showModal();dialog.querySelector('.subscriber-coins-done').focus({preventScroll:true});
    window.playUiSfx?.('money',.45);
  }
  function blocked(){return document.hidden||!canShow()||[...document.querySelectorAll('dialog[open], [aria-modal="true"], #sandbox-access-gate')].some(n=>n!==dialog&&n.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}));}
  async function tryShow(){
    if(!uid||getUid()!==uid||shown||acquiring)return;
    pending=unseen(pending);if(!pending)return;
    if(blocked()){schedule();return;}
    if(!navigator.locks){display();return;}
    const token=epoch;acquiring=true;
    try{await navigator.locks.request(key(),{ifAvailable:true},async lock=>{
      if(token!==epoch)return;
      if(!lock){schedule();return;}
      // Another tab may have dismissed it while this tab was waiting.
      seen=readSeen();if(blocked()){schedule();return;}
      await new Promise(resolve=>{releaseLock=resolve;display();});
    });}finally{if(token===epoch)acquiring=false;}
  }
  function update(userId,notice,coinBalance){
    if(userId!==getUid())return;reset(userId);balance=Math.max(0,Number(coinBalance)||0);
    const next=unseen(notice);
    if(!shown||next?.grantsThrough>shown.grantsThrough)pending=next;
    if(shown)dialog.querySelector('.subscriber-coins-balance strong').textContent=balance.toLocaleString()+' coins';
    void acknowledge();schedule();
  }
  window.addEventListener('storage',event=>{if(!uid||event.key!==key())return;seen=readSeen();if(shown&&shown.grantsThrough<=seen.grantsThrough)close();pending=unseen(pending);schedule();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
  window.addEventListener('online',()=>{retries=0;void acknowledge();schedule();});
  return {update,reset};
}
