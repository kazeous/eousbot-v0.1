import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from "discord.js";
import { config } from "../../config.js";

// Helper to serialize metadata into hidden markdown comment
function serializeMetadata(upvoters, downvoters) {
  const data = { up: upvoters, down: downvoters };
  return `\n\n[//]: # (${JSON.stringify(data)})`;
}

// Helper to deserialize metadata from string
function deserializeMetadata(content) {
  const match = content.match(/\[\/\/\]: # \((.+?)\)/);
  if (!match) return { up: [], down: [] };
  try {
    return JSON.parse(match[1]);
  } catch {
    return { up: [], down: [] };
  }
}

export function registerSuggestions(client) {
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    
    const isUpvote = interaction.customId === "suggest_upvote";
    const isDownvote = interaction.customId === "suggest_downvote";
    
    if (!isUpvote && !isDownvote) return;

    try {
      const message = interaction.message;
      const embed = message.embeds[0];
      if (!embed) return;

      const userId = interaction.user.id;
      const metadata = deserializeMetadata(embed.description || "");
      
      let { up: upvoters, down: downvoters } = metadata;

      if (isUpvote) {
        if (upvoters.includes(userId)) {
          // Remove upvote (toggle)
          upvoters = upvoters.filter(id => id !== userId);
        } else {
          // Add upvote, remove downvote if present
          upvoters.push(userId);
          downvoters = downvoters.filter(id => id !== userId);
        }
      } else if (isDownvote) {
        if (downvoters.includes(userId)) {
          // Remove downvote (toggle)
          downvoters = downvoters.filter(id => id !== userId);
        } else {
          // Add downvote, remove upvote if present
          downvoters.push(userId);
          upvoters = upvoters.filter(id => id !== userId);
        }
      }

      // Update embed
      const cleanDesc = (embed.description || "").replace(/\n\n\[\/\/\]: # \(.+?\)/, "");
      const newMetadata = serializeMetadata(upvoters, downvoters);
      
      const updatedEmbed = EmbedBuilder.from(embed)
        .setDescription(cleanDesc + newMetadata);

      // Update buttons
      const updatedRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("suggest_upvote")
          .setLabel(`👍 Upvote (${upvoters.length})`)
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("suggest_downvote")
          .setLabel(`👎 Downvote (${downvoters.length})`)
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.update({
        embeds: [updatedEmbed],
        components: [updatedRow]
      });

    } catch (err) {
      console.error("Suggestion vote interaction error:", err);
    }
  });
}

// Function to post a new suggestion card
export async function createSuggestion(channel, title, description, author) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2) // Blurple
    .setTitle(`💡 Suggestion: ${title}`)
    .setDescription(description + serializeMetadata([], []))
    .addFields(
      { name: "Status", value: "📊 Up for voting", inline: true },
      { name: "Suggested by", value: `${author}`, inline: true }
    )
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("suggest_upvote")
      .setLabel("👍 Upvote (0)")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("suggest_downvote")
      .setLabel("👎 Downvote (0)")
      .setStyle(ButtonStyle.Danger)
  );

  const msg = await channel.send({
    embeds: [embed],
    components: [row]
  });

  // Create discussion thread
  await msg.startThread({
    name: `Discuss: ${title.substring(0, 50)}`,
    autoArchiveDuration: 1440, // 24 hours
    reason: "Discussion thread for suggestion"
  }).catch(err => {
    console.error("Failed to auto-create discussion thread for suggestion:", err.message);
  });

  return msg;
}
