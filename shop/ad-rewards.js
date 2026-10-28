// Presentation only. Ad verification, daily limits and coin grants will be server-backed later.
(() => {
  const panel=document.querySelector('.shop-ad-rewards');
  if(!panel)return;
  const dailyLimit=5,coinsPerAd=5;
  function renderProgress(watchedToday=0){
    const count=Math.min(dailyLimit,Math.max(0,Math.floor(Number(watchedToday)||0)));
    panel.querySelector('#shop-ad-count').textContent=`${count} / ${dailyLimit} watched`;
    const progress=panel.querySelector('#shop-ad-progress');
    progress.max=dailyLimit;progress.value=count;progress.textContent=`${count} of ${dailyLimit} ads watched`;
    panel.querySelector('#shop-ad-remaining').textContent=count===dailyLimit?'Daily limit reached':`${dailyLimit-count} ads remaining`;
    panel.querySelector('#shop-ad-earned').textContent=`${count*coinsPerAd} / ${dailyLimit*coinsPerAd} coins earned`;
    panel.classList.toggle('is-complete',count===dailyLimit);
    // No ad provider is connected: rendering progress never enables rewards.
    panel.querySelector('#shop-watch-ad').disabled=true;
  }
  window.TeacherTilesAdRewards={renderProgress};
  renderProgress();
})();
