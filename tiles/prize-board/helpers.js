function prizePresetImage(kind='gift'){
  const presets={
    gift:['#6c7be8','#8f6ad8','🎁'],game:['#3ea886','#74c86b','🎮'],snack:['#ee835e','#f0ba4a','🍿'],choice:['#4d91df','#7dc5f2','⭐'],break:['#6c8db7','#9bb9d5','🛋️'],music:['#b66bc6','#e58db5','🎵'],helper:['#e0a13e','#f5cf67','👑'],mystery:['#4d566e','#828ba2','❓']
  };
  const [a,b,emoji]=presets[kind]||presets.gift;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="600" height="360" rx="46" fill="url(#g)"/><circle cx="520" cy="55" r="110" fill="white" opacity=".11"/><circle cx="60" cy="330" r="130" fill="white" opacity=".08"/><text x="300" y="215" text-anchor="middle" font-size="150" font-family="Arial, sans-serif">${emoji}</text></svg>`;
  return`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function prizeId(){return globalThis.crypto?.randomUUID?crypto.randomUUID():`prize-${Date.now()}-${Math.random().toString(36).slice(2,8)}`}

function normalizePrize(value){
  const source=value&&typeof value==='object'?value:{};
  const scope=source.scope==='class'?'class':'student';
  const allowed=scope==='student'?['studentStars','studentPunchcardPoints','studentRaceWins','studentEggPoints','studentFlowerPoints']:['classStars','meterWins','jarsFilled','classPunchcardPoints'];
  return{
    id:String(source.id||prizeId()),scope,title:String(source.title||'New Prize').trim().slice(0,80)||'New Prize',
    description:String(source.description||'').trim().slice(0,400),costStat:allowed.includes(source.costStat)?source.costStat:allowed[0],
    cost:Math.max(0,Math.min(9999,Math.round(Number(source.cost)||1))),image:String(source.image||prizePresetImage('gift'))
  };
}

function pbisBalance(roster,statId,studentName=''){
  if(!roster)return 0;
  if(statId==='studentEggPoints'||statId==='studentFlowerPoints')return normalizePunchcardProgress(roster[statId==='studentEggPoints'?'eggHatching':'flowerPots'],roster.students).studentPoints[starChartStudentKey(studentName)]||0;
  if(statId==='studentStars')return normalizeStarChartCount(roster.starChart?.studentStars?.[starChartStudentKey(studentName)]);
  if(statId==='classStars')return normalizeStarChartCount(roster.starChart?.wholeClassStars);
  if(statId==='studentPunchcardPoints')return normalizePunchcardProgress(roster.punchcards,roster.students).studentPoints[starChartStudentKey(studentName)]||0;
  if(statId==='classPunchcardPoints')return normalizePunchcardProgress(roster.punchcards,roster.students).wholeClassPoints;
  if(statId==='studentRaceWins')return normalizeRacerProgress(roster.racer,roster.students).studentWins[starChartStudentKey(studentName)]||0;
  if(statId==='meterWins')return normalizeClassMeterProgress(roster.classMeter).wins;
  if(statId==='jarsFilled')return normalizeCollectionProgress(roster.collectionJar).jarsFilled;
  if(statId==='meterFill')return Math.round(normalizeClassMeterProgress(roster.classMeter).fill);
  if(statId==='jarItems')return normalizeCollectionProgress(roster.collectionJar).count;
  return 0;
}

function adjustPbisBalance(classId,statId,amount,{studentName='',mode='delta'}={}){
  const roster=readClassRosters().find(item=>item.id===classId);if(!roster)return null;
  const current=pbisBalance(roster,statId,studentName);
  let next=mode==='set'?Number(amount):current+Number(amount);
  if(statId==='meterFill')next=Math.max(0,Math.min(100,next));else if(statId==='jarItems')next=Math.max(0,Math.min(80,Math.round(next)));else next=normalizeStarChartCount(next);
  if(statId==='studentEggPoints'||statId==='studentFlowerPoints'){
    const kind=statId==='studentEggPoints'?'eggHatching':'flowerPots',progress=normalizePunchcardProgress(roster[kind],roster.students);progress.studentPoints[starChartStudentKey(studentName)]=next;writeClassGrowth(classId,kind,progress);
  }else if(statId==='studentStars'||statId==='classStars'){
    const progress=normalizeStarChartProgress(roster.starChart,roster.students);
    if(statId==='studentStars')progress.studentStars[starChartStudentKey(studentName)]=next;else progress.wholeClassStars=next;
    writeClassStarChart(classId,progress);
  }else if(statId==='studentPunchcardPoints'||statId==='classPunchcardPoints'){
    const progress=normalizePunchcardProgress(roster.punchcards,roster.students);
    if(statId==='studentPunchcardPoints')progress.studentPoints[starChartStudentKey(studentName)]=next;else progress.wholeClassPoints=next;
    writeClassPunchcards(classId,progress);
  }else if(statId==='studentRaceWins'){
    const progress=normalizeRacerProgress(roster.racer,roster.students);
    progress.studentWins[starChartStudentKey(studentName)]=next;
    writeClassRacer(classId,progress);
  }else if(statId==='meterWins'||statId==='meterFill'){
    const progress=normalizeClassMeterProgress(roster.classMeter);
    if(statId==='meterWins')progress.wins=next;else progress.fill=next;
    writeClassMeter(classId,progress);
  }else if(statId==='jarsFilled'||statId==='jarItems'){
    const progress=normalizeCollectionProgress(roster.collectionJar);
    if(statId==='jarsFilled')progress.jarsFilled=next;else{progress.count=next;progress.filled=false}
    writeClassCollection(classId,progress);
  }
  flushPbisCloudSave();
  return next;
}

function makePrizeModal(){
  const overlay=document.createElement('div');overlay.className='prize-modal-overlay';overlay.hidden=true;
  const panel=document.createElement('section');panel.className='prize-modal';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
  overlay.append(panel);document.body.append(overlay);
  overlay.addEventListener('pointerdown',event=>{if(event.target===overlay)overlay.hidden=true});
  return{overlay,panel,close:()=>{overlay.hidden=true;panel.replaceChildren()}};
}

async function downloadPrizeCoupon(prize,roster,recipient,statLabel){
  const canvas=document.createElement('canvas');canvas.width=1500;canvas.height=760;const ctx=canvas.getContext('2d');
  const draw=async()=>{
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const grad=ctx.createLinearGradient(0,0,1500,760);grad.addColorStop(0,'#edf6ff');grad.addColorStop(1,'#f4edff');ctx.fillStyle=grad;ctx.fillRect(0,0,1500,760);
    ctx.save();ctx.strokeStyle='#4d91df';ctx.lineWidth=8;ctx.setLineDash([24,18]);ctx.strokeRect(36,36,1428,688);ctx.restore();
    ctx.fillStyle='#1e4168';ctx.font='900 34px Arial';ctx.fillText('TEACHERTILES PRIZE COUPON',82,105);
    ctx.fillStyle='#132238';ctx.font='900 70px Arial';ctx.fillText(prize.title,82,205);
    ctx.fillStyle='#526174';ctx.font='600 29px Arial';
    const words=(prize.description||'Classroom reward').split(/\s+/);let line='',y=270;
    for(const word of words){const test=`${line}${word} `;if(ctx.measureText(test).width>790){ctx.fillText(line.trim(),82,y);line=`${word} `;y+=42}else line=test}if(line)ctx.fillText(line.trim(),82,y);
    ctx.fillStyle='#fff';ctx.strokeStyle='#d4dfed';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(82,470,850,190,28);ctx.fill();ctx.stroke();
    ctx.fillStyle='#6a7788';ctx.font='800 23px Arial';ctx.fillText('REDEEMED BY',120,525);ctx.fillStyle='#14243a';ctx.font='900 38px Arial';ctx.fillText(recipient,120,570);
    ctx.fillStyle='#6a7788';ctx.font='800 23px Arial';ctx.fillText('CLASS',510,525);ctx.fillStyle='#14243a';ctx.font='900 34px Arial';ctx.fillText(roster.name,510,570);
    ctx.fillStyle='#6a7788';ctx.font='800 23px Arial';ctx.fillText('COST',120,625);ctx.fillStyle='#286fb8';ctx.font='900 30px Arial';ctx.fillText(`${prize.cost} ${statLabel}`,220,625);
    try{
      const img=new Image();img.src=prize.image;await img.decode();
      const boxX=1000,boxY=130,boxW=390,boxH=390;
      const imageW=img.naturalWidth||img.width||boxW,imageH=img.naturalHeight||img.height||boxH;
      const scale=Math.min(boxW/imageW,boxH/imageH);
      const drawW=imageW*scale,drawH=imageH*scale,drawX=boxX+(boxW-drawW)/2,drawY=boxY+(boxH-drawH)/2;
      ctx.drawImage(img,drawX,drawY,drawW,drawH);
    }catch{}
    ctx.fillStyle='#53647a';ctx.font='700 21px Arial';ctx.fillText('Redeemed with TeacherTiles PBIS',1005,575);ctx.font='600 18px Arial';ctx.fillText(new Date().toLocaleDateString(),1005,612);
  };
  await draw();
  const link=document.createElement('a');link.download=`${prize.title.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()||'prize'}-coupon.png`;link.href=canvas.toDataURL('image/png');link.click();
}
