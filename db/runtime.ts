import { env } from 'cloudflare:workers';

let ready: Promise<void> | null = null;

export function getDatabase() {
  if (!env.DB) throw new Error('Database binding is unavailable.');
  return env.DB;
}

export function getFiles() {
  if (!env.FILES) throw new Error('File storage binding is unavailable.');
  return env.FILES;
}

export function ensureDatabase() {
  ready ??= initialize();
  return ready;
}

async function initialize() {
  const db = getDatabase();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, image_key TEXT,
      current_score REAL, goal_score REAL, created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, prompt TEXT NOT NULL, position INTEGER NOT NULL,
      friday_only INTEGER NOT NULL DEFAULT 0
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, question_id INTEGER NOT NULL, label TEXT NOT NULL,
      image_key TEXT, position INTEGER NOT NULL,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, created_at TEXT NOT NULL,
      local_date TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS response_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, response_id INTEGER NOT NULL, question_id INTEGER NOT NULL,
      answer_id INTEGER NOT NULL, question_prompt TEXT NOT NULL, answer_label TEXT NOT NULL,
      answer_image_key TEXT,
      FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE
    )`),
    db.prepare('CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_answers_question_position ON answers(question_id, position)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_responses_student_created ON responses(student_id, created_at)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_response_items_response ON response_items(response_id)'),
  ]);

  const questionColumns = await db.prepare('PRAGMA table_info(questions)').all<{ name: string }>();
  if (!questionColumns.results.some((column) => column.name === 'friday_only')) {
    await db.prepare('ALTER TABLE questions ADD COLUMN friday_only INTEGER NOT NULL DEFAULT 0').run();
  }
  const responseItemColumns = await db.prepare('PRAGMA table_info(response_items)').all<{ name: string }>();
  if (!responseItemColumns.results.some((column) => column.name === 'answer_image_key')) {
    await db.prepare('ALTER TABLE response_items ADD COLUMN answer_image_key TEXT').run();
  }
  const studentColumns = await db.prepare('PRAGMA table_info(students)').all<{ name: string }>();
  if (!studentColumns.results.some((column) => column.name === 'current_score')) {
    await db.prepare('ALTER TABLE students ADD COLUMN current_score REAL').run();
  }
  if (!studentColumns.results.some((column) => column.name === 'goal_score')) {
    await db.prepare('ALTER TABLE students ADD COLUMN goal_score REAL').run();
  }
  const responseColumns = await db.prepare('PRAGMA table_info(responses)').all<{ name: string }>();
  if (!responseColumns.results.some((column) => column.name === 'local_date')) {
    await db.prepare('ALTER TABLE responses ADD COLUMN local_date TEXT').run();
  }
  await db.prepare('UPDATE responses SET local_date = substr(created_at, 1, 10) WHERE local_date IS NULL').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_responses_student_local_date ON responses(student_id, local_date)').run();

  await db.prepare(`INSERT OR IGNORE INTO app_settings (id, title, description)
    VALUES (1, 'Daily WIG Check-In', 'Pick the picture that best matches your effort today. Every honest check-in helps your WIG grow.')`).run();

  const seeded = await db.prepare("SELECT value FROM app_meta WHERE key = 'starter_seeded'").first();
  if (!seeded) {
    await db.batch([
      db.prepare('INSERT INTO questions (prompt, position) VALUES (?, 1)').bind('How focused did you feel today?'),
      db.prepare("INSERT INTO app_meta (key, value) VALUES ('starter_seeded', 'true')"),
    ]);
    const question = await db.prepare('SELECT id FROM questions ORDER BY id DESC LIMIT 1').first<{ id: number }>();
    if (question) {
      await db.batch([
        db.prepare('INSERT INTO answers (question_id, label, position) VALUES (?, ?, 1)').bind(question.id, 'Getting Started'),
        db.prepare('INSERT INTO answers (question_id, label, position) VALUES (?, ?, 2)').bind(question.id, 'On My Way'),
        db.prepare('INSERT INTO answers (question_id, label, position) VALUES (?, ?, 3)').bind(question.id, 'Locked In'),
      ]);
    }
  }
}

