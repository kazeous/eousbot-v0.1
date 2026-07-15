import {
  ActionRowBuilder,
  ActivityType,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  OverwriteType,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  Routes,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder
} from "discord.js";
import {
  getDynamicVoiceChannel,
  updateDynamicVoiceChannel
} from "./dynamicVoiceStore.js";

const PANEL_TITLE = "Voice Room Control Panel";
const REGION_OPTIONS = [
  ["auto", "Automatic"],
  ["brazil", "Brazil"],
  ["hongkong", "Hong Kong"],
  ["india", "India"],
  ["japan", "Japan"],
  ["rotterdam", "Rotterdam"],
  ["russia", "Russia"],
  ["singapore", "Singapore"],
  ["southafrica", "South Africa"],
  ["sydney", "Sydney"],
  ["us-central", "US Central"],
  ["us-east", "US East"],
  ["us-south", "US South"],
  ["us-west", "US West"]
];

const SETTINGS = [
  ["rename", "Change channel name", "Rename this room"],
  ["limit", "Set user limit", "Set 0 for unlimited"],
  ["status", "Set voice status", "Set the status shown on the voice channel"],
  ["game", "Use current game as name", "Rename the room to the owner's current game"],
  ["lfg", "Looking for teammates", "Set a ready-to-play status"],
  ["bitrate", "Set bitrate", "Change the audio bitrate in kbps"],
  ["region", "Set region", "Choose the RTC server region"],
  ["text", "Toggle text chat", "Allow or block messages in this voice channel"],
  ["nsfw", "Toggle NSFW", "Toggle the channel's age-restricted flag"],
  ["inherit", "Inherit category permissions", "Sync permissions from the parent category"]
];

const PERMISSIONS = [
  ["lock", "Lock channel", "Prevent everyone from joining"],
  ["unlock", "Unlock channel", "Allow everyone to join"],
  ["allow_user", "Allow a user", "Allow one user to join"],
  ["allow_role", "Allow a role", "Allow a role to join"],
  ["deny_user", "Deny a user", "Prevent one user from joining"],
  ["deny_role", "Deny a role", "Prevent a role from joining"],
  ["invite", "Invite a user", "Grant access and send a one-use invite"],
  ["hide", "Hide channel", "Hide this room from @everyone"],
  ["unhide", "Un-hide channel", "Make this room visible again"],
  ["transfer", "Transfer ownership", "Give control to another member"]
];

function panelCustomId(kind, channelId) {
  return `voice_${kind}:${channelId}`;
}

function entityCustomId(channelId, action) {
  return `voice_entity:${channelId}:${action}`;
}

function modalCustomId(channelId, action) {
  return `voice_modal:${channelId}:${action}`;
}

function getPanelMessage(message) {
  if (!message || !message.embeds?.length) return false;
  return message.embeds[0]?.title === PANEL_TITLE;
}

function makeSelect(customId, placeholder, options) {
  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(options.map(([value, label, description]) => ({ value, label, description })));
}

function formatBitrate(channel) {
  return channel.bitrate ? `${Math.round(channel.bitrate / 1000)} kbps` : "unknown";
}

function makePanel(channel, entry) {
  const owner = entry.ownerId ? `<@${entry.ownerId}>` : "not recorded (administrator only)";
  const everyonePermissions = channel.permissionsFor?.(channel.guild.roles.everyone);
  const textDisabled = everyonePermissions ? !everyonePermissions.has(PermissionFlagsBits.SendMessages) : false;
  const hidden = everyonePermissions ? !everyonePermissions.has(PermissionFlagsBits.ViewChannel) : false;
  const locked = everyonePermissions ? !everyonePermissions.has(PermissionFlagsBits.Connect) : false;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(PANEL_TITLE)
    .setDescription(
      `Manage **${channel.name}** from the menus below.\n` +
      `Owner: ${owner}\n\n` +
      "Only the owner and members with Manage Channels can use these controls."
    )
    .addFields(
      { name: "Current settings", value: [
        `Limit: **${channel.userLimit || "unlimited"}**`,
        `Bitrate: **${formatBitrate(channel)}**`,
        `Region: **${channel.rtcRegion || "automatic"}**`,
        `NSFW: **${channel.nsfw ? "yes" : "no"}**`,
        `Text chat: **${textDisabled ? "blocked" : "allowed"}**`
      ].join("\n"), inline: true },
      { name: "Channel access", value: [
        `Join: **${locked ? "locked" : "open"}**`,
        `Visibility: **${hidden ? "hidden" : "visible"}**`
      ].join("\n"), inline: true }
    )
    .setFooter({ text: "Room settings are saved with the channel and are removed when the room is deleted." });

  const settings = new ActionRowBuilder().addComponents(
    makeSelect(panelCustomId("settings", channel.id), "Change room settings", SETTINGS)
  );
  const permissions = new ActionRowBuilder().addComponents(
    makeSelect(panelCustomId("permissions", channel.id), "Change room permissions", PERMISSIONS)
  );
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(panelCustomId("refresh", channel.id))
      .setLabel("Refresh")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setLabel("Open channel")
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/channels/${channel.guild.id}/${channel.id}`)
  );

  return { embeds: [embed], components: [settings, permissions, buttons] };
}

export async function ensureVoiceControlPanel(channel, entry, client) {
  if (!channel?.isSendable?.()) return null;

  let message = null;
  if (entry.controlMessageId) {
    message = await channel.messages.fetch(entry.controlMessageId).catch(() => null);
    if (message && (message.author?.id !== client.user?.id || !getPanelMessage(message))) {
      message = null;
    }
  }

  if (!message) {
    const recent = await channel.messages.fetch({ limit: 50 }).catch(() => null);
    message = recent?.find(candidate => candidate.author?.id === client.user?.id && getPanelMessage(candidate)) || null;
  }

  const payload = makePanel(channel, entry);
  if (message) {
    await message.edit(payload);
  } else {
    message = await channel.send(payload);
  }

  if (message.id !== entry.controlMessageId) {
    updateDynamicVoiceChannel(channel.id, { controlMessageId: message.id });
  }
  return message;
}

function hasManageAccess(interaction, entry) {
  if (entry.ownerId && interaction.user.id === entry.ownerId) return true;
  const permissions = interaction.member?.permissions;
  return Boolean(permissions?.has(PermissionFlagsBits.ManageChannels) || permissions?.has(PermissionFlagsBits.Administrator));
}

async function getManagedChannel(interaction, client, channelId) {
  if (!interaction.guildId) return { error: "This control only works inside a server." };
  const entry = getDynamicVoiceChannel(channelId);
  if (!entry || entry.guildId !== interaction.guildId) return { error: "That voice room is no longer managed by the bot." };
  if (!hasManageAccess(interaction, entry)) return { error: "Only the room owner or a member with Manage Channels can use this control." };
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || channel.guildId !== interaction.guildId || channel.type !== ChannelType.GuildVoice) {
    return { error: "The voice room no longer exists." };
  }
  return { channel, entry };
}

async function replyError(interaction, message) {
  const payload = { content: `[!] ${message}`, ephemeral: true };
  if (interaction.deferred && !interaction.replied) {
    return interaction.editReply({ content: payload.content, components: [] }).catch(() => {});
  }
  if (interaction.replied) return interaction.followUp(payload).catch(() => {});
  return interaction.reply(payload).catch(() => {});
}

async function setVoiceStatus(client, channel, status) {
  await client.rest.put(Routes.channelVoiceStatus(channel.id), {
    body: { status: status || null }
  });
}

async function refresh(channel, entry, client) {
  const latest = getDynamicVoiceChannel(channel.id) || entry;
  await ensureVoiceControlPanel(channel, latest, client);
}

function editOverwrite(channel, targetId, permissions, reason, type = OverwriteType.Member) {
  return channel.permissionOverwrites.edit(targetId, permissions, { reason, type });
}

async function preserveControllerAccess(channel, entry, permissions, reason) {
  const targetIds = new Set([entry.ownerId, channel.guild.members.me?.id].filter(Boolean));
  for (const targetId of targetIds) {
    await editOverwrite(channel, targetId, permissions, reason);
  }
}

function modalFor(channelId, action) {
  const labels = {
    rename: ["Change channel name", "Name", "Example: Gaming Lounge", 100],
    limit: ["Set user limit", "Limit", "0 for unlimited (maximum 99)", 2],
    status: ["Set voice status", "Status", "Leave empty to clear the status", 500],
    bitrate: ["Set bitrate", "Bitrate (kbps)", "Example: 96", 4]
  };
  const [title, label, placeholder, maxLength] = labels[action];
  const input = new TextInputBuilder()
    .setCustomId("value")
    .setLabel(label)
    .setPlaceholder(placeholder)
    .setStyle(TextInputStyle.Short)
    .setRequired(action !== "status")
    .setMaxLength(maxLength);
  return new ModalBuilder()
    .setCustomId(modalCustomId(channelId, action))
    .setTitle(title)
    .addComponents(new ActionRowBuilder().addComponents(input));
}

function entityMenu(channelId, action) {
  const isRole = action.endsWith("_role");
  const menu = isRole
    ? new RoleSelectMenuBuilder().setCustomId(entityCustomId(channelId, action))
    : new UserSelectMenuBuilder().setCustomId(entityCustomId(channelId, action));
  return new ActionRowBuilder().addComponents(menu.setMinValues(1).setMaxValues(1));
}

async function selectRegion(interaction, channelId, client) {
  await interaction.deferReply({ ephemeral: true });
  const available = await client.fetchVoiceRegions().catch(() => null);
  const regionOptions = available?.size
    ? [...available.values()]
      .filter(region => !region.deprecated)
      .sort((left, right) => left.name.localeCompare(right.name))
      .slice(0, 24)
      .map(region => [region.id, region.name])
    : REGION_OPTIONS.slice(1);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(entityCustomId(channelId, "region"))
    .setPlaceholder("Choose a voice region")
    .addOptions([["auto", "Automatic"], ...regionOptions].map(([value, label]) => ({ value, label })));
  return interaction.editReply({
    content: "Select the RTC region for this room:",
    components: [new ActionRowBuilder().addComponents(menu)]
  });
}

async function applyEntityAction(interaction, client, channel, entry, action, targetId) {
  const reason = `Voice room control by ${interaction.user.tag}`;
  if (["allow_user", "allow_role"].includes(action)) {
    const type = action.endsWith("_role") ? OverwriteType.Role : OverwriteType.Member;
    await editOverwrite(channel, targetId, { ViewChannel: true, Connect: true }, reason, type);
    return "The selected member or role can now see and join the room.";
  }
  if (["deny_user", "deny_role"].includes(action)) {
    if (action === "deny_user" && (targetId === entry.ownerId || targetId === channel.guild.members.me?.id)) {
      throw new Error("The room owner and the bot cannot be denied access.");
    }
    const type = action.endsWith("_role") ? OverwriteType.Role : OverwriteType.Member;
    await editOverwrite(channel, targetId, { Connect: false }, reason, type);
    await preserveControllerAccess(channel, entry, { ViewChannel: true, Connect: true }, reason);
    return "The selected member or role can no longer join the room.";
  }
  if (action === "invite") {
    const member = await channel.guild.members.fetch(targetId).catch(() => null);
    if (!member || member.user.bot) throw new Error("Choose a real server member.");
    await editOverwrite(channel, targetId, {
      ViewChannel: true,
      Connect: true,
      Speak: true,
      UseVAD: true
    }, reason);
    const invite = await channel.createInvite({ maxAge: 86400, maxUses: 1, unique: true, reason });
    const dmSent = await member.send(`You were invited to **${channel.name}**: ${invite.url}`).then(() => true).catch(() => false);
    return `Access granted. A one-use invite was created${dmSent ? " and sent by DM" : "; I could not send a DM"}.`;
  }
  if (action === "transfer") {
    const member = await channel.guild.members.fetch(targetId).catch(() => null);
    if (!member || member.user.bot) throw new Error("Choose a real server member.");
    await editOverwrite(channel, member.id, {
      ViewChannel: true,
      Connect: true,
      Speak: true,
      Stream: true,
      UseVAD: true
    }, reason);
    updateDynamicVoiceChannel(channel.id, { ownerId: member.id });
    return `Ownership transferred to ${member}.`;
  }
  if (action === "region") {
    await channel.setRTCRegion(targetId === "auto" ? null : targetId, reason);
    return `RTC region set to **${targetId === "auto" ? "automatic" : targetId}**.`;
  }
  throw new Error("Unsupported selection.");
}

async function handleSettings(interaction, client, channel, entry, action) {
  if (["rename", "limit", "status", "bitrate"].includes(action)) {
    return interaction.showModal(modalFor(channel.id, action));
  }
  if (action === "region") return selectRegion(interaction, channel.id, client);

  await interaction.deferReply({ ephemeral: true });
  const reason = `Voice room control by ${interaction.user.tag}`;
  if (action === "game") {
    const owner = await channel.guild.members.fetch(entry.ownerId).catch(() => null);
    const activity = owner?.presence?.activities?.find(item => item.type === ActivityType.Playing && item.name);
    if (!activity) return interaction.editReply({ content: "The owner has no visible game activity right now." });
    await channel.setName(activity.name.slice(0, 100), reason);
    await refresh(channel, entry, client);
    return interaction.editReply({ content: `Room renamed to **${activity.name.slice(0, 100)}**.` });
  }
  if (action === "lfg") {
    await setVoiceStatus(client, channel, "Looking for teammates");
    await refresh(channel, entry, client);
    return interaction.editReply({ content: "Voice status set to **Looking for teammates**." });
  }
  if (action === "nsfw") {
    await channel.setNSFW(!channel.nsfw, reason);
    await refresh(channel, entry, client);
    return interaction.editReply({ content: `NSFW is now **${channel.nsfw ? "enabled" : "disabled"}**.` });
  }
  if (action === "text") {
    const textAllowed = channel.permissionsFor(channel.guild.roles.everyone)?.has(PermissionFlagsBits.SendMessages) === true;
    await editOverwrite(channel, channel.guild.id, { SendMessages: !textAllowed }, reason, OverwriteType.Role);
    await preserveControllerAccess(channel, entry, { SendMessages: true, ReadMessageHistory: true }, reason);
    await refresh(channel, entry, client);
    return interaction.editReply({ content: `Text chat is now **${textAllowed ? "blocked" : "allowed"}** for @everyone.` });
  }
  if (action === "inherit") {
    if (!channel.parent) throw new Error("This room has no category to inherit permissions from.");
    await channel.lockPermissions();
    await preserveControllerAccess(channel, entry, {
      ViewChannel: true,
      Connect: true,
      Speak: true,
      Stream: true,
      UseVAD: true,
      SendMessages: true,
      ReadMessageHistory: true
    }, reason);
    await refresh(channel, entry, client);
    return interaction.editReply({ content: "Category permissions inherited. Owner and bot access were restored." });
  }
  throw new Error("Unsupported setting.");
}

async function handlePermissions(interaction, client, channel, entry, action) {
  const reason = `Voice room control by ${interaction.user.tag}`;
  if (["allow_user", "allow_role", "deny_user", "deny_role", "invite", "transfer"].includes(action)) {
    return interaction.reply({
      content: "Choose a member or role:",
      components: [entityMenu(channel.id, action)],
      ephemeral: true
    });
  }
  await interaction.deferReply({ ephemeral: true });
  if (action === "lock") {
    await editOverwrite(channel, channel.guild.id, { Connect: false }, reason, OverwriteType.Role);
    await preserveControllerAccess(channel, entry, { ViewChannel: true, Connect: true }, reason);
    await refresh(channel, entry, client);
    return interaction.editReply({ content: "The room is now locked for @everyone." });
  }
  if (action === "unlock") {
    await editOverwrite(channel, channel.guild.id, { Connect: true }, reason, OverwriteType.Role);
    await refresh(channel, entry, client);
    return interaction.editReply({ content: "The room is now unlocked for @everyone." });
  }
  if (action === "hide") {
    await editOverwrite(channel, channel.guild.id, { ViewChannel: false }, reason, OverwriteType.Role);
    await preserveControllerAccess(channel, entry, {
      ViewChannel: true,
      Connect: true,
      SendMessages: true,
      ReadMessageHistory: true
    }, reason);
    await refresh(channel, entry, client);
    return interaction.editReply({ content: "The room is hidden from @everyone; the owner and bot can still access it." });
  }
  if (action === "unhide") {
    await editOverwrite(channel, channel.guild.id, { ViewChannel: true }, reason, OverwriteType.Role);
    await refresh(channel, entry, client);
    return interaction.editReply({ content: "The room is visible to @everyone again." });
  }
  throw new Error("Unsupported permission action.");
}

async function handleModal(interaction, client, channelId, action) {
  const managed = await getManagedChannel(interaction, client, channelId);
  if (managed.error) return replyError(interaction, managed.error);
  const { channel, entry } = managed;
  const value = interaction.fields.getTextInputValue("value").trim();
  const reason = `Voice room control by ${interaction.user.tag}`;

  if (action === "rename") {
    if (!value) return replyError(interaction, "Channel name cannot be empty.");
    await interaction.deferReply({ ephemeral: true });
    await channel.setName(value, reason);
  } else if (action === "limit") {
    const limit = Number(value);
    if (!Number.isInteger(limit) || limit < 0 || limit > 99) return replyError(interaction, "User limit must be a whole number from 0 to 99.");
    await interaction.deferReply({ ephemeral: true });
    await channel.setUserLimit(limit, reason);
  } else if (action === "bitrate") {
    const kbps = Number(value);
    const tierMaximum = [96000, 128000, 256000, 384000][channel.guild.premiumTier] || 96000;
    const maxKbps = Math.floor((channel.guild.maximumBitrate || tierMaximum) / 1000);
    if (!Number.isInteger(kbps) || kbps < 8 || kbps > maxKbps) return replyError(interaction, `Bitrate must be a whole number from 8 to ${maxKbps} kbps for this server.`);
    await interaction.deferReply({ ephemeral: true });
    await channel.setBitrate(kbps * 1000, reason);
  } else if (action === "status") {
    if (value.length > 500) return replyError(interaction, "Voice status must be 500 characters or fewer.");
    await interaction.deferReply({ ephemeral: true });
    await setVoiceStatus(client, channel, value);
  } else {
    return replyError(interaction, "Unsupported setting.");
  }

  await refresh(channel, entry, client);
  return interaction.editReply({ content: "Room setting updated." });
}

export function registerVoiceControls(client) {
  client.on("interactionCreate", async interaction => {
    try {
      if (interaction.isModalSubmit() && interaction.customId.startsWith("voice_modal:")) {
        const [, channelId, action] = interaction.customId.split(":");
        return await handleModal(interaction, client, channelId, action);
      }

      const isComponent = interaction.isButton() || interaction.isStringSelectMenu() || interaction.isUserSelectMenu() || interaction.isRoleSelectMenu();
      if (!isComponent) return;
      if (interaction.message?.author?.id !== client.user?.id) return;

      const customId = interaction.customId;
      if (!customId.startsWith("voice_")) return;
      const parts = customId.split(":");
      const kind = parts[0];
      const channelId = parts[1];
      const action = parts[2] || interaction.values?.[0];
      const managed = await getManagedChannel(interaction, client, channelId);
      if (managed.error) return replyError(interaction, managed.error);
      const { channel, entry } = managed;

      if (kind === "voice_refresh") {
        await interaction.deferReply({ ephemeral: true });
        await refresh(channel, entry, client);
        return interaction.editReply({ content: "Control panel refreshed." });
      }
      if (kind === "voice_settings" && interaction.isStringSelectMenu()) {
        return await handleSettings(interaction, client, channel, entry, interaction.values[0]);
      }
      if (kind === "voice_permissions" && interaction.isStringSelectMenu()) {
        return await handlePermissions(interaction, client, channel, entry, interaction.values[0]);
      }
      if (kind === "voice_entity") {
        const targetId = interaction.values?.[0];
        await interaction.deferUpdate();
        const result = await applyEntityAction(interaction, client, channel, entry, action, targetId);
        await refresh(channel, getDynamicVoiceChannel(channel.id) || entry, client);
        return interaction.editReply({ content: `[ok] ${result}`, components: [] });
      }
    } catch (error) {
      console.error("Voice control interaction error:", error);
      await replyError(interaction, error.message || "The room control could not be applied.");
    }
  });
}
