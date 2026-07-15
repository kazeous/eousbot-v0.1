import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const configUrl = pathToFileURL(path.join(repoRoot, "src", "config.js")).href;

function runConfigImport(cwd) {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(configUrl)})`], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, DISCORD_TOKEN: "" }
  });
  assert.equal(result.status, 0, result.stderr);
}

test("startup does not rewrite unchanged settings but migrates legacy secrets", () => {
  const workspace = mkdtempSync(path.join(tmpdir(), "eousbot-config-"));
  try {
    runConfigImport(workspace);
    const settingsPath = path.join(workspace, "data", "settings.json");
    const oldTime = new Date(1000);
    utimesSync(settingsPath, oldTime, oldTime);

    runConfigImport(workspace);
    assert.equal(statSync(settingsPath).mtimeMs, oldTime.getTime());

    const legacy = JSON.parse(readFileSync(settingsPath, "utf8"));
    legacy.token = "must-not-persist";
    writeFileSync(settingsPath, JSON.stringify(legacy, null, 2));
    runConfigImport(workspace);

    const migrated = JSON.parse(readFileSync(settingsPath, "utf8"));
    assert.equal("token" in migrated, false);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
