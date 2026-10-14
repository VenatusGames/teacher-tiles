function setupChangelog(){
  const changelogContent=document.getElementById('changelog-content');
  const newsContent=document.getElementById('news-content');
  const contactForm=document.getElementById('contact-form');
  const contactStatus=document.getElementById('contact-status');
  const contactSubmit=document.getElementById('contact-submit');

  if(!changelogContent||!newsContent)return;

  const loaded={announcements:false,news:false};

  const escapeHtml=value=>String(value)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");

  const inlineMarkdown=text=>{
    let safe=escapeHtml(text);
    safe=safe.replace(/`([^`]+)`/g,'<code>$1</code>');
    safe=safe.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
    safe=safe.replace(/\*([^*]+)\*/g,'<em>$1</em>');
    safe=safe.replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g,'<img class="changelog-image" src="$2" alt="$1" loading="lazy" decoding="async">');
    safe=safe.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return safe;
  };

  const renderMarkdown=markdown=>{
    const lines=markdown.replace(/\r\n?/g,'\n').split('\n');
    const out=[];
    let listOpen=false;

    const closeList=()=>{
      if(listOpen){
        out.push('</ul>');
        listOpen=false;
      }
    };

    for(const raw of lines){
      const line=raw.trimEnd();
      if(!line.trim()){
        closeList();
        continue;
      }

      const heading=line.match(/^(#{1,3})\s+(.+)$/);
      if(heading){
        closeList();
        const level=heading[1].length;
        out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
        continue;
      }

      const bullet=line.match(/^\s*[-*]\s+(.+)$/);
      if(bullet){
        if(!listOpen){
          out.push('<ul>');
          listOpen=true;
        }
        out.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
        continue;
      }

      closeList();
      out.push(`<p>${inlineMarkdown(line)}</p>`);
    }

    closeList();
    return out.join('');
  };

  async function loadFeed(kind){
    const isNews=kind==='news';
    const content=isNews?newsContent:changelogContent;
    const folder=isNews?'news':'changelog';
    const globalData=isNews?window.TeacherTilesNewsData:window.TeacherTilesChangelogData;
    const label=isNews?'news':'updates';

    content.innerHTML=`<div class="changelog-loading">Loading ${label}…</div>`;

    try{
      let valid=[];

      if(Array.isArray(globalData)&&globalData.length){
        valid=globalData
          .filter(entry=>entry&&entry.file&&typeof entry.text==='string')
          .slice();
      }else{
        const response=await fetch(`${folder}/index.json?ts=${Date.now()}`,{cache:'no-store'});
        if(!response.ok)throw new Error(`Could not load ${label} index.`);

        const data=await response.json();
        const files=Array.isArray(data.files)?data.files:[];

        const entries=await Promise.all(files.map(async entry=>{
          const file=typeof entry==='string'?entry:entry.file;
          const addedAt=typeof entry==='object'&&entry?entry.addedAt:null;
          if(!file)return null;

          const res=await fetch(`${folder}/${encodeURIComponent(file)}?ts=${Date.now()}`,{cache:'no-store'});
          if(!res.ok)return null;
          return {file,addedAt,text:await res.text()};
        }));

        valid=entries.filter(Boolean);
      }

      if(!valid.length){
        content.innerHTML=`<div class="changelog-empty">No ${label} entries yet.</div>`;
        loaded[kind]=true;
        return;
      }

      content.replaceChildren();
      for(const entry of valid){
        const article=document.createElement('article');
        article.className='changelog-entry';
        article.innerHTML=renderMarkdown(entry.text);
        content.append(article);
      }

      loaded[kind]=true;
    }catch(err){
      content.innerHTML=`<div class="changelog-error">The ${label} feed could not be loaded.</div>`;
      console.error(err);
    }
  }

  window.addEventListener('teachertiles:settings-tab',event=>{
    const name=event.detail?.name;
    if((name==='announcements'||name==='news')&&!loaded[name])loadFeed(name);
  });

  if(contactForm&&contactSubmit&&contactStatus){
    contactForm.addEventListener('submit',async e=>{
      e.preventDefault();

      if(!contactForm.reportValidity())return;

      const formData=new FormData(contactForm);
      const name=String(formData.get('name')||'').trim();
      const email=String(formData.get('email')||'').trim();
      const subject=String(formData.get('subject')||'').trim();
      const message=String(formData.get('message')||'').trim();

      contactSubmit.disabled=true;
      contactSubmit.textContent='Sending…';
      contactStatus.className='contact-status';
      contactStatus.textContent='Sending your message…';

      try{
        const payload=new FormData();
        payload.append('name',name);
        payload.append('email',email);
        payload.append('subject',subject);
        payload.append('message',message);
        payload.append('_subject',`TeacherTiles Contact: ${subject}`);
        payload.append('_template','table');
        payload.append('_captcha','false');

        const response=await fetch('https://formsubmit.co/ajax/teachertiles@gmail.com',{
          method:'POST',
          headers:{Accept:'application/json'},
          body:payload
        });

        const result=await response.json().catch(()=>null);
        if(!response.ok||result?.success===false){
          throw new Error(result?.message||'Message could not be sent.');
        }

        contactForm.reset();
        contactStatus.className='contact-status is-success';
        contactStatus.textContent='Message sent. Thank you!';
      }catch(err){
        console.error(err);
        contactStatus.className='contact-status is-error';
        contactStatus.textContent='Could not send automatically. Please try again in a moment.';
      }finally{
        contactSubmit.disabled=false;
        contactSubmit.textContent='Send Message';
      }
    });
  }

}
