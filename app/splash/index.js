(() => {
 const script=document.currentScript.src;
 window.TeacherTilesSplashReady=(async()=>{
  let choice='default';
  try{choice=localStorage.getItem('teacherTilesSplash')==='halloween'?'halloween':'default'}catch{}
  try{
   const {firebaseConfig}=await import(new URL('../../firebase-config.js',script));
   const response=await fetch(`https://us-central1-${firebaseConfig.projectId}.cloudfunctions.net/shopManagement`,{cache:'no-cache',signal:AbortSignal.timeout(1500)});
   if(response.ok){const config=await response.json();choice=config.splash==='halloween'?'halloween':'default';try{localStorage.setItem('teacherTilesSplash',choice)}catch{}}
  }catch{}
  if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
  const intro=document.getElementById('teachertiles-intro');if(intro)intro.dataset.splash=choice;
  if(choice==='halloween'&&document.fonts)await Promise.race([document.fonts.load('48px "TT Halloween"'),new Promise(resolve=>setTimeout(resolve,300))]).catch(()=>{});
 })();
})();
