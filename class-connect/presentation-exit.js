import {firebaseConfig} from '../firebase-config.js';
// Prepare credentials while the page is alive. The normal callable transport can
// be cancelled on navigation; keepalive lets this small end request finish.
// No Firestore heartbeat is added. Crashes/offline exits still use session expiry.
export async function preparePresentationExit(user){
 const owner=user?.uid;if(!owner)throw Error('Sign in before starting ClassConnect.');
 let token=await user.getIdToken(),timer=0,disposed=false;
 const refresh=async()=>{try{const next=await user.getIdToken();if(!disposed)token=next;}catch{/* The existing token remains usable until its expiry. */}};
 const endpoint='https://us-central1-'+firebaseConfig.projectId+'.cloudfunctions.net/classConnectBoard';
 return {
  start(){timer=setInterval(refresh,30*60*1000);},
  send(data){if(disposed)return;void fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({data:{action:'end',...data}}),keepalive:true,credentials:'omit'}).catch(()=>{});},
  dispose(){disposed=true;clearInterval(timer);token='';}
 };
}
