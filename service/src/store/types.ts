export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteInput {
  title: string;
  body: string;
}

export interface NoteStore {
  init(): Promise<void>;
  ping(): Promise<void>;
  list(): Promise<Note[]>;
  get(id: string): Promise<Note | undefined>;
  create(input: NoteInput): Promise<Note>;
  update(id: string, input: NoteInput): Promise<Note | undefined>;
  remove(id: string): Promise<boolean>;
  close(): Promise<void>;
}
