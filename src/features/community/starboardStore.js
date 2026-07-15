import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve("data");
const STORE_FILE = path.join(DATA_DIR, "starboard.json");
let records = load();

function load() {
  if (!fs.existsSync(STORE_FILE)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch (error) {
    console.error("Failed to load starboard store:", error.message);
    return {};
  }
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const temporary = `${STORE_FILE}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(records, null, 2), { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temporary, STORE_FILE);
}

export function getStarboardMessageId(key) {
  return records[key] || null;
}

export function setStarboardMessageId(key, value) {
  records[key] = value;
  save();
}

export function deleteStarboardMessageId(key) {
  if (!records[key]) return;
  delete records[key];
  save();
}
