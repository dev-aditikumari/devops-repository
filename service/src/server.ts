import type { Server } from "node:http";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { createLogger } from "./logger";
import { MemoryStore } from "./store/memory";
import { PostgresStore } from "./store/postgres";
import type { NoteStore } from "./store/types";

async function main() {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  const store: NoteStore = config.databaseUrl
    ? new PostgresStore(config.databaseUrl)
    : new MemoryStore();
  await store.init();

  const app = createApp({ store, logger, version: config.version });
  const server: Server = app.listen(config.port, () => {
    logger.info("server started", {
      port: config.port,
      store: config.databaseUrl ? "postgres" : "memory",
      version: config.version,
    });
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("shutting down", { signal });
    const force = setTimeout(() => {
      logger.error("forced exit after timeout");
      process.exit(1);
    }, 10_000);
    force.unref();
    server.close(() => {
      store
        .close()
        .then(() => process.exit(0))
        .catch((err: Error) => {
          logger.error("error closing store", { error: err.message });
          process.exit(1);
        });
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err: Error) => {
  process.stderr.write(
    JSON.stringify({ time: new Date().toISOString(), level: "error", msg: "startup failed", error: err.message }) + "\n",
  );
  process.exit(1);
});
