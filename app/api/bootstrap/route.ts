import { requireLocalDevelopment } from '@/lib/development-access';
import { ensureDatabase, getDatabase } from '@/db/runtime';

export async function GET(request: Request) {
  const blocked = requireLocalDevelopment();
  if (blocked) return blocked;
  await ensureDatabase();
  const db = getDatabase();
  const [settings, students, questions, answers] = await Promise.all([
    db.prepare('SELECT title, description FROM app_settings WHERE id = 1').first(),
    db.prepare('SELECT id, name, image_key AS imageKey, current_score AS currentScore, goal_score AS goalScore FROM students ORDER BY created_at, id').all(),
    db.prepare('SELECT id, prompt, position, friday_only AS fridayOnly FROM questions ORDER BY position, id').all(),
    db.prepare('SELECT id, question_id AS questionId, label, image_key AS imageKey, position FROM answers ORDER BY position, id').all(),
  ]);

  return Response.json({
    settings,
    students: students.results,
    questions: questions.results,
    answers: answers.results,
  });
}
