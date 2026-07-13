import fs from "node:fs";
import path from "node:path";
import EventEmitter from "node:events";

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
        enabled: this.parseBoolean(process.env.SOCIAL_EMBEDS_ENABLED, true),
        watchedChannels: this.parseArray(process.env.TARGET_CHANNEL_IDS || process.env.TARGET_CHANNEL_ID || ""),
        twitterDomain: process.env.REPLACEMENT_DOMAIN || "fxtwitter.com",
        instagramDomain: "ddinstagram.com",
        tiktokDomain: "tnktok.com",
        redditDomain: "rxddit.com",
        deleteOriginal: this.parseBoolean(process.env.DELETE_ORIGINAL, false),
        useWebhook: this.parseBoolean(process.env.USE_WEBHOOK, false),
        includeOriginalAuthor: this.parseBoolean(process.env.INCLUDE_ORIGINAL_AUTHOR, true)
      },

      voiceHubs: {
        enabled: !!process.env.VOICE_HUB_CHANNEL_IDS,
        hubChannels: this.parseArray(process.env.VOICE_HUB_CHANNEL_IDS || ""),
        roomFormat: process.env.VOICE_HUB_ROOM_FORMAT || "🔊 {user}'s Room"
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
      }
    };

    // Ensure data directory exists
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    let fileConfig = {};
    if (fs.existsSync(CONFIG_FILE)) {
      try {
        const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
        fileConfig = JSON.parse(raw);
        console.log("Loaded settings from settings.json");
      } catch (err) {
        console.error("Failed to parse settings.json, using defaults:", err.message);
      }
    } else {
      console.log("No settings.json found, creating with default settings");
      this.saveFile(envConfig);
    }

    // Merge file settings into base settings
    this.config = this.deepMerge(envConfig, fileConfig);
  }

  get(key) {
    return this.config[key];
  }

  getAll() {
    return { ...this.config };
  }

  update(newConfig) {
    // Exclude security tokens from front-end updates
    const sanitized = { ...newConfig };
    delete sanitized.token;
    delete sanitized.clientId;
    delete sanitized.clientSecret;

    this.config = this.deepMerge(this.config, sanitized);
    this.saveFile(this.config);
    this.emit("update", this.config);
    return this.config;
  }

  saveFile(configData) {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(configData, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to write to settings.json:", err.message);
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

  deepMerge(target, source) {
    const output = { ...target };
    if (target && typeof target === "object" && source && typeof source === "object") {
      Object.keys(source).forEach((key) => {
        if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
          output[key] = this.deepMerge(target[key] || {}, source[key]);
        } else {
          output[key] = source[key];
        }
      });
    }
    return output;
  }
}

export const config = new ConfigManager();
