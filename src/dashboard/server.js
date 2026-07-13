import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { config } from "../config.js";
import {
  getOAuthUrl,
  exchangeCode,
  createSession,
  destroySession,
  verifySession,
  requireAdmin
} from "./auth.js";

export function startDashboardServer(discordClient) {
  const app = express();
  const port = config.get("healthPort") || 3000;

  app.use(express.json());
  app.use(cookieParser());

  // Serve static files from public directory
  const publicPath = path.resolve("src/dashboard/public");
  app.use(express.static(publicPath));

  // 1. Health check for Coolify
  app.get("/health", (_req, res) => {
    res.type("text/plain");
    res.send(discordClient.isReady() ? "ok" : "starting");
  });

  // 2. OAuth redirect route
  app.get("/api/auth/discord", (_req, res) => {
    const oauthUrl = getOAuthUrl();
    if (!oauthUrl) {
      return res.status(500).json({ error: "Discord OAuth is not configured on the bot server." });
    }
    res.redirect(oauthUrl);
  });

  // 3. OAuth Callback route
  app.get("/api/auth/discord/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) {
      return res.redirect("/?error=no_code_provided");
    }

    try {
      const userData = await exchangeCode(code);
      
      // Check admin status
      const adminIds = config.get("adminDiscordIds") || [];
      if (!adminIds.includes(userData.id)) {
        console.warn(`User ${userData.username} (${userData.id}) tried to log in, but is not in ADMIN_DISCORD_IDS.`);
        return res.redirect("/?error=forbidden");
      }

      const { sessionId, expiresAt } = createSession(userData);
      
      // Set secure HTTP-only cookie
      res.cookie("session_id", sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        expires: new Date(expiresAt)
      });

      res.redirect("/");
    } catch (err) {
      console.error("Auth callback error:", err);
      res.redirect(`/?error=${encodeURIComponent(err.message)}`);
    }
  });

  // 4. Current user details
  app.get("/api/auth/me", (req, res) => {
    const sessionId = req.cookies?.session_id;
    if (!sessionId) {
      return res.status(401).json({ error: "Not logged in" });
    }

    const user = verifySession(sessionId);
    if (!user) {
      return res.status(401).json({ error: "Session expired" });
    }

    res.json({
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar,
      displayName: user.global_name || user.username
    });
  });

  // 5. Logout route
  app.post("/api/auth/logout", (req, res) => {
    const sessionId = req.cookies?.session_id;
    if (sessionId) {
      destroySession(sessionId);
    }
    res.clearCookie("session_id");
    res.json({ success: true });
  });

  // 6. Bot Status API (Admin protected)
  app.get("/api/status", requireAdmin, (req, res) => {
    const uptimeSeconds = Math.floor(discordClient.uptime / 1000) || 0;
    
    res.json({
      status: discordClient.isReady() ? "Online" : "Connecting",
      uptime: formatDuration(uptimeSeconds),
      ping: discordClient.ws.ping !== -1 ? `${discordClient.ws.ping}ms` : "N/A",
      guilds: discordClient.guilds.cache.size,
      users: discordClient.users.cache.size,
      channelsCount: discordClient.channels.cache.size,
      memory: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`
    });
  });

  // 7. Config routes (Admin protected)
  app.get("/api/settings", requireAdmin, (_req, res) => {
    const settings = config.getAll();
    // Do not leak secrets to dashboard frontend inputs
    const sanitized = { ...settings };
    sanitized.token = sanitized.token ? "••••••••••••••••" : "";
    sanitized.clientSecret = sanitized.clientSecret ? "••••••••••••••••" : "";
    res.json(sanitized);
  });

  app.post("/api/settings", requireAdmin, (req, res) => {
    try {
      const updated = config.update(req.body);
      
      // Do not leak secrets back
      const sanitized = { ...updated };
      sanitized.token = sanitized.token ? "••••••••••••••••" : "";
      sanitized.clientSecret = sanitized.clientSecret ? "••••••••••••••••" : "";
      
      res.json({ success: true, settings: sanitized });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Fallback to index.html for single-page routing
  app.get("*", (_req, res) => {
    res.sendFile(path.join(publicPath, "index.html"));
  });

  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`Web Dashboard Server listening on port ${port}`);
  });

  return server;
}

function formatDuration(seconds) {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(" ");
}
