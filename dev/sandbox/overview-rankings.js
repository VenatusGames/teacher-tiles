import {createUserCard} from './user-card.js';
import {node} from './overview-chart.js?v=20261119-insights2';
import {loadTileCatalog} from '../tiles/shared/tile-catalog.js?v=20261020-ui-fixes';

const shortDate = new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'});
const numbers = new Intl.NumberFormat();
export function createRankings(panel) {
  panel.append(node('h2','','Usage Rankings'));
  function group(title) {
    const section = node('section','overview-rank-group');
    section.append(node('h3','',title));
    panel.append(section);
    return section;
  }
  const active = group('Most Active Users'), newest = group('Newest Users'), tiles = group('Most Used Tiles');
  const activeNote = node('p','overview-context','Ranked by distinct days active since tracking began.');
  active.append(activeNote);
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

  let names, fetching, current, empty;
  function list(group, rows, label, value) {
    group.querySelector('.overview-rank-list')?.remove();
    const content = node(rows?.length ? 'ol' : 'p','overview-rank-list');
    if (rows?.length) {
      rows.forEach((item,i) => {
        const row = node('li');
        const ordinal = node('span','overview-rank-index',String(i+1));
        ordinal.setAttribute('aria-hidden','true');
        row.append(ordinal,node('span','overview-rank-name',label(item)),node('strong','',value(item)));
        content.append(row);
      });
    } else content.textContent = empty;
    group.append(content);
  }
  function userCards(group,rows,isNewest) {
    group.querySelector('.overview-user-cards')?.remove();
    const cards=node(rows?.length?'ol':'p','overview-user-cards');
    if (!rows?.length) cards.textContent=empty;
    for (const user of rows || []) {
      const row=node('li'),card=createUserCard({...user,displayName:user.displayName ?? user.name});
      const info=card.querySelector('.user-info');
      const ms=user.activeMs;
      const minutes=Number.isFinite(ms)?Math.floor(ms/60000):null;
      const duration=minutes===null?'Awaiting activity':minutes>=60?Math.floor(minutes/60)+' hr '+minutes%60+' min':minutes===0&&ms>0?'<1 min':minutes+' min';
      const time=node('small','overview-user-stat','Est. Active Time · '+duration);
      time.title='Estimated from visible-tab check-ins since time tracking began.';
      const detail=isNewest?'Joined '+shortDate.format(user.createdAt):numbers.format(user.days)+(user.days===1?' active day':' active days');
      info.append(node('small','overview-user-stat',detail),time);
      row.append(card);cards.append(row);
    }
    group.append(cards);
  }
  function renderTiles() {
    const rows = current?.tiles || [];
    const label = item => names?.get(item.id) || item.id;
    const placements = item => numbers.format(item.count);
    list(tiles,rows.slice(0,5),label,placements);
    list(extended,rows,label,placements);
    tiles.append(more);
    more.disabled = !rows.length;
  }
  return {render(data,failed,loaded) {
    current = data;
    empty = data ? 'No activity recorded yet.' : failed || loaded ? 'Rankings unavailable.' : 'Awaiting snapshot…';
    if (!data && dialog.open) dialog.close();
    activeNote.textContent = data?.activePartial ? 'Some leading accounts are no longer enabled. Showing eligible users from the first 12 ranked accounts.' : 'Ranked by distinct days active since tracking began.';
    userCards(active,data?.active,false);
    userCards(newest,data?.newest,true);
    renderTiles();
    if (data?.tiles?.length && !names && !fetching) {
      fetching = loadTileCatalog().then(catalog => {
        names = new Map(catalog.tiles.map(tile=>[tile.id,tile.name]));
        renderTiles();
      }).catch(()=>{}).finally(()=>{ fetching = null; });
    }
  }};
}
