import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from "discord.js";
import { config } from "../../config.js";

function isUnformattedCode(content) {
  if (content.length < 40) return null;
  if (content.includes("```") || content.includes("`")) return null;

  const lines = content.split("\n");
  if (lines.length < 3) return null;

  // Check for common error stacktrace patterns
  const stackTraceRegex = /^\s*at\s+[\w.<>:\-$]+(?:\([\w.\/\\\s\-:]+\)|:\d+:\d+)/m;
  const pythonTraceback = /Traceback \(most recent call last\):/i;
  
  if (stackTraceRegex.test(content) || pythonTraceback.test(content)) {
    return "error";
  }

  // Score lines for code indicators
  let codeScores = 0;
  const keywords = /\b(const|let|var|function|import|export|class|return|public|private|void|async|await|def|elif|import\s+\w+|from\s+\w+\s+import)\b/;
  const structure = /[;{}]\s*$/;
  const htmlTag = /<\/?[a-z][\s\S]*>/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (keywords.test(trimmed)) codeScores++;
    if (structure.test(trimmed)) codeScores++;
    if (htmlTag.test(trimmed)) codeScores++;
  }

  if (codeScores >= 2 || (lines.length >= 8 && codeScores >= 1)) {
    return "code";
  }

  return null;
}

export function registerCodeHelper(client) {
  client.on("messageCreate", async (message) => {
    try {
      if (message.author.bot) return;

      const prodConfig = config.get("productivity");
      if (!prodConfig || !prodConfig.codeHelperEnabled) return;

      const type = isUnformattedCode(message.content);
      if (!type) return;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`format_code_${message.id}`)
          .setLabel("✨ Auto-Format Code")
          .setStyle(ButtonStyle.Secondary)
      );

      const msgType = type === "error" ? "error stack trace" : "unformatted code snippet";
      const reply = await message.reply({
        content: `💡 **Tip:** It looks like you posted an ${msgType}. Click below to wrap it in a clean code block!`,
        components: [row]
      });

      // Simple button collector for this message
      const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000 // 1 minute active
      });

      collector.on("collect", async (interaction) => {
        if (interaction.customId !== `format_code_${message.id}`) return;

        // Auto-detect language
        let lang = "js";
        if (type === "error") lang = "tb"; // traceback/text
        else if (message.content.includes("def ") || message.content.includes("import pandas")) lang = "python";
        else if (message.content.includes("<html>") || message.content.includes("</div>")) lang = "html";
        else if (message.content.includes("body {") || message.content.includes("color:")) lang = "css";

        const formatted = `**Formatted snippet from ${message.author}:**\n\`\`\`${lang}\n${message.content}\n\`\`\``;

        await interaction.reply({
          content: formatted,
          allowedMentions: { parse: [] }
        });

        // Delete the helper prompt
        await reply.delete().catch(() => {});
        collector.stop();
      });

      collector.on("end", async (collected, reason) => {
        if (reason === "time" && reply) {
          // Remove button after timeout
          await reply.edit({ components: [] }).catch(() => {});
        }
      });

    } catch (err) {
      console.error("Code helper message error:", err);
    }
  });
}
