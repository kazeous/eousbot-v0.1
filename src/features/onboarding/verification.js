import { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle 
} from "discord.js";
import { config } from "../../config.js";

export function registerVerification(client) {
  client.on("interactionCreate", async (interaction) => {
    // 1. Handle Click "Verify" Button
    if (interaction.isButton() && interaction.customId === "verify_request") {
      try {
        const modal = new ModalBuilder()
          .setCustomId("verify_modal")
          .setTitle("Verification Portal");

        const nameInput = new TextInputBuilder()
          .setCustomId("verify_name")
          .setLabel("What should we call you?")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("Preferred nickname")
          .setMaxLength(32)
          .setRequired(true);

        const reasonInput = new TextInputBuilder()
          .setCustomId("verify_reason")
          .setLabel("Why are you joining this community?")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("Tell us a bit about your interests!")
          .setMaxLength(250)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(nameInput),
          new ActionRowBuilder().addComponents(reasonInput)
        );

        await interaction.showModal(modal);
      } catch (err) {
        console.error("Failed to open verification modal:", err);
      }
      return;
    }

    // 2. Handle Modal Submission
    if (interaction.isModalSubmit() && interaction.customId === "verify_modal") {
      try {
        const nickname = interaction.fields.getTextInputValue("verify_name");
        const reason = interaction.fields.getTextInputValue("verify_reason");
        const member = interaction.member;
        const guild = interaction.guild;
        
        if (!member || !guild) return;

        const onboardConfig = config.get("onboarding");
        const roleId = onboardConfig.verifiedRoleId;

        if (!roleId) {
          return interaction.reply({
            content: "❌ Verification is currently disabled (no verified role is set in configuration).",
            ephemeral: true
          });
        }

        const role = await guild.roles.fetch(roleId).catch(() => null);
        if (!role) {
          return interaction.reply({
            content: "❌ The verification role could not be found.",
            ephemeral: true
          });
        }

        // Apply role
        await member.roles.add(role, `Verification successful. Nickname: ${nickname}`);
        
        // Attempt to set nickname (optional, might fail if user is server owner)
        await member.setNickname(nickname).catch(() => {
          // Ignore prefix/hierarchy failures
        });

        await interaction.reply({
          content: `🎉 Thank you, ${nickname}! You have been verified and now have access to the server!`,
          ephemeral: true
        });

        // Welcome Announcement
        if (onboardConfig.welcomeChannelId) {
          const welcomeChannel = await guild.channels.fetch(onboardConfig.welcomeChannelId).catch(() => null);
          if (welcomeChannel?.isTextBased()) {
            const welcomeEmbed = new EmbedBuilder()
              .setColor(0x00FF88)
              .setTitle(`👋 Welcome, ${nickname}!`)
              .setDescription(`${interaction.user} has verified successfully. Welcome to **${guild.name}**!`)
              .addFields({ name: "Interests", value: reason })
              .setThumbnail(interaction.user.displayAvatarURL({ extension: "png" }))
              .setTimestamp();

            await welcomeChannel.send({ embeds: [welcomeEmbed] });
          }
        }
      } catch (err) {
        console.error("Verification modal submission error:", err);
        await interaction.reply({
          content: "❌ An error occurred during the verification process. Please try again.",
          ephemeral: true
        }).catch(() => {});
      }
    }
  });
}

// Admin helper function to post verification card
export async function createVerificationMessage(channel) {
  const onboardConfig = config.get("onboarding");
  
  const embed = new EmbedBuilder()
    .setColor(0x00FF88)
    .setTitle("🛡️ Verification Required")
    .setDescription(onboardConfig.verificationPrompt || "Click the button below to verify your account and unlock roles.");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("verify_request")
      .setLabel("Verify Account")
      .setStyle(ButtonStyle.Success)
      .setEmoji("✅")
  );

  return await channel.send({
    embeds: [embed],
    components: [row]
  });
}
