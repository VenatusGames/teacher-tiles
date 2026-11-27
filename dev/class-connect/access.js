(() => {
  const message = 'ClassConnect is for subscribers only at this time. This is subject to change in the future!';
  const types = new Set(['wordcloud', 'respond', 'livepolls', 'moodcheckin']);
  // The host's subscription authorizes everyone inside an admitted classroom board.
  const allowed = () => Boolean(window.ClassConnectPolicy || window.TeacherTilesHalloween?.hasAccess());
  const request = () => window.TeacherTilesHalloween.requestAccess('ClassConnect', message);
  function requireAccess() {
    if (allowed()) return true;
    request();
    return false;
  }
  window.TeacherTilesConnectAccess = {allowed, types, requireAccess, request};
  function intercept(event) {
    if(event.type==='keydown' && event.key!==' ' && event.key!=='Enter')return;
    if (!event.target.closest?.('[data-connect-perk]') || allowed()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(!event.repeat)request();
  }
  window.addEventListener('click',intercept,true);
  window.addEventListener('keydown',intercept,true);
})();
