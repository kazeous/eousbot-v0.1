import { EmbedBuilder } from "discord.js";
import { fetchCatFact } from "../features/utility/catFact.js";

export async function handleCatFactCommand(interaction) {
  try {
    await interaction.deferReply();
    const fact = await fetchCatFact();

    const embed = new EmbedBuilder()
      .setColor(0xFFA500) // Orange
      .setTitle("🐱 Cat Fact!")
      .setDescription(fact)
      .setFooter({ text: "Source: catfact.ninja" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error("CatFact command error:", err);
    await interaction.editReply("❌ Failed to retrieve cat fact. Meow!");
  }
}
