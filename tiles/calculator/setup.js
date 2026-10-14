function setupCalculator(m){
  const expressionEl=m.querySelector('.calculator-expression');
  const valueEl=m.querySelector('.calculator-value');
  const valueButtons=[...m.querySelectorAll('[data-calc-value]')];
  const actionButtons=[...m.querySelectorAll('[data-calc-action]')];

  let expression='';
  let justEvaluated=false;

  const displayExpression=value=>value
    .replace(/\*/g,'×')
    .replace(/\//g,'÷');

  const evaluate=()=>{
    if(!expression)return 0;
    if(!/^[0-9+\-*/().\s]+$/.test(expression))throw new Error('Invalid expression');
    const result=Function(`"use strict";return (${expression})`)();
    if(typeof result!=='number'||!Number.isFinite(result))throw new Error('Invalid result');
    return Math.round((result+Number.EPSILON)*1e12)/1e12;
  };

  const render=()=>{
    expressionEl.textContent=displayExpression(expression);
    if(!expression){
      valueEl.textContent='0';
      return;
    }
    try{
      const endsWithOperator=/[+\-*/.(]$/.test(expression);
      if(!endsWithOperator)valueEl.textContent=String(evaluate());
    }catch{
      valueEl.textContent='…';
    }
  };

  const append=value=>{
    if(justEvaluated&&/[0-9.]/.test(value)){
      expression='';
    }
    justEvaluated=false;

    if(/[+\-*/]/.test(value)){
      if(!expression&&value!=='-')return;
      if(/[+\-*/]$/.test(expression)){
        expression=expression.slice(0,-1)+value;
        render();
        return;
      }
    }

    if(value==='.'){
      const tail=expression.split(/[+\-*/()]/).at(-1)||'';
      if(tail.includes('.'))return;
      if(!tail)expression+='0';
    }

    expression+=value;
    render();
  };

  const equals=()=>{
    if(!expression)return;
    try{
      const result=evaluate();
      expression=String(result);
      valueEl.textContent=String(result);
      expressionEl.textContent='';
      justEvaluated=true;
    }catch{
      valueEl.textContent='Error';
      justEvaluated=true;
    }
  };

  const percent=()=>{
    const match=expression.match(/(-?\d*\.?\d+)$/);
    if(!match)return;
    const value=Number(match[1])/100;
    expression=expression.slice(0,-match[1].length)+String(value);
    render();
  };

  const toggleSign=()=>{
    const match=expression.match(/(-?\d*\.?\d+)$/);
    if(!match)return;
    const raw=match[1];
    const replacement=raw.startsWith('-')?raw.slice(1):`-${raw}`;
    expression=expression.slice(0,-raw.length)+replacement;
    render();
  };

  valueButtons.forEach(button=>button.addEventListener('click',()=>append(button.dataset.calcValue)));

  actionButtons.forEach(button=>button.addEventListener('click',()=>{
    switch(button.dataset.calcAction){
      case 'clear':
        expression='';
        justEvaluated=false;
        render();
        break;
      case 'backspace':
        expression=expression.slice(0,-1);
        justEvaluated=false;
        render();
        break;
      case 'percent':
        percent();
        break;
      case 'sign':
        toggleSign();
        break;
      case 'equals':
        equals();
        break;
    }
  }));

  m.addEventListener('pointerdown',event=>{
    if(!event.target.closest('.module-delete,.resize-handle'))m.focus({preventScroll:true});
  });

  m.addEventListener('keydown',event=>{
    if(event.target.closest('input,textarea'))return;

    if(/^[0-9.]$/.test(event.key)){
      event.preventDefault();
      append(event.key);
    }else if(['+','-','*','/','(',')'].includes(event.key)){
      event.preventDefault();
      append(event.key);
    }else if(event.key==='Enter'||event.key==='='){
      event.preventDefault();
      equals();
    }else if(event.key==='Backspace'){
      event.preventDefault();
      expression=expression.slice(0,-1);
      render();
    }else if(event.key==='Escape'){
      expression='';
      render();
    }
  });

  m.querySelector('.calculator-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.calculator-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.calculator-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));

  m._boardGetState=()=>({expression,justEvaluated});
  m._boardSetState=state=>{
    expression=typeof state?.expression==='string'?state.expression:'';
    justEvaluated=Boolean(state?.justEvaluated);
    render();
  };

  render();
}
