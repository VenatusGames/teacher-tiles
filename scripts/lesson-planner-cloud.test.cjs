const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function functionSource(source, name) {
  const markers = [`function ${name}(`, `async function ${name}(`];
  const starts = markers.map(marker => source.indexOf(marker)).filter(index => index >= 0);
  const start = starts.length ? Math.min(...starts) : -1;
  assert(start >= 0, `Missing ${name}`);
  const paren = source.indexOf('(', start);
  let parenDepth = 0;
  let quote = '';
  let escaped = false;
  let brace = -1;
  for (let i = paren; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '(') parenDepth += 1;
    else if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        brace = source.indexOf('{', i + 1);
        break;
      }
    }
  }
  assert(brace >= 0, `Missing body for ${name}`);
  let depth = 0;
  quote = '';
  escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (!depth) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Unclosed ${name}`);
}

const plannerSource = fs.readFileSync('tiles/lesson-planner.js', 'utf8');
const plannerNames = [
  'minutes','timeValue','cleanPlannerName','plannerId','scheduleId','normalizeScheduleItem',
  'templateId','normalizeTemplate','savedScheduleId','normalizeSavedSchedule','normalizeBlock',
  'normalizePlanner','normalizePlannerState','mergeById','mergePlannerStates'
];
const plannerSandbox = {
  console,
  Date,
  Math,
  JSON,
  String,
  Number,
  Array,
  Map,
  Set,
  COLORS: [
    { id: 'sun' }, { id: 'sky' }, { id: 'mint' }, { id: 'coral' },
    { id: 'grape' }, { id: 'rose' }, { id: 'ocean' }, { id: 'slate' }
  ],
  MAX_SAVED_SCHEDULES: 4,
  PAID_PLANNER_LIMIT: 10
};
vm.createContext(plannerSandbox);
vm.runInContext(plannerNames.map(name => functionSource(plannerSource, name)).join('\n'), plannerSandbox);

const cloud = {
  planners: [{
    id: 'planner-1', name: 'Cloud planner', color: 'sky', scheduleId: 'schedule-1', settings: { showWeekends: false },
    blocks: [{ id: 'shared', label: 'Cloud edit', date: '2026-09-24', start: '08:00', end: '09:00', color: 'sky', description: '', scheduleId: '' },
             { id: 'cloud-only', label: 'Cloud only', date: '2026-09-25', start: '09:00', end: '10:00', color: 'sky', description: '', scheduleId: '' }]
  }],
  planningLibrary: {
    schedules: [{ id: 'schedule-1', name: 'Cloud schedule', blocks: [{ id: 'schedule-block-cloud', label: 'ELA', start: '08:00', end: '09:00', repeat: 'daily', weekday: 1, color: 'sun' }] }],
    templates: [{ id: 'template-shared', name: 'Cloud template', description: 'Cloud text' }]
  },
  activePlannerId: 'planner-1'
};
const legacyLocal = {
  planners: [{
    id: 'planner-1', name: 'Old local planner', color: 'sun', scheduleId: 'schedule-1', settings: { showWeekends: true },
    blocks: [{ id: 'shared', label: 'Old local edit', date: '2026-09-24', start: '08:00', end: '09:00', color: 'sun', description: '', scheduleId: '' },
             { id: 'local-only', label: 'Local only', date: '2026-09-26', start: '10:00', end: '11:00', color: 'sun', description: '', scheduleId: '' }]
  }, {
    id: 'planner-local', name: 'Local second planner', color: 'mint', scheduleId: '', settings: { showWeekends: false }, blocks: []
  }],
  planningLibrary: {
    schedules: [{ id: 'schedule-local', name: 'Local schedule', blocks: [] }],
    templates: [{ id: 'template-shared', name: 'Old local template', description: 'Old text' }, { id: 'template-local', name: 'Local template', description: 'Keep me' }]
  },
  activePlannerId: 'planner-local'
};

const migrated = plannerSandbox.mergePlannerStates(legacyLocal, cloud);
const migratedPlanner = migrated.planners.find(item => item.id === 'planner-1');
assert.equal(migratedPlanner.name, 'Cloud planner', 'cloud wins matching planner metadata during legacy migration');
assert.equal(migratedPlanner.blocks.find(item => item.id === 'shared').label, 'Cloud edit', 'cloud wins matching lesson during legacy migration');
assert(migratedPlanner.blocks.some(item => item.id === 'local-only'), 'local-only lesson survives migration');
assert(migrated.planners.some(item => item.id === 'planner-local'), 'local-only planner survives migration');
assert(migrated.planningLibrary.schedules.some(item => item.id === 'schedule-local'), 'local-only saved schedule survives migration');
assert.equal(migrated.planningLibrary.templates.find(item => item.id === 'template-shared').description, 'Cloud text');
assert(migrated.planningLibrary.templates.some(item => item.id === 'template-local'), 'local-only template survives migration');

const currentLocal = structuredClone(migrated);
currentLocal.planners[0].blocks.find(item => item.id === 'shared').label = 'Newest local edit';
currentLocal.planners[0].blocks.push({ id: 'new-local', label: 'New local', date: '2026-09-27', start: '11:00', end: '12:00', color: 'coral', description: '', scheduleId: '' });
const conflictMerged = plannerSandbox.mergePlannerStates(cloud, currentLocal);
assert.equal(conflictMerged.planners[0].blocks.find(item => item.id === 'shared').label, 'Newest local edit', 'current local edit wins a revision conflict');
assert(conflictMerged.planners[0].blocks.some(item => item.id === 'cloud-only'), 'remote-only lesson survives revision conflict merge');
assert(conflictMerged.planners[0].blocks.some(item => item.id === 'new-local'), 'new local lesson survives revision conflict merge');

const authSource = fs.readFileSync('firebase-auth.js', 'utf8');
const authNames = ['lessonPlannerDocument','loadLessonPlannerCloud','saveLessonPlannerCloud'];
let docState = { revision: 3, state: { hello: 'cloud' } };
const firestoreSdk = {
  doc: (_db, ...parts) => parts.join('/'),
  serverTimestamp: () => ({ server: true }),
  getDocFromServer: async () => ({ exists: () => Boolean(docState), data: () => docState }),
  runTransaction: async (_db, fn) => {
    const tx = {
      get: async () => ({ exists: () => Boolean(docState), data: () => docState }),
      set: (_ref, value) => { docState = value; }
    };
    return fn(tx);
  }
};
const authSandbox = { currentUser: { uid: 'teacher' }, db: {}, firestoreSdk, Error, Number, Math };
vm.createContext(authSandbox);
vm.runInContext(authNames.map(name => functionSource(authSource, name)).join('\n'), authSandbox);
(async () => {
  const loaded = await authSandbox.loadLessonPlannerCloud();
  assert.equal(loaded.revision, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(loaded.state)), { hello: 'cloud' });
  await assert.rejects(() => authSandbox.saveLessonPlannerCloud({ hello: 'local' }, { expectedRevision: 2 }), error => error.code === 'planner-conflict');
  const saved = await authSandbox.saveLessonPlannerCloud({ hello: 'local' }, { expectedRevision: 3 });
  assert.equal(saved.revision, 4);
  assert.equal(docState.revision, 4);
  assert.deepEqual(JSON.parse(JSON.stringify(docState.state)), { hello: 'local' });

  assert(plannerSource.includes('queuePlannerCloudSave();'), 'planner saves must enqueue cloud persistence');
  assert(plannerSource.includes("window.addEventListener('teachertiles:authchange'"), 'planner must hydrate on auth changes');
  assert(plannerSource.includes("window.addEventListener('focus'"), 'planner must refresh when returning to a browser');
  assert(authSource.includes('window.TeacherTilesLessonPlannerCloud = Object.freeze'), 'auth layer must expose planner cloud API');
  console.log('Lesson planner cloud migration, conflict merge, revision guard, and sync hooks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
