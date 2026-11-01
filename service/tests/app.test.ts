import request from "supertest";
import { createApp } from "../src/app";
import { createLogger } from "../src/logger";
import { MemoryStore } from "../src/store/memory";
import type { NoteStore } from "../src/store/types";

const silent = createLogger("error", () => {});

function build(store: NoteStore = new MemoryStore()) {
  return createApp({ store, logger: silent, version: "9.9.9" });
}

describe("operational endpoints", () => {
  it("GET /health returns ok", async () => {
    const res = await request(build()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("GET /ready returns ready when the store responds", async () => {
    const res = await request(build()).get("/ready");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ready" });
  });

  it("GET /ready returns 503 when the store fails", async () => {
    const store = new MemoryStore();
    store.ping = async () => {
      throw new Error("down");
    };
    const res = await request(build(store)).get("/ready");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "unavailable" });
  });

  it("GET /version returns the configured version", async () => {
    const res = await request(build()).get("/version");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ version: "9.9.9" });
  });
});

describe("notes CRUD", () => {
  it("starts empty", async () => {
    const res = await request(build()).get("/api/notes");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("creates, reads, lists, updates and deletes a note", async () => {
    const app = build();

    const created = await request(app).post("/api/notes").send({ title: "  First  ", body: "hello" });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ title: "First", body: "hello" });
    expect(created.headers.location).toBe(`/api/notes/${created.body.id}`);
    const id: string = created.body.id;

    const fetched = await request(app).get(`/api/notes/${id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body).toEqual(created.body);

    const list = await request(app).get("/api/notes");
    expect(list.body).toHaveLength(1);

    const updated = await request(app).put(`/api/notes/${id}`).send({ title: "Renamed" });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ id, title: "Renamed", body: "" });
    expect(updated.body.createdAt).toBe(created.body.createdAt);

    const del = await request(app).delete(`/api/notes/${id}`);
    expect(del.status).toBe(204);

    const gone = await request(app).get(`/api/notes/${id}`);
    expect(gone.status).toBe(404);
  });

  it("defaults body to an empty string", async () => {
    const res = await request(build()).post("/api/notes").send({ title: "x" });
    expect(res.status).toBe(201);
    expect(res.body.body).toBe("");
  });

  it("returns 404 for unknown ids on get, put and delete", async () => {
    const app = build();
    const id = "00000000-0000-4000-8000-000000000000";
    expect((await request(app).get(`/api/notes/${id}`)).status).toBe(404);
    expect((await request(app).put(`/api/notes/${id}`).send({ title: "x" })).status).toBe(404);
    expect((await request(app).delete(`/api/notes/${id}`)).status).toBe(404);
  });
});

describe("validation and errors", () => {
  const bad: Array<[string, unknown]> = [
    ["missing title", {}],
    ["empty title", { title: "   " }],
    ["non-string title", { title: 5 }],
    ["title too long", { title: "a".repeat(101) }],
    ["non-string body", { title: "ok", body: 12 }],
    ["body too long", { title: "ok", body: "a".repeat(1001) }],
    ["array payload", [{ title: "x" }]],
  ];

  it.each(bad)("rejects %s with 400 on POST", async (_name, payload) => {
    const res = await request(build()).post("/api/notes").send(payload as object);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation failed");
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it("reports every problem at once", async () => {
    const res = await request(build()).post("/api/notes").send({ title: "", body: 1 });
    expect(res.body.details).toHaveLength(2);
  });

  it("rejects invalid input on PUT before looking up the note", async () => {
    const res = await request(build())
      .put("/api/notes/00000000-0000-4000-8000-000000000000")
      .send({ title: "" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await request(build())
      .post("/api/notes")
      .set("Content-Type", "application/json")
      .send('{"title": ');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "malformed JSON" });
  });

  it("returns 413 for oversized payloads", async () => {
    const res = await request(build()).post("/api/notes").send({ title: "x", body: "a".repeat(20000) });
    expect(res.status).toBe(413);
  });

  it("returns 404 JSON for unknown routes", async () => {
    const res = await request(build()).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "route not found" });
  });

  it("returns 500 without leaking details when the store throws", async () => {
    const store = new MemoryStore();
    store.list = async () => {
      throw new Error("secret detail");
    };
    const res = await request(build(store)).get("/api/notes");
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("secret detail");
  });

  it("does not send the x-powered-by header", async () => {
    const res = await request(build()).get("/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
