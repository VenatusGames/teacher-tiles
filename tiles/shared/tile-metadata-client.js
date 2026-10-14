import {firebaseConfig} from '../../firebase-config.js';
const key=`teacherTiles.tileMetadata.${firebaseConfig.projectId}`, maxAge=60000;
let pending, lastAttempt=0;
export function cachedTileMetadata(){try{const value=JSON.parse(localStorage.getItem(key));return valid(value)?value:null;}catch{return null;}}
function valid(value){return value && Number.isSafeInteger(value.revision) && value.revision>=0 && value.tiles && typeof value.tiles==='object' && !Array.isArray(value.tiles);}
export function rememberTileMetadata(value){
  if(!valid(value))throw new Error('Invalid tile metadata response.');
  const old=cachedTileMetadata();if(old && old.revision>value.revision)return old;
  const data={revision:value.revision,tiles:value.tiles,fetchedAt:Date.now()};
  try{localStorage.setItem(key,JSON.stringify(data));}catch{}
  window.dispatchEvent(new CustomEvent('teachertiles:tilemetadata',{detail:data}));return data;
}
export async function fetchTileMetadata(){
  const old=cachedTileMetadata();
  if(old && Date.now()-old.fetchedAt<maxAge)return old;
  if(pending)return pending;
  if(Date.now()-lastAttempt<maxAge)return old;
  lastAttempt=Date.now();
  pending=(async()=>{
    try{
      const response=await fetch(`https://us-central1-${firebaseConfig.projectId}.cloudfunctions.net/tileMetadata`,{signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw new Error('Tile categories are temporarily unavailable.');
      return rememberTileMetadata(await response.json());
    }catch{return old;}finally{pending=null;}
  })();return pending;
}
window.addEventListener('storage',event=>{if(event.key===key){const value=cachedTileMetadata();if(value)window.dispatchEvent(new CustomEvent('teachertiles:tilemetadata',{detail:value}));}});
