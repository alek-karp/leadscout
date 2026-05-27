import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";

const DB_PATH = "./data/checkpoints.db";
mkdirSync("./data", { recursive: true });

const db = new Database(DB_PATH);
db.run(`
  CREATE TABLE IF NOT EXISTS search_checkpoints (
    city           TEXT    NOT NULL,
    query_template TEXT    NOT NULL,
    searched_at    INTEGER NOT NULL,
    result_count   INTEGER NOT NULL,
    PRIMARY KEY (city, query_template)
  )
`);

const stmtGet = db.prepare<{ searched_at: number }, [string, string]>(
  "SELECT searched_at FROM search_checkpoints WHERE city = ? AND query_template = ?"
);
const stmtUpsert = db.prepare(
  `INSERT INTO search_checkpoints (city, query_template, searched_at, result_count)
   VALUES (?, ?, ?, ?)
   ON CONFLICT(city, query_template) DO UPDATE SET
     searched_at  = excluded.searched_at,
     result_count = excluded.result_count`
);
const stmtReset = db.prepare("DELETE FROM search_checkpoints");

export function isDue(city: string, queryTemplate: string, cooldownDays: number): boolean {
  const row = stmtGet.get(city, queryTemplate);
  if (!row) return true;
  const ageSeconds = Math.floor(Date.now() / 1000) - row.searched_at;
  return ageSeconds >= cooldownDays * 86_400;
}

export function mark(city: string, queryTemplate: string, resultCount: number): void {
  stmtUpsert.run(city, queryTemplate, Math.floor(Date.now() / 1000), resultCount);
}

export function resetAll(): void {
  stmtReset.run();
}

export function close(): void {
  db.close();
}
