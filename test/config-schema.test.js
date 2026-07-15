import test from "node:test";
import assert from "node:assert/strict";
import { mergeSettings, validateEditableConfig } from "../src/config-schema.js";

function validSettings() {
  return {
    socialEmbeds: { enabled: true, watchedChannels: ["123456789012345678"], twitterDomain: "fxtwitter.com", instagramDomain: "ddinstagram.com", tiktokDomain: "tnktok.com", redditDomain: "rxddit.com", deleteOriginal: false, useWebhook: false, includeOriginalAuthor: true },
    productivity: { summarizerEnabled: true, codeHelperEnabled: false },
    voiceHubs: { enabled: false, hubChannels: [], roomFormat: "Voice - {user}" },
    starboard: { enabled: false, channelId: "", threshold: 3 },
    suggestions: { enabled: false, channelId: "" },
    autoThreader: { enabled: false, channels: [] },
    onboarding: { enabled: false, welcomeChannelId: "", verifiedRoleId: "", verificationPrompt: "Verify" },
    moderation: { enabled: true, logChannelId: "" },
    automod: { enabled: false, spamLimit: 5, spamWindow: 5, capsLimit: 70, bannedWords: [], blockInvites: true, blockLinks: false, violationsLimit: 3, violationsWindow: 60, action: "TIMEOUT", actionDuration: 10 },
    feeds: { reddit: [], youtube: [], twitch: [], rss: [] },
    greetings: { joinChannelId: "", leaveChannelId: "", joinMessage: "Welcome", leaveMessage: "Bye", joinDm: "Thanks" }
  };
}

test("validates editable settings and normalizes action", () => {
  const settings = validSettings();
  settings.automod.action = "ban";
  assert.equal(validateEditableConfig(settings).automod.action, "BAN");
});

test("rejects malformed Discord IDs and enforces feed URL shape", () => {
  const settings = validSettings();
  settings.socialEmbeds.watchedChannels = ["123"];
  assert.throws(() => validateEditableConfig(settings), /Discord ID/);

  const rssSettings = validSettings();
  rssSettings.feeds.rss = [{ url: "http://127.0.0.1/feed.xml", channelId: "123456789012345678" }];
  assert.equal(validateEditableConfig(rssSettings).feeds.rss[0].url, "http://127.0.0.1/feed.xml");
});

test("rejects prototype pollution keys", () => {
  assert.throws(() => mergeSettings({}, JSON.parse('{"__proto__":{"polluted":true}}')), /not allowed/);
});
