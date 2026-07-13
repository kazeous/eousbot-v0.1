import { EmbedBuilder } from "discord.js";
import { config } from "../../config.js";

export function registerStarboard(client) {
  client.on("messageReactionAdd", async (reaction, user) => {
    // We only care about Star reactions
    if (reaction.emoji.name !== "⭐") return;

    try {
      const starboardConfig = config.get("starboard");
      if (!starboardConfig || !starboardConfig.enabled || !starboardConfig.channelId) return;

      // Handle partials
      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();

      const message = reaction.message;
      if (!message.guild) return;

      // Ignore messages in the starboard channel itself to prevent loops
      if (message.channelId === starboardConfig.channelId) return;

      // Ignore bot messages
      if (message.author.bot) return;

      // Count stars
      const starCount = reaction.count;
      const threshold = starboardConfig.threshold || 3;

      if (starCount >= threshold) {
        const starboardChannel = await message.guild.channels.fetch(starboardConfig.channelId).catch(() => null);
        if (!starboardChannel || !starboardChannel.isTextBased()) {
          console.warn(`Starboard channel ${starboardConfig.channelId} not found or not text-based.`);
          return;
        }

        // Check if message is already starboarded
        const starboardMessages = await starboardChannel.messages.fetch({ limit: 50 });
        const existingMessage = starboardMessages.find(m => 
          m.embeds.length > 0 && 
          m.embeds[0].footer?.text?.includes(`Message ID: ${message.id}`)
        );

        const embed = new EmbedBuilder()
          .setColor(0xffac33)
          .setAuthor({
            name: message.member?.displayName || message.author.username,
            iconURL: message.author.displayAvatarURL({ extension: "png" })
          })
          .setDescription(message.content || "_[No text content]_")
          .addFields(
            { name: "Channel", value: `${message.channel}`, inline: true },
            { name: "Jump Link", value: `[Go to message](${message.url})`, inline: true }
          )
          .setFooter({ text: `⭐ ${starCount} | Message ID: ${message.id}` })
          .setTimestamp(message.createdAt);

        // Attach first image if present
        const attachment = message.attachments.find(a => a.contentType?.startsWith("image/"));
        if (attachment) {
          embed.setImage(attachment.url);
        }

        const msgContent = `⭐ **${starCount}** | ${message.channel}`;

        if (existingMessage) {
          await existingMessage.edit({
            content: msgContent,
            embeds: [embed]
          });
        } else {
          await starboardChannel.send({
            content: msgContent,
            embeds: [embed]
          });
        }
      }
    } catch (error) {
      console.error("Starboard reaction process error:", error);
    }
  });
}
