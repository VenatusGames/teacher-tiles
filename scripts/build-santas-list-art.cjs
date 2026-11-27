const fs=require('node:fs'),sharp=require('C:/Users/Jack/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
(async()=>{
 // User-supplied artwork. Remove only its neutral gray export matte.
 const {data,info}=await sharp('tiles/santas-list/assets/scroll-source.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let i=0;i<data.length;i+=4){const spread=Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2]);if(spread<10)data[i+3]=Math.round(data[i+3]*Math.max(0,(spread-2)/8));}
 await sharp(data,{raw:info}).webp({lossless:true}).toFile('tiles/santas-list/assets/scroll-base.webp');
 let flakes='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560" preserveAspectRatio="none">';
 for(const [x,y,r]of [[70,122,21],[330,175,24],[72,280,18],[326,355,26],[85,435,20],[310,459,16]]){
  flakes+=`<g transform="translate(${x} ${y}) rotate(${x%39})" stroke="#faffff" stroke-width="2" stroke-linecap="round" opacity=".67">`;
  for(let j=0;j<6;j++)flakes+=`<path transform="rotate(${j*60})" d="M0 0V${-r} M0 ${-r*.5}l${r*.2} ${-r*.18} M0 ${-r*.5}l${-r*.2} ${-r*.18} M0 ${-r*.78}l${r*.14} ${-r*.12} M0 ${-r*.78}l${-r*.14} ${-r*.12}"/>`;
  flakes+='</g>';
 }
 fs.writeFileSync('tiles/santas-list/assets/frosted-flakes.svg',flakes+'</svg>');
 console.log('Prepared user-provided scroll and frosted snowflake overlay');
})();
