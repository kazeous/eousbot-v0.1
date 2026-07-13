import { config } from "../../config.js";
import { timeoutUser, kickUser, banUser } from "../moderation/rules.js";
import { addCase } from "../moderation/index.js";

// In-memory track of recent message timestamps per user: Map<userId, Array<number>>
const messageTracker = new Map();

// In-memory track of automod violations per user: Map<userId, Array<number>>
const violationTracker = new Map();

export function registerAutoMod(client) {
  client.on("messageCreate", async (message) => {
    try {
      if (message.author.bot || !message.guild || !message.member) return;

      const automodConfig = config.get("automod");
      if (!automodConfig || !automodConfig.enabled) return;

      // Skip moderators with ManageMessages permissions
      if (message.member.permissions.has("ManageMessages")) return;

      const userId = message.author.id;
      const now = Date.now();
      let violated = false;
      let violationReason = "";

      // 1. Check Spam Rule
      if (automodConfig.spamLimit && automodConfig.spamWindow) {
        if (!messageTracker.has(userId)) {
          messageTracker.set(userId, []);
        }
        const userMsgs = messageTracker.get(userId);
        userMsgs.push(now);

        // Keep only timestamps within the spam window
        const cutoff = now - (automodConfig.spamWindow * 1000);
        const recentMsgs = userMsgs.filter(t => t > cutoff);
        if (recentMsgs.length === 0) {
          messageTracker.delete(userId);
        } else {
          messageTracker.set(userId, recentMsgs);
        }

        if (recentMsgs.length > automodConfig.spamLimit) {
          violated = true;
          violationReason = "Spamming messages";
        }
      }

      // 2. Check Caps Lock Limit
      if (!violated && automodConfig.capsLimit && message.content.length >= 10) {
        const alphabetic = message.content.replace(/[^a-zA-Z]/g, "");
        if (alphabetic.length >= 8) {
          const uppercase = message.content.replace(/[^A-Z]/g, "").length;
          const capsPct = (uppercase / alphabetic.length) * 100;
          if (capsPct > automodConfig.capsLimit) {
            violated = true;
            violationReason = "Excessive CAPITAL letters";
          }
        }
      }

      // 3. Check Banned Words
      if (!violated && automodConfig.bannedWords && automodConfig.bannedWords.length > 0) {
        const lowerContent = message.content.toLowerCase();
        const flaggedWord = automodConfig.bannedWords.find(word => 
          lowerContent.includes(word.toLowerCase().trim())
        );
        if (flaggedWord) {
          violated = true;
          violationReason = `Banned word usage`;
        }
      }

      // 4. Check Link / Invite Blocks
      if (!violated && automodConfig.blockInvites) {
        const inviteRegex = /(discord\.(gg|io|me|li)\/.+|discord(app)?\.com\/invite\/.+)/i;
        if (inviteRegex.test(message.content)) {
          violated = true;
          violationReason = "Posting Discord server invites";
        }
      }

      if (!violated && automodConfig.blockLinks) {
        const linkRegex = /https?:\/\/[^\s]+/i;
        if (linkRegex.test(message.content)) {
          violated = true;
          violationReason = "Posting links";
        }
      }

      // Handle AutoMod action if violated
      if (violated) {
        // Delete offending message
        await message.delete().catch(() => {});

        // Alert user in channel (delete warning after 5s)
        const warnReply = await message.channel.send(
          `⚠️ <@${userId}>, your message was removed. Reason: **${violationReason}**.`
        );
        setTimeout(() => warnReply.delete().catch(() => {}), 5000);

        // Record violation
        if (!violationTracker.has(userId)) {
          violationTracker.set(userId, []);
        }
        const userViolations = violationTracker.get(userId);
        userViolations.push(now);

        // Filter violations in current window
        const vCutoff = now - (automodConfig.violationsWindow * 1000);
        const recentViolations = userViolations.filter(t => t > vCutoff);
        if (recentViolations.length === 0) {
          violationTracker.delete(userId);
        } else {
          violationTracker.set(userId, recentViolations);
        }

        // Check if violations hit escalation threshold
        if (recentViolations.length >= automodConfig.violationsLimit) {
          // Escalation Action
          violationTracker.delete(userId); // Reset tracker
          
          const botMember = message.guild.members.me;
          const action = automodConfig.action || "TIMEOUT";
          const reason = `AutoMod: repeated rule violations (${violationReason})`;

          if (action === "TIMEOUT" && botMember.permissions.has("ModerateMembers")) {
            const minutes = automodConfig.actionDuration || 10;
            const durationMs = minutes * 60 * 1000;
            await message.member.timeout(durationMs, reason);
            
            await addCase(client, {
              guildId: message.guild.id,
              userId,
              userTag: message.author.tag,
              modId: client.user.id,
              modTag: "AutoMod",
              type: "TIMEOUT",
              reason,
              duration: minutes
            });

            await message.channel.send(`🚨 <@${userId}> has been timed out (muted) for **${minutes} minutes** due to repeated AutoMod violations.`);
          }
          else if (action === "KICK" && botMember.permissions.has("KickMembers")) {
            await message.member.kick(reason);

            await addCase(client, {
              guildId: message.guild.id,
              userId,
              userTag: message.author.tag,
              modId: client.user.id,
              modTag: "AutoMod",
              type: "KICK",
              reason
            });

            await message.channel.send(`🚨 <@${userId}> was kicked from the server due to repeated AutoMod violations.`);
          }
          else if (action === "BAN" && botMember.permissions.has("BanMembers")) {
            await message.member.ban({ reason });

            await addCase(client, {
              guildId: message.guild.id,
              userId,
              userTag: message.author.tag,
              modId: client.user.id,
              modTag: "AutoMod",
              type: "BAN",
              reason
            });

            await message.channel.send(`🚨 <@${userId}> has been permanently banned due to repeated AutoMod violations.`);
          }
        }
      }

    } catch (err) {
      console.error("AutoMod process error:", err.message);
    }
  });
}
export function cleanAutoModTrackers() {
  messageTracker.clear();
  violationTracker.clear();
}

// Periodic cleanup sweeper to prevent memory leakage from inactive users
setInterval(() => {
  const now = Date.now();
  const automodConfig = config.get("automod") || {};
  const spamCutoff = now - ((automodConfig.spamWindow || 5) * 1000);
  const violationCutoff = now - ((automodConfig.violationsWindow || 60) * 1000);

  for (const [userId, timestamps] of messageTracker.entries()) {
    const recent = timestamps.filter(t => t > spamCutoff);
    if (recent.length === 0) {
      messageTracker.delete(userId);
    } else {
      messageTracker.set(userId, recent);
    }
  }

  for (const [userId, timestamps] of violationTracker.entries()) {
    const recent = timestamps.filter(t => t > violationCutoff);
    if (recent.length === 0) {
      violationTracker.delete(userId);
    } else {
      violationTracker.set(userId, recent);
    }
  }
}, 10 * 60 * 1000).unref();

