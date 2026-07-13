import { PermissionsBitField } from "discord.js";

export async function repostWithWebhook(message, content, client) {
  const channel = message.channel;
  const botMember = message.guild?.members.me;

  if (!botMember) {
    return false;
  }

  const permissions = channel.permissionsFor(botMember);
  const canManageWebhooks = permissions?.has(PermissionsBitField.Flags.ManageWebhooks);

  if (!canManageWebhooks || !channel.isTextBased()) {
    console.warn(`Cannot use webhook in channel ${channel.id}: missing ManageWebhooks permission.`);
    return false;
  }

  const webhook = await getOrCreateWebhook(channel, client);
  await webhook.send({
    content,
    username: message.member?.displayName || message.author.displayName || message.author.username,
    avatarURL: message.author.displayAvatarURL({ extension: "png", size: 128 }),
    allowedMentions: { parse: [] }
  });

  return true;
}

async function getOrCreateWebhook(channel, client) {
  const hooks = await channel.fetchWebhooks();
  const existing = hooks.find((hook) => hook.owner?.id === client.user.id && hook.name === "Kazbot Embed Reposter");

  if (existing) {
    return existing;
  }

  return channel.createWebhook({
    name: "Kazbot Embed Reposter",
    reason: "Repost links with embed-friendly domains"
  });
}

export async function safelyDeleteOriginal(message) {
  try {
    const botMember = message.guild?.members.me;
    const permissions = botMember ? message.channel.permissionsFor(botMember) : null;
    const canDelete = permissions?.has(PermissionsBitField.Flags.ManageMessages);

    if (!canDelete) {
      console.warn(`Cannot delete original message in channel ${message.channel.id}: missing ManageMessages.`);
      return;
    }

    await message.delete();
  } catch (error) {
    console.error("Failed to delete original message:", error);
  }
}
