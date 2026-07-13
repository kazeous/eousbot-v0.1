import { 
  REST, 
  Routes, 
  SlashCommandBuilder, 
  ContextMenuCommandBuilder, 
  ApplicationCommandType, 
  PermissionFlagsBits 
} from "discord.js";

export async function deployCommands(clientId, token) {
  if (!clientId || !token) {
    console.warn("Skipping Slash Commands deployment: missing CLIENT_ID or TOKEN.");
    return;
  }

  const commands = [
    // 1. /suggest
    new SlashCommandBuilder()
      .setName("suggest")
      .setDescription("Submit a suggestion to the community suggestions board")
      .addStringOption(option => 
        option.setName("title")
          .setDescription("A short, clear title for your suggestion")
          .setRequired(true)
          .setMaxLength(100)
      )
      .addStringOption(option => 
        option.setName("description")
          .setDescription("Detailed explanation of your idea")
          .setRequired(true)
          .setMaxLength(1500)
      ),

    // 2. /suggestion status
    new SlashCommandBuilder()
      .setName("suggestion")
      .setDescription("Manage suggestions (Admins only)")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addSubcommand(sub =>
        sub.setName("status")
          .setDescription("Update the status of a suggestion")
          .addStringOption(option =>
            option.setName("message_id")
              .setDescription("The message ID of the suggestion card")
              .setRequired(true)
          )
          .addStringOption(option =>
            option.setName("status")
              .setDescription("Choose the status")
              .setRequired(true)
              .addChoices(
                { name: "Approved", value: "Approved" },
                { name: "Rejected", value: "Rejected" },
                { name: "In Progress", value: "In Progress" },
                { name: "Implemented", value: "Implemented" }
              )
          )
          .addStringOption(option =>
            option.setName("reason")
              .setDescription("Provide a reason for this update")
              .setRequired(false)
          )
      ),

    // 3. /summarize
    new SlashCommandBuilder()
      .setName("summarize")
      .setDescription("Summarize the recent conversation in this channel")
      .addIntegerOption(option =>
        option.setName("limit")
          .setDescription("Number of recent messages to look at (10-100, default 50)")
          .setRequired(false)
          .setMinValue(10)
          .setMaxValue(100)
      ),

    // 4. Message Context Menu: Summarize Discussion
    new ContextMenuCommandBuilder()
      .setName("Summarize Discussion")
      .setType(ApplicationCommandType.Message),

    // 5. /rolepicker create
    new SlashCommandBuilder()
      .setName("rolepicker")
      .setDescription("Setup self-assignable buttons for roles (Admins only)")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addSubcommand(sub =>
        sub.setName("create")
          .setDescription("Post a role picker dashboard in a channel")
          .addChannelOption(option =>
            option.setName("channel")
              .setDescription("Where to post the picker message")
              .setRequired(true)
          )
          .addStringOption(option =>
            option.setName("title")
              .setDescription("Title of the role picker panel")
              .setRequired(true)
          )
          .addRoleOption(option =>
            option.setName("role1")
              .setDescription("First role to assign")
              .setRequired(true)
          )
          .addStringOption(option =>
            option.setName("label1")
              .setDescription("Label for the first role button")
              .setRequired(true)
          )
          .addRoleOption(option =>
            option.setName("role2")
              .setDescription("Second role to assign")
              .setRequired(false)
          )
          .addStringOption(option =>
            option.setName("label2")
              .setDescription("Label for the second role button")
              .setRequired(false)
          )
          .addRoleOption(option =>
            option.setName("role3")
              .setDescription("Third role to assign")
              .setRequired(false)
          )
          .addStringOption(option =>
            option.setName("label3")
              .setDescription("Label for the third role button")
              .setRequired(false)
          )
          .addStringOption(option =>
            option.setName("description")
              .setDescription("Optional description text above the buttons")
              .setRequired(false)
          )
      ),

    // 6. /verifysetup
    new SlashCommandBuilder()
      .setName("verifysetup")
      .setDescription("Setup the server entry verification card (Admins only)")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addChannelOption(option =>
        option.setName("channel")
          .setDescription("Where to send the verification box")
          .setRequired(true)
      ),

    // NEW: 7. /catfact
    new SlashCommandBuilder()
      .setName("catfact")
      .setDescription("Get a random fun cat fact!"),

    // NEW: 8. /warn
    new SlashCommandBuilder()
      .setName("warn")
      .setDescription("Issue a formal warning to a user (Moderators only)")
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
      .addUserOption(option =>
        option.setName("user")
          .setDescription("The user to warn")
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName("reason")
          .setDescription("Reason for the warning")
          .setRequired(false)
      ),

    // NEW: 9. /timeout
    new SlashCommandBuilder()
      .setName("timeout")
      .setDescription("Place a user in timeout/mute (Moderators only)")
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption(option =>
        option.setName("user")
          .setDescription("The user to mute")
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option.setName("duration")
          .setDescription("Timeout duration in minutes")
          .setRequired(true)
          .addChoices(
            { name: "60 Seconds", value: 1 },
            { name: "5 Minutes", value: 5 },
            { name: "10 Minutes", value: 10 },
            { name: "1 Hour", value: 60 },
            { name: "1 Day", value: 1440 },
            { name: "1 Week", value: 10080 }
          )
      )
      .addStringOption(option =>
        option.setName("reason")
          .setDescription("Reason for muting")
          .setRequired(false)
      ),

    // NEW: 10. /kick
    new SlashCommandBuilder()
      .setName("kick")
      .setDescription("Kick a user from the server (Moderators only)")
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
      .addUserOption(option =>
        option.setName("user")
          .setDescription("The user to kick")
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName("reason")
          .setDescription("Reason for kicking")
          .setRequired(false)
      ),

    // NEW: 11. /ban
    new SlashCommandBuilder()
      .setName("ban")
      .setDescription("Permanently ban a user (Moderators only)")
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
      .addUserOption(option =>
        option.setName("user")
          .setDescription("The user to ban")
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option.setName("delete_messages_days")
          .setDescription("Number of days of message history to purge")
          .setRequired(false)
          .addChoices(
            { name: "Don't Delete", value: 0 },
            { name: "Previous 24 Hours", value: 1 },
            { name: "Previous 7 Days", value: 7 }
          )
      )
      .addStringOption(option =>
        option.setName("reason")
          .setDescription("Reason for banning")
          .setRequired(false)
      ),

    // NEW: 12. /cases
    new SlashCommandBuilder()
      .setName("cases")
      .setDescription("View moderation history for a user (Moderators only)")
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
      .addUserOption(option =>
        option.setName("user")
          .setDescription("The user to look up")
          .setRequired(true)
      ),

    // NEW: 13. /clean
    new SlashCommandBuilder()
      .setName("clean")
      .setDescription("Bulk delete messages with optional criteria filters (Moderators only)")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addIntegerOption(option =>
        option.setName("amount")
          .setDescription("Number of messages to analyze (1-100)")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(100)
      )
      .addStringOption(option =>
        option.setName("filter")
          .setDescription("Select advanced message type filter")
          .setRequired(false)
          .addChoices(
            { name: "Only Bot Messages", value: "only-bots" },
            { name: "Only Human Messages", value: "only-users" },
            { name: "Contains Web Links", value: "contain-links" },
            { name: "Contains Server Invites", value: "contain-invites" },
            { name: "Text Only (No embeds/media)", value: "text-only" }
          )
      )
      .addUserOption(option =>
        option.setName("user")
          .setDescription("Only delete messages sent by this user")
          .setRequired(false)
      )
  ].map(command => command.toJSON());

  const rest = new REST({ version: "10" }).setToken(token);

  try {
    console.log("Started refreshing application (/) commands.");
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );
    console.log("Successfully reloaded application (/) commands globally.");
  } catch (error) {
    console.error("Failed to deploy slash commands:", error);
  }
}
