// ClassConnect publishes only an explicit, read-only roster projection.
export function publicClass(roster) {
  return {
    name:roster.name, emoji:roster.logo || '👥', image:roster.logoImage || '', gradeLevel:roster.gradeLevel || '',
    students:roster.students.map(name => {
      const profile=roster.studentProfiles?.[`student:${name.trim().toLocaleLowerCase()}`] || {};
      const parts=name.trim().split(/\s+/);let hue=0;
      for(const character of `${roster.id}:${name}`)hue=(hue*31+character.codePointAt(0))>>>0;
      return {name, emoji:profile.emoji || '', image:profile.image || '', initials:((parts[0]?.[0] || 'S')+(parts.length>1?(parts.at(-1)?.[0] || ''):'')).toLocaleUpperCase().slice(0,2), hue:hue%360};
    })
  };
}
export function createClassConnectClient({call,getUid,announce=detail=>window.dispatchEvent(new CustomEvent('teachertiles:classconnectsync',{detail}))}) {
  let queue=Promise.resolve(),lastSignature='',lastUid='',failed=null;
  function enqueue(uid,operation) {
    const task=queue.catch(()=>{}).then(()=>{
      if(!uid || getUid()!==uid)throw new Error('Sign in to your account to use ClassConnect.');
      if(lastUid!==uid){lastUid=uid;lastSignature='';failed=null;}
      return operation();
    });
    queue=task;return task;
  }
  function publish(shared,signature,uid,sourceRevision) {
    return enqueue(uid,async()=>{
      if(signature===lastSignature)return;
      announce({userId:uid,status:'saving'});
      try {
        const result=await call('classConnect',{action:'sync',ownerUid:uid,classes:shared,sourceRevision});
        if(getUid()===uid){
          if(!result.stale)lastSignature=signature;
          failed=null;announce({userId:uid,status:result.stale?'stale':'saved'});
        }
        return result;
      } catch(error) {
        if(getUid()===uid){failed={shared,signature,uid,sourceRevision};announce({userId:uid,status:'error',message:'ClassConnect could not update. Reopen ClassConnect to retry.'});}
        throw error;
      }
    });
  }
  return Object.freeze({
    list(){const uid=getUid();return enqueue(uid,()=>call('classConnect',{action:'list',ownerUid:uid}));},
    change(action,roster,expectedRevision=0){
      const uid=getUid(),data={action,ownerUid:uid,classId:roster.id,expectedRevision};
      if(action!=='disable')data.view=publicClass(roster);
      return enqueue(uid,async()=>{const result=await call('classConnect',data);lastSignature='';return result;});
    },
    retry(){return failed && failed.uid===getUid()?publish(failed.shared,failed.signature,failed.uid,failed.sourceRevision):Promise.resolve();},
    sync(classes,uid=getUid(),sourceRevision) {
      const shared=classes.map(c=>({classId:c.id,view:publicClass(c)}));
      return publish(shared,JSON.stringify(shared),uid,sourceRevision);
    }
  });
}
