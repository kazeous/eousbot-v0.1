import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export function registerRolePicker(client) {
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("role_toggle_")) return;
    if (!interaction.message.author || interaction.message.author.id !== client.user.id) return;

    try {
      const roleId = interaction.customId.replace("role_toggle_", "");
      const member = interaction.member;
      if (!member || !interaction.guild) return;

      const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
      if (!role) {
        return interaction.reply({
          content: "❌ That role could not be found on this server.",
          ephemeral: true
        });
      }

      // Check if bot can manage roles
      const botMember = interaction.guild.members.me;
      if (!botMember || !botMember.permissions.has("ManageRoles") || botMember.roles.highest.position <= role.position) {
        return interaction.reply({
          content: "❌ I do not have permission to manage this role. Please ensure my bot role is placed above this role in the server settings.",
          ephemeral: true
        });
      }

      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId, "Role Picker toggle");
        await interaction.reply({
          content: `✅ Removed the **${role.name}** role from you.`,
          ephemeral: true
        });
      } else {
        await member.roles.add(roleId, "Role Picker toggle");
        await interaction.reply({
          content: `✅ Added the **${role.name}** role to you.`,
          ephemeral: true
        });
      }
    } catch (err) {
      console.error("Role picker interaction error:", err);
      await interaction.reply({
        content: "❌ An error occurred while assigning your role.",
        ephemeral: true
      }).catch(() => {});
    }
  });
}

// Admin helper function to create a button role picker message
export async function createRolePickerMessage(channel, title, description, rolesConfig) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(title)
    .setDescription(description || "Click the buttons below to assign or remove roles:");

  const row = new ActionRowBuilder();
  
  // rolesConfig is an array of { roleId, label, emoji }
  for (const roleObj of rolesConfig.slice(0, 5)) { // Max 5 buttons per row
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`role_toggle_${roleObj.roleId}`)
        .setLabel(roleObj.label)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(roleObj.emoji || "🏷️")
    );
  }

  return await channel.send({
    embeds: [embed],
    components: [row]
  });
}
