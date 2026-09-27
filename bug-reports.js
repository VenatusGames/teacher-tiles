export const BUG_CATEGORIES=['Saving & syncing','Tiles & tools','Boards & templates','Themes, stickers & cursors','Account & subscription','Performance','Accessibility','Other'];
export function setupBugReports(call){
 const form=document.getElementById('bug-report-form');if(!form)return;
 const category=form.elements.category,status=form.querySelector('[role="status"]'),submit=form.querySelector('[type="submit"]');
 for(const name of BUG_CATEGORIES){const option=document.createElement('option');option.value=option.textContent=name;category.append(option);}
 let requestId=null,busy=false;form.addEventListener('input',()=>{if(!busy)requestId=null;});
 form.addEventListener('submit',async event=>{event.preventDefault();if(busy||!form.reportValidity())return;busy=true;submit.disabled=true;status.textContent='Sending report…';requestId ||= Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
  const values=new FormData(form);for(const input of form.querySelectorAll('input,textarea,select'))input.disabled=true;
  try{await call('submitBugReport',{requestId,category:values.get('category'),title:values.get('title'),description:values.get('description'),browser:navigator.userAgent.slice(0,180)});form.reset();requestId=null;status.textContent='Report sent. Thank you! Our team will review it.';}
  catch(error){status.textContent=error.message||'Could not send your report. Please try again.';}
  finally{busy=false;submit.disabled=false;for(const input of form.querySelectorAll('input,textarea,select'))input.disabled=false;}
 });
}
