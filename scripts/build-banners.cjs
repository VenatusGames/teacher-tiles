"use strict";
const fs=require('node:fs'),path=require('node:path');
const extensions=/\.(png|jpe?g|webp|gif|svg|avif)$/i;
function buildBanners(root){
 const dir=path.join(root,'banners'),images=[];fs.mkdirSync(dir,{recursive:true});
 function scan(folder,parts=[]){for(const entry of fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
  if(entry.name.startsWith('.')||entry.name.startsWith('_')||entry.isSymbolicLink())continue;
  const names=[...parts,entry.name],file=path.join(folder,entry.name);
  if(entry.isDirectory())scan(file,names);
  else if(entry.isFile()&&extensions.test(entry.name))images.push({path:'banners/'+names.map(encodeURIComponent).join('/'),name:entry.name.replace(/\.[^.]+$/,'').replace(/[-_]+/g,' ')});
 }}scan(dir);images.sort((a,b)=>a.name.localeCompare(b.name)||a.path.localeCompare(b.path));
 fs.writeFileSync(path.join(dir,'index.json'),JSON.stringify({images},null,2)+'\n');return images;
}
module.exports={buildBanners};
if(require.main===module)console.log(`Indexed ${buildBanners(path.resolve(process.argv[2]||'.')).length} banner images.`);
