// Transactions keep the outgoing batch immutable while new placements accumulate across tabs.
let opening;
function database() {
  if (!opening) opening = new Promise((resolve,reject) => {
    const request = indexedDB.open('teacherTilesPlacementCounts',1);
    request.onupgradeneeded = () => request.result.createObjectStore('counts');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { opening = null; reject(request.error); };
  });
  return opening;
}
async function update(uid, change) {
  const db = await database();
  return new Promise((resolve,reject) => {
    const tx = db.transaction('counts','readwrite'), store = tx.objectStore('counts');
    const get = store.get(uid);
    let result;
    get.onsuccess = () => {
      const state = get.result || {counts:{}};
      const edit = change(state);
      if (edit?.save) store.put(state,uid);
      result = edit?.value;
    };
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(tx.error);
  });
}
export function addPlacement(uid,id) {
  if (!/^[a-z][a-z0-9_-]{0,79}$/.test(id)) return;
  return update(uid,state => {
    state.counts[id] = Math.min(5000,(state.counts[id] || 0) + 1);
    return {save:true};
  });
}
export function pendingPlacements(uid) {
  return update(uid,state => {
    if (Date.now() < (state.nextAt || 0)) return;
    if (state.flight) return {value:state.flight};
    if (!Object.keys(state.counts).length) return;
    state.flight = {id:crypto.randomUUID(),counts:state.counts};
    state.counts = {};
    return {save:true,value:state.flight};
  });
}
export function finishPlacementBatch(uid,id,reply) {
  return update(uid,state => {
    if (state.flight?.id !== id) return;
    if (reply.placementAck) delete state.flight;
    state.nextAt = Number(reply.nextPlacementAt) || 0;
    return {save:true};
  });
}
