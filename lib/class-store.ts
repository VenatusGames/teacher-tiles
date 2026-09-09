import { collection, doc, getDoc, getDocs, runTransaction, writeBatch, deleteDoc, type DocumentReference, type DocumentSnapshot } from 'firebase/firestore';
import { auth, requireDb } from './firebase';
import { decryptRecord, encryptRecord, emailLookup, isEncrypted } from './encryption';
import { classKey } from './key-vault';
import { cachedRead, invalidateReads, patchCachedRead } from './read-cache';
import { emptyData, localDate, normalizeEmail, personalize, type Access, type AppData, type Student, type Question, type Answer, type HistoryEntry } from './model';

const root = (access: Access) => doc(requireDb(), 'classes', access.ownerId);
const records = (access: Access, name: string) => collection(root(access), name);
const record = (access: Access, name: string, id: string) => doc(records(access, name), id);
const link = (hash: string) => doc(requireDb(), 'studentAccess', hash);
function requireTeacher(access: Access) {
  if (access.role !== 'teacher' || access.ownerId !== auth?.currentUser?.uid) throw new Error('Only your teacher can change the class.');
}
function text(value: unknown, label: string, max = 2000) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error('Enter ' + label + ' (up to ' + max + ' characters).');
  return value.trim();
}
function imageValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.length > 33000 || (!/^data:image\/jpeg;base64,/.test(value) && !/^preset:(smile|sad|yes|no)$/.test(value))) throw new Error('Choose a smaller picture.');
  return value;
}
type Row = { ref: DocumentReference; id: string; exists: () => boolean; data: () => Record<string, any> | undefined };
function rememberRecord(access: Access, ref: DocumentReference, payload: Record<string, unknown>) {
  const snapshot: Row = { ref, id: ref.id, exists: () => true, data: () => payload };
  const name = ref.path.split('/')[2];
  if (!name) patchCachedRead<Row>(access, 'settings', () => snapshot);
  else if (name === 'students') patchCachedRead<Row[]>(access, 'students', rows => [...rows.filter(row => row.id !== ref.id), snapshot]);
  else patchCachedRead<{ docs: Row[] }>(access, name, rows => ({ docs: [...rows.docs.filter(row => row.id !== ref.id), snapshot] }));
}
function forgetRecord(access: Access, name: string, id: string) {
  if (name === 'students') patchCachedRead<Row[]>(access, name, rows => rows.filter(row => row.id !== id));
  else patchCachedRead<{ docs: Row[] }>(access, name, rows => ({ docs: rows.docs.filter(row => row.id !== id) }));
}
export function refreshClassData(access: Access) {
  for (const name of ['settings', 'students', 'questions', 'answers', 'history:', 'completed:']) invalidateReads(access, name);
}
async function read<T>(snapshot: Row, key: CryptoKey): Promise<T> {
  if (!snapshot.exists()) throw new Error('That record is no longer available.');
  return decryptRecord<T>(snapshot.data()!, key, snapshot.ref.path);
}
const sorted = <T extends { position: number }>(rows: T[]) => rows.sort((a, b) => a.position - b.position);

// Full replacements remove plaintext. Transactions re-read their sources.
// Encrypt the root last so an interrupted migration resumes on the next load.
async function prepareClass(access: Access, initial: DocumentSnapshot) {
  requireTeacher(access);
  if (initial.exists() && isEncrypted(initial.data())) return;
  const [questions, answers, students] = await Promise.all([
    getDocs(records(access, 'questions')), getDocs(records(access, 'answers')), getDocs(records(access, 'students')),
  ]);
  const shared = await classKey(access, undefined, ![...questions.docs, ...answers.docs].some(s => isEncrypted(s.data())));
  const migrate = async (ref: DocumentReference, key: CryptoKey, convert: (data: Record<string, any>) => unknown = data => data) => {
    await runTransaction(requireDb(), async tx => {
      const current = await tx.get(ref);
      if (!current.exists() || isEncrypted(current.data())) return;
      tx.set(ref, await encryptRecord(convert(current.data()), key, ref.path));
    });
  };
  for (const row of questions.docs) await migrate(row.ref, shared);
  for (const row of answers.docs) await migrate(row.ref, shared);
  for (const student of students.docs) {
    const responses = await getDocs(collection(student.ref, 'responses'));
    const key = await classKey(access, student.id, !isEncrypted(student.data()) && !responses.docs.some(s => isEncrypted(s.data())));
    for (const response of responses.docs) await migrate(response.ref, key, data => ({
      createdAt: data.createdAt?.toDate().toISOString() ?? response.id + 'T12:00:00.000Z', items: data.items,
    }));
    await runTransaction(requireDb(), async tx => {
      const current = await tx.get(student.ref);
      if (!current.exists() || isEncrypted(current.data())) return;
      const data = current.data() as Student;
      const email = normalizeEmail(data.email ?? '');
      const hash = await emailLookup(email);
      const existing = hash ? await tx.get(link(hash)) : null;
      const legacyRef = email ? doc(requireDb(), 'studentLinks', email) : null;
      const legacy = legacyRef ? await tx.get(legacyRef) : null;
      if (existing?.exists() && (existing.data().ownerId !== access.ownerId || existing.data().studentId !== student.id)) throw new Error('A student email assignment conflicts. No assignment was replaced.');
      if (legacy?.exists() && (legacy.data().ownerId !== access.ownerId || legacy.data().studentId !== student.id)) throw new Error('A legacy student email assignment conflicts. No assignment was replaced.');
      tx.set(student.ref, { ...await encryptRecord({ ...data, id: student.id, email }, key, student.ref.path), emailHash: hash });
      if (hash) {
        tx.set(link(hash), { ownerId: access.ownerId, studentId: student.id });
        if (legacy?.exists()) tx.delete(legacyRef!);
      }
    });
  }
  await runTransaction(requireDb(), async tx => {
    const current = await tx.get(root(access));
    if (current.exists() && isEncrypted(current.data())) return;
    const settings = current.exists() ? { title: current.data().title, description: current.data().description } : emptyData.settings;
    tx.set(root(access), await encryptRecord(settings, shared, root(access).path));
    if (!current.exists()) {
      const question = record(access, 'questions', 'starter');
      tx.set(question, await encryptRecord({ id: 'starter', prompt: 'How focused did you feel today?', position: 1, fridayOnly: false }, shared, question.path));
      for (const [index, label] of ['Getting Started', 'On My Way', 'Locked In'].entries()) {
        const answer = record(access, 'answers', 'starter-' + index);
        tx.set(answer, await encryptRecord({ id: answer.id, questionId: 'starter', label, imageKey: null, position: index + 1 }, shared, answer.path));
      }
    }
  });
}

export async function loadClass(access: Access): Promise<AppData> {
  let settings = await cachedRead(access, 'settings', () => getDoc(root(access)), Infinity);
  if (access.role === 'teacher' && (!settings.exists() || !isEncrypted(settings.data()))) {
    try { await cachedRead(access, 'migration', () => prepareClass(access, settings)); }
    finally { invalidateReads(access, 'settings'); invalidateReads(access, 'migration'); }
    settings = await cachedRead(access, 'settings', () => getDoc(root(access)), Infinity);
  }
  if (!settings.exists()) throw new Error('Your class is no longer available. Contact your teacher.');
  if (!isEncrypted(settings.data())) throw new Error('Your teacher needs to open the updated app once to finish protecting this class.');
  const shared = await classKey(access);
  const [studentRows, questionRows, answerRows] = await Promise.all([
    cachedRead(access, 'students', () => access.role === 'student' ? getDoc(record(access, 'students', access.studentId)).then(s => [s]) : getDocs(records(access, 'students')).then(s => s.docs), Infinity),
    cachedRead(access, 'questions', () => getDocs(records(access, 'questions')), Infinity), cachedRead(access, 'answers', () => getDocs(records(access, 'answers')), Infinity),
  ]);
  const students = await Promise.all(studentRows.map(async s => ({ ...await read<Student>(s, await classKey(access, s.id)), id: s.id })));
  return { settings: await read<AppData['settings']>(settings, shared), students: students.sort((a, b) => a.name.localeCompare(b.name)),
    questions: sorted(await Promise.all(questionRows.docs.map(s => read<Question>(s, shared)))),
    answers: sorted(await Promise.all(answerRows.docs.map(s => read<Answer>(s, shared)))) };
}

async function saveStudent(access: Access, id: string, values: Partial<Student>, creating: boolean) {
  requireTeacher(access);
  const key = await classKey(access, id, creating);
  const saved = await runTransaction(requireDb(), async tx => {
    const ref = record(access, 'students', id); const previous = await tx.get(ref);
    if (!creating && !previous.exists()) throw new Error('That student no longer exists.');
    if (creating && previous.exists()) throw new Error('That student already exists.');
    const old = previous.exists() ? await read<Student>(previous, key) : undefined;
    const next: Student = { id, name: '', email: '', imageKey: null, currentScore: null, goalScore: null, ...old, ...values };
    next.email = normalizeEmail(next.email);
    if (next.email === normalizeEmail(auth!.currentUser!.email!)) throw new Error('Use the student’s Google email, not your teacher email.');
    const hash = await emailLookup(next.email); const oldHash = await emailLookup(old?.email ?? '');
    if (hash && hash !== oldHash) {
      const existing = await tx.get(link(hash));
      const legacy = await tx.get(doc(requireDb(), 'studentLinks', next.email));
      if (existing.exists() || legacy.exists()) throw new Error('That email is already attached to a student. Ask the current teacher to remove its assignment first.');
    }
    if (oldHash && oldHash !== hash) tx.delete(link(oldHash));
    const payload = { ...await encryptRecord(next, key, ref.path), emailHash: hash };
    tx.set(ref, payload);
    if (hash && hash !== oldHash) tx.set(link(hash), { ownerId: access.ownerId, studentId: id });
    return { ref, payload };
  });
  rememberRecord(access, saved.ref, saved.payload);
}
async function editRecord(access: Access, ref: DocumentReference, key: CryptoKey, values: Record<string, unknown>) {
  const payload = await runTransaction(requireDb(), async tx => {
    const current = await tx.get(ref);
    const data = await read<Record<string, unknown>>(current, key);
    const payload = await encryptRecord({ ...data, ...values }, key, ref.path);
    tx.set(ref, payload);
    return payload;
  });
  rememberRecord(access, ref, payload);
}
export async function changeClass(access: Access, body: Record<string, unknown>) {
  try { return await performChange(access, body); }
  catch (error) {
    const action = String(body.action);
    if (action === 'saveSettings') invalidateReads(access, 'settings');
    if (action.toLowerCase().includes('student')) invalidateReads(access, 'students');
    if (action.toLowerCase().includes('question')) invalidateReads(access, 'questions');
    if (action.toLowerCase().includes('answer') || action === 'deleteQuestion') invalidateReads(access, 'answers');
    if (action === 'deleteStudent' || action === 'deleteResponse') invalidateReads(access, 'history:' + String(body.studentId ?? body.id) + ':');
    throw error;
  }
}
async function performChange(access: Access, body: Record<string, unknown>) {
  requireTeacher(access);
  const id = String(body.id ?? '');
  const ref = record(access, 'students', id || 'unused');
  switch (body.action) {
    case 'saveSettings': return editRecord(access, root(access), await classKey(access), { title: text(body.title, 'a title', 160), description: text(body.description, 'a description', 4000) });
    case 'addStudent': return saveStudent(access, crypto.randomUUID(), { name: text(body.name, 'a student name', 100), email: normalizeEmail(String(body.email ?? '')), imageKey: imageValue(body.imageKey) }, true);
    case 'updateStudentName': return saveStudent(access, id, { name: text(body.name, 'a student name', 100) }, false);
    case 'updateStudentEmail': return saveStudent(access, id, { email: normalizeEmail(String(body.email ?? '')) }, false);
    case 'updateStudentImage': return saveStudent(access, id, { imageKey: imageValue(body.imageKey) }, false);
    case 'removeStudentImage': return saveStudent(access, id, { imageKey: null }, false);
    case 'updateStudentScores': {
      if (![body.currentScore, body.goalScore].every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1e9)) throw new Error('Enter valid scores.');
      return saveStudent(access, id, { currentScore: body.currentScore as number, goalScore: body.goalScore as number }, false);
    }
    case 'deleteStudent': {
      const responses = await getDocs(collection(ref, 'responses'));
      for (let i = 0; i < responses.docs.length; i += 400) { const batch = writeBatch(requireDb()); responses.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref)); await batch.commit(); }
      await runTransaction(requireDb(), async tx => {
        const student = await tx.get(ref);
        if (student.data()?.emailHash) tx.delete(link(student.data()!.emailHash));
        tx.delete(ref);
      });
      forgetRecord(access, 'students', id);
      invalidateReads(access, 'history:' + id + ':');
      invalidateReads(access, 'completed:' + id + ':');
      return;
    }
    case 'addQuestion': {
      const ref = record(access, 'questions', crypto.randomUUID());
      const payload = await encryptRecord({ id: ref.id, prompt: text(body.prompt, 'a question', 2000), position: Date.now(), fridayOnly: Boolean(body.fridayOnly) }, await classKey(access), ref.path);
      await runTransaction(requireDb(), async tx => { tx.set(ref, payload); });
      rememberRecord(access, ref, payload); return;
    }
    case 'setQuestionFridayOnly': return editRecord(access, record(access, 'questions', id), await classKey(access), { fridayOnly: Boolean(body.fridayOnly) });
    case 'deleteQuestion': {
      const key = await classKey(access); const all = await getDocs(records(access, 'answers'));
      const matching = (await Promise.all(all.docs.map(async row => (await read<Answer>(row, key)).questionId === id ? row : null))).filter(row => row !== null);
      for (let i = 0; i < matching.length; i += 400) { const batch = writeBatch(requireDb()); matching.slice(i, i + 400).forEach(d => batch.delete(d.ref)); await batch.commit(); }
      await deleteDoc(record(access, 'questions', id));
      forgetRecord(access, 'questions', id);
      matching.forEach(row => forgetRecord(access, 'answers', row.id)); return;
    }
    case 'addAnswer': {
      const ref = record(access, 'answers', crypto.randomUUID()); const questionId = String(body.questionId ?? '');
      const payload = await encryptRecord({ id: ref.id, questionId, label: text(body.label, 'an answer', 300), imageKey: imageValue(body.imageKey), position: Date.now() }, await classKey(access), ref.path);
      await runTransaction(requireDb(), async tx => { if (!(await tx.get(record(access, 'questions', questionId))).exists()) throw new Error('That question no longer exists.'); tx.set(ref, payload); });
      rememberRecord(access, ref, payload); return;
    }
    case 'deleteAnswer': await deleteDoc(record(access, 'answers', id)); forgetRecord(access, 'answers', id); return;
    case 'deleteResponse': {
      const studentId = String(body.studentId);
      await deleteDoc(doc(record(access, 'students', studentId), 'responses', id));
      patchCachedRead<{ docs: Row[] }>(access, 'history:' + studentId + ':rows', rows => ({ docs: rows.docs.filter(row => row.id !== id) }));
      invalidateReads(access, 'completed:' + studentId + ':'); return;
    }
    default: throw new Error('Unknown class action.');
  }
}
function studentRef(access: Access, id: string) {
  if (access.role === 'student' && access.studentId !== id) throw new Error('You can only access your own profile.');
  return record(access, 'students', id);
}
export async function completedToday(access: Access, id: string) {
  studentRef(access, id);
  const day = localDate();
  return cachedRead(access, 'completed:' + id + ':' + day, async () => (await getDoc(doc(studentRef(access, id), 'responses', day))).exists(), Infinity);
}
export async function loadHistory(access: Access, studentId?: string): Promise<HistoryEntry[]> {
  if (studentId) studentRef(access, studentId);
  const students = (await loadClass(access)).students.filter(student => !studentId || student.id === studentId);
  const history = await Promise.all(students.map(async student => {
    const key = await classKey(access, student.id);
    const rows = await cachedRead(access, 'history:' + student.id + ':rows', () => getDocs(collection(studentRef(access, student.id), 'responses')), Infinity);
    return Promise.all(rows.docs.map(async row => ({ ...await read<Pick<HistoryEntry, 'createdAt' | 'items'>>(row, key), id: row.id, studentId: student.id, studentName: student.name })));
  }));
  return history.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function submitResponse(access: Access, student: Student, data: AppData, selections: Record<string, string>) {
  const active = data.questions.filter(q => !q.fridayOnly || new Date().getDay() === 5);
  if (!active.length || active.length > 20) throw new Error('The class must have between 1 and 20 questions per check-in.');
  const items = active.map(q => { const answer = data.answers.find(a => a.id === selections[q.id] && a.questionId === q.id); if (!answer) throw new Error('Answer every question first.'); return { question: personalize(q.prompt, student), answer: answer.label, imageKey: answer.imageKey }; });
  const ref = doc(studentRef(access, student.id), 'responses', localDate());
  const payload = await encryptRecord({ createdAt: new Date().toISOString(), items }, await classKey(access, student.id), ref.path);
  await runTransaction(requireDb(), async tx => { if ((await tx.get(ref)).exists()) throw new Error('You already completed today’s check-in.'); tx.set(ref, payload); });
  patchCachedRead<{ docs: Row[] }>(access, 'history:' + student.id + ':rows', rows => ({ docs: [...rows.docs, { ref, id: ref.id, exists: () => true, data: () => payload }] }));
  invalidateReads(access, 'completed:' + student.id + ':');
  await cachedRead(access, 'completed:' + student.id + ':' + ref.id, async () => true, Infinity);
}
