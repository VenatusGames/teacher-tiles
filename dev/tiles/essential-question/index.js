(() => {
  'use strict';

  const QUESTION_MAX=280;
  const SUBHEADING_MAX=220;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

  const clean=(value,max,{stripQuotes=false,trim=true}={})=>{
    let text=String(value??'').replace(/[\r\n\t]+/g,' ').replace(/ {2,}/g,' ');
    if(stripQuotes)text=text.replace(/^["'“”‘’]+/g,'').replace(/["'“”‘’]+$/g,'');
    text=trim?text.trim():text.replace(/^ +/,'');
    return text.slice(0,max);
  };

  function placeCaretAtEnd(element){
    if(!(element instanceof HTMLElement))return;
    const selection=window.getSelection?.();
    if(!selection)return;
    const range=document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function installPlainTextPaste(field){
    field.addEventListener('paste',event=>{
      event.preventDefault();
      const text=event.clipboardData?.getData('text/plain')||'';
      document.execCommand('insertText',false,text);
    });
  }

  function setup(moduleElement){
    const question=moduleElement.querySelector('.essential-question-question');
    const subheading=moduleElement.querySelector('.essential-question-subheading');
    const measure=document.createElement('div');
    measure.className='text-fit-measure text-fit-measure--essential-question';
    moduleElement.appendChild(measure);

    installPlainTextPaste(question);
    installPlainTextPaste(subheading);

    let frame=0;
    const fit=(field,cssVar,{min,max,emptySize,maxChars,stripQuotes=false})=>{
      const text=clean(field.textContent,maxChars,{stripQuotes,trim:false});
      const computed=getComputedStyle(field);
      const width=Math.max(24,field.clientWidth-4);
      const availableHeight=field===question?field.parentElement?.clientHeight:field.clientHeight;
      const height=Math.max(22,(availableHeight||field.clientHeight)-4);
      if(!text&&field!==question){moduleElement.style.setProperty(cssVar,`${emptySize}px`);return}
      measure.style.width=`${width}px`;
      measure.style.fontFamily=computed.fontFamily;
      measure.style.fontWeight=computed.fontWeight;
      measure.style.lineHeight=computed.lineHeight;
      measure.style.letterSpacing=computed.letterSpacing;
      measure.textContent=field===question?`“${text||(field.dataset.placeholder||'Type the essential question')}”`:text;
      let low=min,high=max,best=min;
      for(let i=0;i<18;i+=1){
        const mid=(low+high)/2;
        measure.style.fontSize=`${mid}px`;
        if(measure.scrollWidth<=width+1&&measure.scrollHeight<=height+1){best=mid;low=mid}else high=mid;
      }
      moduleElement.style.setProperty(cssVar,`${clamp(best,min,max)}px`);
    };

    const syncQuestionQuoteState=()=>{
      const hasText=Boolean(clean(question.textContent,QUESTION_MAX,{stripQuotes:true,trim:true}));
      question.classList.toggle('has-question-text',hasText);
      question.classList.toggle('is-empty-question',!hasText);
    };

    const scheduleFit=()=>{
      syncQuestionQuoteState();
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        fit(question,'--essential-question-size',{min:18,max:64,emptySize:40,maxChars:QUESTION_MAX,stripQuotes:true});
        fit(subheading,'--essential-subheading-size',{min:12,max:22,emptySize:17,maxChars:SUBHEADING_MAX});
      });
    };

    const syncLive=(field,max,{stripQuotes=false}={})=>{
      const next=clean(field.textContent,max,{stripQuotes,trim:false});
      if(field.textContent!==next||(!next&&field.innerHTML)){field.textContent=next;placeCaretAtEnd(field)}
      scheduleFit();
    };
    const syncFinal=(field,max,{stripQuotes=false}={})=>{
      const next=clean(field.textContent,max,{stripQuotes,trim:true});
      if(field.textContent!==next)field.textContent=next;
      scheduleFit();
    };

    question.addEventListener('input',()=>{syncLive(question,QUESTION_MAX,{stripQuotes:true});notifyBoardChanged('essential-question-question')});
    subheading.addEventListener('input',()=>{syncLive(subheading,SUBHEADING_MAX);notifyBoardChanged('essential-question-subheading')});
    question.addEventListener('blur',()=>syncFinal(question,QUESTION_MAX,{stripQuotes:true}));
    subheading.addEventListener('blur',()=>syncFinal(subheading,SUBHEADING_MAX));

    const ro=new ResizeObserver(scheduleFit);
    ro.observe(moduleElement);ro.observe(question);ro.observe(subheading);

    moduleElement._boardGetState=()=>({
      question:clean(question.textContent,QUESTION_MAX,{stripQuotes:true,trim:true}),
      subheading:clean(subheading.textContent,SUBHEADING_MAX,{trim:true})
    });
    moduleElement._boardSetState=state=>{
      question.textContent=clean(state?.question,QUESTION_MAX,{stripQuotes:true,trim:true});
      subheading.textContent=clean(state?.subheading,SUBHEADING_MAX,{trim:true});
      scheduleFit();
    };

    scheduleFit();
    const priorCleanup=moduleElement._cleanup;
    moduleElement._cleanup=()=>{cancelAnimationFrame(frame);ro.disconnect();measure.remove();priorCleanup?.()};
  }

  window.TeacherTilesEssentialQuestion=Object.freeze({setup});
})();
