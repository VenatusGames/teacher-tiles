"use strict";
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),model=require('../news/runtime/portable-model.js');
const hash=data=>createHash('sha256').update(data).digest('hex');
function buildNews(root){
 const folder=path.join(root,'news'),records=[],assets=new Map(),ids=new Set();fs.mkdirSync(folder,{recursive:true});
 function scan(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
  if(entry.isSymbolicLink()||/^[._]/.test(entry.name))continue;
  const file=path.join(dir,entry.name);if(entry.isDirectory()){if(dir!==folder||!['runtime','legacy','generated','banners'].includes(entry.name))scan(file);continue;}if(!entry.isFile()||!entry.name.toLowerCase().endsWith('.ttn'))continue;
  try{
   if(fs.statSync(file).size>model.MAX_FILE_BYTES)throw Error('Keep .ttn files under 96 MB.');
   const source=fs.readFileSync(file),bundle=model.parse(source.toString('utf8'));
   if(ids.has(bundle.post.id))throw Error('Another .ttn file has the same post ID. Replace the existing file instead of adding a duplicate.');ids.add(bundle.post.id);
   const replacements=new Map();for(const asset of bundle.assets){const bytes=model.assetBytes(asset),target='banners/news-assets/'+hash(bytes)+'.'+asset.path.split('.').pop().toLowerCase();assets.set(target,bytes);replacements.set(asset.path,target);}
   records.push({version:hash(source),post:model.mapImages(bundle.post,url=>replacements.get(url)||url)});
  }catch(error){throw Error(path.relative(root,file)+': '+error.message);}
 }}scan(folder);
 // Validate every file before writing the generated manifest and extracted assets.
 for(const [name,bytes]of assets){const dest=path.join(root,...name.split('/'));fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);}
 records.sort((a,b)=>b.post.publishedAt.localeCompare(a.post.publishedAt)||a.post.id.localeCompare(b.post.id));
 fs.mkdirSync(path.join(folder,'generated'),{recursive:true});
 fs.writeFileSync(path.join(folder,'generated','posts.json'),JSON.stringify({version:1,files:records})+'\n');return records;
}
module.exports={buildNews};
if(require.main===module)console.log(`Indexed ${buildNews(path.resolve(process.argv[2]||'.')).length} portable news posts.`);
