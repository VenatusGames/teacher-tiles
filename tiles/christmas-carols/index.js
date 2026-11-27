(() => {
  'use strict';
  const tracks=window.TeacherTilesCarolTracks;

  function setup(tile){
    const audio=tile.querySelector('.boombox-audio');
    const info=tile.querySelector('.carol-info');
    const credits=tile.querySelector('.carol-credits:not(.carol-library)');
    const creditContent=credits.querySelector('.carol-credit-content');
    const library=tile.querySelector('.carol-library');
    const choose=tile.querySelector('.carol-choose');
    const error=tile.querySelector('.carol-error');
    let selector;
    const closeCredits=bindDialog(credits,info);
    const closeLibrary=()=>selector?.close();

    function changed(){
      (tile._presentationChanged||window.notifyBoardChanged)?.('carol-track');
    }
    function link(text,url){
      const anchor=document.createElement('a');
      anchor.textContent=text;anchor.href=url;anchor.target='_blank';anchor.rel='noopener noreferrer';
      return anchor;
    }
    function syncTrack(track,index){
      error.hidden=true;
      const title=document.createElement('strong');title.textContent=track.title;
      const author=document.createElement('p');author.textContent=track.credit;
      const license=document.createElement('p');license.append(link(track.license,track.licenseUrl));
      const source=document.createElement('p');source.append(link('Original Recording & Source',track.source));
      const note=document.createElement('small');
      note.textContent='Recording used without edits'+(track.id.startsWith('USUAN')?' · ISRC: '+track.id:'');
      creditContent.replaceChildren(title,author,license,source,note);
      choose.setAttribute('aria-label','Choose a Carol: '+track.title);
      selector?.sync(index);
    }

    const player=TeacherTilesSoundscapes.setup(tile,{tracks,lazy:true,onTrackChange:syncTrack});
    selector=TeacherTilesSoundscapes.attachSelector({tile,tracks,triggers:[choose],dialog:library,selectTrack:player.selectTrack,getTrackIndex:player.getTrackIndex});
    tile.querySelectorAll('.boombox-prev,.boombox-next').forEach(button=>button.addEventListener('click',changed));
    audio.addEventListener('error',()=>{error.hidden=false;});
    audio.addEventListener('playing',()=>{error.hidden=true;});
    tile.querySelector('.boombox-volume').addEventListener('change',changed);
    const play=tile.querySelector('.boombox-play');
    function labelPlayback(){play.setAttribute('aria-label',audio.paused?'Play Carol':'Pause Carol');}
    audio.addEventListener('play',labelPlayback);audio.addEventListener('pause',labelPlayback);labelPlayback();
    const deactivate=tile._deactivate,cleanup=tile._cleanup;
    tile._deactivate=()=>{closeCredits();closeLibrary();deactivate?.();};
    tile._cleanup=()=>{closeCredits();closeLibrary();cleanup?.();};
  }

  function bindDialog(dialog,trigger){
    function close(){dialog.close();trigger.setAttribute('aria-expanded','false');}
    trigger.addEventListener('click',()=>{
      if(dialog.open){close();return;}
      dialog.showModal();trigger.setAttribute('aria-expanded','true');
      dialog.querySelector('[aria-pressed="true"]')?.scrollIntoView({block:'nearest'});
    });
    dialog.querySelector('.carol-credits-close').addEventListener('click',close);
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    dialog.addEventListener('click',event=>{
      if(event.target!==dialog)return;
      const rect=dialog.getBoundingClientRect();
      if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();
    });
    dialog.addEventListener('pointerdown',event=>event.stopPropagation());
    dialog.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
    return close;
  }
  function preview(tile,state={}){
    const index=Math.max(0,Math.min(tracks.length-1,Math.round(Number(state.track)||0)));
    const track=tracks[index];
    tile.querySelector('.boombox-title').textContent=track.title;
    tile.querySelector('.boombox-duration').textContent=`${Math.floor(track.duration/60)}:${String(track.duration%60).padStart(2,'0')}`;
  }
  window.TeacherTilesChristmasCarols=Object.freeze({setup,preview});
})();
