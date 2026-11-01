export interface Config {
  port: number;
  nodeEnv: string;
  logLevel: "debug" | "info" | "warn" | "error";
  version: string;
  databaseUrl: string | undefined;
}

const LEVELS = ["debug", "info", "warn", "error"] as const;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const rawPort = env.PORT ?? "5300";
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${rawPort}`);
  }

  const level = env.LOG_LEVEL ?? "info";
  if (!(LEVELS as readonly string[]).includes(level)) {
    throw new Error(`Invalid LOG_LEVEL: ${level}`);
  }

  const databaseUrl = env.DATABASE_URL?.trim() || undefined;
  if (databaseUrl && !/^postgres(ql)?:\/\//.test(databaseUrl)) {
    throw new Error("DATABASE_URL must start with postgres:// or postgresql://");
  }

  return {
    port,
    nodeEnv: env.NODE_ENV ?? "development",
    logLevel: level as Config["logLevel"],
    version: env.APP_VERSION?.trim() || process.env.npm_package_version || "0.0.0",
    databaseUrl,
  };
}
