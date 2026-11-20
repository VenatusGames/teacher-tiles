import {call,active,watchRoom} from './boards.js?v=20261119-attach';
let current=null;
const pending=new WeakMap();
const historyRemovals=new WeakMap();
export const routing=result=>result.groupId?{groupId:result.groupId,panelId:result.panelId}:{};
export function panelStatus(parent,id){
 const panel=parent?.panels?.find(p=>p.id===id);
 return panel&&active(parent)?{...panel,active:true,until:parent.until}:null;
}
export function watchPanel(result,change){
 if(result.subscribe)return result.subscribe(change);
 if(!result.groupId)return watchRoom(result.room,change);
 return watchRoom(result.parentRoom,parent=>{
  if(parent?.sessionId===result.groupId&&active(parent)&&parent.revision<result.groupRevision)return;
  change(panelStatus(parent,result.panelId));
 });
}
export function bindTile(tile,classId,name,result,exit,connect){
 if(!result.groupId){connect(tile,classId,name,result,exit);return;}
 let group=current;
 const opened=!group||group.id!==result.groupId;
 if(opened){
  group={id:result.groupId,classId,name,exit,tiles:new Map(),requestIds:new WeakMap(),adds:new Set(),leaving:false};
  current=group;exit.start();
 }
 if(group.exit!==exit)exit.dispose();
 group.tiles.set(tile,result.panelId);
 group.requestIds.set(tile,result.panelId);
 const lease={start(){},removed(){group.requestIds.delete(tile);},endSession:()=>endGroup(group),beforeRemoval:()=>Promise.allSettled([...group.adds]),send(){
   if(!group.leaving){group.leaving=true;group.exit.send({classId,sessionId:group.id,publisherPanels:[...group.tiles.values()]});}
  },dispose(){
   group.tiles.delete(tile);
   if(!group.tiles.size){group.exit.dispose();if(current===group)current=null;}
  }};
 connect(tile,classId,name,result,lease);
 if(opened&&group===current){
  for(const other of document.querySelectorAll('#workspace .wordcloud-module'))tileReady(other);
 }
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
function endGroup(group){
 if(group.ending)return group.ending;
 group.leaving=true;
 group.ending=call({action:'end',classId:group.classId,sessionId:group.id}).catch(error=>{
  group.ending=null;group.leaving=false;throw error;
 });
 return group.ending;
}
export function responseGroup(){
 const group=current;
 return group&&!group.leaving?{name:group.name,endSession:()=>endGroup(group)}:null;
}
export function attachResponse(tile){return attachTile(tile,false);}
function attachTile(tile,restoreDeck){
 const group=current;
 if(!group||group.leaving||!tile.isConnected||tile._classConnectSession||(!restoreDeck&&!tile._wordCloudInfo)||window.ClassConnectPolicy||tile.dataset.presentationEmbedded)return;
 if(pending.has(tile))return pending.get(tile);
 const task=(async()=>{
  const options=restoreDeck?(await import('./presentation-session.js?v=20261119-attach')).presentationOptions(tile):(await import('./word-cloud-session.js?v=20261119-attach')).responseOptions(tile);
  if(current!==group||group.leaving||!tile.isConnected||tile._classConnectSession)return;
  const info=options.getInfo();if(!info)return;
  // Keep the same panel ID if a callable commits but its response is lost.
  const requestId=group.requestIds.get(tile)||crypto.randomUUID();group.requestIds.set(tile,requestId);
  const result=await call({action:restoreDeck?'start':'addPanel',grouped:true,groupId:group.id,classId:group.classId,requestId,...options.startData(info)});
  if(result.groupId!==group.id||result.panelId!==requestId)throw Error('Could not attach this tile to the current session.');
  if(!tile.isConnected||current!==group||group.leaving){
   await call({action:'end',...routing(result),classId:group.classId,sessionId:result.status.sessionId});return;
  }
  bindTile(tile,group.classId,group.name,result,group.exit,options.connect);
  if(options.key(info)!==options.key(options.getInfo()))tile.querySelector('.wordcloud-prompt')?.dispatchEvent(new Event('change',{bubbles:true}));
 })().finally(()=>{pending.delete(tile);group.adds.delete(task);});
 pending.set(tile,task);group.adds.add(task);return task;
}
// Board history reuses the same DOM node. Remember only its original live group.
export function historyDetach(tile){
 const group=current;
 if(!group||group.leaving||(!group.tiles.has(tile)&&!pending.has(tile)))return;
 const previous=historyRemovals.get(tile);
 const removal=previous?.removal||tile._classConnectSession?.end()||pending.get(tile);
 historyRemovals.set(tile,{group,removal,deck:!!tile._classConnectPresentation});
}
export async function historyRestore(tile){
 const entry=historyRemovals.get(tile);
 if(!entry)return;
 try{
  await entry.removal;
  if(historyRemovals.get(tile)!==entry||!tile.isConnected)return;
  historyRemovals.delete(tile);
  if(current!==entry.group||current.leaving||tile._classConnectSession)return;
  entry.group.requestIds.delete(tile);
  await attachTile(tile,entry.deck);
 }catch(error){
  if(tile.isConnected){
   if(entry.deck){const status=tile.querySelector('.presentation-connection-status');if(status){status.textContent=error.message;status.hidden=false;}}
   else tile._wordCloudStatus?.(error.message,false);
  }
 }
}
export function tileReady(tile){
 attachResponse(tile)?.catch(error=>tile._wordCloudStatus?.(error.message,false));
}
