(() => {
'use strict';
// Unknown dictionary templates are rejected rather than erased from a definition.
function clean(value){
 let s=String(value||''),invalid=false;
 for(let i=0;i<12&&/\{\{/.test(s);i++)s=s.replace(/\{\{([^{}]*)\}\}/g,(_,body)=>{
   const args=body.split('|'),name=args.shift().trim().toLowerCase();
   if(['lb','label','context','qualifier','q','senseid','anchor'].includes(name))return '';
   if(['l','link','m','mention','ll'].includes(name))return args[2]||args[1]||'';
   if(['w','wikipedia'].includes(name))return args[1]||args[0]||'';
   if(['gloss','non-gloss definition','ngd','vern','smallcaps','smallcaps2','nowrap'].includes(name))return args[0]||'';
   invalid=true;return '';
 });
 s=s.replace(/\[\[([^\]]+)\]\]/g,(_,body)=>{const parts=body.split('|');return parts.length>1?parts.at(-1):parts[0].split('#')[0];})
   .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi,'').replace(/<[^>]*>/g,'').replace(/'{2,}/g,'')
   .replace(/&(?:nbsp|amp|quot|apos|lt|gt);/g,e=>({'&nbsp;':' ','&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'}[e]))
   .replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const cp=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return cp>0&&cp<=0x10ffff?String.fromCodePoint(cp):'';})
   .replace(/\s+/g,' ').trim();
 return invalid?'':s;
}
const readable=s=>typeof s==='string'&&s.trim().length>0&&!/[{}\[\]|<>\uFFFD]|&[a-z#0-9]+;|\b(?:undefined|null|NaN)\b/i.test(s);
const validWord=w=>!!w&&readable(w.word)&&/^[a-z][a-z -]{1,59}$/i.test(w.word)&&readable(w.definition)&&w.definition.length>=15&&w.definition.length<=600&&(w.definition.match(/[a-z]+/gi)||[]).length>=3&&!/^(?:alternative|obsolete|archaic|plural|past tense|present participle|comparative|superlative) (?:form|spelling|of)\b/i.test(w.definition)&&!/[#=]/.test(w.definition)&&readable(w.part);
const validQuote=q=>!!q&&readable(q.text)&&q.text.length>=35&&q.text.length<=400&&(q.text.match(/[a-z]+/gi)||[]).length>=7&&readable(q.author)&&q.author.length>=3&&q.author.length<=80;
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
  const word=clean(fields[0]),definition=clean(fields[2]).split(/\s+#(?:\s|$)/)[0];
  if(!word||word.length>60||!definition||definition.length>800||!appropriate(word+' '+definition))return null;
  const item={word,part:({n:'noun',adj:'adjective',adv:'adverb',v:'verb'}[clean(fields[1])]||clean(fields[1])).slice(0,40),definition,example:`Can you use “${word}” in a sentence?`,source:'https://en.wiktionary.org/wiki/'+encodeURIComponent(word),credit:'Wiktionary · CC BY-SA'};
  return validWord(item)?item:null;
}

const text=s=>String(s||'').replace(/\s+/g,' ').trim();
const classroom=s=>appropriate(s)&&!(/\b(religio\w*|god|christ\w*|sex\w*|war|kill\w*|slave\w*|racial|race|politic\w*|stupid|idiot|ignorant|ignorance|hell|damn|dumb|clueless|defect|refuse|caricature|obstacle|military|soldier|china|economy)\b/i.test(s));
async function page(host,title,prop){
 const url=new URL(`https://${host}/w/api.php`);Object.entries({action:'parse',prop,format:'json',origin:'*',page:title}).forEach(([k,v])=>url.searchParams.set(k,v));
 const response=await fetch(url,{signal:AbortSignal.timeout(18000),credentials:'omit'});
 if(!response.ok)throw Error('Source unavailable');const data=await response.json();const body=data.parse?.[prop]?.['*'];if(typeof body!=='string'||body.length>2000000)throw Error('Invalid source');return body;
}
function parseQuotes(html,topic){
 const doc=new DOMParser().parseFromString(html,'text/html'),output=[];
 for(const li of doc.querySelectorAll('.mw-parser-output > ul > li')){
   const citation=li.querySelector(':scope > ul > li'),author=citation?.querySelector('a[href^="/wiki/"]');
   if(!author||!text(citation.textContent).startsWith(text(author.textContent)))continue;
   const copy=li.cloneNode(true);copy.querySelectorAll('ul,ol,sup').forEach(n=>n.remove());const quote=text(copy.textContent),name=text(author.textContent);
   if(!validQuote({text:quote,author:name})||/\b(?:misattributed|disputed|unsourced|attributed to|translation|variant)\b/i.test(citation.textContent))continue;
   if(quote.length<35||quote.length>260||name.length>80||!classroom(quote)||!/curio|grow|courage|dream|creat|imagin|discover|wonder|joy|possib|inspir|opportun|persever|achiev/i.test(quote))continue;
   output.push({text:quote,author:name,work:`Wikiquote · ${topic} · CC BY-SA`,source:`https://en.wikiquote.org/wiki/${encodeURIComponent(topic)}`});
 }
 return [...new Map(output.map(q=>[q.text,q])).values()];
}
async function wordBatch(offset){
 const today=new Date(),titles=Array.from({length:50},(_,i)=>{
   const date=new Date(Date.UTC(today.getFullYear(),today.getMonth(),today.getDate()-i-offset));
   return `Wiktionary:Word of the day/${date.getUTCFullYear()}/${date.toLocaleString('en-US',{month:'long',timeZone:'UTC'})} ${date.getUTCDate()}`;
 });
 const url=new URL('https://en.wiktionary.org/w/api.php');
 Object.entries({action:'query',prop:'revisions',rvprop:'content',rvslots:'main',format:'json',origin:'*',titles:titles.join('|')}).forEach(([k,v])=>url.searchParams.set(k,v));
 const response=await fetch(url,{signal:AbortSignal.timeout(18000),credentials:'omit'});if(!response.ok)throw Error('Word source unavailable');
 const data=await response.json(),pages=Object.values(data.query?.pages||{});
 const items=titles.map(title=>parseWord(pages.find(p=>p.title===title)?.revisions?.[0]?.slots?.main?.['*']||'')).filter(w=>w&&/^[a-z-]{9,}$/i.test(w.word)&&classroom(w.word+' '+w.definition));
 if(!items.length)throw Error('Word source unavailable');return items;
}
async function words(){
 const epoch=Math.floor(Date.now()/86400000),results=await Promise.allSettled([wordBatch(0),wordBatch(50+(epoch%20)*50)]);
 const items=[...new Map(results.filter(r=>r.status==='fulfilled').flatMap(r=>r.value).map(w=>[w.word,w])).values()];
 if(!items.length)throw Error('Word source unavailable');return items;
}
async function quotes(){
 const results=await Promise.allSettled(['Education','Learning','Curiosity','Creativity','Perseverance','Imagination','Hope','Courage'].map(topic=>page('en.wikiquote.org',topic,'text').then(html=>parseQuotes(html,topic))));
 const items=[...new Map(results.filter(r=>r.status==='fulfilled').flatMap(r=>r.value).map(q=>[q.text,q])).values()];
 if(!items.length)throw Error('Quote source unavailable');return items;
}
window.TeacherTilesLive=Object.freeze({words,quotes,parseWord,parseQuotes,validWord,validQuote});
})();
