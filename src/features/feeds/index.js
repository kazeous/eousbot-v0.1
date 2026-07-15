import { EmbedBuilder } from "discord.js";
import { config } from "../../config.js";
import { fetchPublicText } from "../../utils/safeFetch.js";

// Keep track of which items we've already announced: Map<feedKey, Set<itemId>>
const announcedItems = new Map();

// Keep track of Twitch live states: Map<username, boolean>
const twitchLiveStatus = new Map();

// Twitch token caching variables
let cachedTwitchToken = null;
let twitchTokenExpiresAt = 0;
let pollInProgress = false;

function cacheKey(type, source, channelId) {
  return `${type}:${source}:${channelId}`;
}

function rememberItem(cache, itemId) {
  cache.add(itemId);
  while (cache.size > 500) cache.delete(cache.values().next().value);
}

config.on("update", () => {
  announcedItems.clear();
  twitchLiveStatus.clear();
});

async function getTwitchToken(clientId, clientSecret) {
  if (cachedTwitchToken && Date.now() < twitchTokenExpiresAt) {
    return cachedTwitchToken;
  }

  try {
    const res = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" })
    });
    if (!res.ok) {
      throw new Error(`Twitch auth endpoint returned status ${res.status}`);
    }
    const data = await res.json();
    cachedTwitchToken = data.access_token;
    // Expire 1 minute early as a buffer
    twitchTokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000;
    return cachedTwitchToken;
  } catch (err) {
    console.error("Twitch OAuth token fetch failed:", err.message);
    return null;
  }
}

export function startFeedsPoller(client) {
  const poll = async () => {
    if (pollInProgress) return;
    pollInProgress = true;
    try {
      const feedsConfig = config.get("feeds");
      if (!feedsConfig) return;
      if (feedsConfig.reddit?.length) await pollRedditFeeds(client, feedsConfig.reddit);
      if (feedsConfig.youtube?.length) await pollYouTubeFeeds(client, feedsConfig.youtube);
      if (feedsConfig.twitch?.length) await pollTwitchFeeds(client, feedsConfig.twitch);
      if (feedsConfig.rss?.length) await pollRssFeeds(client, feedsConfig.rss);
    } catch (err) {
      console.error("Feeds poller error:", err.message);
    } finally {
      pollInProgress = false;
    }
  };

  void poll();
  // Poll every 2 minutes
  setInterval(poll, 2 * 60 * 1000).unref();
}

// REDDIT FEED
async function pollRedditFeeds(client, redditFeeds) {
  for (const feed of redditFeeds) {
    const { subreddit, channelId } = feed;
    if (!subreddit || !channelId) continue;

    try {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel) continue;

      const res = await fetch(`https://www.reddit.com/r/${encodeURIComponent(subreddit)}/new.json?limit=5`, {
        headers: { "User-Agent": "Eousbot/0.1 Feed Poller" },
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) continue;

      const data = await res.json();
      const posts = data.data?.children || [];

      const key = cacheKey("reddit", subreddit, channelId);
      if (!announcedItems.has(key)) {
        // Initialize cache on first run with current post IDs to avoid spamming historical posts
        announcedItems.set(key, new Set(posts.map(p => p.data.id)));
        continue;
      }

      const cache = announcedItems.get(key);

      for (const post of posts.reverse()) {
        const pData = post.data;
        if (cache.has(pData.id)) continue;

        rememberItem(cache, pData.id);

        const embed = new EmbedBuilder()
          .setColor(0xff4500) // Reddit Orange
          .setTitle(pData.title.substring(0, 250))
          .setURL(`https://reddit.com${pData.permalink}`)
          .setAuthor({ name: `r/${subreddit} • Posted by u/${pData.author}` })
          .setDescription(pData.selftext ? pData.selftext.substring(0, 300) + (pData.selftext.length > 300 ? "..." : "") : null)
          .setTimestamp(pData.created_utc * 1000);

        if (pData.url && (pData.url.endsWith(".jpg") || pData.url.endsWith(".png") || pData.url.endsWith(".gif"))) {
          embed.setImage(pData.url);
        }

        await channel.send({
          content: `📢 **New post on r/${subreddit}!**`,
          embeds: [embed],
          allowedMentions: { parse: [] }
        });
      }
    } catch (err) {
      console.error(`Failed to poll Reddit feed r/${subreddit}:`, err.message);
    }
  }
}

// YOUTUBE RSS FEED
async function pollYouTubeFeeds(client, youtubeFeeds) {
  for (const feed of youtubeFeeds) {
    const { youtubeChannelId, channelId } = feed;
    if (!youtubeChannelId || !channelId) continue;

    try {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel) continue;

      const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(youtubeChannelId)}`, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;

      const xml = await res.text();
      
      // Simple Regex XML parser for entries
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
      let match;
      const entries = [];

      while ((match = entryRegex.exec(xml)) !== null) {
        const entryXml = match[1];
        const videoIdMatch = entryXml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
        const titleMatch = entryXml.match(/<title>([^<]+)<\/title>/);
        const authorMatch = entryXml.match(/<name>([^<]+)<\/name>/);
        const publishedMatch = entryXml.match(/<published>([^<]+)<\/published>/);

        if (videoIdMatch && titleMatch) {
          entries.push({
            id: videoIdMatch[1],
            title: titleMatch[1],
            author: authorMatch ? authorMatch[1] : "YouTube Creator",
            published: publishedMatch ? new Date(publishedMatch[1]).getTime() : Date.now()
          });
        }
      }

      const key = cacheKey("youtube", youtubeChannelId, channelId);
      if (!announcedItems.has(key)) {
        announcedItems.set(key, new Set(entries.map(e => e.id)));
        continue;
      }

      const cache = announcedItems.get(key);

      // Post new uploads (oldest first)
      for (const entry of entries.reverse()) {
        if (cache.has(entry.id)) continue;

        rememberItem(cache, entry.id);

        await channel.send({
          content: `🎥 **${entry.author}** uploaded a new video!\n**${entry.title}**\nhttps://www.youtube.com/watch?v=${entry.id}`,
          allowedMentions: { parse: [] }
        });
      }
    } catch (err) {
      console.error(`Failed to poll YouTube feed ${youtubeChannelId}:`, err.message);
    }
  }
}

// TWITCH LIVE STREAM FEED
async function pollTwitchFeeds(client, twitchFeeds) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return;

  const accessToken = await getTwitchToken(clientId, clientSecret);
  if (!accessToken) return;

  for (const feed of twitchFeeds) {
    const { twitchUsername, channelId } = feed;
    if (!twitchUsername || !channelId) continue;

    try {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel) continue;

      const query = new URLSearchParams({ user_login: twitchUsername });
      const res = await fetch(`https://api.twitch.tv/helix/streams?${query}`, {
        signal: AbortSignal.timeout(15000),
        headers: {
          "Client-ID": clientId,
          "Authorization": `Bearer ${accessToken}`
        }
      });

      if (!res.ok) continue;
      const data = await res.json();
      const streams = data.data || [];
      const isLive = streams.length > 0;

      const statusKey = cacheKey("twitch", twitchUsername, channelId);
      const wasLive = twitchLiveStatus.get(statusKey) || false;
      twitchLiveStatus.set(statusKey, isLive);

      // If streamer just went live
      if (isLive && !wasLive) {
        const streamInfo = streams[0];
        const embed = new EmbedBuilder()
          .setColor(0x6441a5) // Twitch Purple
          .setTitle(streamInfo.title)
          .setURL(`https://twitch.tv/${twitchUsername}`)
          .setAuthor({ name: `${streamInfo.user_name} is now LIVE on Twitch!` })
          .addFields(
            { name: "Game", value: streamInfo.game_name || "Just Chatting", inline: true },
            { name: "Viewers", value: String(streamInfo.viewer_count), inline: true }
          )
          .setImage(streamInfo.thumbnail_url.replace("{width}", "1280").replace("{height}", "720"))
          .setTimestamp();

        await channel.send({
          content: `👾 **Live Alert!** https://twitch.tv/${twitchUsername}`,
          embeds: [embed],
          allowedMentions: { parse: [] }
        });
      }
    } catch (err) {
      console.error(`Failed to poll Twitch stream ${twitchUsername}:`, err.message);
    }
  }
}

// GENERIC RSS XML FEED
async function pollRssFeeds(client, rssFeeds) {
  for (const feed of rssFeeds) {
    const { url, channelId } = feed;
    if (!url || !channelId) continue;

    try {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel) continue;

      const xml = await fetchPublicText(url);
      
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      const items = [];

      while ((match = itemRegex.exec(xml)) !== null) {
        const itemXml = match[1];
        
        // CDATA extracts
        const titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
        const linkMatch = itemXml.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/);
        const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);

        if (titleMatch && linkMatch) {
          items.push({
            title: titleMatch[1].trim(),
            link: linkMatch[1].trim(),
            pubDate: pubDateMatch ? new Date(pubDateMatch[1]).getTime() : Date.now()
          });
        }
      }

      const key = cacheKey("rss", url, channelId);
      if (!announcedItems.has(key)) {
        announcedItems.set(key, new Set(items.map(i => i.link)));
        continue;
      }

      const cache = announcedItems.get(key);

      for (const item of items.reverse()) {
        if (cache.has(item.link)) continue;

        rememberItem(cache, item.link);

        const embed = new EmbedBuilder()
          .setColor(0x00FF88)
          .setTitle(item.title)
          .setURL(item.link)
          .setTimestamp(item.pubDate);

        await channel.send({
          content: `📰 **New Feed Article Published!**`,
          embeds: [embed],
          allowedMentions: { parse: [] }
        });
      }
    } catch (err) {
      console.error(`Failed to poll RSS feed ${url}:`, err.message);
    }
  }
}
