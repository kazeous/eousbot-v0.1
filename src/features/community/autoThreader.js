import { config } from "../../config.js";

export function registerAutoThreader(client) {
  client.on("messageCreate", async (message) => {
    try {
      if (message.author.bot || !message.guild) return;

      const threadConfig = config.get("autoThreader");
      if (!threadConfig || !threadConfig.enabled) return;

      const targetChannels = new Set(threadConfig.channels || []);
      if (!targetChannels.has(message.channelId)) return;

      // Ensure the channel supports threading
      if (!message.channel.threads) return;

      const authorName = message.member?.displayName || message.author.username;
      const threadTitle = `💬 Discussion - ${authorName}`;

      await message.startThread({
        name: threadTitle.substring(0, 99),
        autoArchiveDuration: 1440, // 24 hours
        reason: "Auto-Threader: channel conversation started"
      });
      
    } catch (error) {
      // Ignore errors if the bot doesn't have permissions or thread already exists
      console.error("Auto-Threader error:", error.message);
    }
  });
}
