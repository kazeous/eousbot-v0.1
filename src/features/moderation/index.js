import fs from "node:fs";
import path from "node:path";
import { EmbedBuilder } from "discord.js";
import { config } from "../../config.js";

const MODLOG_DIR = path.resolve("data");
const MODLOG_FILE = path.join(MODLOG_DIR, "modlog.json");

// Load existing logs
let cases = [];
if (fs.existsSync(MODLOG_FILE)) {
  try {
    cases = JSON.parse(fs.readFileSync(MODLOG_FILE, "utf-8"));
  } catch (err) {
    console.error("Failed to parse modlog.json:", err.message);
  }
}

function saveCases() {
  try {
    if (!fs.existsSync(MODLOG_DIR)) {
      fs.mkdirSync(MODLOG_DIR, { recursive: true });
    }
    fs.writeFileSync(MODLOG_FILE, JSON.stringify(cases, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save modlog.json:", err.message);
  }
}

export function getCasesForUser(guildId, userId) {
  return cases.filter(c => c.guildId === guildId && c.userId === userId);
}

export function getAllCases(guildId) {
  if (!guildId) return cases;
  return cases.filter(c => c.guildId === guildId);
}

export async function addCase(client, { guildId, userId, userTag, modId, modTag, type, reason, duration = null }) {
  const guildCases = cases.filter(c => c.guildId === guildId);
  const caseNumber = guildCases.length + 1;

  const newCase = {
    caseNumber,
    guildId,
    userId,
    userTag,
    modId,
    modTag,
    type, // WARN, TIMEOUT, KICK, BAN
    reason,
    duration, // in minutes (only for TIMEOUT/BAN duration)
    timestamp: Date.now()
  };

  cases.push(newCase);
  saveCases();

  // 1. Send warning to User via Direct Message
  try {
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    const targetUser = await client.users.fetch(userId).catch(() => null);

    if (targetUser && guild) {
      let actionText = "";
      if (type === "WARN") actionText = "warned";
      else if (type === "TIMEOUT") actionText = `timed out (muted) for ${duration} minutes`;
      else if (type === "KICK") actionText = "kicked";
      else if (type === "BAN") actionText = "permanently banned";

      const dmEmbed = new EmbedBuilder()
        .setColor(0xda373c) // Red
        .setTitle(`🛡️ Action Taken: ${type}`)
        .setDescription(`You have been **${actionText}** in **${guild.name}**.`)
        .addFields(
          { name: "Reason", value: reason },
          { name: "Case Number", value: `#${caseNumber}`, inline: true }
        )
        .setTimestamp();

      await targetUser.send({ embeds: [dmEmbed] }).catch(() => {
        // Direct messages may be closed by the user
      });
    }
  } catch (dmErr) {
    console.warn(`Could not send action DM to user ${userId}:`, dmErr.message);
  }

  // 2. Log to Modlog Channel
  try {
    const modConfig = config.get("moderation");
    if (modConfig?.logChannelId) {
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      const logChannel = await guild?.channels.fetch(modConfig.logChannelId).catch(() => null);
      
      if (logChannel?.isTextBased()) {
        let color = 0xe4a11b; // Warn/Timeout (Orange)
        if (type === "KICK") color = 0xf06a6a;
        if (type === "BAN") color = 0xda373c; // Ban (Red)

        const logEmbed = new EmbedBuilder()
          .setColor(color)
          .setTitle(`⚖️ Case #${caseNumber} | ${type}`)
          .setDescription(`**User:** <@${userId}> (${userTag})\n**Moderator:** <@${modId}> (${modTag})`)
          .addFields({ name: "Reason", value: reason })
          .setTimestamp();

        if (duration) {
          logEmbed.addFields({ name: "Duration", value: `${duration} minutes`, inline: true });
        }

        await logChannel.send({ embeds: [logEmbed] });
      }
    }
  } catch (logErr) {
    console.error("Failed to post message to moderation log channel:", logErr.message);
  }

  return caseNumber;
}
