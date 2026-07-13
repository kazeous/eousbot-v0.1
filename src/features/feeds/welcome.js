import { EmbedBuilder } from "discord.js";
import { config } from "../../config.js";

// Helper to format greeting templates
function formatGreeting(template, member) {
  return template
    .replace(/{user}/g, `${member}`)
    .replace(/{username}/g, member.user.username)
    .replace(/{guild}/g, member.guild.name)
    .replace(/{count}/g, String(member.guild.memberCount));
}

export function registerWelcomeGreetings(client) {
  // 1. Guild Member Join
  client.on("guildMemberAdd", async (member) => {
    try {
      const greetingsConfig = config.get("greetings");
      if (!greetingsConfig) return;

      // Join Channel Announcement
      if (greetingsConfig.joinChannelId && greetingsConfig.joinMessage) {
        const channel = await member.guild.channels.fetch(greetingsConfig.joinChannelId).catch(() => null);
        if (channel?.isTextBased()) {
          const text = formatGreeting(greetingsConfig.joinMessage, member);
          const embed = new EmbedBuilder()
            .setColor(0x00FF88) // Welcome Green
            .setDescription(text)
            .setThumbnail(member.user.displayAvatarURL({ extension: "png" }))
            .setTimestamp();

          await channel.send({ embeds: [embed] });
        }
      }

      // Welcome Direct Message
      if (greetingsConfig.joinDm) {
        const text = formatGreeting(greetingsConfig.joinDm, member);
        await member.send(text).catch(() => {
          // Direct messages may be closed by the user
        });
      }
    } catch (err) {
      console.error("GuildMemberAdd greeting error:", err.message);
    }
  });

  // 2. Guild Member Leave
  client.on("guildMemberRemove", async (member) => {
    try {
      const greetingsConfig = config.get("greetings");
      if (!greetingsConfig) return;

      if (greetingsConfig.leaveChannelId && greetingsConfig.leaveMessage) {
        const channel = await member.guild.channels.fetch(greetingsConfig.leaveChannelId).catch(() => null);
        if (channel?.isTextBased()) {
          const text = formatGreeting(greetingsConfig.leaveMessage, member);
          const embed = new EmbedBuilder()
            .setColor(0xf06a6a) // Leave Red
            .setDescription(text)
            .setThumbnail(member.user.displayAvatarURL({ extension: "png" }))
            .setTimestamp();

          await channel.send({ embeds: [embed] });
        }
      }
    } catch (err) {
      console.error("GuildMemberRemove greeting error:", err.message);
    }
  });
}
