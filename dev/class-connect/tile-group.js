import {call,active,watchRoom} from './boards.js?v=20261119-live-switch';
let current=null;
const pending=new WeakMap();
export const routing=result=>result.groupId?{groupId:result.groupId,panelId:result.panelId}:{};
export function panelStatus(parent,id){
 const panel=parent?.panels?.find(p=>p.id===id);
 return panel&&active(parent)?{...panel,active:true,until:parent.until}:null;
}
export function watchPanel(result,change){
 if(result.subscribe)return result.subscribe(change);
 if(!result.groupId)return watchRoom(result.room,change);
 return watchRoom(result.parentRoom,parent=>change(panelStatus(parent,result.panelId)));
}
export function bindTile(tile,classId,name,result,exit,connect){
 if(!result.groupId){connect(tile,classId,name,result,exit);return;}
 let group=current;
 if(!group||group.id!==result.groupId){
  group={id:result.groupId,classId,name,exit,tiles:new Map(),adds:new Set(),leaving:false};
  current=group;exit.start();
 }
 if(group.exit!==exit)exit.dispose();
 group.tiles.set(tile,result.panelId);
 const lease={start(){},endSession:()=>call({action:'end',classId,sessionId:group.id}),beforeRemoval:()=>Promise.allSettled([...group.adds]),send(){
   if(!group.leaving){group.leaving=true;group.exit.send({classId,sessionId:group.id,publisherPanels:[...group.tiles.values()]});}
  },dispose(){
   group.tiles.delete(tile);
   if(!group.tiles.size){group.exit.dispose();if(current===group)current=null;}
  }};
 connect(tile,classId,name,result,lease);
 if(result.status.mode==='presentation'){
  for(const other of group.tiles.keys())if(other!==tile)other._classConnectSession?.releasePresentation?.();
 }
}
export const pendingAttachment=tile=>pending.get(tile);
export function currentPresentationGroup(){
 if(!current||current.leaving)return null;
 const deck=[...current.tiles.keys()].find(tile=>tile._classConnectSession?.panelId&&tile._classConnectPresentation);
 return {groupId:current.id,id:current.classId,name:current.name,panelId:deck?._classConnectSession.panelId,title:deck?._classConnectPresentation()?.title};
}
export function attachIfLive(tile,options){
 const group=current;
 if(!group||group.leaving||tile._classConnectSession||tile.id==='presentations-tool')return null;
 if(pending.has(tile))return pending.get(tile);
 const info=options.getInfo();
 if(!info)return null;
 const requestId=tile._panelRequestId||crypto.randomUUID();tile._panelRequestId=requestId;
 const task=call({action:'start',grouped:true,groupId:group.id,classId:group.classId,requestId,...options.startData(info)})
  .then(async result=>{
   if(!tile.isConnected||current!==group||group.leaving||tile.dataset.type==='presentation'&&options.key(info)!==options.key(options.getInfo())){
    await call({action:'end',...routing(result),classId:group.classId,sessionId:result.status.sessionId});
    return;
   }
   delete tile._panelRequestId;
   bindTile(tile,group.classId,group.name,result,group.exit,options.connect);
   if(tile.dataset.type!=='presentation'&&options.key(info)!==options.key(options.getInfo()))tile.querySelector('.wordcloud-prompt')?.dispatchEvent(new Event('change',{bubbles:true}));
  }).finally(()=>{pending.delete(tile);group.adds.delete(task);});
 group.adds.add(task);
 pending.set(tile,task);return task;
}
export function tileReady(tile){
 if(!current||!tile.isConnected||tile._classConnectSession||window.ClassConnectPolicy||tile.dataset.presentationEmbedded)return;
 const method=tile.dataset.type==='presentation'?'presentation':'wordcloud';
 if(method==='presentation'){
  if(!tile._classConnectPresentation?.()||currentPresentationGroup()?.panelId)return;
  window.TeacherTilesBoardSessions.presentation(tile,{automatic:true}).catch(error=>{
   if(error.details?.reason==='presentation-live')return;
   const message=tile.querySelector('.presentation-tile-message');if(message)message.textContent=error.message;
  });return;
 }
 window.TeacherTilesBoardSessions[method](tile).catch(error=>{
  if(tile._wordCloudStatus)tile._wordCloudStatus(error.message,false);
  else {const message=tile.querySelector('.presentation-tile-message');if(message)message.textContent=error.message;}
 });
}
