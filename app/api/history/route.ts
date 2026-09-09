import { requireLocalDevelopment } from '@/lib/development-access';
import { ensureDatabase, getDatabase } from '@/db/runtime';

type HistoryRow = {
  responseId: number;
  studentId: number;
  studentName: string;
  createdAt: string;
  questionPrompt: string;
  answerLabel: string;
  answerImageKey: string | null;
};

export async function GET(request: Request) {
  const blocked = requireLocalDevelopment();
  if (blocked) return blocked;
  await ensureDatabase();
  const db = getDatabase();
  const value = new URL(request.url).searchParams.get('studentId');
  const studentId = value ? Number(value) : null;
  const query = studentId
    ? db.prepare(`SELECT r.id AS responseId, r.student_id AS studentId, s.name AS studentName,
        r.created_at AS createdAt, i.question_prompt AS questionPrompt, i.answer_label AS answerLabel,
        COALESCE(i.answer_image_key, a.image_key) AS answerImageKey
        FROM responses r JOIN students s ON s.id = r.student_id
        JOIN response_items i ON i.response_id = r.id
        LEFT JOIN answers a ON a.id = i.answer_id
        WHERE r.student_id = ? ORDER BY r.created_at DESC, i.id`).bind(studentId)
    : db.prepare(`SELECT r.id AS responseId, r.student_id AS studentId, s.name AS studentName,
        r.created_at AS createdAt, i.question_prompt AS questionPrompt, i.answer_label AS answerLabel,
        COALESCE(i.answer_image_key, a.image_key) AS answerImageKey
        FROM responses r JOIN students s ON s.id = r.student_id
        JOIN response_items i ON i.response_id = r.id
        LEFT JOIN answers a ON a.id = i.answer_id
        ORDER BY r.created_at DESC, i.id`);
  const rows = await query.all<HistoryRow>();

  const grouped = new Map<number, { id: number; studentId: number; studentName: string; createdAt: string; items: Array<{ question: string; answer: string; imageKey: string | null }> }>();
  for (const row of rows.results) {
    const entry = grouped.get(row.responseId) ?? {
      id: row.responseId,
      studentId: row.studentId,
      studentName: row.studentName,
      createdAt: row.createdAt,
      items: [],
    };
    entry.items.push({ question: row.questionPrompt, answer: row.answerLabel, imageKey: row.answerImageKey });
    grouped.set(row.responseId, entry);
  }
  return Response.json({ history: [...grouped.values()] });
}
