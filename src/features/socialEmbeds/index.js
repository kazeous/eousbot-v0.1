import { EmbedBuilder } from "discord.js";
import { config } from "../../config.js";
import { repostWithWebhook, safelyDeleteOriginal } from "../../utils/webhooks.js";

// Helper to remove trailing punctuation from links
function trimTrailingPunctuation(value) {
  return value.replace(/[),.!?]+$/g, "");
}

export function registerSocialEmbeds(client) {
  client.on("messageCreate", async (message) => {
    try {
      // Ignore bots
      if (message.author.bot) return;

      const embedConfig = config.get("socialEmbeds");
      if (!embedConfig || !embedConfig.enabled) return;

      // Check if channel is watched
      const watched = new Set(embedConfig.watchedChannels || []);
      if (watched.size === 0 || !watched.has(message.channelId)) {
        return;
      }

      // Check for links
      const urlPattern = /https?:\/\/[^\s<>()]+/gi;
      let match;
      let content = message.content;
      let changed = false;
      const promises = [];

      // We'll collect links to replace
      const linksToReplace = [];

      while ((match = urlPattern.exec(message.content)) !== null) {
        const original = trimTrailingPunctuation(match[0]);
        try {
          const parsed = new URL(original);
          const hostname = parsed.hostname.toLowerCase();

          // 1. Twitter / X
          if (
            [
              "twitter.com",
              "www.twitter.com",
              "mobile.twitter.com",
              "x.com",
              "www.x.com"
            ].includes(hostname)
          ) {
            parsed.hostname = embedConfig.twitterDomain || "fxtwitter.com";
            linksToReplace.push({ original, replacement: parsed.toString() });
            changed = true;
          }
          // 2. Instagram
          else if (["instagram.com", "www.instagram.com"].includes(hostname)) {
            // Keep reels/posts only
            if (parsed.pathname.startsWith("/p/") || parsed.pathname.startsWith("/reel/") || parsed.pathname.startsWith("/reels/")) {
              parsed.hostname = embedConfig.instagramDomain || "ddinstagram.com";
              linksToReplace.push({ original, replacement: parsed.toString() });
              changed = true;
            }
          }
          // 3. TikTok
          else if (["tiktok.com", "www.tiktok.com", "vm.tiktok.com"].includes(hostname)) {
            parsed.hostname = embedConfig.tiktokDomain || "tnktok.com";
            linksToReplace.push({ original, replacement: parsed.toString() });
            changed = true;
          }
          // 4. Reddit
          else if (["reddit.com", "www.reddit.com", "old.reddit.com"].includes(hostname)) {
            parsed.hostname = embedConfig.redditDomain || "rxddit.com";
            linksToReplace.push({ original, replacement: parsed.toString() });
            changed = true;
          }
          // 5. GitHub PR/Issues (Card Expander)
          else if (hostname === "github.com") {
            const pathParts = parsed.pathname.split("/").filter(Boolean);
            // Expected: /owner/repo/issues/num or /owner/repo/pull/num
            if (
              pathParts.length === 4 &&
              (pathParts[2] === "issues" || pathParts[2] === "pull")
            ) {
              const [owner, repo, type, number] = pathParts;
              promises.push(expandGitHubLink(message.channel, owner, repo, type, number, original));
            }
          }
        } catch (err) {
          // Skip invalid URLs
        }
      }

      // If we have GitHub links to expand
      if (promises.length > 0) {
        await Promise.all(promises);
      }

      // If standard media links changed
      if (changed) {
        const safeToDeleteOriginal = message.attachments.size === 0 &&
          message.stickers.size === 0 && !message.reference?.messageId;
        let finalContent = content;
        for (const repl of linksToReplace) {
          finalContent = finalContent.replace(repl.original, repl.replacement);
        }

        // Send replacement
        if (embedConfig.deleteOriginal && safeToDeleteOriginal && embedConfig.useWebhook && message.inGuild()) {
          const sent = await repostWithWebhook(message, finalContent, client);
          if (sent) {
            await safelyDeleteOriginal(message);
            return;
          }
        }

        const text = embedConfig.includeOriginalAuthor
          ? `${message.author} ${finalContent}`
          : finalContent;

        await message.channel.send({
          content: text,
          allowedMentions: { users: [message.author.id], roles: [], parse: [] }
        });

        if (embedConfig.deleteOriginal && safeToDeleteOriginal) {
          await safelyDeleteOriginal(message);
        } else if (embedConfig.deleteOriginal && !safeToDeleteOriginal) {
          console.warn(`Preserved message ${message.id} because deleting it would lose attachments, stickers, or reply context.`);
        }
      }
    } catch (error) {
      console.error("Failed to process social embed link:", error);
    }
  });
}

// Fetches issue/PR details from GitHub public API and posts a clean Embed
async function expandGitHubLink(channel, owner, repo, type, number, originalUrl) {
  try {
    const apiType = type === "pull" ? "pulls" : "issues";
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${number}`, {
      headers: { "User-Agent": "Kazbot-Discord-Bot" }
    });

    if (!res.ok) return;

    const data = await res.json();
    const isPR = data.pull_request !== undefined;
    
    // Embed Styling
    const color = data.state === "open" ? 0x238636 : 0x8250df; // Green for open, Purple for closed/merged
    const typeLabel = isPR ? "Pull Request" : "Issue";
    
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`[${owner}/${repo}] ${typeLabel} #${number}: ${data.title}`)
      .setURL(originalUrl)
      .setDescription(data.body ? data.body.substring(0, 240) + (data.body.length > 240 ? "..." : "") : "No description provided.")
      .setAuthor({
        name: data.user.login,
        iconURL: data.user.avatar_url,
        url: data.user.html_url
      })
      .addFields(
        { name: "Status", value: data.state.toUpperCase(), inline: true },
        { name: "Comments", value: String(data.comments), inline: true }
      )
      .setTimestamp(new Date(data.created_at));

    if (data.labels && data.labels.length > 0) {
      const labelsText = data.labels.map(l => `\`${l.name}\``).join(" ");
      embed.addFields({ name: "Labels", value: labelsText, inline: false });
    }

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error("GitHub link expander error:", error);
  }
}
