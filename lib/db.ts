import Database, { type Database as DB } from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

let _db: DB | null = null;

function resolveDatabasePath(): string {
  const p = process.env.DATABASE_PATH || "./data/data.sqlite";
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

function applyMigrations(db: DB) {
  const dir = path.resolve(process.cwd(), "db/migrations");
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), "utf-8");
    db.exec(sql);
  }
}

export function getDb(): DB {
  if (_db) return _db;
  const file = resolveDatabasePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
  _db = db;
  return db;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
