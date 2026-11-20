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
  const activeList = node('div');
  activeList.id = 'overview-active-users';
  const toggle = node('button','overview-rank-more','View Top 50');
  toggle.type = 'button';
  toggle.setAttribute('aria-controls',activeList.id);
  const status = node('p','overview-context');
  status.setAttribute('role','status');
  active.append(activeNote, toggle, status, activeList);
  tiles.append(node('p','overview-context','Signed-in Add Tile placements'));
  const more = node('button','overview-rank-more','View Top 20');
  more.type = 'button';
  const dialog = node('dialog','overview-ranking-dialog');
  dialog.setAttribute('aria-label','Top 20 Most Used Tiles');
  const heading = node('div','overview-dialog-heading');
  const close = node('button','overview-rank-close','×');
  close.type = 'button';
  close.setAttribute('aria-label','Close tile rankings');
  heading.append(node('h2','','Top 20 Most Used Tiles'),close);
  const extended = node('div');
  dialog.append(heading,node('p','overview-context','Placements from the signed-in Add Tile menu since tracking began.'),extended);
  panel.append(dialog);
  close.onclick = () => dialog.close();
  more.onclick = () => dialog.showModal();

  let tilesById, fetching, current, empty;
  let expanded = false, topUsers = null, pending = null, error = '';
  function renderActive() {
    const showingAll = expanded && topUsers !== null;
    toggle.disabled = !current?.active?.length && !current?.activePartial;
    toggle.textContent = expanded ? 'Show Top 3' : 'View Top 50';
    toggle.setAttribute('aria-expanded',String(expanded));
    activeList.classList.toggle('overview-active-expanded',showingAll);
    status.textContent = expanded && pending ? 'Loading most active users…' : error;
    status.hidden = !status.textContent;
    activeNote.textContent = current?.activePartial && !showingAll
      ? 'Some leading accounts are no longer enabled. Showing eligible users from the first 12 ranked accounts.'
      : 'Ranked by distinct days active since tracking began.';
    userCards(activeList,showingAll ? topUsers : current?.active,false);
  }
  toggle.onclick = async () => {
    expanded = !expanded;
    error = '';
    if (!expanded || topUsers || pending) { renderActive(); return; }
    const request = pending = loadTopActive();
    renderActive();
    try {
      const rows = await request;
      if (pending === request) topUsers = rows;
    } catch {
      if (pending === request && expanded) {
        expanded = false;
        error = 'Could not load the ranking. Select View Top 50 to try again.';
      }
    } finally {
      if (pending === request) { pending = null; renderActive(); }
    }
  };
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
    tileCards(tiles,rows.slice(0,5));
    tileCards(extended,rows.slice(0,20));
    tiles.append(more);
    more.disabled = !rows.length;
  }
  return {render(data,failed,loaded) {
    if (current !== data) { expanded = false; topUsers = null; pending = null; error = ''; }
    current = data;
    empty = data ? 'No activity recorded yet.' : failed || loaded ? 'Rankings unavailable.' : 'Awaiting snapshot…';
    if (!data && dialog.open) dialog.close();
    renderActive();
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
