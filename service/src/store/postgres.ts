import { Pool } from "pg";
import type { Note, NoteInput, NoteStore } from "./types";

interface Row {
  id: string;
  title: string;
  body: string;
  created_at: Date;
  updated_at: Date;
}

const toNote = (r: Row): Note => ({
  id: r.id,
  title: r.title,
  body: r.body,
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
});

export class PostgresStore implements NoteStore {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 3000 });
  }

  async init(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        body TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  }

  async ping(): Promise<void> {
    await this.pool.query("SELECT 1");
  }

  async list(): Promise<Note[]> {
    const { rows } = await this.pool.query<Row>("SELECT * FROM notes ORDER BY created_at, id");
    return rows.map(toNote);
  }

  async get(id: string): Promise<Note | undefined> {
    if (!isUuid(id)) return undefined;
    const { rows } = await this.pool.query<Row>("SELECT * FROM notes WHERE id = $1", [id]);
    return rows[0] && toNote(rows[0]);
  }

  async create(input: NoteInput): Promise<Note> {
    const { rows } = await this.pool.query<Row>(
      "INSERT INTO notes (title, body) VALUES ($1, $2) RETURNING *",
      [input.title, input.body],
    );
    return toNote(rows[0] as Row);
  }

  async update(id: string, input: NoteInput): Promise<Note | undefined> {
    if (!isUuid(id)) return undefined;
    const { rows } = await this.pool.query<Row>(
      "UPDATE notes SET title = $2, body = $3, updated_at = now() WHERE id = $1 RETURNING *",
      [id, input.title, input.body],
    );
    return rows[0] && toNote(rows[0]);
  }

  async remove(id: string): Promise<boolean> {
    if (!isUuid(id)) return false;
    const res = await this.pool.query("DELETE FROM notes WHERE id = $1", [id]);
    return (res.rowCount ?? 0) > 0;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

const isUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
