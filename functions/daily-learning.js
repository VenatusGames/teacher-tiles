"use strict";
// Fixed upstream URLs, bounded text, and a database lease keep this public feed inexpensive.
const clean=s=>String(s||'').replace(/\{\{[^{}]*\}\}/g,'').replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g,'$1').replace(/<[^>]*>/g,'').replace(/'{2,}/g,'').replace(/\s+/g,' ').trim();
const appropriate=s=>!(/\b(sex|sexual|fuck|shit|suicide|penis|vagina|drunk|porn|bastard)\b/i.test(s));
function parseWord(raw){
  // Split only at top-level pipes: definitions contain nested links/templates.
  const start=raw.indexOf('{{WOTD|');if(start<0)return null;
  const fields=[];let part='',braces=0,links=0;
  for(let i=start+7;i<raw.length;i++){
    const pair=raw.slice(i,i+2);
    if(pair==='{{'){braces++;part+=pair;i++;continue;}
    if(pair==='}}'){if(!braces){fields.push(part);break;}braces--;part+=pair;i++;continue;}
    if(pair==='[['){links++;part+=pair;i++;continue;}if(pair===']]'){links--;part+=pair;i++;continue;}
    if(raw[i]==='|'&&!braces&&!links){fields.push(part);part='';}else part+=raw[i];
  }
  const word=clean(fields[0]),definition=clean(fields[2]);
  if(!word||word.length>60||!definition||definition.length>800||!appropriate(word+' '+definition))return null;
  return {word,part:clean(fields[1]).slice(0,40),definition,example:`Can you use “${word}” in a sentence?`,source:'https://en.wiktionary.org/wiki/'+encodeURIComponent(word),credit:'Wiktionary · CC BY-SA'};
}
async function json(url){const r=await fetch(url,{headers:{'User-Agent':'TeacherTiles/1.0 (https://teachertiles.com)'},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Upstream '+r.status);const body=await r.text();if(body.length>500000)throw Error('Oversized feed');return JSON.parse(body);}
function handler(db){return async(req,res)=>{
  res.set('Access-Control-Allow-Origin','*');res.set('Cache-Control','public, max-age=1800');
  if(req.method!=='GET')return res.status(405).end();
  const date=new Date(),day=date.toISOString().slice(0,10),ref=db.collection('dailyLearning').doc('current');
  try{
    const cached=await ref.get(),previous=cached.data()||{};
    if(previous.day===day)return res.json(previous.content);
    const acquired=await db.runTransaction(async tx=>{const snap=await tx.get(ref),data=snap.data()||{};if(data.day===day||data.leaseUntil>Date.now())return false;tx.set(ref,{leaseUntil:Date.now()+300000},{merge:true});return true;});
    if(!acquired)return previous.content?res.json(previous.content):res.status(503).json({error:'Feed warming up'});
    const month=date.toLocaleString('en-US',{month:'long',timeZone:'UTC'});
    const page=`Wiktionary:Word of the day/${date.getUTCFullYear()}/${month} ${date.getUTCDate()}`;
    const results=await Promise.allSettled([json('https://en.wiktionary.org/w/api.php?action=parse&prop=wikitext&format=json&page='+encodeURIComponent(page)),json('https://zenquotes.io/api/quotes')]);
    const word=results[0].status==='fulfilled'?parseWord(results[0].value.parse?.wikitext?.['*']||''):null;
    const seen=new Set((previous.content?.quotes||[]).map(q=>q.text));
    const quotes=results[1].status==='fulfilled'&&Array.isArray(results[1].value)?results[1].value.filter(q=>typeof q.q==='string'&&typeof q.a==='string'&&q.q.length<600&&q.a.length<100&&appropriate(q.q)&&!seen.has(q.q)&&/learn|educat|knowledge|wisdom|curio|grow|courage|effort|success|dream|believe|create|imagin|persever|practice/i.test(q.q)).map(q=>({text:q.q,author:q.a,work:'Inspirational quotes provided by ZenQuotes API',source:'https://zenquotes.io/',prompt:'How could you put this idea into practice today?'})):[];
    const content={day,words:[...(word?[word]:[]),...(previous.content?.words||[]).filter(w=>w.word!==word?.word)].slice(0,365),quotes:[...quotes,...(previous.content?.quotes||[])].slice(0,365)};
    if(!word&&!quotes.length)return previous.content?res.json(previous.content):res.status(503).json({error:'Feed unavailable'});
    await ref.set({day,content,leaseUntil:0});return res.json(content);
  }catch(error){console.warn('Daily learning feed unavailable:',error.message);return res.status(503).json({error:'Feed unavailable'});}
};}
module.exports={handler,parseWord,appropriate};
