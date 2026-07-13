import { ChannelType } from "discord.js";
import { config } from "../../config.js";

// Keep track of active dynamic channels created by the bot
const activeDynamicChannels = new Set();

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

        // Move the member to the new channel
        await newState.setChannel(newChannel);
      }

      // 2. User leaves a dynamic channel: check if it's empty and delete
      if (oldState.channelId && activeDynamicChannels.has(oldState.channelId)) {
        const channel = oldState.channel;
        
        // Fetch fresh channel object to be absolutely sure of members count
        if (channel && channel.members.size === 0) {
          activeDynamicChannels.delete(channel.id);
          await channel.delete("Join-to-Create: dynamic room is now empty").catch(err => {
            console.error(`Failed to auto-delete empty channel ${channel.id}:`, err.message);
          });
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

      for (const guild of client.guilds.cache.values()) {
        const channels = await guild.channels.fetch();
        for (const channel of channels.values()) {
          // Identify potential left-over rooms if the name matches the format (e.g. ends with "'s Room" or starts with "🔊")
          if (
            channel.type === ChannelType.GuildVoice &&
            channel.members.size === 0 &&
            (channel.name.startsWith("🔊") || channel.name.includes("'s Room"))
          ) {
            // Confirm it's not a configured hub channel
            const hubChannels = new Set(voiceConfig.hubChannels || []);
            if (!hubChannels.has(channel.id)) {
              await channel.delete("Startup sweep: cleaning up empty dynamic room").catch(() => {});
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to run voice channel startup sweep:", err);
    }
  });
}
