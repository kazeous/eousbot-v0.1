import { PermissionsBitField } from "discord.js";
import { addCase } from "./index.js";

// Helper to check if moderator can target member
function validateHierarchy(guild, moderator, targetMember) {
  const botMember = guild.members.me;
  
  if (targetMember.id === botMember.id) {
    throw new Error("I cannot perform moderation actions on myself.");
  }

  if (targetMember.id === guild.ownerId) {
    throw new Error("I cannot perform moderation actions on the server owner.");
  }

  // Check bot position
  if (botMember.roles.highest.position <= targetMember.roles.highest.position) {
    throw new Error("I cannot moderate this user because my highest role is below or equal to theirs.");
  }

  // Check moderator position (skip if moderator is guild owner)
  if (moderator.id !== guild.ownerId && moderator.roles.highest.position <= targetMember.roles.highest.position) {
    throw new Error("You cannot moderate this user because your highest role is below or equal to theirs.");
  }

  return true;
}

export async function warnUser(client, guild, targetUser, moderator, reason) {
  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
  if (targetMember) {
    validateHierarchy(guild, moderator, targetMember);
  }

  const caseNum = await addCase(client, {
    guildId: guild.id,
    userId: targetUser.id,
    userTag: targetUser.tag,
    modId: moderator.id,
    modTag: moderator.user.tag,
    type: "WARN",
    reason
  });

  return caseNum;
}

export async function timeoutUser(client, guild, targetUser, moderator, durationMinutes, reason) {
  const targetMember = await guild.members.fetch(targetUser.id);
  if (!targetMember) {
    throw new Error("User is not currently in this server.");
  }

  validateHierarchy(guild, moderator, targetMember);

  const durationMs = durationMinutes * 60 * 1000;
  
  // Timeout in Discord.js v14
  await targetMember.timeout(durationMs, reason);

  const caseNum = await addCase(client, {
    guildId: guild.id,
    userId: targetUser.id,
    userTag: targetUser.tag,
    modId: moderator.id,
    modTag: moderator.user.tag,
    type: "TIMEOUT",
    reason,
    duration: durationMinutes
  });

  return caseNum;
}

export async function kickUser(client, guild, targetUser, moderator, reason) {
  const targetMember = await guild.members.fetch(targetUser.id);
  if (!targetMember) {
    throw new Error("User is not currently in this server.");
  }

  validateHierarchy(guild, moderator, targetMember);

  await targetMember.kick(reason);

  const caseNum = await addCase(client, {
    guildId: guild.id,
    userId: targetUser.id,
    userTag: targetUser.tag,
    modId: moderator.id,
    modTag: moderator.user.tag,
    type: "KICK",
    reason
  });

  return caseNum;
}

export async function banUser(client, guild, targetUser, moderator, deleteMessagesDays, reason) {
  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
  
  if (targetMember) {
    validateHierarchy(guild, moderator, targetMember);
  }

  const deleteMessageSeconds = deleteMessagesDays * 24 * 60 * 60;

  await guild.bans.create(targetUser.id, {
    deleteMessageSeconds,
    reason
  });

  const caseNum = await addCase(client, {
    guildId: guild.id,
    userId: targetUser.id,
    userTag: targetUser.tag,
    modId: moderator.id,
    modTag: moderator.user.tag,
    type: "BAN",
    reason
  });

  return caseNum;
}
