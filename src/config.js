import fs from "node:fs";
import path from "node:path";
import EventEmitter from "node:events";
import { editableConfigFrom, mergeSettings, validateEditableConfig } from "./config-schema.js";

const CONFIG_DIR = path.resolve("data");
const CONFIG_FILE = path.join(CONFIG_DIR, "settings.json");

class ConfigManager extends EventEmitter {
  constructor() {
    super();
    this.config = {};
    this.init();
  }

  init() {
    // 1. Load initial values from environment variables as defaults
    const envConfig = {
      token: process.env.DISCORD_TOKEN || "",
      clientId: process.env.DISCORD_CLIENT_ID || "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
      adminDiscordIds: this.parseArray(process.env.ADMIN_DISCORD_IDS || ""),
      healthPort: Number.parseInt(process.env.HEALTH_PORT || "3000", 10),
      redirectUri: process.env.DASHBOARD_REDIRECT_URI || "http://localhost:3000/api/auth/discord/callback",
      
      socialEmbeds: {
        enabled: this.parseBoolean(process.env.SOCIAL_EMBEDS_ENABLED, false),
        watchedChannels: this.parseArray(process.env.TARGET_CHANNEL_IDS || process.env.TARGET_CHANNEL_ID || ""),
        twitterDomain: process.env.REPLACEMENT_DOMAIN || "fxtwitter.com",
        instagramDomain: "ddinstagram.com",
        tiktokDomain: "tnktok.com",
        redditDomain: "rxddit.com",
        deleteOriginal: this.parseBoolean(process.env.DELETE_ORIGINAL, false),
        useWebhook: this.parseBoolean(process.env.USE_WEBHOOK, false),
        includeOriginalAuthor: this.parseBoolean(process.env.INCLUDE_ORIGINAL_AUTHOR, true)
      },

      productivity: {
        summarizerEnabled: this.parseBoolean(process.env.SUMMARIZER_ENABLED, true),
        codeHelperEnabled: this.parseBoolean(process.env.CODE_HELPER_ENABLED, false)
      },

      voiceHubs: {
        enabled: !!process.env.VOICE_HUB_CHANNEL_IDS,
        hubChannels: this.parseArray(process.env.VOICE_HUB_CHANNEL_IDS || ""),
        roomFormat: process.env.VOICE_HUB_ROOM_FORMAT || "Voice - {user}"
      },

      starboard: {
        enabled: !!process.env.STARBOARD_CHANNEL_ID,
        channelId: process.env.STARBOARD_CHANNEL_ID || "",
        threshold: Number.parseInt(process.env.STARBOARD_THRESHOLD || "3", 10)
      },

      suggestions: {
        enabled: !!process.env.SUGGESTION_CHANNEL_ID,
        channelId: process.env.SUGGESTION_CHANNEL_ID || ""
      },

      autoThreader: {
        enabled: !!process.env.AUTO_THREAD_CHANNEL_IDS,
        channels: this.parseArray(process.env.AUTO_THREAD_CHANNEL_IDS || "")
      },

      onboarding: {
        enabled: !!process.env.VERIFIED_ROLE_ID,
        welcomeChannelId: process.env.WELCOME_CHANNEL_ID || "",
        verifiedRoleId: process.env.VERIFIED_ROLE_ID || "",
        verificationPrompt: process.env.VERIFICATION_PROMPT || "Click the button below to verify and unlock the server roles!"
      },

      // NEW: Moderation settings
      moderation: {
        enabled: true,
        logChannelId: process.env.MOD_LOG_CHANNEL_ID || ""
      },

      // NEW: Auto-moderator rules settings
      automod: {
        enabled: false,
        spamLimit: 5,            // messages
        spamWindow: 5,           // seconds
        capsLimit: 70,           // percent uppercase (min 10 chars)
        bannedWords: [],         // array of blacklisted phrases
        blockInvites: true,      // block server invites
        blockLinks: false,       // block all links
        violationsLimit: 3,      // warnings before automated escalation
        violationsWindow: 60,    // time window for escalation in seconds
        action: "TIMEOUT",       // TIMEOUT, KICK, BAN
        actionDuration: 10       // duration in minutes if action is TIMEOUT
      },

      // NEW: Fast content feed configs
      feeds: {
        reddit: [],              // [{ subreddit, channelId, lastSeen }]
        youtube: [],             // [{ youtubeChannelId, channelId, lastSeen }]
        twitch: [],              // [{ twitchUsername, channelId, lastSeen }]
        rss: []                  // [{ url, channelId, lastSeen }]
      },

      // NEW: Server entry greetings settings
      greetings: {
        joinChannelId: process.env.GREETING_JOIN_CHANNEL_ID || "",
        leaveChannelId: process.env.GREETING_LEAVE_CHANNEL_ID || "",
        joinMessage: process.env.GREETING_JOIN_MSG || "👋 Welcome {user} to the server!",
        leaveMessage: process.env.GREETING_LEAVE_MSG || "😢 {user} has left the server.",
        joinDm: process.env.GREETING_JOIN_DM || "Thanks for joining our community!"
      }
    };

    // Ensure data directory exists
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    let fileConfig = {};
    let hasConfigFile = false;
    if (fs.existsSync(CONFIG_FILE)) {
      hasConfigFile = true;
      try {
        const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
        fileConfig = JSON.parse(raw);
        console.log("Loaded settings from settings.json");
      } catch (err) {
        console.error("Failed to parse settings.json, using defaults:", err.message);
      }
    } else {
      console.log("No settings.json found, creating with default settings");
    }

    // Only editable, non-secret settings are loaded from disk. Environment
    // credentials and process-level server settings always remain authoritative.
    const defaults = editableConfigFrom(envConfig);
    const merged = mergeSettings(defaults, this.pickEditable(fileConfig));
    const validated = validateEditableConfig(merged);
    this.config = { ...envConfig, ...validated };

    // Migrate old files only when their persisted representation actually
    // changes. This avoids requiring a write for every read-only startup.
    if (!hasConfigFile || JSON.stringify(fileConfig) !== JSON.stringify(validated)) {
      this.saveFile(validated);
    }
  }

  get(key) {
    return this.config[key];
  }

  getAll() {
    return editableConfigFrom(this.config);
  }

  update(newConfig) {
    const current = editableConfigFrom(this.config);
    const validated = validateEditableConfig(mergeSettings(current, newConfig));
    this.config = { ...this.config, ...validated };
    this.saveFile(validated);
    this.emit("update", this.config);
    return editableConfigFrom(this.config);
  }

  saveFile(configData) {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(configData, null, 2), { encoding: "utf8", mode: 0o600 });
      fs.chmodSync(CONFIG_FILE, 0o600);
    } catch (err) {
      console.error("Failed to write to settings.json:", err.message);
      throw err;
    }
  }

  parseArray(val) {
    if (!val) return [];
    return val.split(",").map((s) => s.trim()).filter(Boolean);
  }

  parseBoolean(value, defaultValue) {
    if (value === undefined || value === null) {
      return defaultValue;
    }
    return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
  }

  pickEditable(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const allowed = new Set([
      "socialEmbeds", "productivity", "voiceHubs", "starboard", "suggestions",
      "autoThreader", "onboarding", "moderation", "automod", "feeds", "greetings"
    ]);
    return Object.fromEntries(Object.entries(value).filter(([key]) => allowed.has(key)));
  }
}

export const config = new ConfigManager();
