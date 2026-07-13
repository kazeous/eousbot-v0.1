export async function cleanChannelMessages(channel, amount, options = {}) {
  // Fetch messages (limit max 100 per sweep)
  const limit = Math.min(amount, 100);
  const fetched = await channel.messages.fetch({ limit });

  const inviteRegex = /(discord\.(gg|io|me|li)\/.+|discord(app)?\.com\/invite\/.+)/i;
  const linkRegex = /https?:\/\/[^\s]+/i;

  const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

  // Filter messages based on advanced options
  const toDelete = fetched.filter(msg => {
    // 1. Skip messages older than 14 days (cannot bulk delete)
    if (msg.createdTimestamp < fourteenDaysAgo) return false;

    // 2. Filter by User ID if specified
    if (options.userId && msg.author.id !== options.userId) return false;

    // 3. Apply advanced string filter
    if (options.filter) {
      switch (options.filter) {
        case "only-bots":
          return msg.author.bot;
        case "only-users":
          return !msg.author.bot;
        case "contain-links":
          return linkRegex.test(msg.content);
        case "contain-invites":
          return inviteRegex.test(msg.content);
        case "text-only":
          return msg.content && msg.attachments.size === 0 && msg.embeds.length === 0;
        default:
          return true;
      }
    }

    return true;
  });

  if (toDelete.size === 0) {
    return 0;
  }

  // Delete messages
  const deleted = await channel.bulkDelete(toDelete, true);
  return deleted.size;
}
