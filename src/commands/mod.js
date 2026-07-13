import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { warnUser, timeoutUser, kickUser, banUser } from "../features/moderation/rules.js";
import { getCasesForUser } from "../features/moderation/index.js";
import { cleanChannelMessages } from "../features/moderation/clean.js";

export async function handleModerationCommands(interaction, client) {
  const { commandName } = interaction;
  const guild = interaction.guild;
  const moderator = interaction.member;

  try {
    // 1. /warn
    if (commandName === "warn") {
      const targetUser = interaction.options.getUser("user");
      const reason = interaction.options.getString("reason") || "No reason provided.";

      await interaction.deferReply({ ephemeral: true });
      const caseNum = await warnUser(client, guild, targetUser, moderator, reason);

      return interaction.editReply(`✅ **Case #${caseNum}**: Warned <@${targetUser.id}>. Reason: *${reason}*`);
    }

    // 2. /timeout
    if (commandName === "timeout") {
      const targetUser = interaction.options.getUser("user");
      const duration = interaction.options.getInteger("duration");
      const reason = interaction.options.getString("reason") || "No reason provided.";

      await interaction.deferReply({ ephemeral: true });
      const caseNum = await timeoutUser(client, guild, targetUser, moderator, duration, reason);

      return interaction.editReply(`✅ **Case #${caseNum}**: Timed out <@${targetUser.id}> for ${duration} minutes. Reason: *${reason}*`);
    }

    // 3. /kick
    if (commandName === "kick") {
      const targetUser = interaction.options.getUser("user");
      const reason = interaction.options.getString("reason") || "No reason provided.";

      await interaction.deferReply({ ephemeral: true });
      const caseNum = await kickUser(client, guild, targetUser, moderator, reason);

      return interaction.editReply(`✅ **Case #${caseNum}**: Kicked <@${targetUser.id}>. Reason: *${reason}*`);
    }

    // 4. /ban
    if (commandName === "ban") {
      const targetUser = interaction.options.getUser("user");
      const deleteDays = interaction.options.getInteger("delete_messages_days") || 0;
      const reason = interaction.options.getString("reason") || "No reason provided.";

      await interaction.deferReply({ ephemeral: true });
      const caseNum = await banUser(client, guild, targetUser, moderator, deleteDays, reason);

      return interaction.editReply(`✅ **Case #${caseNum}**: Banned <@${targetUser.id}>. Deleted messages from past ${deleteDays} days. Reason: *${reason}*`);
    }

    // 5. /cases
    if (commandName === "cases") {
      const targetUser = interaction.options.getUser("user");
      const userCases = getCasesForUser(guild.id, targetUser.id);

      if (userCases.length === 0) {
        return interaction.reply({ content: `✅ <@${targetUser.id}> has a clean record. No cases found.`, ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`⚖️ Cases Log for ${targetUser.username}`)
        .setDescription(`Total cases found: **${userCases.length}**`)
        .setTimestamp();

      // Show top 10 cases to avoid hitting field limits
      userCases.slice(-10).forEach(c => {
        const date = new Date(c.timestamp).toLocaleDateString();
        let details = `**Type:** \`${c.type}\`\n**Moderator:** <@${c.modId}>\n**Reason:** ${c.reason}`;
        if (c.duration) details += `\n**Duration:** ${c.duration} mins`;
        embed.addFields({ name: `Case #${c.caseNumber} - ${date}`, value: details, inline: false });
      });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // 6. /clean
    if (commandName === "clean") {
      // Check moderator permission
      if (!moderator.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({ content: "❌ You do not have permission to run this command.", ephemeral: true });
      }

      const amount = interaction.options.getInteger("amount");
      const filter = interaction.options.getString("filter");
      const filterUser = interaction.options.getUser("user");

      await interaction.deferReply({ ephemeral: true });

      const deletedCount = await cleanChannelMessages(interaction.channel, amount, {
        filter,
        userId: filterUser?.id
      });

      return interaction.editReply(`🧹 Purged **${deletedCount}** messages from channel matching criteria.`);
    }

  } catch (err) {
    console.error("Moderation command execution failed:", err.message);
    const msg = `❌ Command failed: ${err.message}`;
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(msg).catch(() => {});
    } else {
      await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
    }
  }
}
