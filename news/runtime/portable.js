import './document-model.js?v=20261103-news-folders';
import './portable-model.js?v=20261103-news-folders';
const model=globalThis.TeacherTilesNewsFile,root=new URL('../../',import.meta.url);
export async function loadNewsFiles(){
 const response=await fetch(new URL('../generated/posts.json',import.meta.url),{cache:'no-cache',signal:AbortSignal.timeout(10000)});
 if(response.status===404)return [];
 if(!response.ok)throw Error('News files could not load.');
 const data=await response.json();if(data.version!==1||!Array.isArray(data.files))throw Error('News file index needs rebuilding.');
 return data.files.map(file=>{if(!/^[a-f0-9]{64}$/.test(file.version))throw Error('Invalid news file version.');return {version:file.version,post:model.post(file.post)};});
}
export function mergeNewsFiles(files,posts,overrides={}){
 const merged=new Map(posts.map(post=>[post.id,post]));
 for(const file of files){const override=overrides[file.post.id];if(override?.version===file.version){if(override.hidden)merged.delete(file.post.id);}else merged.set(file.post.id,{...file.post,sourceFileVersion:file.version});}
 return [...merged.values()];
}
export function fileOverrides(config){return {...Object.fromEntries(Object.entries(config.fileRemovals||{}).map(([id,version])=>[id,{version,hidden:true}])),...Object.fromEntries(Object.values(config.posts).filter(p=>p.sourceFileVersion).map(p=>[p.id,{version:p.sourceFileVersion,hidden:false}]))};}
export async function downloadNewsFile(value){
 const post=model.post(value),assets=[];let packedSize=new TextEncoder().encode(JSON.stringify(post)).length;
 for(const path of model.imagePaths(post)){
  const response=await fetch(new URL(path,root),{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('An image could not be packaged. Try Download .ttn again.');
  if(Number(response.headers.get('Content-Length'))>model.MAX_ASSET_BYTES)throw Error('An image is over 40 MB. Use a smaller image before downloading.');
  const bytes=await response.arrayBuffer();if(bytes.byteLength>model.MAX_ASSET_BYTES)throw Error('An image is over 40 MB. Use a smaller image before downloading.');
  const mime=model.types[path.split('.').pop().toLowerCase()];
  const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(Error('An image could not be packaged.'));reader.readAsDataURL(new Blob([bytes],{type:mime}));});
  packedSize+=data.length+path.length+mime.length+100;if(packedSize>model.MAX_FILE_BYTES)throw Error('Keep .ttn files under 96 MB. Use fewer or smaller images.');
  assets.push({path,mime,data});
 }
 const source=JSON.stringify({format:model.FORMAT,version:model.VERSION,post,assets});model.parse(source);
 const blob=new Blob([source],{type:'application/vnd.teachertiles.news+json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=post.id+'.ttn';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
