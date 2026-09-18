(() => {
  'use strict';

  const QUESTION_MAX=280;
  const SUBHEADING_MAX=220;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const clean=(value,max,{stripQuotes=false}={})=>{
    let text=String(value??'').replace(/\s+/g,' ').trim();
    if(stripQuotes)text=text.replace(/^["'“”‘’]+|["'“”‘’]+$/g,'').trim();
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

  function fitField(field,measure,cssVar,{min,max,emptySize,maxChars,stripQuotes=false}){
    const apply=()=>{
      const text=clean(field.textContent,maxChars,{stripQuotes});
      if(field.textContent!==text&&document.activeElement!==field){
        field.textContent=text;
      }
      if(!text){
        field.style.setProperty(cssVar,`${emptySize}px`);
        return;
      }
      const computed=getComputedStyle(field);
      const width=Math.max(24,field.clientWidth-6);
      const height=Math.max(22,field.clientHeight-6);
      measure.style.width=`${width}px`;
      measure.style.fontFamily=computed.fontFamily;
      measure.style.fontWeight=computed.fontWeight;
      measure.style.lineHeight=computed.lineHeight;
      measure.style.letterSpacing=computed.letterSpacing;
      measure.textContent=text;
      let low=min,high=max,best=min;
      for(let i=0;i<18;i+=1){
        const mid=(low+high)/2;
        measure.style.fontSize=`${mid}px`;
        if(measure.scrollWidth<=width+1&&measure.scrollHeight<=height+1){
          best=mid;
          low=mid;
        }else high=mid;
      }
      field.style.setProperty(cssVar,`${clamp(best,min,max)}px`);
    };
    return apply;
  }

  function setup(moduleElement){
    const question=moduleElement.querySelector('.essential-question-question');
    const subheading=moduleElement.querySelector('.essential-question-subheading');
    const measure=document.createElement('div');
    measure.className='text-fit-measure text-fit-measure--essential-question';
    moduleElement.appendChild(measure);

    installPlainTextPaste(question);
    installPlainTextPaste(subheading);

    question.style.fontSize='var(--essential-question-size,42px)';
    subheading.style.fontSize='var(--essential-subheading-size,18px)';

    let frame=0;
    const questionFit=fitField(question,measure,'--essential-question-size',{min:18,max:60,emptySize:40,maxChars:QUESTION_MAX,stripQuotes:true});
    const subheadingFit=fitField(subheading,measure,'--essential-subheading-size',{min:12,max:24,emptySize:16,maxChars:SUBHEADING_MAX});
    const scheduleFit=()=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        questionFit();
        subheadingFit();
      });
    };

    const syncQuestion=(preserveCaret=false)=>{
      const next=clean(question.textContent,QUESTION_MAX,{stripQuotes:true});
      if(question.textContent!==next){
        question.textContent=next;
        if(preserveCaret&&document.activeElement===question)placeCaretAtEnd(question);
      }
      scheduleFit();
    };
    const syncSubheading=(preserveCaret=false)=>{
      const next=clean(subheading.textContent,SUBHEADING_MAX);
      if(subheading.textContent!==next){
        subheading.textContent=next;
        if(preserveCaret&&document.activeElement===subheading)placeCaretAtEnd(subheading);
      }
      scheduleFit();
    };

    const announceChange=reason=>notifyBoardChanged(`essential-question-${reason}`);
    question.addEventListener('input',()=>{syncQuestion(true);announceChange('question')});
    subheading.addEventListener('input',()=>{syncSubheading(true);announceChange('subheading')});
    question.addEventListener('blur',()=>syncQuestion(false));
    subheading.addEventListener('blur',()=>syncSubheading(false));

    const ro=new ResizeObserver(scheduleFit);
    ro.observe(moduleElement);
    ro.observe(question);
    ro.observe(subheading);

    moduleElement._boardGetState=()=>({
      question:clean(question.textContent,QUESTION_MAX,{stripQuotes:true}),
      subheading:clean(subheading.textContent,SUBHEADING_MAX)
    });
    moduleElement._boardSetState=state=>{
      question.textContent=clean(state?.question,QUESTION_MAX,{stripQuotes:true});
      subheading.textContent=clean(state?.subheading,SUBHEADING_MAX);
      scheduleFit();
    };

    scheduleFit();

    const priorCleanup=moduleElement._cleanup;
    moduleElement._cleanup=()=>{
      cancelAnimationFrame(frame);
      ro.disconnect();
      measure.remove();
      priorCleanup?.();
    };
  }

  window.TeacherTilesEssentialQuestion=Object.freeze({setup});
})();
