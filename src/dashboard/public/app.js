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
    "onboard-prompt": { path: "onboarding.verificationPrompt", type: "value" }
  };

  let originalSettings = null;
  let hasChanges = false;
  let statusPollInterval = null;

  // Initialize
  checkAuth();
  handleUrlErrors();
  setupNavigation();
  setupFormTracking();

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
      // Clean url parameters
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
        
        // Update header texts based on active tab
        updateHeaderText(targetTab);
      });
    });
  }

  function updateHeaderText(tabId) {
    const titles = {
      "tab-overview": { title: "Dashboard Overview", sub: "Real-time statistics and service health metrics." },
      "tab-media": { title: "Media & Embeds", sub: "Control link-embed overrides and webhook impersonations." },
      "tab-productivity": { title: "Productivity & AI", sub: "Manage AI summarizations and auto-code styling blocks." },
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
        populateForm(originalSettings);
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
      } else {
        val = element.value;
      }

      setValueByPath(payload, spec.path, val);
    }

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
