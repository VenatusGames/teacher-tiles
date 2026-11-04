// ClassConnect shares only explicitly enabled reward totals and roster fields.
export function publicClass(roster) {
  const pbisEnabled=typeof roster.pbisEnabled==='boolean'?roster.pbisEnabled:roster.gradeLevel!=='Higher-Ed'&&!(Number(roster.gradeLevel)>=7);
  return {
    name:roster.name, emoji:roster.logo || '👥', image:roster.logoImage || '', gradeLevel:roster.gradeLevel || '',
    pbisEnabled, studentBoards:roster.studentBoards===true, allowStudentEmojiEditing:roster.allowStudentEmojiEditing===true,
    students:roster.students.map(name => {
      const profile=roster.studentProfiles?.[`student:${name.trim().toLocaleLowerCase()}`] || {};
      const parts=name.trim().split(/\s+/);let hue=0;
      for(const character of `${roster.id}:${name}`)hue=(hue*31+character.codePointAt(0))>>>0;
      const rewards={},key=`student:${name.trim().toLocaleLowerCase()}`;
      const maps={eggPoints:roster.eggHatching?.studentPoints,flowerPoints:roster.flowerPots?.studentPoints,stars:roster.starChart?.studentStars,punchcardPoints:roster.punchcards?.studentPoints,raceWins:roster.racer?.studentWins};
      if(pbisEnabled)for(const [id,map]of Object.entries(maps))if(roster.pbisStats?.[id]!==false)rewards[id]=Math.max(0,Math.min(9999,Math.round(Number(map?.[key])||0)));
      return {id:profile.id || key,avatarVersion:profile.avatarVersion || '',rewards,name, emoji:profile.emoji || '', image:profile.image || '', initials:((parts[0]?.[0] || 'S')+(parts.length>1?(parts.at(-1)?.[0] || ''):'')).toLocaleUpperCase().slice(0,2), hue:hue%360};
    })
  };
}
export function createClassConnectClient({call,getUid,announce=detail=>window.dispatchEvent(new CustomEvent('teachertiles:classconnectsync',{detail}))}) {
  let queue=Promise.resolve(),lastSignature='',lastUid='',failed=null;
  const avatarOverrides=new Map();
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
    resolveProfile(classId,profile){
      const edit=avatarOverrides.get(`${getUid()}\0${classId}`)?.get(profile.id);
      return edit && edit.avatarVersion===profile.avatarVersion ? {...profile,emoji:edit.emoji,image:''} : profile;
    },
    refreshAvatars(classId){
      const uid=getUid();return enqueue(uid,async()=>{
        const result=await call('classConnect',{action:'avatars',ownerUid:uid,classId});
        if(getUid()===uid){avatarOverrides.set(`${uid}\0${classId}`,new Map(Object.values(result.edits || {}).map(edit=>[edit.studentId,edit])));announce({userId:uid,status:'avatars',classId});}
      });
    },
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
