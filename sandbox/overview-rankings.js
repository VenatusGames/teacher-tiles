import {createUserCard} from './user-card.js';
import {node} from './overview-chart.js?v=20261119-insights2';
import {loadTileCatalog,tileIcon} from '../tiles/shared/tile-catalog.js?v=20261020-ui-fixes';

const shortDate = new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'});
const numbers = new Intl.NumberFormat();
export function createRankings(panel, loadTopActive) {
  panel.append(node('h2','','Usage Rankings'));
  function group(title) {
    const section = node('section','overview-rank-group');
    section.append(node('h3','',title));
    panel.append(section);
    return section;
  }
  const active = group('Most Active Users'), newest = group('Newest Users'), tiles = group('Most Used Tiles');
  const activeNote = node('p','overview-context','Ranked by distinct days active since tracking began.');
  const activeList = node('div'), tileList = node('div');
  active.append(activeNote,activeList);
  tiles.append(node('p','overview-context','Signed-in Add Tile placements'),tileList);

  function rankingDialog(section,label,title,description,onOpen) {
    const link = node('button','overview-rank-more',label);
    link.type = 'button';
    link.setAttribute('aria-haspopup','dialog');
    const arrow = node('span','','→');
    arrow.setAttribute('aria-hidden','true');
    link.append(arrow);
    section.append(link);

    const dialog = node('dialog','overview-ranking-dialog');
    dialog.setAttribute('aria-label',title);
    const heading = node('div','overview-dialog-heading');
    const close = node('button','overview-rank-close','×');
    close.type = 'button';
    close.setAttribute('aria-label','Close '+title);
    close.onclick = () => dialog.close();
    heading.append(node('h2','',title),close);
    const content = node('div');
    dialog.append(heading,node('p','overview-context',description),content);
    panel.append(dialog);
    link.onclick = () => { dialog.showModal(); onOpen?.(); };
    return {link,dialog,content};
  }
  const users = rankingDialog(active,'View Top 50','Top 50 Most Active Users',activeNote.textContent,loadUsers);
  const topTiles = rankingDialog(tiles,'View Top 20','Top 20 Most Used Tiles','Placements from the signed-in Add Tile menu since tracking began.');
  const status = node('p','overview-context');
  status.setAttribute('role','status');
  const retry = node('button','overview-rank-more','Try again');
  retry.type = 'button';
  retry.onclick = loadUsers;
  const userResults = node('div','overview-ranked-users');
  users.content.append(status,retry,userResults);
  let tilesById, fetching, current, empty, pending;
  async function loadUsers() {
    if (pending || userResults.childElementCount) return;
    retry.hidden = true;
    status.textContent = 'Loading most active users…';
    const request = pending = loadTopActive();
    try {
      const rows = await request;
      if (pending !== request) return;
      status.textContent = '';
      userCards(userResults,rows,false);
    } catch {
      if (pending !== request) return;
      status.textContent = 'Could not load the ranking.';
      retry.hidden = false;
    } finally {
      if (pending === request) pending = null;
    }
  }
  function tileCards(group, rows) {
    group.querySelector('.overview-rank-list')?.remove();
    const list = node(rows.length ? 'ol' : 'p','overview-rank-list');
    for (const {id} of rows) {
      const tile = tilesById?.get(id);
      const name = tile?.name || id.replace(/[-_]+/g,' ').replace(/\b\w/g,letter => letter.toUpperCase());
      const card = node('li','overview-tile-card');
      card.append(tileIcon(tile?.icon,tile?.iconText || name.charAt(0)),node('strong','',name));
      list.append(card);
    }
    if (!rows.length) list.textContent = empty;
    group.append(list);
  }
  function userCards(group,rows,isNewest) {
    group.querySelector('.overview-user-cards')?.remove();
    const cards=node(rows?.length?'ol':'p','overview-user-cards');
    if (!rows?.length) cards.textContent=empty;
    for (const user of rows || []) {
      const row=node('li'),card=createUserCard({...user,displayName:user.displayName ?? user.name});
      const info=card.querySelector('.user-info');
      const detail=isNewest?'Joined '+shortDate.format(user.createdAt):numbers.format(user.days)+(user.days===1?' active day':' active days');
      info.append(node('small','overview-user-stat',detail));
      if (!isNewest) {
        const ms=user.activeMs;
        const minutes=Number.isFinite(ms)?Math.floor(ms/60000):null;
        const duration=minutes===null?'Awaiting activity':minutes>=60?Math.floor(minutes/60)+' hr '+minutes%60+' min':minutes===0&&ms>0?'<1 min':minutes+' min';
        const time=node('small','overview-user-stat','Est. Active Time · '+duration);
        time.title='Estimated from visible-tab check-ins since time tracking began.';
        info.append(time);
      }
      row.append(card);cards.append(row);
    }
    group.append(cards);
  }
  function renderTiles() {
    const rows = current?.tiles || [];
    tileCards(tileList,rows.slice(0,5));
    tileCards(topTiles.content,rows.slice(0,20));
    topTiles.link.disabled = !rows.length;
  }
  return {render(data,failed,loaded) {
    if (current !== data) {
      if (users.dialog.open) users.dialog.close();
      pending = null;
      userResults.replaceChildren();
    }
    current = data;
    empty = data ? 'No activity recorded yet.' : failed || loaded ? 'Rankings unavailable.' : 'Awaiting snapshot…';
    if (!data && topTiles.dialog.open) topTiles.dialog.close();
    users.link.disabled = !data?.active?.length && !data?.activePartial;
    activeNote.textContent = data?.activePartial ? 'Some leading accounts are no longer enabled. Showing eligible users from the first 12 ranked accounts.' : 'Ranked by distinct days active since tracking began.';
    userCards(activeList,data?.active?.slice(0,3),false);
    userCards(newest,data?.newest,true);
    renderTiles();
    if (data?.tiles?.length && !tilesById && !fetching) {
      fetching = loadTileCatalog().then(catalog => {
        tilesById = new Map(catalog.tiles.map(tile=>[tile.id,tile]));
        renderTiles();
      }).catch(()=>{}).finally(()=>{ fetching = null; });
    }
  }};
}
