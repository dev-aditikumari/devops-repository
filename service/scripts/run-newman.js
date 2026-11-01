const { spawn } = require("node:child_process");
const path = require("node:path");

const port = process.env.PORT || "5300";
const baseUrl = `http://127.0.0.1:${port}`;
const collection = path.join(__dirname, "..", "..", "postman", "devops-service.postman_collection.json");
const newman = path.join(__dirname, "..", "node_modules", ".bin", "newman");

const server = spawn("node", ["dist/server.js"], {
  cwd: path.join(__dirname, ".."),
  env: { ...process.env, PORT: port, LOG_LEVEL: "warn", APP_VERSION: "1.0.0" },
  stdio: "inherit",
});

async function waitForHealth() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("service did not become healthy");
}

function runNewman() {
  return new Promise((resolve) => {
    const child = spawn(newman, ["run", collection, "--env-var", `baseUrl=${baseUrl}`, "--color", "off"], {
      stdio: "inherit",
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

(async () => {
  let code = 1;
  try {
    await waitForHealth();
    code = await runNewman();
  } catch (err) {
    console.error(err.message);
  } finally {
    server.kill("SIGTERM");
  }
  process.exit(code);
})();
