import "dotenv/config";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import { config } from "./config.js";
import { deployCommands } from "./deploy-commands.js";
import { startDashboardServer } from "./dashboard/server.js";

// Import existing features
import { registerSocialEmbeds } from "./features/socialEmbeds/index.js";
import { registerCodeHelper } from "./features/productivity/codeHelper.js";
import { registerVoiceHubs } from "./features/community/voiceHubs.js";
import { registerVoiceControls } from "./features/community/voiceControl.js";
import { registerStarboard } from "./features/community/starboard.js";
import { registerSuggestions } from "./features/community/suggestions.js";
import { registerAutoThreader } from "./features/community/autoThreader.js";
import { registerRolePicker } from "./features/onboarding/rolePicker.js";
import { registerVerification } from "./features/onboarding/verification.js";

// Import new features
import { registerAutoMod } from "./features/automod/automod.js";
import { registerWelcomeGreetings } from "./features/feeds/welcome.js";
import { startFeedsPoller } from "./features/feeds/index.js";

// Import command router
import { registerCommands } from "./commands/index.js";

// Ensure bot token exists
const token = config.get("token");
if (!token) {
  console.error("CRITICAL ERROR: DISCORD_TOKEN is missing from settings or .env.");
  process.exit(1);
}

// Setup Discord Client with all required intents & partials
// Added GuildMembers (for welcomes), and GuildPresences/VoiceStates
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers, // Required for join/leave welcomes
    GatewayIntentBits.GuildPresences // Required for the room owner's current-game name option
  ],
  partials: [
    Partials.Channel, 
    Partials.Message, 
    Partials.Reaction,
    Partials.GuildMember // Required to capture partial joins/leaves
  ]
});

// Once ready, register slash commands and start web server
client.once("ready", async () => {
  console.log(`Logged in as Discord Bot: ${client.user.tag}`);
  
  // Deploy slash commands automatically on boot
  const clientId = client.user.id;
  await deployCommands(clientId, token);

  // Start Content Feeds Poller Loops
  startFeedsPoller(client);
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
registerVoiceControls(client);
registerStarboard(client);
registerSuggestions(client);
registerAutoThreader(client);
registerRolePicker(client);
registerVerification(client);

// Register new feature listeners
registerAutoMod(client);
registerWelcomeGreetings(client);

// Register commands dispatcher
registerCommands(client);

// Start health/dashboard before login so orchestration can observe a
// deliberate "starting" state while Discord is reconnecting.
startDashboardServer(client);

// Log in to Discord
await client.login(token);
