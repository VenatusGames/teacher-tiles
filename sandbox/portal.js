import {firebaseConfig} from '../firebase-config.js';
import {verifyAccess,accessError} from './access-client.js';
const login=document.getElementById('portal-login'),home=document.getElementById('portal-home'),status=document.getElementById('portal-status');
const signIn=document.getElementById('portal-signin'),retry=document.getElementById('portal-retry'),signOut=document.getElementById('portal-signout');
const shell=document.querySelector('.portal-shell'),accessScreen=document.getElementById('portal-access-screen');
function showPortal(visible){shell.hidden=!visible;shell.inert=!visible;accessScreen.hidden=visible;if(visible)document.querySelector('.portal-topbar').append(signOut);else document.querySelector('.access-actions').append(signOut);}
let auth,sdk,call,pending=false,generation=0,lastCheck=0,authorized=false;
function lock(message){showPortal(false);authorized=false;home.hidden=true;login.hidden=false;status.textContent=message;signOut.hidden=!auth?.currentUser;}
function busy(value){pending=value;signIn.disabled=retry.disabled=value||!auth;signOut.disabled=value;}
async function check(user){
  const attempt=++generation;lastCheck=Date.now();
  if(!user){lock('Sign in with an authorized administrator account.');busy(false);return;}
  busy(true);lock('Signed in. Verifying administrator access…');
  try{
    const access=await verifyAccess(user,call);
    if(attempt!==generation||auth.currentUser?.uid!==user.uid)return;
    document.getElementById('portal-name').textContent=user.displayName||'Administrator';
    document.getElementById('portal-email').textContent=user.email||'';
    document.getElementById('portal-role').textContent=access.role==='owner'?'Owner':'Administrator';
    authorized=true;showPortal(true);login.hidden=true;home.hidden=false;signOut.hidden=false;
  }catch(error){if(attempt===generation)lock(accessError(error));}
  finally{if(attempt===generation)busy(false);}
}
signIn.onclick=async()=>{
  if(pending||!auth)return;busy(true);status.textContent='Opening Google sign-in…';
  const timer=setTimeout(()=>{if(!authorized&&status.textContent==='Opening Google sign-in…')status.textContent='Finish signing in in the Google window. If none opened, allow popups for teachertiles.com and refresh.'},12000);
  try{const provider=new sdk.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await sdk.signInWithPopup(auth,provider);}
  catch(error){lock(accessError(error));busy(false);}
  finally{clearTimeout(timer);}
};
retry.onclick=()=>{if(!pending)void check(auth?.currentUser)};
signOut.onclick=async()=>{busy(true);try{await sdk.signOut(auth)}catch(error){lock(accessError(error));busy(false)}};
try{
  const [app,authSdk,functions]=await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js')
  ]);
  sdk=authSdk;const firebase=app.initializeApp(firebaseConfig);auth=sdk.getAuth(firebase);
  call=(name,data)=>functions.httpsCallable(functions.getFunctions(firebase,'us-central1'),name,{timeout:15000})(data);
  await sdk.setPersistence(auth,sdk.browserLocalPersistence);
  sdk.onIdTokenChanged(auth,user=>void check(user),()=>{lock('Unable to read your sign-in session. Please refresh.');busy(false)});
}catch{lock('Google sign-in could not load. Check your connection and refresh this page.');}
const recheck=()=>{if(auth?.currentUser&&!pending&&!document.hidden&&Date.now()-lastCheck>=300000)void check(auth.currentUser)};
setInterval(recheck,60000);window.addEventListener('focus',recheck);
