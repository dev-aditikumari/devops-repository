import { randomUUID } from "node:crypto";
import type { Note, NoteInput, NoteStore } from "./types";

export class MemoryStore implements NoteStore {
  private notes = new Map<string, Note>();

  async init(): Promise<void> {}

  async ping(): Promise<void> {}

  async list(): Promise<Note[]> {
    return [...this.notes.values()];
  }

  async get(id: string): Promise<Note | undefined> {
    return this.notes.get(id);
  }

  async create(input: NoteInput): Promise<Note> {
    const now = new Date().toISOString();
    const note: Note = { id: randomUUID(), ...input, createdAt: now, updatedAt: now };
    this.notes.set(note.id, note);
    return note;
  }

  async update(id: string, input: NoteInput): Promise<Note | undefined> {
    const existing = this.notes.get(id);
    if (!existing) return undefined;
    const updated: Note = { ...existing, ...input, updatedAt: new Date().toISOString() };
    this.notes.set(id, updated);
    return updated;
  }

  async remove(id: string): Promise<boolean> {
    return this.notes.delete(id);
  }

  async close(): Promise<void> {}
}
