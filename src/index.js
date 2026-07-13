import "dotenv/config";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import { config } from "./config.js";
import { deployCommands } from "./deploy-commands.js";
import { startDashboardServer } from "./dashboard/server.js";

// Import features
import { registerSocialEmbeds } from "./features/socialEmbeds/index.js";
import { registerCodeHelper } from "./features/productivity/codeHelper.js";
import { registerVoiceHubs } from "./features/community/voiceHubs.js";
import { registerStarboard } from "./features/community/starboard.js";
import { registerSuggestions } from "./features/community/suggestions.js";
import { registerAutoThreader } from "./features/community/autoThreader.js";
import { registerRolePicker } from "./features/onboarding/rolePicker.js";
import { registerVerification } from "./features/onboarding/verification.js";

// Import command router
import { registerCommands } from "./commands/index.js";

// Ensure bot token exists
const token = config.get("token");
if (!token) {
  console.error("CRITICAL ERROR: DISCORD_TOKEN is missing from settings or .env.");
  process.exit(1);
}

// Setup Discord Client with all required intents & partials
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [
    Partials.Channel, 
    Partials.Message, 
    Partials.Reaction
  ]
});

// Once ready, register slash commands and start web server
client.once("ready", async () => {
  console.log(`Logged in as Discord Bot: ${client.user.tag}`);
  
  // Deploy slash commands automatically on boot
  const clientId = client.user.id;
  await deployCommands(clientId, token);

  // Initialize and run the Dashboard + health check server
  startDashboardServer(client);
});

// Handle global errors to prevent bot crashes
client.on("error", (error) => {
  console.error("Discord client socket error:", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

// Register all modular feature listeners
registerSocialEmbeds(client);
registerCodeHelper(client);
registerVoiceHubs(client);
registerStarboard(client);
registerSuggestions(client);
registerAutoThreader(client);
registerRolePicker(client);
registerVerification(client);

// Register commands dispatcher
registerCommands(client);

// Log in to Discord
await client.login(token);
