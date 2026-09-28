(() => {
 'use strict';
 // Only exact, reviewed entries may reach the board, including from old caches.
 const wordFields=['id','word','part','definition','example','level','source','credit'];
 const quoteFields=['id','text','author','work','source'];
 const wordBank=()=>Object.values(window.TeacherTilesWords).flat();
 const quoteBank=()=>window.TeacherTilesQuotes;
 const matches=(item,bank,fields)=>!!item&&bank.some(approved=>approved.id===item.id&&fields.every(field=>item[field]===approved[field]));
 const validWord=item=>matches(item,wordBank(),wordFields);
 const validQuote=item=>matches(item,quoteBank(),quoteFields);
 async function catalog(folder,key,validate){
   const response=await fetch(`tiles/${folder}/catalog.json`,{cache:'no-cache',credentials:'same-origin',signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error('Classroom collection unavailable');
   const data=await response.json();if(data.version!==1||!Array.isArray(data[key]))throw Error('Invalid classroom collection');
   const entries=[...new Map(data[key].filter(validate).map(item=>[item.id,item])).values()];
    const expected=key==='words'?wordBank().length:quoteBank().length;
    if(entries.length!==expected)throw Error('Incomplete classroom collection');return entries;
 }
 window.TeacherTilesLive=Object.freeze({validWord,validQuote,
   words:()=>catalog('word-of-the-day','words',validWord),
   quotes:()=>catalog('quote-of-the-day','quotes',validQuote)
 });
})();
