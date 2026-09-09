import { collection, doc, getDoc, getDocs, orderBy, query, runTransaction, serverTimestamp, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { auth, requireDb } from './firebase';
import { emptyData, localDate, normalizeEmail, personalize, type Access, type AppData, type Student, type Question, type Answer, type HistoryEntry } from './model';

const root = (access: Access) => doc(requireDb(), 'classes', access.ownerId);
const records = (access: Access, name: string) => collection(root(access), name);
const record = (access: Access, name: string, id: string) => doc(records(access, name), id);
function requireTeacher(access: Access) {
  if (access.role !== 'teacher' || access.ownerId !== auth?.currentUser?.uid) throw new Error('Only your teacher can change the class.');
}
function text(value: unknown, label: string, max = 2000) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error(`Enter ${label} (up to ${max} characters).`);
  return value.trim();
}
function imageValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.length > 33000 || (!/^data:image\/jpeg;base64,/.test(value) && !/^preset:(smile|sad|yes|no)$/.test(value))) throw new Error('Choose a smaller picture.');
  return value;
}
const sorted = <T extends {position:number}>(rows:T[]) => rows.sort((a,b)=>a.position-b.position);
export async function loadClass(access: Access): Promise<AppData> {
  if (access.role === 'teacher') {
    await runTransaction(requireDb(), async tx => {
      const ref = root(access); const snap = await tx.get(ref);
      if (!snap.exists()) {
        tx.set(ref, { ...emptyData.settings, ownerId: access.ownerId, createdAt: serverTimestamp() });
        tx.set(record(access,'questions','starter'), {id:'starter',prompt:'How focused did you feel today?',position:1,fridayOnly:false});
        ['Getting Started','On My Way','Locked In'].forEach((label,index) => tx.set(record(access,'answers',`starter-${index}`),{id:`starter-${index}`,questionId:'starter',label,imageKey:null,position:index+1}));
      }
    });
  }
  const [settings, studentRows, questionRows, answerRows] = await Promise.all([
    getDoc(root(access)),
    access.role === 'student' ? getDoc(record(access,'students',access.studentId)).then(s => s.exists() ? [{...s.data(),id:s.id} as Student] : []) : getDocs(records(access,'students')).then(s => s.docs.map(d => ({...d.data(),id:d.id} as Student))),
    getDocs(records(access,'questions')),
    getDocs(records(access,'answers')),
  ]);
  if (!settings.exists()) throw new Error('Your class is no longer available. Contact your teacher.');
  if (access.role === 'student' && !studentRows.length) throw new Error('Your student profile is no longer available. Contact your teacher.');
  return { settings: { title: settings.data()!.title, description: settings.data()!.description }, students: studentRows.sort((a,b)=>a.name.localeCompare(b.name)), questions: sorted(questionRows.docs.map(d=>({...d.data(),id:d.id} as Question))), answers: sorted(answerRows.docs.map(d=>({...d.data(),id:d.id} as Answer))) };
}
async function saveStudent(access: Access, id: string, values: Partial<Student>, creating: boolean) {
  requireTeacher(access);
  const db = requireDb();
  await runTransaction(db, async tx => {
    const ref = record(access,'students',id); const previous = await tx.get(ref);
    if (!creating && !previous.exists()) throw new Error('That student no longer exists.');
    const old = previous.data() as Student | undefined;
    const next = creating ? { id, name: '', email: '', imageKey: null, currentScore: null, goalScore: null, ...values } : {...old,...values,id};
    const email = normalizeEmail(next.email ?? '');
    if (email === normalizeEmail(auth!.currentUser!.email!)) throw new Error('Use the student’s Google email, not your teacher email.');
    const linkRef = email ? doc(db,'studentLinks',email) : null;
    if (linkRef && email !== old?.email) {
      const existing = await tx.get(linkRef);
      if (existing.exists()) throw new Error('That email is already attached to a student. Ask the current teacher to remove its assignment first.');
    }
    if (old?.email && old.email !== email) tx.delete(doc(db,'studentLinks',old.email));
    tx.set(ref, {...next,email});
    if (linkRef) tx.set(linkRef,{ownerId:access.ownerId,studentId:id});
  });
}
export async function changeClass(access: Access, body: Record<string, unknown>) {
  requireTeacher(access);
  const id = String(body.id ?? '');
  const ref = record(access,'students',id || 'unused');
  switch(body.action) {
    case 'saveSettings': return updateDoc(root(access),{title:text(body.title,'a title',160),description:text(body.description,'a description',4000)});
    case 'addStudent': return saveStudent(access,crypto.randomUUID(),{name:text(body.name,'a student name',100),email:normalizeEmail(String(body.email ?? '')),imageKey:imageValue(body.imageKey)},true);
    case 'updateStudentName': return saveStudent(access,id,{name:text(body.name,'a student name',100)},false);
    case 'updateStudentEmail': return saveStudent(access,id,{email:normalizeEmail(String(body.email ?? ''))},false);
    case 'updateStudentImage': return updateDoc(ref,{imageKey:imageValue(body.imageKey)});
    case 'removeStudentImage': return updateDoc(ref,{imageKey:null});
    case 'updateStudentScores': {
      if (![body.currentScore,body.goalScore].every(n=>typeof n==='number' && Number.isFinite(n) && Math.abs(n)<=1e9)) throw new Error('Enter valid scores.');
      return updateDoc(ref,{currentScore:body.currentScore,goalScore:body.goalScore});
    }
    case 'deleteStudent': {
      // Delete nested history before deleting the student and the email assignment.
      const responses = await getDocs(collection(ref,'responses'));
      for (let i=0;i<responses.docs.length;i+=400) { const batch=writeBatch(requireDb()); responses.docs.slice(i,i+400).forEach(d=>batch.delete(d.ref)); await batch.commit(); }
      return runTransaction(requireDb(),async tx=>{const student=await tx.get(ref);if(student.data()?.email)tx.delete(doc(requireDb(),'studentLinks',student.data()!.email));tx.delete(ref);});
    }
    case 'addQuestion': {
      const id=crypto.randomUUID(); return runTransaction(requireDb(),async tx=>{tx.set(record(access,'questions',id),{id,prompt:text(body.prompt,'a question',2000),position:Date.now(),fridayOnly:Boolean(body.fridayOnly)});});
    }
    case 'setQuestionFridayOnly': return updateDoc(record(access,'questions',id),{fridayOnly:Boolean(body.fridayOnly)});
    case 'deleteQuestion': {
      const all=await getDocs(records(access,'answers')); const matching=all.docs.filter(d=>d.data().questionId===id);
      for(let i=0;i<matching.length;i+=400){const batch=writeBatch(requireDb());matching.slice(i,i+400).forEach(d=>batch.delete(d.ref));await batch.commit();}
      return deleteDoc(record(access,'questions',id));
    }
    case 'addAnswer': {
      const id=crypto.randomUUID(); const questionId=String(body.questionId ?? '');
      return runTransaction(requireDb(),async tx=>{const question=await tx.get(record(access,'questions',questionId));if(!question.exists())throw new Error('That question no longer exists.');tx.set(record(access,'answers',id),{id,questionId,label:text(body.label,'an answer',300),imageKey:imageValue(body.imageKey),position:Date.now()});});
    }
    case 'deleteAnswer': return deleteDoc(record(access,'answers',id));
    case 'deleteResponse': return deleteDoc(doc(record(access,'students',String(body.studentId)), 'responses', id));
    default: throw new Error('Unknown class action.');
  }
}
function studentRef(access: Access,id: string) {
  if(access.role==='student' && access.studentId!==id)throw new Error('You can only access your own profile.');
  return record(access,'students',id);
}
export async function completedToday(access: Access,id: string) {
  return (await getDoc(doc(studentRef(access,id),'responses',localDate()))).exists();
}
export async function loadHistory(access: Access, studentId?: string): Promise<HistoryEntry[]> {
  const students = studentId ? [await getDoc(studentRef(access,studentId))] : access.role==='student' ? [await getDoc(studentRef(access,access.studentId))] : (await getDocs(records(access,'students'))).docs;
  const history=await Promise.all(students.map(async student=>{
    if(!student.exists())return [];
    const rows=await getDocs(query(collection(student.ref,'responses'),orderBy('createdAt','desc')));
    return rows.docs.map(row=>{const data=row.data();return {id:row.id,studentId:student.id,studentName:student.data()!.name,createdAt:data.createdAt?.toDate().toISOString() ?? new Date().toISOString(),items:data.items} as HistoryEntry;});
  }));
  return history.flat().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
export async function submitResponse(access: Access, student: Student, data: AppData, selections: Record<string,string>) {
  const active=data.questions.filter(q=>!q.fridayOnly || new Date().getDay()===5);
  if(!active.length || active.length>20)throw new Error('The class must have between 1 and 20 questions per check-in.');
  const items=active.map(q=>{const answer=data.answers.find(a=>a.id===selections[q.id] && a.questionId===q.id);if(!answer)throw new Error('Answer every question first.');return {question:personalize(q.prompt,student),answer:answer.label,imageKey:answer.imageKey};});
  const ref=doc(studentRef(access,student.id),'responses',localDate());
  await runTransaction(requireDb(),async tx=>{if((await tx.get(ref)).exists())throw new Error('You already completed today’s check-in.');tx.set(ref,{createdAt:serverTimestamp(),localDate:ref.id,items});});
}
