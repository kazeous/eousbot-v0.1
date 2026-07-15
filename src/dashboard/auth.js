import crypto from "node:crypto";
import { config } from "../config.js";

// In-memory session store: Map<sessionId, { user, expiresAt }>
const sessions = new Map();

// Session duration: 7 days
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

export function createOAuthState() {
  return crypto.randomBytes(32).toString("base64url");
}

export function getOAuthUrl(state) {
  const clientId = config.get("clientId");
  const redirectUri = config.get("redirectUri");
  
  if (!clientId || !redirectUri) {
    return null;
  }

  if (!state) return null;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify",
    state
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}

export async function exchangeCode(code) {
  const clientId = config.get("clientId");
  const clientSecret = config.get("clientSecret");
  const redirectUri = config.get("redirectUri");

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Discord OAuth credentials are not fully configured in settings or environment.");
  }

  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri
    })
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Failed to exchange OAuth code: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;

  // Fetch user info
  const userResponse = await fetch("https://discord.com/api/users/@me", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!userResponse.ok) {
    throw new Error("Failed to fetch user profile from Discord.");
  }

  const userData = await userResponse.json();
  return userData;
}

export function createSession(user) {
  const sessionId = crypto.randomUUID();
  const csrfToken = crypto.randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + SESSION_DURATION;
  sessions.set(sessionId, { user, csrfToken, expiresAt });
  return { sessionId, csrfToken, expiresAt };
}

export function getSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }

  return session;
}

export function verifySession(sessionId) {
  return getSession(sessionId)?.user || null;
}

export function destroySession(sessionId) {
  sessions.delete(sessionId);
}

// Clean up expired sessions periodically (every hour)
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(id);
    }
  }
}, 60 * 60 * 1000).unref();

// Middleware to protect API routes
export function requireAdmin(req, res, next) {
  const sessionId = req.cookies?.session_id;
  if (!sessionId) {
    return res.status(401).json({ error: "Unauthorized: No session cookie provided." });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized: Invalid or expired session." });
  }

  const adminIds = config.get("adminDiscordIds") || [];
  if (!adminIds.includes(session.user.id)) {
    return res.status(403).json({ error: "Forbidden: You are not authorized as an administrator." });
  }

  req.user = session.user;
  req.session = session;
  next();
}

export function requireCsrf(req, res, next) {
  const supplied = req.get("x-csrf-token") || "";
  const expected = req.session?.csrfToken || "";
  const valid = supplied.length === expected.length && supplied.length > 0 &&
    crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  if (!valid) return res.status(403).json({ error: "Invalid CSRF token." });
  next();
}

export function statesMatch(supplied, expected) {
  if (typeof supplied !== "string" || typeof expected !== "string" || supplied.length !== expected.length || !supplied) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}
