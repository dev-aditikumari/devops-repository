import { loadConfig } from "../src/config";
import { createLogger } from "../src/logger";

describe("loadConfig", () => {
  it("uses defaults", () => {
    const c = loadConfig({});
    expect(c.port).toBe(5300);
    expect(c.logLevel).toBe("info");
    expect(c.databaseUrl).toBeUndefined();
  });

  it("reads values from the environment", () => {
    const c = loadConfig({
      PORT: "8080",
      LOG_LEVEL: "debug",
      APP_VERSION: "1.2.3",
      DATABASE_URL: "postgres://u:p@h:5432/d",
    });
    expect(c).toMatchObject({ port: 8080, logLevel: "debug", version: "1.2.3" });
    expect(c.databaseUrl).toBe("postgres://u:p@h:5432/d");
  });

  it("treats an empty DATABASE_URL as unset", () => {
    expect(loadConfig({ DATABASE_URL: "  " }).databaseUrl).toBeUndefined();
  });

  it.each(["abc", "0", "70000", "80.5"])("rejects PORT=%s", (port) => {
    expect(() => loadConfig({ PORT: port })).toThrow(/Invalid PORT/);
  });

  it("rejects an unknown log level", () => {
    expect(() => loadConfig({ LOG_LEVEL: "loud" })).toThrow(/LOG_LEVEL/);
  });

  it("rejects a non-postgres DATABASE_URL", () => {
    expect(() => loadConfig({ DATABASE_URL: "mysql://x" })).toThrow(/DATABASE_URL/);
  });
});

describe("logger", () => {
  it("writes one JSON object per line with extra fields", () => {
    const lines: string[] = [];
    createLogger("info", (l) => lines.push(l)).info("hello", { a: 1 });
    const parsed = JSON.parse(lines[0] as string);
    expect(parsed).toMatchObject({ level: "info", msg: "hello", a: 1 });
    expect(typeof parsed.time).toBe("string");
  });

  it("drops messages below the configured level", () => {
    const lines: string[] = [];
    const log = createLogger("warn", (l) => lines.push(l));
    log.info("skip");
    log.warn("keep");
    expect(lines).toHaveLength(1);
  });
});
