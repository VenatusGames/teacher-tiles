export function accessError(error) {
  const code=error?.code||'unknown';
  if(code==='functions/permission-denied')return 'This account does not have access. Sign in with an authorized administrator or ask for beta access.';
  if(code==='functions/unauthenticated')return 'Your sign-in session has expired. Please sign in again.';
  if(code==='functions/failed-precondition'&&error?.details?.reason==='auth-reader-missing')return 'The verification server is missing its Firebase Authentication read permission. Contact the project owner.';
  if(code==='functions/internal')return 'The verification server returned an error (functions/internal). Check the verifyDeveloperAccess logs; this can indicate a server permission problem.';
  if(code==='functions/not-found')return 'The required access function is not deployed in us-central1 for this project.';
  if(code==='functions/deadline-exceeded'||code==='functions/unavailable')return `The verification service did not respond (${code}). Please try again.`;
  if(code==='auth/popup-blocked')return 'Allow popups for teachertiles.com, then sign in again.';
  if(code==='auth/popup-closed-by-user'||code==='auth/cancelled-popup-request')return 'Sign-in was canceled. You can try again.';
  return `Access could not be verified (${code}). Please try again.`;
}

export async function verifyAccess(user,call,{sandbox=false}={}) {
  if(!user)throw Object.assign(new Error('Sign in required'),{code:'functions/unauthenticated'});
  const response=await call(sandbox?'verifySandboxAccess':'verifyDeveloperAccess',{});
  if(response.data?.uid!==user.uid||!(sandbox?['owner','admin','beta']:['owner','admin']).includes(response.data?.role))throw Object.assign(new Error('Admin access required'),{code:'functions/permission-denied'});
  return response.data;
}
