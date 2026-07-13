import { EmbedBuilder } from "discord.js";
import { config } from "../config.js";
import { createSuggestion } from "../features/community/suggestions.js";
import { summarizeMessages } from "../features/productivity/summarizer.js";
import { createRolePickerMessage } from "../features/onboarding/rolePicker.js";
import { createVerificationMessage } from "../features/onboarding/verification.js";

export function registerCommands(client) {
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand() && !interaction.isMessageContextMenuCommand()) return;

    const { commandName } = interaction;

    try {
      // 1. /suggest Command
      if (commandName === "suggest") {
        const suggConfig = config.get("suggestions");
        const channelId = suggConfig?.channelId;
        
        const channel = channelId 
          ? await interaction.guild.channels.fetch(channelId).catch(() => null)
          : interaction.channel;

        if (!channel || !channel.isTextBased()) {
          return interaction.reply({
            content: "❌ Suggestions channel is not configured or not valid.",
            ephemeral: true
          });
        }

        const title = interaction.options.getString("title");
        const description = interaction.options.getString("description");
        
        await createSuggestion(channel, title, description, interaction.user);
        
        return interaction.reply({
          content: `✅ Your suggestion has been posted to ${channel}!`,
          ephemeral: true
        });
      }

      // 2. /suggestion Commands (Admin)
      if (commandName === "suggestion") {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "status") {
          const messageId = interaction.options.getString("message_id");
          const newStatus = interaction.options.getString("status");
          const reason = interaction.options.getString("reason") || "No reason provided.";

          // Search the channel for this suggestion card
          // Start with suggestion channel
          const suggConfig = config.get("suggestions");
          const targetChannelId = suggConfig.channelId || interaction.channelId;
          const channel = await interaction.guild.channels.fetch(targetChannelId).catch(() => null);

          if (!channel) {
            return interaction.reply({ content: "❌ Target suggestions channel not found.", ephemeral: true });
          }

          const msg = await channel.messages.fetch(messageId).catch(() => null);
          if (!msg || msg.embeds.length === 0) {
            return interaction.reply({ content: "❌ Suggestion message not found. Make sure the ID is correct.", ephemeral: true });
          }

          const embed = msg.embeds[0];
          
          // Determine status color & label
          let color = 0x5865F2; // Default blurple
          if (newStatus === "Approved") color = 0x238636; // Green
          else if (newStatus === "Rejected") color = 0xda373c; // Red
          else if (newStatus === "In Progress") color = 0xe4a11b; // Orange
          else if (newStatus === "Implemented") color = 0x00FF88; // Bright green

          // Copy and update fields
          const updatedEmbed = EmbedBuilder.from(embed)
            .setColor(color)
            .setFields(
              { name: "Status", value: `🔹 **${newStatus}**\n*Reason: ${reason}*`, inline: true },
              { name: "Suggested by", value: embed.fields[1].value, inline: true }
            );

          await msg.edit({ embeds: [updatedEmbed] });

          return interaction.reply({
            content: `✅ Suggestion status updated to **${newStatus}**.`,
            ephemeral: true
          });
        }
      }

      // 3. /summarize & Summarize Discussion Context Command
      if (commandName === "summarize" || commandName === "Summarize Discussion") {
        await interaction.deferReply({ ephemeral: true });
        
        let limit = 50;
        if (interaction.isChatInputCommand()) {
          limit = interaction.options.getInteger("limit") || 50;
        }

        const summaryResult = await summarizeMessages(interaction.channel, limit);
        
        return interaction.editReply({
          content: summaryResult
        });
      }

      // 4. /rolepicker Command (Admin)
      if (commandName === "rolepicker") {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === "create") {
          const channel = interaction.options.getChannel("channel");
          const title = interaction.options.getString("title");
          const desc = interaction.options.getString("description") || "";
          
          const rolesConfig = [];
          for (let i = 1; i <= 3; i++) {
            const role = interaction.options.getRole(`role${i}`);
            const label = interaction.options.getString(`label${i}`);
            if (role && label) {
              rolesConfig.push({ roleId: role.id, label });
            }
          }

          if (rolesConfig.length === 0) {
            return interaction.reply({
              content: "❌ You must specify at least one role and its label.",
              ephemeral: true
            });
          }

          await createRolePickerMessage(channel, title, desc, rolesConfig);

          return interaction.reply({
            content: `✅ Role picker message has been sent to ${channel}!`,
            ephemeral: true
          });
        }
      }

      // 5. /verifysetup Command (Admin)
      if (commandName === "verifysetup") {
        const channel = interaction.options.getChannel("channel");
        
        await createVerificationMessage(channel);

        return interaction.reply({
          content: `✅ Verification welcome message has been sent to ${channel}!`,
          ephemeral: true
        });
      }

    } catch (err) {
      console.error(`Command ${commandName} execution error:`, err);
      const errorMsg = { content: "❌ An error occurred while executing this command.", ephemeral: true };
      
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorMsg).catch(() => {});
      } else {
        await interaction.reply(errorMsg).catch(() => {});
      }
    }
  });
}
