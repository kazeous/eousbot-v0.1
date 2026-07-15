import { EmbedBuilder } from "discord.js";
import { config } from "../../config.js";
import {
  deleteStarboardMessageId,
  getStarboardMessageId,
  setStarboardMessageId
} from "./starboardStore.js";

export function registerStarboard(client) {
  client.on("messageReactionAdd", (reaction, user) => syncStarboard(reaction, user, client));
  client.on("messageReactionRemove", (reaction, user) => syncStarboard(reaction, user, client));
}

async function syncStarboard(reaction, user, client) {
  if (user?.bot || reaction.emoji.name !== "⭐") return;

  try {
    const starboardConfig = config.get("starboard");
    if (!starboardConfig?.enabled || !starboardConfig.channelId) return;
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    const message = reaction.message;
    if (!message.guild || message.author.bot || message.channelId === starboardConfig.channelId) return;

    const starboardChannel = await message.guild.channels.fetch(starboardConfig.channelId).catch(() => null);
    if (!starboardChannel?.isTextBased()) return;

    const storeKey = `${message.guild.id}:${message.id}`;
    const existingId = getStarboardMessageId(storeKey);
    const existingMessage = existingId
      ? await starboardChannel.messages.fetch(existingId).catch(() => null)
      : null;
    if (existingId && !existingMessage) deleteStarboardMessageId(storeKey);

    const starCount = reaction.count || 0;
    const threshold = starboardConfig.threshold || 3;
    if (starCount < threshold) {
      if (existingMessage) await existingMessage.delete().catch(() => {});
      deleteStarboardMessageId(storeKey);
      return;
    }

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

    const attachment = message.attachments.find(item => item.contentType?.startsWith("image/"));
    if (attachment) embed.setImage(attachment.url);

    const payload = {
      content: `⭐ **${starCount}** | ${message.channel}`,
      embeds: [embed]
    };
    if (existingMessage) {
      await existingMessage.edit(payload);
    } else {
      const created = await starboardChannel.send(payload);
      setStarboardMessageId(storeKey, created.id);
    }
  } catch (error) {
    console.error("Starboard reaction process error:", error.message);
  }
}
