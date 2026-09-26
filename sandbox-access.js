(() => {
  'use strict';
  const required = /^\/sandbox(?:\/|$)/i.test(location.pathname);
  let allowed = false, role = '', gate, message, signIn, refresh;
  let actions = {};
  const blocked = () => required && !allowed;
  if (required) {
    document.documentElement.classList.add('sandbox-access-locked');
    const style = document.createElement('style');
    style.textContent = `html.sandbox-access-locked body{overflow:hidden!important}html.sandbox-access-locked body>*:not(#sandbox-access-gate){visibility:hidden!important;pointer-events:none!important}#sandbox-access-gate{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:#f3f5fa;color:#202838;font:15px/1.5 system-ui,sans-serif}#sandbox-access-gate[hidden]{display:none}#sandbox-access-gate section{width:min(100%,420px);box-sizing:border-box;padding:36px;border:1px solid #dce2ec;border-radius:24px;background:white;box-shadow:0 20px 70px #20305012;text-align:center}#sandbox-access-gate svg{width:38px;height:38px;color:#667996}#sandbox-access-gate h1{font-size:24px;margin:16px 0 10px}#sandbox-access-gate p{color:#647084;min-height:45px}#sandbox-access-gate button{display:block;width:100%;margin-top:10px;padding:12px;border:1px solid #d9e0eb;border-radius:12px;background:#edf3ff;color:#214977;font:600 14px system-ui;cursor:pointer}#sandbox-access-gate button:disabled{opacity:.5;cursor:wait}#sandbox-access-gate a{display:inline-block;margin-top:20px;color:#647084;font-size:13px}`;
    document.head.append(style);
    // Inert blocks focus; capture guards also stop board keyboard shortcuts.
    const prevent = event => {
      if (blocked() && !event.target.closest?.('#sandbox-access-gate')) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    };
    for (const type of ['keydown','keyup','pointerdown','click','wheel','drop']) document.addEventListener(type, prevent, {capture:true,passive:false});
    document.addEventListener('DOMContentLoaded', () => {
      gate = document.createElement('div'); gate.id = 'sandbox-access-gate';
      gate.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="sandbox-access-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg><h1 id="sandbox-access-title">Admin access only</h1><p role="status" aria-live="polite">Checking your account…</p><button type="button" data-signin disabled>Sign in with Google</button><button type="button" data-refresh disabled>Check access again</button><a href="/">Back to TeacherTiles</a></section>`;
      document.body.append(gate);
      message = gate.querySelector('p'); signIn = gate.querySelector('[data-signin]'); refresh = gate.querySelector('[data-refresh]');
      signIn.onclick = async () => { signIn.disabled=true;try {await actions.signIn?.()} finally {signIn.disabled=false} };
      refresh.onclick = async () => { refresh.disabled=true;try {await actions.refresh?.()} finally {refresh.disabled=false} };
      const inert = () => { for (const child of document.body.children) if(child!==gate) {if(blocked()&&!child.inert){child.inert=true;child.dataset.sandboxAccessInert='true'}else if(!blocked()&&child.dataset.sandboxAccessInert){child.inert=false;delete child.dataset.sandboxAccessInert}} };
      new MutationObserver(inert).observe(document.body,{childList:true});
      window.addEventListener('teachertiles:adminaccess',inert); inert();
      sync();
    },{once:true});
  }
  let status = 'Checking your account…';
  function sync() {
    document.documentElement.classList.toggle('sandbox-access-locked',blocked());
    if(gate)gate.hidden=!blocked();
    if(message)message.textContent=status;
    if(signIn)signIn.disabled=!actions.signIn;
    if(refresh)refresh.disabled=!actions.refresh;
  }
  window.TeacherTilesAdminAccess = Object.freeze({
    get required(){return required},get allowed(){return allowed},get role(){return role},get locked(){return blocked()},
    configure(value){actions=value;sync()},
    status(value){status=value;sync()},
    update(claims={},email=''){
      role=['owner','admin'].includes(claims.portalRole)?claims.portalRole:'';
      allowed=Boolean(role);
      status=allowed?'Access granted.':email?`${email} does not have admin access. Sign in with an authorized account.`:'Sign in with an authorized administrator account to use the sandbox.';
      sync();window.dispatchEvent(new CustomEvent('teachertiles:adminaccess',{detail:{allowed,role}}));
    }
  });
})();
