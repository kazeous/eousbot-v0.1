document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const loginContainer = document.getElementById("login-container");
  const dashboardContainer = document.getElementById("dashboard-container");
  const loginError = document.getElementById("login-error");
  const userAvatar = document.getElementById("user-avatar");
  const userName = document.getElementById("user-name");
  const btnLogout = document.getElementById("btn-logout");
  const toast = document.getElementById("toast");
  
  const pageTitle = document.getElementById("page-title");
  const pageSubtitle = document.getElementById("page-subtitle");
  const botStatusText = document.getElementById("bot-status-text");
  
  // Stats
  const statUptime = document.getElementById("stat-uptime");
  const statPing = document.getElementById("stat-ping");
  const statGuilds = document.getElementById("stat-guilds");
  const statMemory = document.getElementById("stat-memory");
  
  // Form & Fields
  const settingsForm = document.getElementById("settings-form");
  const unsavedLabel = document.getElementById("unsaved-label");
  const btnDiscard = document.getElementById("btn-discard");
  
  // Mod cases log body
  const modCasesBody = document.getElementById("mod-cases-body");

  // Feed inputs and list displays
  const feedLists = {
    reddit: {
      containerId: "reddit-feeds-list",
      addBtnId: "btn-add-reddit",
      inputs: { subreddit: "add-reddit-subreddit", channelId: "add-reddit-channel" }
    },
    youtube: {
      containerId: "youtube-feeds-list",
      addBtnId: "btn-add-youtube",
      inputs: { youtubeChannelId: "add-youtube-id", channelId: "add-youtube-channel" }
    },
    twitch: {
      containerId: "twitch-feeds-list",
      addBtnId: "btn-add-twitch",
      inputs: { twitchUsername: "add-twitch-user", channelId: "add-twitch-channel" }
    },
    rss: {
      containerId: "rss-feeds-list",
      addBtnId: "btn-add-rss",
      inputs: { url: "add-rss-url", channelId: "add-rss-channel" }
    }
  };

  // Field mappings to match config.js nested structure
  const fields = {
    "toggle-social-global": { path: "socialEmbeds.enabled", type: "checkbox" },
    "embed-twitter-domain": { path: "socialEmbeds.twitterDomain", type: "value" },
    "watched-channels": { path: "socialEmbeds.watchedChannels", type: "array" },
    "embed-delete-original": { path: "socialEmbeds.deleteOriginal", type: "checkbox" },
    "embed-use-webhook": { path: "socialEmbeds.useWebhook", type: "checkbox" },
    "embed-include-author": { path: "socialEmbeds.includeOriginalAuthor", type: "checkbox" },
    
    "prod-summarizer-enabled": { path: "productivity.summarizerEnabled", type: "checkbox" },
    "prod-code-enabled": { path: "productivity.codeHelperEnabled", type: "checkbox" },
    
    "toggle-voice-global": { path: "voiceHubs.enabled", type: "checkbox" },
    "voice-hubs": { path: "voiceHubs.hubChannels", type: "array" },
    "voice-room-format": { path: "voiceHubs.roomFormat", type: "value" },
    
    "toggle-starboard-global": { path: "starboard.enabled", type: "checkbox" },
    "starboard-channel": { path: "starboard.channelId", type: "value" },
    "starboard-threshold": { path: "starboard.threshold", type: "number" },
    
    "auto-threader-channels": { path: "autoThreader.channels", type: "array" },
    
    "onboard-role-id": { path: "onboarding.verifiedRoleId", type: "value" },
    "onboard-welcome-channel": { path: "onboarding.welcomeChannelId", type: "value" },
    "onboard-prompt": { path: "onboarding.verificationPrompt", type: "value" },

    // NEW: Moderation settings
    "mod-log-channel": { path: "moderation.logChannelId", type: "value" },

    // NEW: AutoMod settings
    "automod-enabled": { path: "automod.enabled", type: "checkbox" },
    "automod-spam-limit": { path: "automod.spamLimit", type: "number" },
    "automod-spam-window": { path: "automod.spamWindow", type: "number" },
    "automod-caps-limit": { path: "automod.capsLimit", type: "number" },
    "automod-banned-words": { path: "automod.bannedWords", type: "array" },
    "automod-block-invites": { path: "automod.blockInvites", type: "checkbox" },
    "automod-block-links": { path: "automod.blockLinks", type: "checkbox" },
    "automod-violations-limit": { path: "automod.violationsLimit", type: "number" },
    "automod-violations-window": { path: "automod.violationsWindow", type: "number" },
    "automod-action": { path: "automod.action", type: "value" },
    "automod-action-duration": { path: "automod.actionDuration", type: "number" },

    // NEW: Greetings settings
    "greet-join-channel": { path: "greetings.joinChannelId", type: "value" },
    "greet-leave-channel": { path: "greetings.leaveChannelId", type: "value" },
    "greet-join-msg": { path: "greetings.joinMessage", type: "value" },
    "greet-leave-msg": { path: "greetings.leaveMessage", type: "value" },
    "greet-join-dm": { path: "greetings.joinDm", type: "value" }
  };

  let originalSettings = null;
  let activeFeeds = { reddit: [], youtube: [], twitch: [], rss: [] };
  let hasChanges = false;
  let statusPollInterval = null;

  // Initialize
  checkAuth();
  handleUrlErrors();
  setupNavigation();
  setupFormTracking();
  setupFeedListeners();

  // Authentication check
  async function checkAuth() {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const user = await res.json();
        showDashboard(user);
      } else {
        showLogin();
      }
    } catch (err) {
      showLogin();
    }
  }

  function handleUrlErrors() {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) {
      loginError.textContent = `Authentication failed: ${err}`;
      loginError.classList.remove("hidden");
      window.history.replaceState({}, document.title, "/");
    }
  }

  function showLogin() {
    loginContainer.classList.remove("hidden");
    dashboardContainer.classList.add("hidden");
    if (statusPollInterval) clearInterval(statusPollInterval);
  }

  function showDashboard(user) {
    loginContainer.classList.add("hidden");
    dashboardContainer.classList.remove("hidden");
    
    userAvatar.src = user.avatar 
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
      : "https://cdn.discordapp.com/embed/avatars/0.png";
    userName.textContent = user.displayName;

    loadSettings();
    pollBotStatus();
    statusPollInterval = setInterval(pollBotStatus, 10000);
  }

  // Logout
  btnLogout.addEventListener("click", async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        showToast("Logged out successfully");
        showLogin();
      }
    } catch (err) {
      showToast("Failed to logout", true);
    }
  });

  // Tab Navigation
  function setupNavigation() {
    const navLinks = document.querySelectorAll(".nav-link");
    const panels = document.querySelectorAll(".tab-panel");

    navLinks.forEach(link => {
      link.addEventListener("click", () => {
        const targetTab = link.getAttribute("data-tab");
        
        navLinks.forEach(l => l.classList.remove("active"));
        panels.forEach(p => p.classList.remove("active"));
        
        link.classList.add("active");
        document.getElementById(targetTab).classList.add("active");
        
        updateHeaderText(targetTab);

        // Fetch logs if opening moderation tab
        if (targetTab === "tab-moderation") {
          loadModCases();
        }
      });
    });
  }

  function updateHeaderText(tabId) {
    const titles = {
      "tab-overview": { title: "Dashboard Overview", sub: "Real-time statistics and service health metrics." },
      "tab-media": { title: "Media & Embeds", sub: "Control link-embed overrides and webhook impersonations." },
      "tab-productivity": { title: "Productivity & AI", sub: "Manage AI summarizations and auto-code styling blocks." },
      "tab-moderation": { title: "Moderation & AutoMod", sub: "Inspect infraction cases and configure automated moderation filters." },
      "tab-feeds": { title: "Content Feeds", sub: "Manage automated stream alerts, new uploads, and RSS streams." },
      "tab-greetings": { title: "Greetings & Welcome", sub: "Set up welcoming channel announcements and direct messages." },
      "tab-community": { title: "Community Features", sub: "Configure starboard rooms, auto-threaders, and join-to-create channels." },
      "tab-onboarding": { title: "Onboarding & Roles", sub: "Customize server entry routes and custom verification embeds." }
    };
    
    const info = titles[tabId];
    if (info) {
      pageTitle.textContent = info.title;
      pageSubtitle.textContent = info.sub;
    }
  }

  // Load Settings
  async function loadSettings() {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        originalSettings = await res.json();
        
        // Populate static inputs
        populateForm(originalSettings);

        // Copy feeds arrays
        activeFeeds = {
          reddit: JSON.parse(JSON.stringify(originalSettings.feeds?.reddit || [])),
          youtube: JSON.parse(JSON.stringify(originalSettings.feeds?.youtube || [])),
          twitch: JSON.parse(JSON.stringify(originalSettings.feeds?.twitch || [])),
          rss: JSON.parse(JSON.stringify(originalSettings.feeds?.rss || []))
        };

        // Render feed lists
        renderFeedsLists();
        resetChanges();
      } else {
        showToast("Failed to fetch settings from API", true);
      }
    } catch (err) {
      showToast("Error loading settings", true);
    }
  }

  function getValueByPath(obj, path) {
    return path.split(".").reduce((acc, part) => acc && acc[part], obj);
  }

  function setValueByPath(obj, path, value) {
    const parts = path.split(".");
    const last = parts.pop();
    const nested = parts.reduce((acc, part) => {
      if (!acc[part]) acc[part] = {};
      return acc[part];
    }, obj);
    nested[last] = value;
  }

  function populateForm(data) {
    for (const [elementId, spec] of Object.entries(fields)) {
      const element = document.getElementById(elementId);
      if (!element) continue;

      const rawVal = getValueByPath(data, spec.path);
      
      if (spec.type === "checkbox") {
        element.checked = !!rawVal;
      } else if (spec.type === "array") {
        element.value = Array.isArray(rawVal) ? rawVal.join(", ") : "";
      } else {
        element.value = rawVal !== undefined ? rawVal : "";
      }
    }
  }

  // Form Tracking & Changes
  function setupFormTracking() {
    settingsForm.addEventListener("input", checkFormChanges);
    settingsForm.addEventListener("change", checkFormChanges);
    
    btnDiscard.addEventListener("click", () => {
      if (originalSettings) {
        populateForm(originalSettings);
        activeFeeds = {
          reddit: JSON.parse(JSON.stringify(originalSettings.feeds?.reddit || [])),
          youtube: JSON.parse(JSON.stringify(originalSettings.feeds?.youtube || [])),
          twitch: JSON.parse(JSON.stringify(originalSettings.feeds?.twitch || [])),
          rss: JSON.parse(JSON.stringify(originalSettings.feeds?.rss || []))
        };
        renderFeedsLists();
        resetChanges();
        showToast("Changes discarded");
      }
    });

    settingsForm.addEventListener("submit", saveSettings);
  }

  function checkFormChanges() {
    if (!originalSettings) return;

    let changed = false;
    for (const [elementId, spec] of Object.entries(fields)) {
      const element = document.getElementById(elementId);
      if (!element) continue;

      const origVal = getValueByPath(originalSettings, spec.path);
      let currentVal;

      if (spec.type === "checkbox") {
        currentVal = element.checked;
      } else if (spec.type === "array") {
        currentVal = element.value.split(",").map(s => s.trim()).filter(Boolean);
      } else if (spec.type === "number") {
        currentVal = parseInt(element.value, 10);
        if (isNaN(currentVal)) currentVal = 0;
      } else {
        currentVal = element.value;
      }

      if (spec.type === "array") {
        const origArr = Array.isArray(origVal) ? origVal : [];
        if (origArr.length !== currentVal.length || !origArr.every((v, i) => v === currentVal[i])) {
          changed = true;
          break;
        }
      } else {
        if (origVal !== currentVal) {
          changed = true;
          break;
        }
      }
    }

    // Also check feeds arrays changes
    if (!changed) {
      const feedTypes = ["reddit", "youtube", "twitch", "rss"];
      for (const type of feedTypes) {
        const orig = originalSettings.feeds?.[type] || [];
        const curr = activeFeeds[type] || [];
        if (orig.length !== curr.length || JSON.stringify(orig) !== JSON.stringify(curr)) {
          changed = true;
          break;
        }
      }
    }

    hasChanges = changed;
    if (hasChanges) {
      unsavedLabel.classList.remove("hidden");
    } else {
      unsavedLabel.classList.add("hidden");
    }
  }

  function resetChanges() {
    hasChanges = false;
    unsavedLabel.classList.add("hidden");
  }

  // Load Mod cases log list
  async function loadModCases() {
    try {
      const res = await fetch("/api/moderation/cases");
      if (res.ok) {
        const cases = await res.json();
        
        if (cases.length === 0) {
          modCasesBody.innerHTML = `<tr><td colspan="6" class="table-empty">No moderation actions have been recorded yet.</td></tr>`;
          return;
        }

        // Show newest cases first
        modCasesBody.innerHTML = cases.reverse().map(c => {
          const date = new Date(c.timestamp).toLocaleString();
          let details = c.reason;
          if (c.duration) details += ` (${c.duration} mins)`;

          return `
            <tr>
              <td><strong>#${c.caseNumber}</strong></td>
              <td>${c.userTag} <small class="helper-text">(${c.userId})</small></td>
              <td><span class="role-badge" style="color: ${c.type === "BAN" ? "var(--error)" : "var(--primary)"}">${c.type}</span></td>
              <td>${c.modTag}</td>
              <td>${details}</td>
              <td>${date}</td>
            </tr>
          `;
        }).join("");
      }
    } catch (err) {
      modCasesBody.innerHTML = `<tr><td colspan="6" class="table-empty" style="color: var(--error)">Failed to retrieve moderation log history.</td></tr>`;
    }
  }

  // Content Feeds rendering and form logic
  function setupFeedListeners() {
    // Add Reddit Feed
    document.getElementById(feedLists.reddit.addBtnId).addEventListener("click", () => {
      const subredditInput = document.getElementById(feedLists.reddit.inputs.subreddit);
      const channelInput = document.getElementById(feedLists.reddit.inputs.channelId);
      const sub = subredditInput.value.trim();
      const chan = channelInput.value.trim();
      
      if (sub && chan) {
        activeFeeds.reddit.push({ subreddit: sub, channelId: chan });
        subredditInput.value = "";
        channelInput.value = "";
        renderFeedsLists();
        checkFormChanges();
      }
    });

    // Add YouTube Feed
    document.getElementById(feedLists.youtube.addBtnId).addEventListener("click", () => {
      const ytInput = document.getElementById(feedLists.youtube.inputs.youtubeChannelId);
      const channelInput = document.getElementById(feedLists.youtube.inputs.channelId);
      const ytId = ytInput.value.trim();
      const chan = channelInput.value.trim();
      
      if (ytId && chan) {
        activeFeeds.youtube.push({ youtubeChannelId: ytId, channelId: chan });
        ytInput.value = "";
        channelInput.value = "";
        renderFeedsLists();
        checkFormChanges();
      }
    });

    // Add Twitch Feed
    document.getElementById(feedLists.twitch.addBtnId).addEventListener("click", () => {
      const twInput = document.getElementById(feedLists.twitch.inputs.twitchUsername);
      const channelInput = document.getElementById(feedLists.twitch.inputs.channelId);
      const twUser = twInput.value.trim();
      const chan = channelInput.value.trim();
      
      if (twUser && chan) {
        activeFeeds.twitch.push({ twitchUsername: twUser, channelId: chan });
        twInput.value = "";
        channelInput.value = "";
        renderFeedsLists();
        checkFormChanges();
      }
    });

    // Add RSS Feed
    document.getElementById(feedLists.rss.addBtnId).addEventListener("click", () => {
      const urlInput = document.getElementById(feedLists.rss.inputs.url);
      const channelInput = document.getElementById(feedLists.rss.inputs.channelId);
      const url = urlInput.value.trim();
      const chan = channelInput.value.trim();
      
      if (url && chan) {
        activeFeeds.rss.push({ url, channelId: chan });
        urlInput.value = "";
        channelInput.value = "";
        renderFeedsLists();
        checkFormChanges();
      }
    });
  }

  function renderFeedsLists() {
    const feedTypes = ["reddit", "youtube", "twitch", "rss"];
    
    feedTypes.forEach(type => {
      const container = document.getElementById(feedLists[type].containerId);
      const list = activeFeeds[type] || [];

      if (list.length === 0) {
        container.innerHTML = `<div class="table-empty">No active feeds. Add one below!</div>`;
        return;
      }

      container.innerHTML = list.map((item, index) => {
        let titleInfo = "";
        if (type === "reddit") titleInfo = `r/${item.subreddit}`;
        else if (type === "youtube") titleInfo = `Channel ID: ${item.youtubeChannelId}`;
        else if (type === "twitch") titleInfo = `twitch.tv/${item.twitchUsername}`;
        else if (type === "rss") titleInfo = item.url;

        return `
          <div class="feed-item">
            <div class="feed-item-info">
              <span class="feed-item-val">${titleInfo}</span>
              <span class="helper-text">➡️ Channel: ${item.channelId}</span>
            </div>
            <button type="button" class="btn-remove-feed" data-type="${type}" data-index="${index}">❌ Remove</button>
          </div>
        `;
      }).join("");
    });

    // Hook delete buttons
    document.querySelectorAll(".btn-remove-feed").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const type = btn.getAttribute("data-type");
        const index = parseInt(btn.getAttribute("data-index"), 10);
        
        activeFeeds[type].splice(index, 1);
        renderFeedsLists();
        checkFormChanges();
      });
    });
  }

  // Save Settings
  async function saveSettings(e) {
    e.preventDefault();
    if (!hasChanges) return;

    const payload = {};
    for (const [elementId, spec] of Object.entries(fields)) {
      const element = document.getElementById(elementId);
      if (!element) continue;

      let val;
      if (spec.type === "checkbox") {
        val = element.checked;
      } else if (spec.type === "array") {
        val = element.value.split(",").map(s => s.trim()).filter(Boolean);
      } else if (spec.type === "number") {
        val = parseInt(element.value, 10);
        if (isNaN(val)) val = 0;
      } else {
        val = element.value;
      }

      setValueByPath(payload, spec.path, val);
    }

    // Attach feeds arrays
    payload.feeds = activeFeeds;

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result = await res.json();
        originalSettings = result.settings;
        populateForm(originalSettings);
        activeFeeds = {
          reddit: JSON.parse(JSON.stringify(originalSettings.feeds?.reddit || [])),
          youtube: JSON.parse(JSON.stringify(originalSettings.feeds?.youtube || [])),
          twitch: JSON.parse(JSON.stringify(originalSettings.feeds?.twitch || [])),
          rss: JSON.parse(JSON.stringify(originalSettings.feeds?.rss || []))
        };
        renderFeedsLists();
        resetChanges();
        showToast("Settings saved and live-reloaded!");
      } else {
        const err = await res.json();
        showToast(`Save failed: ${err.error}`, true);
      }
    } catch (err) {
      showToast("Network error while saving settings", true);
    }
  }

  // Poll status
  async function pollBotStatus() {
    try {
      const res = await fetch("/api/status");
      if (res.ok) {
        const status = await res.json();
        
        botStatusText.textContent = status.status;
        const dot = document.querySelector(".status-dot");
        dot.className = "status-dot";
        if (status.status === "Online") {
          dot.classList.add("online");
        } else {
          dot.classList.add("connecting");
        }

        statUptime.textContent = status.uptime;
        statPing.textContent = status.ping;
        statGuilds.textContent = status.guilds;
        statMemory.textContent = status.memory;
      }
    } catch (err) {
      botStatusText.textContent = "Offline";
      const dot = document.querySelector(".status-dot");
      dot.className = "status-dot";
      statUptime.textContent = "N/A";
      statPing.textContent = "N/A";
    }
  }

  // Toast Helper
  let toastTimeout;
  function showToast(message, isError = false) {
    clearTimeout(toastTimeout);
    toast.textContent = message;
    toast.className = "toast";
    if (isError) toast.classList.add("error");
    toast.classList.remove("hidden");
    
    toastTimeout = setTimeout(() => {
      toast.classList.add("hidden");
    }, 4000);
  }
});
