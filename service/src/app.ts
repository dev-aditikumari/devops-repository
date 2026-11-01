import express, { type NextFunction, type Request, type Response } from "express";
import type { Logger } from "./logger";
import type { NoteStore } from "./store/types";
import { validateNote } from "./validation";

export interface AppDeps {
  store: NoteStore;
  logger: Logger;
  version: string;
}

interface HttpError extends Error {
  status?: number;
  type?: string;
}

export function createApp({ store, logger, version }: AppDeps) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "10kb" }));

  app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      logger.info("request", {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Math.round(ms * 100) / 100,
      });
    });
    next();
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/ready", async (_req, res) => {
    try {
      await store.ping();
      res.json({ status: "ready" });
    } catch (err) {
      logger.error("readiness check failed", { error: (err as Error).message });
      res.status(503).json({ status: "unavailable" });
    }
  });

  app.get("/version", (_req, res) => {
    res.json({ version });
  });

  const wrap =
    (fn: (req: Request, res: Response) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) => {
      fn(req, res).catch(next);
    };

  app.get(
    "/api/notes",
    wrap(async (_req, res) => {
      res.json(await store.list());
    }),
  );

  app.get(
    "/api/notes/:id",
    wrap(async (req, res) => {
      const note = await store.get(String(req.params.id));
      if (!note) {
        res.status(404).json({ error: "note not found" });
        return;
      }
      res.json(note);
    }),
  );

  app.post(
    "/api/notes",
    wrap(async (req, res) => {
      const result = validateNote(req.body);
      if (!result.ok) {
        res.status(400).json({ error: "validation failed", details: result.errors });
        return;
      }
      const note = await store.create(result.value);
      res.status(201).location(`/api/notes/${note.id}`).json(note);
    }),
  );

  app.put(
    "/api/notes/:id",
    wrap(async (req, res) => {
      const result = validateNote(req.body);
      if (!result.ok) {
        res.status(400).json({ error: "validation failed", details: result.errors });
        return;
      }
      const note = await store.update(String(req.params.id), result.value);
      if (!note) {
        res.status(404).json({ error: "note not found" });
        return;
      }
      res.json(note);
    }),
  );

  app.delete(
    "/api/notes/:id",
    wrap(async (req, res) => {
      const removed = await store.remove(String(req.params.id));
      if (!removed) {
        res.status(404).json({ error: "note not found" });
        return;
      }
      res.status(204).end();
    }),
  );

  app.use((_req, res) => {
    res.status(404).json({ error: "route not found" });
  });

  app.use((err: HttpError, _req: Request, res: Response, _next: NextFunction) => {
    if (err.type === "entity.parse.failed") {
      res.status(400).json({ error: "malformed JSON" });
      return;
    }
    if (err.type === "entity.too.large") {
      res.status(413).json({ error: "payload too large" });
      return;
    }
    logger.error("unhandled error", { error: err.message });
    res.status(500).json({ error: "internal server error" });
  });

  return app;
}
