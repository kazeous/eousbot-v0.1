import { ChannelType } from "discord.js";
import { config } from "../../config.js";
import {
  forgetDynamicVoiceChannel,
  listDynamicVoiceChannels,
  rememberDynamicVoiceChannel
} from "./dynamicVoiceStore.js";

// Keep track of active dynamic channels created by the bot
const activeDynamicChannels = new Set(listDynamicVoiceChannels().map(entry => entry.channelId));

export function registerVoiceHubs(client) {
  client.on("voiceStateUpdate", async (oldState, newState) => {
    try {
      const voiceConfig = config.get("voiceHubs");
      if (!voiceConfig || !voiceConfig.enabled) return;

      const hubChannels = new Set(voiceConfig.hubChannels || []);
      const member = newState.member || oldState.member;
      if (!member || member.user.bot) return;

      // 1. User joins a hub channel: create a new room
      if (newState.channelId && hubChannels.has(newState.channelId)) {
        const parentCategory = newState.channel.parent;
        const displayName = member.displayName || member.user.username;
        const channelName = voiceConfig.roomFormat.replace("{user}", displayName);

        const newChannel = await newState.guild.channels.create({
          name: channelName,
          type: ChannelType.GuildVoice,
          parent: parentCategory ? parentCategory.id : null,
          reason: `Join-to-Create: voice room requested by ${displayName}`
        });

        activeDynamicChannels.add(newChannel.id);
        rememberDynamicVoiceChannel({
          channelId: newChannel.id,
          guildId: newState.guild.id,
          hubChannelId: newState.channelId,
          parentId: parentCategory?.id || null
        });

        // Move the member to the new channel
        try {
          await newState.setChannel(newChannel);
        } catch (error) {
          activeDynamicChannels.delete(newChannel.id);
          forgetDynamicVoiceChannel(newChannel.id);
          await newChannel.delete("Join-to-Create: failed to move requesting member").catch(() => {});
          throw error;
        }
      }

      // 2. User leaves a dynamic channel: check if it's empty and delete
      if (oldState.channelId && activeDynamicChannels.has(oldState.channelId)) {
        const channel = oldState.channel;
        
        // Fetch fresh channel object to be absolutely sure of members count
        if (channel && channel.members.size === 0) {
          const deleted = await channel.delete("Join-to-Create: dynamic room is now empty").then(() => true).catch(err => {
            console.error(`Failed to auto-delete empty channel ${channel.id}:`, err.message);
            return false;
          });
          if (deleted) {
            activeDynamicChannels.delete(channel.id);
            forgetDynamicVoiceChannel(channel.id);
          }
        }
      }
    } catch (error) {
      console.error("VoiceStateUpdate error in Join-to-Create feature:", error);
    }
  });

  // Sweep empty rooms created by the bot on startup
  client.once("ready", async () => {
    try {
      const voiceConfig = config.get("voiceHubs");
      if (!voiceConfig || !voiceConfig.enabled) return;

      for (const entry of listDynamicVoiceChannels()) {
        const channel = await client.channels.fetch(entry.channelId).catch(() => null);
        if (!channel) {
          activeDynamicChannels.delete(entry.channelId);
          forgetDynamicVoiceChannel(entry.channelId);
          continue;
        }
        if (channel.type !== ChannelType.GuildVoice || channel.guildId !== entry.guildId) {
          activeDynamicChannels.delete(entry.channelId);
          forgetDynamicVoiceChannel(entry.channelId);
          continue;
        }
        activeDynamicChannels.add(channel.id);
        if (channel.members.size === 0) {
          const deleted = await channel.delete("Startup sweep: removing a recorded empty dynamic room").then(() => true).catch(() => false);
          if (deleted) {
            activeDynamicChannels.delete(channel.id);
            forgetDynamicVoiceChannel(channel.id);
          }
        }
      }
    } catch (err) {
      console.error("Failed to run voice channel startup sweep:", err);
    }
  });
}
