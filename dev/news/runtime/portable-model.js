/* Portable news files contain data, never executable HTML. Shared by the builder and browser. */
(function(root){'use strict';
const doc=typeof module!=='undefined'?require('./document-model.js'):root.TeacherTilesNewsDocument;
const FORMAT='TeacherTiles News',VERSION=1,MAX_FILE_BYTES=96*1024*1024,MAX_ASSET_BYTES=40*1024*1024;
const types={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',avif:'image/avif',svg:'image/svg+xml'};
function validId(id){return typeof id==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(id)&&!['__proto__','constructor','prototype'].includes(id);}
function localImage(value){
 if(typeof value!=='string'||value.length>600||!(value.startsWith('banners/')||value.startsWith('news/banners/'))||/[?#\\\x00-\x1f]/.test(value))return false;
 try{return value.slice(value.startsWith('news/')?13:8).split('/').every(part=>{const decoded=decodeURIComponent(part);return decoded&&!/^[._]|[/\\:%?#\x00-\x1f]/.test(decoded)&&encodeURIComponent(decoded)===part;})&&!!types[value.split('.').pop().toLowerCase()];}catch{return false;}
}
function imageUrl(value){if(localImage(value)||typeof value==='string'&&/^https?:\/\//i.test(value)&&doc.safeURL(value))return value;throw Error('An image has an unsupported address.');}
function post(value){
 if(!value||!validId(value.id)||typeof value.title!=='string'||!value.title.trim()||value.title.length>140)throw Error('The news file needs a valid post ID and title.');
 const date=value.publishedAt;if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error('The news file has an invalid publication date.');
 if(typeof value.published!=='boolean'||typeof value.archived!=='boolean')throw Error('The news file needs publication and archive settings.');
 if(!Array.isArray(value.blocks)||value.blocks.length>40)throw Error('Use up to 40 modules per news post.');
 const ids=new Set(),blocks=value.blocks.map(block=>{
  if(!block||!validId(block.id)||ids.has(block.id))throw Error('News modules need unique IDs.');ids.add(block.id);
  if(block.type==='text')return {id:block.id,type:'text',content:doc.clean(block.content)};
  if(!['photo','gallery'].includes(block.type)||!Array.isArray(block.images)||block.images.length>12||block.type==='photo'&&block.images.length!==1)throw Error('Use a single photo or a gallery of up to 12 images.');
  return {id:block.id,type:block.type,images:block.images.map(image=>{if(!image||typeof image.caption!=='string'||image.caption.length>300)throw Error('Image captions must be under 300 characters.');return {image:imageUrl(image.image),caption:image.caption};})};
 });
 const result={id:value.id,title:value.title.trim(),publishedAt:date,published:value.published,archived:value.archived,blocks};
 if(new TextEncoder().encode(JSON.stringify(result)).length>600000)throw Error('This news post has too much text or formatting.');
 return result;
}
function mapImages(value,replace){const result=structuredClone(value);function visit(nodes){for(const node of nodes){if(typeof node==='string')continue;if(node.tag==='img')node.src=replace(imageUrl(node.src));visit(node.children||[]);}}for(const block of result.blocks){if(['photo','gallery'].includes(block.type))for(const image of block.images)image.image=replace(imageUrl(image.image));else visit(block.content);}return result;}
function imagePaths(value){const paths=new Set();mapImages(value,url=>{if(localImage(url))paths.add(url);return url;});return [...paths];}
function assetBytes(asset){
 if(!asset||!localImage(asset.path)||asset.mime!==types[asset.path.split('.').pop().toLowerCase()]||typeof asset.data!=='string'||asset.data.length>Math.ceil(MAX_ASSET_BYTES/3)*4||asset.data.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(asset.data))throw Error('The news file contains an invalid image.');
 const bytes=typeof Buffer!=='undefined'?new Uint8Array(Buffer.from(asset.data,'base64')):Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0));
 if(!bytes.length||bytes.length>MAX_ASSET_BYTES)throw Error('An image is empty or too large.');
 const ascii=new TextDecoder().decode(bytes.slice(0,24));
 if(asset.mime==='image/png'&&![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)||asset.mime==='image/jpeg'&&!(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)||asset.mime==='image/gif'&&!/^GIF8[79]a/.test(ascii)||asset.mime==='image/webp'&&!(ascii.startsWith('RIFF')&&ascii.slice(8,12)==='WEBP')||asset.mime==='image/avif'&&!(ascii.slice(4,8)==='ftyp'&&/avi[fs]/.test(ascii)))throw Error('An image does not match its file type.');
 if(asset.mime==='image/svg+xml'){
  const svg=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  if(!/<svg[\s>]/i.test(svg)||/<!DOCTYPE|<!ENTITY|<\?(?!xml\s)|<\s*\/?\s*(?:[\w-]+:)?(?:script|foreignObject|iframe|object|embed|audio|video|animate|set|a)(?:\s|\/|>)/i.test(svg)||/\son[\w:-]+\s*=/i.test(svg)||/@import|expression\s*\(/i.test(svg))throw Error('SVG news images cannot contain scripts or interactive content.');
  for(const m of svg.matchAll(/(?:href|src)\s*=\s*(["'])(.*?)\1/gi))if(!/^(#[a-zA-Z0-9_.:-]+|data:image\/(?:png|jpeg|webp|gif|avif);base64,[A-Za-z0-9+/=]+)$/.test(m[2]))throw Error('SVG images must contain their own artwork.');
  for(const m of svg.matchAll(/url\s*\((.*?)\)/gi))if(!/^["']?#[a-zA-Z0-9_.:-]+["']?$/.test(m[1]))throw Error('SVG images must contain their own artwork.');
 }
 return bytes;
}
function parse(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_FILE_BYTES)throw Error('Keep .ttn files under 96 MB.');
 let value;try{value=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw Error('This is not a valid .ttn news file.');}
 if(value?.format!==FORMAT||value.version!==VERSION)throw Error('This .ttn file version is not supported.');
 const normalized=post(value.post),needed=new Set(imagePaths(normalized)),seen=new Set();
 if(!Array.isArray(value.assets)||value.assets.length>480)throw Error('The news file has an invalid image collection.');
 for(const asset of value.assets){if(seen.has(asset.path)||!needed.has(asset.path))throw Error('The news file has duplicate or unused images.');assetBytes(asset);seen.add(asset.path);}
 if(needed.size!==seen.size)throw Error('An image is missing from this news file. Download the post again.');
 return {format:FORMAT,version:VERSION,post:normalized,assets:value.assets.map(({path,mime,data})=>({path,mime,data}))};
}
const api={FORMAT,VERSION,MAX_FILE_BYTES,MAX_ASSET_BYTES,types,post,parse,mapImages,imagePaths,assetBytes,localImage};
if(typeof module!=='undefined')module.exports=api;else root.TeacherTilesNewsFile=api;
})(globalThis);
