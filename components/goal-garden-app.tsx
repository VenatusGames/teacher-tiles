
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, CalendarDays, Check, ChevronRight, CircleCheckBig, CircleX, Database, Footprints, Frown,
  ImagePlus, LoaderCircle, LogOut, Plus, Rows3, Settings, Smile, Sparkles,
  Sprout, Target, Trash2, UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { type Access, type Student, type Question, type Answer, type AppData, type HistoryEntry, type HistoryItem, emptyData } from '@/lib/model';
import { loadClass, changeClass, loadHistory, completedToday, submitResponse } from '@/lib/class-store';
import { logOut, friendlyError } from '@/lib/firebase';

type Screen = 'students' | 'menu' | 'lead' | 'history';
type ImageUploader = (file: File | null) => Promise<string | null>;

const presetChoices = [
  { key: 'preset:smile', label: 'Smiley Face', icon: Smile },
  { key: 'preset:sad', label: 'Sad Face', icon: Frown },
  { key: 'preset:yes', label: 'Yes', icon: CircleCheckBig },
  { key: 'preset:no', label: 'No', icon: CircleX },
] as const;


export function GoalGardenApp({ access, email }: { access: Access; email: string }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>('students');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [advancing, setAdvancing] = useState(false);
  const [isFriday, setIsFriday] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkingToday, setCheckingToday] = useState(false);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [error, setError] = useState('');
  const [adminOpen, setAdminOpen] = useState(false);

  const refresh = useCallback(async () => {
    const next = await loadClass(access);
    setData(next);
    setSelectedStudent((current) => current ? next.students.find((student) => student.id === current.id) ?? null : null);
  }, [access]);

  useEffect(() => {
    refresh().catch(err => setError(friendlyError(err))).finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => { setIsFriday(new Date().getDay() === 5); }, []);

  const activeQuestions = useMemo(
    () => data.questions.filter((question) => !question.fridayOnly || isFriday),
    [data.questions, isFriday],
  );
  const currentQuestion = activeQuestions[currentQuestionIndex] ?? null;
  const currentAnswers = currentQuestion
    ? data.answers.filter((answer) => answer.questionId === currentQuestion.id)
    : [];

  useEffect(() => {
    if (access.role === 'student' && data.students[0]) { setSelectedStudent(data.students[0]); setScreen('menu'); }
  }, [access, data.students]);

  const goHome = () => {
    setScreen(access.role === 'student' ? 'menu' : 'students');
    setSelectedStudent(access.role === 'student' ? data.students[0] ?? null : null);
    setSelectedAnswers({});
    setCurrentQuestionIndex(0);
    setAdvancing(false);
    setAlreadyCheckedIn(false);
    setError('');
  };

  const chooseStudent = (student: Student) => {
    setSelectedStudent(student);
    setScreen('menu');
    setSelectedAnswers({});
    setCurrentQuestionIndex(0);
    setAdvancing(false);
    setAlreadyCheckedIn(false);
    setError('');
  };

  const startLeadMeasures = async () => {
    if (!selectedStudent) return;
    setSelectedAnswers({});
    setCurrentQuestionIndex(0);
    setAdvancing(false);
    setAlreadyCheckedIn(false);
    setCheckingToday(true);
    setError('');
    setScreen('lead');
    try {
      setAlreadyCheckedIn(await completedToday(access, selectedStudent.id));
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Could not check today’s status.');
    } finally {
      setCheckingToday(false);
    }
  };

  const openHistory = async () => {
    if (!selectedStudent) return;
    setScreen('history');
    setHistoryLoading(true);
    setError('');
    try {
      setHistory(await loadHistory(access, selectedStudent.id));
    } catch {
      setError('History could not load right now.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const submitCheckIn = async (answers = selectedAnswers) => {
    if (!selectedStudent || activeQuestions.some((question) => !answers[question.id])) return;
    setSaving(true);
    setError('');
    try { await submitResponse(access, selectedStudent, data, answers); }
    catch (err) { setError(friendlyError(err)); return; }
    finally { setSaving(false); }
    setCelebrating(true);
    window.setTimeout(() => {
      setCelebrating(false);
      setScreen('menu');
      setSelectedAnswers({});
      setCurrentQuestionIndex(0);
    }, 1200);
  };

  const chooseAnswer = (question: Question, answerId: string) => {
    if (advancing || saving) return;
    const nextAnswers = { ...selectedAnswers, [question.id]: answerId };
    setSelectedAnswers(nextAnswers);
    setAdvancing(true);
    window.setTimeout(() => {
      if (currentQuestionIndex < activeQuestions.length - 1) {
        setCurrentQuestionIndex((index) => index + 1);
        setAdvancing(false);
      } else {
        void submitCheckIn(nextAnswers).finally(() => setAdvancing(false));
      }
    }, 420);
  };

  const questionColumns = useMemo(
    () => Array.from(new Set(history.flatMap((entry) => entry.items.map((item) => item.question)))),
    [history],
  );

  if (loading) return <LoadingScreen />;

  return (
    <main className="app-shell min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="site-header">
        <button className="brand-button" onClick={goHome} aria-label="Return to student profiles">
          <span className="brand-mark"><Sparkles /></span><span>WIGs</span>
        </button>
        <div className="account-controls"><span className="account-email">{email}</span>{access.role === 'teacher' && <button className="admin-launch" onClick={() => setAdminOpen(true)} aria-label="Open admin panel"><Settings /></button>}<button className="admin-launch" onClick={() => void logOut().catch(err => setError(friendlyError(err)))} aria-label="Sign out"><LogOut /></button></div>
      </header>

      {screen !== 'students' && !(access.role === 'student' && screen === 'menu') && (
        <button className="back-button" onClick={() => setScreen(screen === 'menu' && access.role === 'teacher' ? 'students' : 'menu')}>
          <ArrowLeft /> <span>Back</span>
        </button>
      )}

      {error && <div className="error-banner" role="alert">{error}</div>}

      {screen === 'students' && access.role === 'teacher' && (
        <section className="page-section student-page page-enter">
          <p className="eyebrow">Choose your profile</p>
          <h1>Who is growing a goal today?</h1>
          <p className="intro">Tap your sticker to check in and keep your progress moving.</p>
          {data.students.length ? (
            <div className="student-grid">
              {data.students.map((student, index) => (
                <button key={student.id} className="student-sticker" onClick={() => chooseStudent(student)} style={{ animationDelay: `${index * 70}ms` }}>
                  <ProfileImage student={student} />
                  <span className="student-name">{student.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-card"><UserRound /><h2>No students yet</h2><p>Open the admin panel to add the first student profile.</p></div>
          )}
        </section>
      )}

      {screen === 'menu' && selectedStudent && (
        <section className="page-section menu-page page-enter">
          <div className="mini-profile"><ProfileImage student={selectedStudent} /><div><p className="eyebrow">Welcome back</p><h1>{selectedStudent.name}</h1></div></div>
          <div className="choice-grid">
            <button className="path-card lead-card" onClick={startLeadMeasures}>
              <LeadBars /><span><strong>Lead Measures</strong><small>Make today&apos;s check-in</small></span><ChevronRight />
            </button>
            <button className="path-card history-card" onClick={openHistory}>
              <Rows3 /><span><strong>View All</strong><small>See your full history</small></span><ChevronRight />
            </button>
          </div>
        </section>
      )}

      {screen === 'lead' && selectedStudent && (
        <section className="page-section lead-page page-enter">
          <div className="lead-heading"><LeadBars /><div><p className="eyebrow">{selectedStudent.name}&apos;s check-in</p><h1>{data.settings.title}</h1><p>{personalize(data.settings.description, selectedStudent)}</p></div></div>
          {checkingToday ? (
            <div className="loading-inline"><LoaderCircle className="spin" /> Checking today&apos;s progress…</div>
          ) : alreadyCheckedIn ? (
            <div className="empty-card already-checked-card"><Check /><h2>You&apos;re checked in for today!</h2><p>Come back tomorrow to keep growing your WIG.</p><button type="button" className="empty-card-action" onClick={openHistory}><Rows3 /> View my history</button></div>
          ) : currentQuestion ? (
            <div className="question-flow">
              <div className="question-progress" aria-label={`Question ${currentQuestionIndex + 1} of ${activeQuestions.length}`}>
                <span>{currentQuestionIndex + 1} of {activeQuestions.length}</span>
                <div><i style={{ width: `${((currentQuestionIndex + 1) / activeQuestions.length) * 100}%` }} /></div>
              </div>
              <article className={`question-stage ${advancing ? 'is-advancing' : ''}`} key={currentQuestion.id}>
                {currentQuestion.fridayOnly && <span className="friday-question"><CalendarDays /> Friday reflection</span>}
                <h2 className="floating-question">{personalize(currentQuestion.prompt, selectedStudent)}</h2>
                {currentAnswers.length ? (
                  <div className="round-answer-grid">
                    {currentAnswers.map((answer, answerIndex) => {
                      const active = selectedAnswers[currentQuestion.id] === answer.id;
                      return (
                        <button
                          className={`round-answer-choice ${active ? 'selected' : ''}`}
                          key={answer.id}
                          onClick={() => chooseAnswer(currentQuestion, answer.id)}
                          aria-label={answer.label}
                          aria-pressed={active}
                          disabled={advancing || saving}
                        >
                          <AnswerVisual answer={answer} index={answerIndex} />
                          {!isFacePreset(answer.imageKey) && <span>{answer.label}</span>}
                          {active && <b className="answer-check"><Check /></b>}
                        </button>
                      );
                    })}
                  </div>
                ) : <p className="soft-note floating-note">This question needs answer choices from the admin panel.</p>}
              </article>
              {saving && <div className="saving-checkin"><LoaderCircle className="spin" /> Saving your WIG…</div>}
            </div>
          ) : data.questions.length ? (
            <div className="empty-card"><CalendarDays /><h2>You&apos;re all caught up</h2><p>There are no questions scheduled for today. Friday reflections will appear at the end of the week.</p></div>
          ) : <div className="empty-card"><LeadBars /><h2>No lead measures yet</h2><p>An admin can add the first question and image choices.</p></div>}
        </section>
      )}

      {screen === 'history' && selectedStudent && (
        <section className="page-section history-page page-enter">
          <div className="history-heading"><Database /><div><p className="eyebrow">Every check-in, together</p><h1>{selectedStudent.name}&apos;s history</h1></div></div>
          {historyLoading ? <div className="loading-inline"><LoaderCircle className="spin" /> Loading history…</div> : history.length ? (
            <HistoryTable history={history} columns={questionColumns} showStudent={false} />
          ) : <div className="empty-card"><Rows3 /><h2>No check-ins yet</h2><p>Your saved lead measures will appear here as one big data set.</p></div>}
        </section>
      )}

      {celebrating && <div className="celebration" role="status"><span><Check /></span><strong>WIG saved!</strong><small>Nice work, {selectedStudent?.name}.</small></div>}

      <div className="teacher-tiles-credit" aria-label="Powered by TeacherTiles">
        <img src="/wigs/teacher-tiles.png" alt="" />
        <span>Powered by <strong>TeacherTiles</strong></span>
      </div>

      <Dialog open={adminOpen} onOpenChange={setAdminOpen}>
        <DialogContent className="admin-dialog" showCloseButton>
          <DialogTitle className="sr-only">WIGs admin panel</DialogTitle>
          {access.role === 'teacher' && <AdminPanel data={data} refresh={refresh} access={access} />}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function LoadingScreen() {
  return <main className="loading-screen"><div className="brand-mark"><Sparkles /></div><h1>WIGs</h1><LoaderCircle className="spin" /><p>Growing your dashboard…</p></main>;
}

function ProfileImage({ student }: { student: Student }) {
  return <span className="student-photo">{student.imageKey ? <img src={fileUrl(student.imageKey)} alt="" /> : <span className={`initial-avatar avatar-${Array.from(student.id).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4}`}>{student.name.slice(0, 1).toUpperCase()}</span>}</span>;
}

function AnswerVisual({ answer, index }: { answer: Answer; index: number }) {
  const preset = presetChoices.find((choice) => choice.key === answer.imageKey);
  const Icon = preset?.icon ?? [Sprout, Footprints, Target][index % 3];
  return <span className={`answer-visual answer-${index % 3} ${preset ? 'preset-visual' : ''}`}>{answer.imageKey?.startsWith('images/') ? <img src={fileUrl(answer.imageKey)} alt="" /> : <Icon />}</span>;
}

function LeadBars() {
  return <span className="lead-bars" aria-label="Three increasing bars"><i /><i /><i /></span>;
}

function HistoryAnswer({ item }: { item: HistoryItem | undefined }) {
  if (!item) return <span className="history-empty">—</span>;
  const preset = presetChoices.find((choice) => choice.key === item.imageKey);
  if (preset) {
    const Icon = preset.icon;
    return <span className="history-answer" aria-label={item.answer} title={item.answer}><span className="history-answer-visual preset"><Icon /></span></span>;
  }
  if (item.imageKey?.startsWith('images/')) {
    return <span className="history-answer" aria-label={item.answer} title={item.answer}><span className="history-answer-visual"><img src={fileUrl(item.imageKey)} alt={item.answer} /></span></span>;
  }
  return <span className="answer-text-pill">{item.answer}</span>;
}

function HistoryTable({ history, columns, showStudent, onDelete }: { history: HistoryEntry[]; columns: string[]; showStudent: boolean; onDelete?: (entry: HistoryEntry) => void }) {
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead><tr>{showStudent && <th>Student</th>}<th>Date</th>{columns.map((column) => <th key={column}>{column}</th>)}{onDelete && <th>Delete</th>}</tr></thead>
        <tbody>{history.map((entry) => <tr key={`${entry.studentId}:${entry.id}`}>{showStudent && <td><strong>{entry.studentName}</strong></td>}<td>{formatDate(entry.createdAt)}</td>{columns.map((column) => <td key={column}><HistoryAnswer item={entry.items.find((item) => item.question === column)} /></td>)}{onDelete && <td><button type="button" className="history-delete" onClick={() => onDelete(entry)} aria-label={`Delete ${entry.studentName}'s check-in from ${formatDate(entry.createdAt)}`}><Trash2 /></button></td>}</tr>)}</tbody>
      </table>
    </div>
  );
}

function AdminPanel({ data, refresh, access }: { data: AppData; refresh: () => Promise<void>; access: Access }) {
  const [tab, setTab] = useState<'students' | 'measures' | 'history'>('students');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [adminHistory, setAdminHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    let active = true;
    if (tab === 'history') loadHistory(access).then(history => { if (active) setAdminHistory(history); }).catch(err => { if (active) setMessage(friendlyError(err)); });
    return () => { active = false; };
  }, [tab, data, access]);

  const action = async (body: Record<string, unknown>, success = 'Saved!') => {
    setBusy(true); setMessage('');
    try { await changeClass(access, body); await refresh(); setMessage(success); return true; }
    catch (err) { setMessage(friendlyError(err)); return false; }
    finally { setBusy(false); }
  };

  const upload: ImageUploader = async (file) => {
    if (!file) return null;
    setBusy(true);
    setMessage('Preparing image…');
    try {
      const preparedFile = await prepareImageForUpload(file);
      return await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read this picture.')); reader.readAsDataURL(preparedFile); });
    } finally {
      setBusy(false);
      setMessage('');
    }
  };

  const columns = Array.from(new Set(adminHistory.flatMap((entry) => entry.items.map((item) => item.question))));
  const deleteCheckIn = async (entry: HistoryEntry) => {
    if (!window.confirm(`Delete ${entry.studentName}'s check-in from ${formatDate(entry.createdAt)}? This cannot be undone.`)) return;
    if (await action({ action: 'deleteResponse', id: entry.id, studentId: entry.studentId }, 'Check-in deleted.')) {
      setAdminHistory((current) => current.filter((item) => item.id !== entry.id));
    }
  };
  return (
    <div className="admin-panel">
      <div className="admin-topbar"><div><p className="eyebrow">WIGs</p><h2>Admin panel</h2></div></div>
      <nav className="admin-tabs" aria-label="Admin sections">
        <button className={tab === 'students' ? 'active' : ''} onClick={() => setTab('students')}><UserRound /> Students</button>
        <button className={tab === 'measures' ? 'active' : ''} onClick={() => setTab('measures')}><LeadBars /> Lead Measures</button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}><Database /> History</button>
      </nav>
      {message && <p className="form-message">{message}</p>}
      <div className="admin-scroll">
        {tab === 'students' && <StudentsAdmin students={data.students} busy={busy} upload={upload} action={action} />}
        {tab === 'measures' && <MeasuresAdmin data={data} busy={busy} upload={upload} action={action} />}
        {tab === 'history' && <section className="admin-section"><div className="section-title"><div><p className="eyebrow">All responses</p><h3>Combined history</h3></div><span className="count-pill">{adminHistory.length} check-ins</span></div>{adminHistory.length ? <HistoryTable history={adminHistory} columns={columns} showStudent onDelete={deleteCheckIn} /> : <div className="admin-empty">Student answers will collect here.</div>}</section>}
      </div>
    </div>
  );
}

function StudentsAdmin({ students, busy, upload, action }: { students: Student[]; busy: boolean; upload: ImageUploader; action: (body: Record<string, unknown>, success?: string) => Promise<boolean> }) {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [file, setFile] = useState<File | null>(null); const [key, setKey] = useState(0);
  const add = async (event: FormEvent) => { event.preventDefault(); try { const imageKey = await upload(file); if (await action({ action: 'addStudent', name, email, imageKey }, `${name} was added.`)) { setName(''); setEmail(''); setFile(null); setKey((value) => value + 1); } } catch (error) { window.alert(error instanceof Error ? error.message : 'Upload failed.'); } };
  return <section className="admin-section"><div className="section-title"><div><p className="eyebrow">Profiles</p><h3>Add a student</h3></div><span className="count-pill">{students.length} students</span></div><form className="admin-form-row" onSubmit={add}><Input className="admin-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Student name" required maxLength={100} /><Input className="admin-input" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Student Google email (optional)" maxLength={254} /><FilePicker key={key} label={file?.name ?? 'Choose picture'} onFile={setFile} /><Button className="admin-primary" type="submit" disabled={busy || !name.trim()}><Plus /> Add student</Button></form><div className="admin-student-list">{students.map((student) => <StudentAdminCard key={student.id} student={student} busy={busy} upload={upload} action={action} />)}</div></section>;
}

function StudentAdminCard({ student, busy, upload, action }: { student: Student; busy: boolean; upload: ImageUploader; action: (body: Record<string, unknown>, success?: string) => Promise<boolean> }) {
  const [uploading, setUploading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(student.name);
  const [emailDraft, setEmailDraft] = useState(student.email);
  useEffect(() => { setEmailDraft(student.email); }, [student.email]);
  const [currentScore, setCurrentScore] = useState(student.currentScore === null ? '' : String(student.currentScore));
  const [goalScore, setGoalScore] = useState(student.goalScore === null ? '' : String(student.goalScore));
  useEffect(() => { if (!editingName) setNameDraft(student.name); }, [student.name, editingName]);
  useEffect(() => {
    setCurrentScore(student.currentScore === null ? '' : String(student.currentScore));
    setGoalScore(student.goalScore === null ? '' : String(student.goalScore));
  }, [student.currentScore, student.goalScore]);
  const replaceImage = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const imageKey = await upload(file);
      if (imageKey) await action({ action: 'updateStudentImage', id: student.id, imageKey }, `${student.name}'s picture was updated.`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Image update failed.');
    } finally {
      setUploading(false);
    }
  };
  const saveName = async () => {
    const nextName = nameDraft.trim();
    if (!nextName || nextName === student.name) {
      setNameDraft(student.name);
      setEditingName(false);
      return;
    }
    if (await action({ action: 'updateStudentName', id: student.id, name: nextName }, `${student.name} was renamed to ${nextName}.`)) {
      setEditingName(false);
    }
  };
  const saveScores = () => action({ action: 'updateStudentScores', id: student.id, currentScore: Number(currentScore), goalScore: Number(goalScore) }, `${student.name}'s scores were saved.`);
  return (
    <div className="admin-student">
      <ProfileImage student={student} />
      {editingName ? (
        <Input
          className="admin-input student-name-input"
          value={nameDraft}
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setNameDraft(event.target.value)}
          onBlur={() => void saveName()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') { event.preventDefault(); setNameDraft(student.name); setEditingName(false); }
          }}
          aria-label={`Edit ${student.name}'s name`}
        />
      ) : (
        <strong
          className="admin-student-name"
          tabIndex={0}
          title="Double-click to edit name"
          aria-label={`${student.name}. Double-click or press Enter to edit.`}
          onDoubleClick={() => setEditingName(true)}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === 'F2') setEditingName(true); }}
        >{student.name}</strong>
      )}
      <Button variant="destructive" size="icon" aria-label={`Delete ${student.name}`} onClick={() => action({ action: 'deleteStudent', id: student.id }, `${student.name} was removed.`)}><Trash2 /></Button>
      <div className="student-photo-actions"><FilePicker label={uploading ? 'Updating…' : 'Change picture'} onFile={replaceImage} />{student.imageKey && <button type="button" onClick={() => action({ action: 'removeStudentImage', id: student.id }, `${student.name}'s picture was removed.`)}>Remove</button>}</div>
      <form className="student-email-editor" onSubmit={event => { event.preventDefault(); void action({ action: 'updateStudentEmail', id: student.id, email: emailDraft }, 'Student login updated.'); }}><label>Student Google email<Input className="admin-input" type="email" value={emailDraft} onChange={event => setEmailDraft(event.target.value)} placeholder="No student login assigned" maxLength={254} /></label><Button type="submit" className="admin-secondary" disabled={busy || emailDraft === student.email}>Save login</Button></form><div className="student-score-editor">
        <label>Current Score<Input className="admin-input" type="number" step="any" value={currentScore} onChange={(event) => setCurrentScore(event.target.value)} placeholder="0" /></label>
        <label>Goal Score<Input className="admin-input" type="number" step="any" value={goalScore} onChange={(event) => setGoalScore(event.target.value)} placeholder="0" /></label>
        <Button type="button" className="admin-secondary" disabled={busy || currentScore === '' || goalScore === ''} onClick={saveScores}><Check /> Save scores</Button>
      </div>
    </div>
  );
}

function MeasuresAdmin({ data, busy, upload, action }: { data: AppData; busy: boolean; upload: ImageUploader; action: (body: Record<string, unknown>, success?: string) => Promise<boolean> }) {
  const [title, setTitle] = useState(data.settings.title);
  const [description, setDescription] = useState(data.settings.description);
  const [prompt, setPrompt] = useState('');
  const [fridayOnly, setFridayOnly] = useState(false);
  useEffect(() => { setTitle(data.settings.title); setDescription(data.settings.description); }, [data.settings]);
  const addQuestion = async (event: FormEvent) => {
    event.preventDefault();
    if (data.questions.length >= 20) return;
    if (await action({ action: 'addQuestion', prompt, fridayOnly }, 'Question added.')) {
      setPrompt('');
      setFridayOnly(false);
    }
  };

  return (
    <div className="admin-measures">
      <section className="admin-section">
        <div className="section-title"><div><p className="eyebrow">Student intro</p><h3>Lead measure heading</h3></div></div>
        <div className="settings-form">
          <label>Title<Input className="admin-input" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>Description<Textarea className="admin-textarea" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <p className="template-help">Use <code>(name)</code>, <code>(score-a)</code>, and <code>(score-b)</code> to personalize descriptions and questions for each student. Line breaks are preserved.</p>
          <Button className="admin-primary" disabled={busy} onClick={() => action({ action: 'saveSettings', title, description }, 'Heading updated.')}><Check /> Save heading</Button>
        </div>
      </section>
      <section className="admin-section">
        <div className="section-title"><div><p className="eyebrow">Question builder</p><h3>Questions & image choices</h3></div><span className="count-pill">{data.questions.length} questions</span></div>
        <form className="admin-form-row question-add-form" onSubmit={addQuestion}>
          <Input className="admin-input" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Type a new question" maxLength={2000} required />
          <label className="friday-option">
            <Checkbox checked={fridayOnly} onCheckedChange={(checked) => setFridayOnly(checked)} />
            <span><strong>Fridays only</strong><small>Ask at the end of the week</small></span>
          </label>
          <Button type="submit" className="admin-primary" disabled={busy || !prompt.trim() || data.questions.length >= 20}><Plus /> Add question</Button>
        </form>
        <div className="question-builder-list">
          {data.questions.map((question, index) => <QuestionBuilder key={question.id} question={question} index={index} answers={data.answers.filter((answer) => answer.questionId === question.id)} busy={busy} upload={upload} action={action} />)}
        </div>
      </section>
    </div>
  );
}

function QuestionBuilder({ question, index, answers, busy, upload, action }: { question: Question; index: number; answers: Answer[]; busy: boolean; upload: ImageUploader; action: (body: Record<string, unknown>, success?: string) => Promise<boolean> }) {
  const [label, setLabel] = useState(''); const [file, setFile] = useState<File | null>(null); const [key, setKey] = useState(0); const [presetKey, setPresetKey] = useState('');
  const addAnswer = async (event: FormEvent) => { event.preventDefault(); try { const uploadedKey = await upload(file); const imageKey = uploadedKey || presetKey || null; if (await action({ action: 'addAnswer', questionId: question.id, label, imageKey }, 'Answer choice added.')) { setLabel(''); setFile(null); setPresetKey(''); setKey((value) => value + 1); } } catch (error) { window.alert(error instanceof Error ? error.message : 'Upload failed.'); } };
  const choosePreset = (choice: typeof presetChoices[number]) => { setPresetKey(choice.key); setFile(null); setLabel(choice.label); setKey((value) => value + 1); };
  return (
    <article className="question-builder">
      <div className="question-builder-head">
        <span>{index + 1}</span>
        <div className="question-builder-title">
          <strong>{question.prompt}</strong>
          <label className="question-schedule-toggle">
            <Checkbox
              checked={Boolean(question.fridayOnly)}
              disabled={busy}
              onCheckedChange={(checked) => void action({ action: 'setQuestionFridayOnly', id: question.id, fridayOnly: checked }, checked ? 'Question set to Fridays only.' : 'Question set to every day.')}
            />
            <span><CalendarDays /> Fridays only</span>
          </label>
        </div>
        <Button variant="destructive" size="icon" aria-label="Delete question" onClick={() => action({ action: 'deleteQuestion', id: question.id }, 'Question removed.')}><Trash2 /></Button>
      </div>
      <div className="answer-admin-list">{answers.map((answer, answerIndex) => <div className="answer-admin-item" key={answer.id}><AnswerVisual answer={answer} index={answerIndex} /><strong>{answer.label}</strong><Button variant="destructive" size="icon" aria-label={`Delete ${answer.label}`} onClick={() => action({ action: 'deleteAnswer', id: answer.id }, 'Answer removed.')}><Trash2 /></Button></div>)}</div>
      <div className="preset-picker"><span>Prebuilt images</span><div>{presetChoices.map((choice) => { const Icon = choice.icon; return <button type="button" className={presetKey === choice.key ? 'active' : ''} key={choice.key} onClick={() => choosePreset(choice)} aria-pressed={presetKey === choice.key}><Icon /><small>{choice.label}</small></button>; })}</div></div>
      <form className="answer-add-row" onSubmit={addAnswer}><Input className="admin-input" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Answer label" /><FilePicker key={key} label={file?.name ?? (presetKey ? 'Use selected image' : 'Or upload an image')} onFile={(nextFile) => { setFile(nextFile); if (nextFile) setPresetKey(''); }} /><Button type="submit" className="admin-secondary" disabled={busy || !label.trim()}><Plus /> Add choice</Button></form>
    </article>
  );
}

function FilePicker({ label, onFile }: { label: string; onFile: (file: File | null) => void }) {
  return <label className="file-picker"><ImagePlus /><span>{label}</span><input type="file" accept="image/*" onChange={(event) => onFile(event.target.files?.[0] ?? null)} /></label>;
}

async function prepareImageForUpload(file: File) {
  const maxBytes = 24 * 1024;
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');


  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('That image format could not be resized. Try a JPG or PNG.');
  }

  try {
    let smallest: Blob | null = null;
    for (const maxEdge of [384, 256, 192, 128]) {
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('This browser could not prepare the image.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.82, 0.7, 0.58]) {
        const blob = await canvasToBlob(canvas, quality);
        smallest = blob;
        if (blob.size <= maxBytes) {
          return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'image'}.jpg`, { type: 'image/jpeg' });
        }
      }
    }
    if (smallest && smallest.size <= maxBytes) return new File([smallest], 'image.jpg', { type: 'image/jpeg' });
    throw new Error('The image could not be prepared.');
  } finally {
    bitmap.close();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('The image could not be prepared.')), 'image/jpeg', quality);
  });
}

function personalize(text: string, student: Student) {
  return text
    .replace(/\(name\)/gi, student.name)
    .replace(/\(score-a\)/gi, formatScore(student.currentScore))
    .replace(/\(score-b\)/gi, formatScore(student.goalScore));
}

function formatScore(value: number | null) { return value === null ? '—' : String(value); }
function fileUrl(key: string) { return key; }
function isFacePreset(key: string | null) { return key === 'preset:smile' || key === 'preset:sad'; }
function formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)); }
