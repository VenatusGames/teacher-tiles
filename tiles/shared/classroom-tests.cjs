const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),context={window:{},URL,Date};
for(const file of ['shared/daily','word-of-the-day/words','quote-of-the-day/quotes','vocabulary/index','times-tables/index','google/index','link/index'])vm.runInNewContext(fs.readFileSync(path.join(root,'tiles',file+'.js'),'utf8'),context);
const {TeacherTilesDaily:daily,TeacherTilesWords:words,TeacherTilesQuotes:quotes,TeacherTilesVocabulary:vocab,TeacherTilesTimesTables:tables,TeacherTilesGoogle:google,TeacherTilesLink:link}=context.window;
for(const date of [new Date(2026,2,8),new Date(2026,10,1),new Date(2026,11,31)]){
  const next=new Date(date.getFullYear(),date.getMonth(),date.getDate()+1);
  assert.equal(daily.dayNumber(next)-daily.dayNumber(date),1);
  assert.equal(daily.index(40,0,next),(daily.index(40,0,date)+1)%40);
  assert.equal(daily.index(40,0,date),daily.index(40,0,new Date(date.getFullYear(),date.getMonth(),date.getDate(),23,59)));
}
assert.equal(words.everyday.length,40);assert.equal(words.challenge.length,40);
for(const bank of Object.values(words))for(const item of bank)for(const field of ['word','definition','part','example'])assert(item[field]?.trim());
assert.equal(quotes.length,20);for(const q of quotes){assert(q.text&&q.author&&q.prompt&&q.work);assert(new URL(q.source).hostname==='www.gutenberg.org');}
assert.equal(vocab.normalize(Array.from({length:100},()=>({word:'word',definition:'x'.repeat(500)}))).length,80);
assert.equal(vocab.normalize([{word:' ',definition:'ignored'},null,{word:' term ',definition:'meaning'}]).length,1);
assert.equal(vocab.normalize([{word:'w',definition:'x'.repeat(500)}])[0].definition.length,240);
const t=tables.normalize({families:[2,2,4,-1,99,'5'],start:20,end:0,practice:true});
assert.deepEqual(Array.from(t.families),[2,4]);assert.equal(t.start,20);assert.equal(t.end,20);
const search=new URL(google.searchUrl('earth & space + planets'));assert.equal(search.searchParams.get('q'),'earth & space + planets');assert.equal(search.searchParams.get('safe'),'active');assert.equal(search.origin,'https://www.google.com');
assert.equal(link.safeUrl('example.com/class'),'https://example.com/class');
for(const bad of ['javascript:alert(1)','data:text/html,test','file:///secret','https://user:pass@example.com','https://',''])assert.equal(link.safeUrl(bad),'');
assert.equal(link.safeImage('data:image/svg+xml;base64,PHN2Zz4='),'');assert.equal(link.safeImage('https://example.com/a.png'),'');
const png='data:image/png;base64,iVBORw0KGgo=';assert.equal(link.safeImage(png),png);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),app=fs.readFileSync(path.join(root,'app.js'),'utf8');
for(const [type,category,folder] of [['wordoftheday','literacy','word-of-the-day'],['quoteoftheday','literacy','quote-of-the-day'],['vocabulary','literacy','vocabulary'],['timestables','math','times-tables'],['google','tools','google'],['link','tools','link']]){
 assert(html.includes(`data-module="${type}" data-category="${category}"`));assert(html.includes(`id="${type}-template"`));assert(app.includes(`${type}:'.widget-title'`));
 assert(html.includes(`src="tiles/${folder}/index.js`));assert(html.includes(`href="tiles/${folder}/styles.css`));
}
for(const match of html.matchAll(/(?:href|src)="([^"?:]+\.(?:js|css))(?:\?[^" ]*)?"/g))assert(fs.existsSync(path.join(root,match[1])),`Missing asset ${match[1]}`);
console.log('Six classroom tiles: daily rotation, content, bounded state, safe links, search encoding, categories, headings, and local assets passed.');
