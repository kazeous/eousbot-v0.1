import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve("data");
const STORE_FILE = path.join(DATA_DIR, "dynamic-voice-channels.json");
let entries = load();

function load() {
  if (!fs.existsSync(STORE_FILE)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
    return Array.isArray(parsed) ? parsed.filter(entry => entry?.channelId && entry?.guildId) : [];
  } catch (error) {
    console.error("Failed to load dynamic voice channel store:", error.message);
    return [];
  }
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const temporary = `${STORE_FILE}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(entries, null, 2), { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temporary, STORE_FILE);
}

export function listDynamicVoiceChannels() {
  return structuredClone(entries);
}

export function rememberDynamicVoiceChannel(entry) {
  entries = entries.filter(item => item.channelId !== entry.channelId);
  entries.push({
    channelId: entry.channelId,
    guildId: entry.guildId,
    hubChannelId: entry.hubChannelId,
    parentId: entry.parentId || null
  });
  save();
}

export function forgetDynamicVoiceChannel(channelId) {
  const next = entries.filter(entry => entry.channelId !== channelId);
  if (next.length === entries.length) return;
  entries = next;
  save();
}
