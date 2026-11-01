import request from "supertest";
import { createApp } from "../src/app";
import { createLogger } from "../src/logger";
import { PostgresStore } from "../src/store/postgres";

const url = process.env.DATABASE_URL;
const maybe = url ? describe : describe.skip;

maybe("PostgresStore (requires DATABASE_URL)", () => {
  let store: PostgresStore;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    store = new PostgresStore(url as string);
    await store.init();
    app = createApp({ store, logger: createLogger("error", () => {}), version: "test" });
  });

  afterAll(async () => {
    await store.close();
  });

  it("init is idempotent", async () => {
    await expect(store.init()).resolves.toBeUndefined();
  });

  it("is ready", async () => {
    expect((await request(app).get("/ready")).status).toBe(200);
  });

  it("runs the full CRUD cycle against postgres", async () => {
    const created = await request(app).post("/api/notes").send({ title: "pg note", body: "b" });
    expect(created.status).toBe(201);
    const id: string = created.body.id;

    const updated = await request(app).put(`/api/notes/${id}`).send({ title: "pg renamed" });
    expect(updated.body.title).toBe("pg renamed");
    expect(new Date(updated.body.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(created.body.createdAt).getTime(),
    );

    expect((await request(app).get(`/api/notes/${id}`)).body.title).toBe("pg renamed");
    expect((await request(app).get("/api/notes")).body.some((n: { id: string }) => n.id === id)).toBe(true);
    expect((await request(app).delete(`/api/notes/${id}`)).status).toBe(204);
    expect((await request(app).get(`/api/notes/${id}`)).status).toBe(404);
  });

  it("returns 404 for a non-uuid id instead of a database error", async () => {
    expect((await request(app).get("/api/notes/not-a-uuid")).status).toBe(404);
  });
});
