import { requireLocalDevelopment } from '@/lib/development-access';
import { ensureDatabase, getDatabase } from '@/db/runtime';

type Submission = {
  studentId?: number;
  answers?: Array<{ questionId: number; answerId: number }>;
  timezoneOffset?: number;
};

type StudentRow = { id: number; name: string; currentScore: number | null; goalScore: number | null };

export async function GET(request: Request) {
  const blocked = requireLocalDevelopment();
  if (blocked) return blocked;
  await ensureDatabase();
  const db = getDatabase();
  const params = new URL(request.url).searchParams;
  const studentId = Number(params.get('studentId'));
  const timezoneOffset = Number(params.get('timezoneOffset'));
  if (!studentId) return bad('Choose a student first.');
  const response = await db.prepare('SELECT id FROM responses WHERE student_id = ? AND local_date = ? LIMIT 1')
    .bind(studentId, localDateForOffset(timezoneOffset)).first<{ id: number }>();
  return Response.json({ completed: Boolean(response), responseId: response?.id ?? null });
}

export async function POST(request: Request) {
  const blocked = requireLocalDevelopment();
  if (blocked) return blocked;
  await ensureDatabase();
  const db = getDatabase();
  const body = await request.json<Submission>();
  if (!body.studentId || !Array.isArray(body.answers)) return bad('This check-in is incomplete.');

  const student = await db.prepare('SELECT id, name, current_score AS currentScore, goal_score AS goalScore FROM students WHERE id = ?')
    .bind(body.studentId).first<StudentRow>();
  if (!student) return bad('Choose a student first.');
  const localDate = localDateForOffset(body.timezoneOffset);
  const existing = await db.prepare('SELECT id FROM responses WHERE student_id = ? AND local_date = ? LIMIT 1')
    .bind(body.studentId, localDate).first<{ id: number }>();
  if (existing) return Response.json({ error: 'You already completed today\'s check-in.' }, { status: 409 });

  const allQuestions = await db.prepare('SELECT id, prompt, friday_only AS fridayOnly FROM questions ORDER BY position, id')
    .all<{ id: number; prompt: string; fridayOnly: number }>();
  const currentQuestions = allQuestions.results.filter((question) => !question.fridayOnly || isFridayForOffset(body.timezoneOffset));
  if (!currentQuestions.length || body.answers.length !== currentQuestions.length) {
    return bad('Answer every question before saving.');
  }

  const items: Array<{ questionId: number; answerId: number; prompt: string; label: string; imageKey: string | null }> = [];
  for (const question of currentQuestions) {
    const selected = body.answers.find((item) => item.questionId === question.id);
    if (!selected) return bad('Answer every question before saving.');
    const answer = await db.prepare('SELECT id, label, image_key AS imageKey FROM answers WHERE id = ? AND question_id = ?')
      .bind(selected.answerId, question.id).first<{ id: number; label: string; imageKey: string | null }>();
    if (!answer) return bad('One of those choices is no longer available.');
    items.push({ questionId: question.id, answerId: answer.id, prompt: personalize(question.prompt, student), label: answer.label, imageKey: answer.imageKey });
  }

  const saved = await db.prepare('INSERT INTO responses (student_id, created_at, local_date) VALUES (?, ?, ?)')
    .bind(body.studentId, new Date().toISOString(), localDate).run();
  const responseId = Number(saved.meta.last_row_id);
  await db.batch(items.map((item) => db.prepare(
    'INSERT INTO response_items (response_id, question_id, answer_id, question_prompt, answer_label, answer_image_key) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(responseId, item.questionId, item.answerId, item.prompt, item.label, item.imageKey)));

  return Response.json({ ok: true, responseId });
}

function bad(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

function isFridayForOffset(value: number | undefined) {
  const offset = normalizeOffset(value);
  return new Date(Date.now() - offset * 60_000).getUTCDay() === 5;
}

function localDateForOffset(value: number | undefined) {
  const offset = normalizeOffset(value);
  return new Date(Date.now() - offset * 60_000).toISOString().slice(0, 10);
}

function normalizeOffset(value: number | undefined) {
  return Number.isFinite(value) ? Math.max(-840, Math.min(840, Number(value))) : 0;
}

function personalize(text: string, student: StudentRow) {
  return text
    .replace(/\(name\)/gi, student.name)
    .replace(/\(score-a\)/gi, formatScore(student.currentScore))
    .replace(/\(score-b\)/gi, formatScore(student.goalScore));
}

function formatScore(value: number | null) {
  return value === null ? '—' : String(value);
}
