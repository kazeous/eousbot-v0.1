const DISCORD_ID = /^\d{17,20}$/;
const SAFE_KEYS = new Set([
  "socialEmbeds", "productivity", "voiceHubs", "starboard", "suggestions",
  "autoThreader", "onboarding", "moderation", "automod", "feeds", "greetings"
]);

function assertSafeObject(value, path = "settings") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object.`);
  }
  for (const [key, child] of Object.entries(value)) {
    if (["__proto__", "prototype", "constructor"].includes(key)) {
      throw new TypeError(`${path}.${key} is not allowed.`);
    }
    if (child && typeof child === "object" && !Array.isArray(child)) {
      assertSafeObject(child, `${path}.${key}`);
    }
  }
}

function bool(value, path) {
  if (typeof value !== "boolean") throw new TypeError(`${path} must be true or false.`);
  return value;
}

function integer(value, path, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new TypeError(`${path} must be an integer from ${min} to ${max}.`);
  }
  return value;
}

function text(value, path, maxLength, { allowEmpty = true } = {}) {
  if (typeof value !== "string") throw new TypeError(`${path} must be text.`);
  const result = value.trim();
  if (!allowEmpty && !result) throw new TypeError(`${path} cannot be empty.`);
  if (result.length > maxLength) throw new TypeError(`${path} must be at most ${maxLength} characters.`);
  return result;
}

function discordId(value, path, { allowEmpty = true } = {}) {
  const result = text(value, path, 20, { allowEmpty });
  if (result && !DISCORD_ID.test(result)) throw new TypeError(`${path} must be a Discord ID.`);
  return result;
}

function stringList(value, path, itemValidator, maxItems = 100) {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new TypeError(`${path} must be an array with at most ${maxItems} entries.`);
  }
  return [...new Set(value.map((item, index) => itemValidator(item, `${path}[${index}]`)))];
}

function hostname(value, path) {
  const result = text(value, path, 253, { allowEmpty: false }).toLowerCase();
  const pattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
  if (!pattern.test(result)) throw new TypeError(`${path} must be a hostname without a protocol or path.`);
  return result;
}

function httpUrl(value, path) {
  const result = text(value, path, 2048, { allowEmpty: false });
  let parsed;
  try {
    parsed = new URL(result);
  } catch {
    throw new TypeError(`${path} must be a valid URL.`);
  }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new TypeError(`${path} must be an HTTP(S) URL without embedded credentials.`);
  }
  return parsed.toString();
}

function feedList(value, path, sourceField, sourceValidator) {
  if (!Array.isArray(value) || value.length > 100) {
    throw new TypeError(`${path} must be an array with at most 100 entries.`);
  }
  return value.map((item, index) => {
    assertSafeObject(item, `${path}[${index}]`);
    return {
      [sourceField]: sourceValidator(item[sourceField], `${path}[${index}].${sourceField}`),
      channelId: discordId(item.channelId, `${path}[${index}].channelId`, { allowEmpty: false })
    };
  });
}

export function validateEditableConfig(value) {
  assertSafeObject(value);
  for (const key of Object.keys(value)) {
    if (!SAFE_KEYS.has(key)) throw new TypeError(`Unknown settings section: ${key}.`);
  }

  const action = text(value.automod.action, "automod.action", 10, { allowEmpty: false }).toUpperCase();
  if (!["TIMEOUT", "KICK", "BAN"].includes(action)) {
    throw new TypeError("automod.action must be TIMEOUT, KICK, or BAN.");
  }

  return {
    socialEmbeds: {
      enabled: bool(value.socialEmbeds.enabled, "socialEmbeds.enabled"),
      watchedChannels: stringList(value.socialEmbeds.watchedChannels, "socialEmbeds.watchedChannels", discordId),
      twitterDomain: hostname(value.socialEmbeds.twitterDomain, "socialEmbeds.twitterDomain"),
      instagramDomain: hostname(value.socialEmbeds.instagramDomain, "socialEmbeds.instagramDomain"),
      tiktokDomain: hostname(value.socialEmbeds.tiktokDomain, "socialEmbeds.tiktokDomain"),
      redditDomain: hostname(value.socialEmbeds.redditDomain, "socialEmbeds.redditDomain"),
      deleteOriginal: bool(value.socialEmbeds.deleteOriginal, "socialEmbeds.deleteOriginal"),
      useWebhook: bool(value.socialEmbeds.useWebhook, "socialEmbeds.useWebhook"),
      includeOriginalAuthor: bool(value.socialEmbeds.includeOriginalAuthor, "socialEmbeds.includeOriginalAuthor")
    },
    productivity: {
      summarizerEnabled: bool(value.productivity.summarizerEnabled, "productivity.summarizerEnabled"),
      codeHelperEnabled: bool(value.productivity.codeHelperEnabled, "productivity.codeHelperEnabled")
    },
    voiceHubs: {
      enabled: bool(value.voiceHubs.enabled, "voiceHubs.enabled"),
      hubChannels: stringList(value.voiceHubs.hubChannels, "voiceHubs.hubChannels", discordId),
      roomFormat: text(value.voiceHubs.roomFormat, "voiceHubs.roomFormat", 100, { allowEmpty: false })
    },
    starboard: {
      enabled: bool(value.starboard.enabled, "starboard.enabled"),
      channelId: discordId(value.starboard.channelId, "starboard.channelId"),
      threshold: integer(value.starboard.threshold, "starboard.threshold", 1, 100)
    },
    suggestions: {
      enabled: bool(value.suggestions.enabled, "suggestions.enabled"),
      channelId: discordId(value.suggestions.channelId, "suggestions.channelId")
    },
    autoThreader: {
      enabled: bool(value.autoThreader.enabled, "autoThreader.enabled"),
      channels: stringList(value.autoThreader.channels, "autoThreader.channels", discordId)
    },
    onboarding: {
      enabled: bool(value.onboarding.enabled, "onboarding.enabled"),
      welcomeChannelId: discordId(value.onboarding.welcomeChannelId, "onboarding.welcomeChannelId"),
      verifiedRoleId: discordId(value.onboarding.verifiedRoleId, "onboarding.verifiedRoleId"),
      verificationPrompt: text(value.onboarding.verificationPrompt, "onboarding.verificationPrompt", 1000, { allowEmpty: false })
    },
    moderation: {
      enabled: bool(value.moderation.enabled, "moderation.enabled"),
      logChannelId: discordId(value.moderation.logChannelId, "moderation.logChannelId")
    },
    automod: {
      enabled: bool(value.automod.enabled, "automod.enabled"),
      spamLimit: integer(value.automod.spamLimit, "automod.spamLimit", 1, 100),
      spamWindow: integer(value.automod.spamWindow, "automod.spamWindow", 1, 3600),
      capsLimit: integer(value.automod.capsLimit, "automod.capsLimit", 1, 100),
      bannedWords: stringList(value.automod.bannedWords, "automod.bannedWords", (item, path) => text(item, path, 100, { allowEmpty: false }), 500),
      blockInvites: bool(value.automod.blockInvites, "automod.blockInvites"),
      blockLinks: bool(value.automod.blockLinks, "automod.blockLinks"),
      violationsLimit: integer(value.automod.violationsLimit, "automod.violationsLimit", 1, 100),
      violationsWindow: integer(value.automod.violationsWindow, "automod.violationsWindow", 1, 86400),
      action,
      actionDuration: integer(value.automod.actionDuration, "automod.actionDuration", 1, 40320)
    },
    feeds: {
      reddit: feedList(value.feeds.reddit, "feeds.reddit", "subreddit", (item, path) => {
        const result = text(item, path, 21, { allowEmpty: false });
        if (!/^[A-Za-z0-9_]+$/.test(result)) throw new TypeError(`${path} is not a valid subreddit name.`);
        return result;
      }),
      youtube: feedList(value.feeds.youtube, "feeds.youtube", "youtubeChannelId", (item, path) => text(item, path, 100, { allowEmpty: false })),
      twitch: feedList(value.feeds.twitch, "feeds.twitch", "twitchUsername", (item, path) => {
        const result = text(item, path, 25, { allowEmpty: false }).toLowerCase();
        if (!/^[a-z0-9_]+$/.test(result)) throw new TypeError(`${path} is not a valid Twitch username.`);
        return result;
      }),
      rss: feedList(value.feeds.rss, "feeds.rss", "url", httpUrl)
    },
    greetings: {
      joinChannelId: discordId(value.greetings.joinChannelId, "greetings.joinChannelId"),
      leaveChannelId: discordId(value.greetings.leaveChannelId, "greetings.leaveChannelId"),
      joinMessage: text(value.greetings.joinMessage, "greetings.joinMessage", 4000),
      leaveMessage: text(value.greetings.leaveMessage, "greetings.leaveMessage", 4000),
      joinDm: text(value.greetings.joinDm, "greetings.joinDm", 1900)
    }
  };
}

export function mergeSettings(target, source) {
  assertSafeObject(source);
  const output = { ...target };
  for (const [key, value] of Object.entries(source)) {
    output[key] = value && typeof value === "object" && !Array.isArray(value)
      ? mergeSettings(target[key] || {}, value)
      : value;
  }
  return output;
}

export function editableConfigFrom(config) {
  return Object.fromEntries([...SAFE_KEYS].map((key) => [key, structuredClone(config[key])]));
}
