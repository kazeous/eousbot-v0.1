import assert from "node:assert/strict";
import test from "node:test";
import { PermissionFlagsBits, PermissionsBitField } from "discord.js";
import { ensureVoiceControlPanel } from "../src/features/community/voiceControl.js";

test("builds a valid voice room control panel", async () => {
  const sent = [];
  const guildId = "234567890123456789";
  const channel = {
    id: "123456789012345678",
    name: "Test Room",
    userLimit: 0,
    bitrate: 96000,
    rtcRegion: null,
    nsfw: false,
    guild: {
      id: guildId,
      roles: { everyone: { id: guildId } }
    },
    permissionsFor: () => new PermissionsBitField([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.SendMessages
    ]),
    isSendable: () => true,
    messages: {
      fetch: async () => ({ find: () => null })
    },
    send: async payload => {
      sent.push(payload);
      return { id: "345678901234567890" };
    }
  };

  await ensureVoiceControlPanel(channel, {
    channelId: channel.id,
    guildId,
    ownerId: "456789012345678901",
    controlMessageId: null
  }, { user: { id: "567890123456789012" } });

  assert.equal(sent.length, 1);
  assert.equal(sent[0].embeds[0].toJSON().title, "Voice Room Control Panel");

  const rows = sent[0].components.map(row => row.toJSON());
  assert.equal(rows.length, 3);
  assert.equal(rows[0].components[0].custom_id, `voice_settings:${channel.id}`);
  assert.equal(rows[1].components[0].custom_id, `voice_permissions:${channel.id}`);
  assert.ok(rows[0].components[0].options.some(option => option.value === "game"));
  assert.ok(rows[1].components[0].options.some(option => option.value === "transfer"));
});
