import { ensureDatabase, getDatabase, getFiles } from '@/db/runtime';
import { requireLocalDevelopment } from '@/lib/development-access';

type ActionBody = {
  action?: string;
  id?: number;
  questionId?: number;
  title?: string;
  description?: string;
  name?: string;
  prompt?: string;
  label?: string;
  imageKey?: string | null;
  fridayOnly?: boolean;
  currentScore?: number;
  goalScore?: number;
};

export async function POST(request: Request) {
  const blocked = requireLocalDevelopment();
  if (blocked) return blocked;
  await ensureDatabase();
  const db = getDatabase();
  const body = await request.json<ActionBody>();

  try {
    switch (body.action) {
      case 'saveSettings':
        if (!body.title?.trim() || !body.description?.trim()) return bad('Add a title and description.');
        await db.prepare('UPDATE app_settings SET title = ?, description = ? WHERE id = 1')
          .bind(body.title.trim(), body.description.trim()).run();
        break;

      case 'addStudent':
        if (!body.name?.trim()) return bad('Add the student name.');
        await db.prepare('INSERT INTO students (name, image_key, created_at) VALUES (?, ?, ?)')
          .bind(body.name.trim(), body.imageKey ?? null, new Date().toISOString()).run();
        break;

      case 'updateStudentName':
        if (!body.id || !body.name?.trim()) return bad('Add the student name.');
        await db.prepare('UPDATE students SET name = ? WHERE id = ?')
          .bind(body.name.trim(), body.id).run();
        break;

      case 'deleteStudent': {
        const row = await db.prepare('SELECT image_key AS imageKey FROM students WHERE id = ?')
          .bind(body.id).first<{ imageKey: string | null }>();
        await db.prepare('DELETE FROM students WHERE id = ?').bind(body.id).run();
        if (isStoredImage(row?.imageKey)) await getFiles().delete(row.imageKey);
        break;
      }

      case 'updateStudentImage': {
        if (!body.id || !isStoredImage(body.imageKey)) return bad('Choose a new student picture.');
        const row = await db.prepare('SELECT image_key AS imageKey FROM students WHERE id = ?')
          .bind(body.id).first<{ imageKey: string | null }>();
        if (!row) return bad('That student could not be found.');
        await db.prepare('UPDATE students SET image_key = ? WHERE id = ?').bind(body.imageKey, body.id).run();
        if (isStoredImage(row.imageKey) && row.imageKey !== body.imageKey) await getFiles().delete(row.imageKey);
        break;
      }

      case 'removeStudentImage': {
        const row = await db.prepare('SELECT image_key AS imageKey FROM students WHERE id = ?')
          .bind(body.id).first<{ imageKey: string | null }>();
        if (!row) return bad('That student could not be found.');
        await db.prepare('UPDATE students SET image_key = NULL WHERE id = ?').bind(body.id).run();
        if (isStoredImage(row.imageKey)) await getFiles().delete(row.imageKey);
        break;
      }

      case 'updateStudentScores': {
        if (!body.id || !Number.isFinite(body.currentScore) || !Number.isFinite(body.goalScore)) {
          return bad('Add both the current score and goal score.');
        }
        await db.prepare('UPDATE students SET current_score = ?, goal_score = ? WHERE id = ?')
          .bind(body.currentScore, body.goalScore, body.id).run();
        break;
      }

      case 'addQuestion': {
        if (!body.prompt?.trim()) return bad('Add a question.');
        const next = await db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS value FROM questions').first<{ value: number }>();
        await db.prepare('INSERT INTO questions (prompt, position, friday_only) VALUES (?, ?, ?)')
          .bind(body.prompt.trim(), next?.value ?? 1, body.fridayOnly ? 1 : 0).run();
        break;
      }

      case 'setQuestionFridayOnly': {
        if (!body.id) return bad('That question could not be found.');
        await db.prepare('UPDATE questions SET friday_only = ? WHERE id = ?')
          .bind(body.fridayOnly ? 1 : 0, body.id).run();
        break;
      }

      case 'deleteQuestion': {
        await db.prepare('DELETE FROM questions WHERE id = ?').bind(body.id).run();
        break;
      }

      case 'addAnswer': {
        if (!body.questionId || !body.label?.trim()) return bad('Add an answer label.');
        const next = await db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS value FROM answers WHERE question_id = ?')
          .bind(body.questionId).first<{ value: number }>();
        await db.prepare('INSERT INTO answers (question_id, label, image_key, position) VALUES (?, ?, ?, ?)')
          .bind(body.questionId, body.label.trim(), body.imageKey ?? null, next?.value ?? 1).run();
        break;
      }

      case 'deleteAnswer': {
        await db.prepare('DELETE FROM answers WHERE id = ?').bind(body.id).run();
        break;
      }

      case 'deleteResponse': {
        if (!body.id) return bad('That check-in could not be found.');
        await db.batch([
          db.prepare('DELETE FROM response_items WHERE response_id = ?').bind(body.id),
          db.prepare('DELETE FROM responses WHERE id = ?').bind(body.id),
        ]);
        break;
      }

      default:
        return bad('Unknown admin action.');
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'That change could not be saved.' }, { status: 500 });
  }
}

function bad(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

function isStoredImage(value: string | null | undefined): value is string {
  return Boolean(value?.startsWith('images/'));
}
